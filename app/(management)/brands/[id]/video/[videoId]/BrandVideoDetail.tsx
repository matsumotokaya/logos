"use client";

// One V2 video Take under a brand. This component renders the matching surface:
//
//   event-promo → EventVideoWorkspace (goal + material slots)
//   product-cm with no pinned voice → the campaign narration screen
//   product-cm with pinned voice → the V2 render/publication workspace
//
// The narration screen remains the authoring entry point. Once it produces a
// voice track, the Take becomes self-contained and the V2 workspace takes over.
//
// A Slide-Factory pipeline bar sits above the workspace for the two surfaces
// that have one. Read-only by intent: actions stay on the screens that own
// them (the brief editor, the template picker, the render button), and the
// bar is what shows the user what each stage is waiting on
// (deliverable-architecture §17.3, §17.6).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { videoFetch } from "@/lib/video/client";
import { cn } from "@/lib/cn";
import CampaignDetail from "@/app/campaigns/[id]/CampaignDetail";
import EventVideoWorkspace from "@/components/video/EventVideoWorkspace";
import EventCmWorkspace from "@/components/video/EventCmWorkspace";
import NarrationDialog from "@/components/video/NarrationDialog";
import BgmDialog from "@/components/video/BgmDialog";
import { DEFAULT_ASSETS } from "@/lib/assets/defaults";
import { narrationVoiceByName } from "@/lib/narration/voices";
import { panelDeletion } from "@/lib/event-cm/panel-actions";
import {
  bakeState,
  pendingFilmSteps,
  renderIsBehind,
  type FilmStep,
} from "@/lib/event-cm/bake";
import { eventCmFilm } from "@/remotion/event-cm/film";
import { EVENT_WIDTH, EVENT_HEIGHT } from "@/remotion/event/palette";
import type { FactEdit } from "@/components/video/FactList";
import BriefSourceIntake, { type BriefSource } from "@/components/video/BriefSourceIntake";
import TitleOffer from "@/components/video/TitleOffer";
import { titleOffer } from "@/lib/event-cm/title";
import FactList from "@/components/video/FactList";
import BusyBar from "@/components/pipeline/BusyBar";
import RunOverlay, { type RunCard } from "@/components/pipeline/RunOverlay";
import StageAction from "@/components/pipeline/StageAction";
import { ExtractResults, StructureResults } from "@/components/pipeline/StageResults";
import type { RunnableStage } from "@/app/api/brands/[id]/videos/[videoId]/run/[stage]/route";

/** What the run card calls each step while it is running. */
const STAGE_RUN_LABEL: Record<RunnableStage, string> = {
  extract: "資料を読み取る",
  structure: "内容を構造化する",
  map: "動画へ反映する",
};
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import type { TakeRunRecord } from "@/app/api/brands/[id]/videos/[videoId]/runs/route";
import PipelineBar from "@/components/pipeline/PipelineBar";
import StageDrawer from "@/components/pipeline/StageDrawer";
import VideoPipelinePanel, {
  type VideoPipelinePayload,
} from "@/components/pipeline/VideoPipelinePanel";
import type { PipelineStage } from "@/lib/pipeline/stages";
import { VIDEO_STATE_LABEL, type VideoState } from "@/lib/video/asset";
import type { VideoTemplateId } from "@/lib/video/templates";
import type { EventBrief } from "@/remotion/event/types";
import type { EventCmBrief, EventCmSceneRole } from "@/remotion/event-cm/types";

type VideoAsset = {
  id: string;
  brandId: string;
  /** The brand this video belongs to, for the breadcrumb. */
  brandName: string | null;
  title: string;
  template: VideoTemplateId;
  templateName: string;
  published: boolean;
  publicUrl: string | null;
  briefSlug: string | null;
  /** One of the known template shapes, or an unknown record for the rest. Both
   *  event briefs are named because they are no longer one type: `EventCmBrief`
   *  stopped extending `EventBrief` (remotion/event-cm/types.ts). */
  brief: EventBrief | EventCmBrief | Record<string, unknown> | null;
  /** The brief a run fixed — what the player runs. Null = never run. */
  bakedBrief: Record<string, unknown> | null;
  bakedAt: string | null;
  campaignJobId: string | null;
  /** Materials the brief points at that are not pinned to this take. The
   *  preview cannot fetch them, so say so rather than let the player fail
   *  silently — an empty slot here would read as a designed fallback. */
  unresolvedMaterials?: string[];
  /** material:<uuid> → the signed URL the server resolved it to. */
  materialUrls?: Record<string, string>;
  state: VideoState;
  createdAt: string;
  render: { status: "running" | "done" | "error"; error: string | null; renderedAt: string | null } | null;
  /** Signed same-origin URL of the MP4 in R2, when one has been rendered. */
  mp4Url: string | null;
};

/** A render takes minutes; poll while one is in flight. */
const RENDER_POLL_MS = 5000;

type Resolved = { kind: "asset"; video: VideoAsset };

function hasPinnedProductVoice(brief: VideoAsset["brief"]): boolean {
  if (!brief || typeof brief !== "object") return false;
  const voice = (brief as Record<string, unknown>).voice;
  if (!voice || typeof voice !== "object") return false;
  return (
    typeof (voice as Record<string, unknown>).track === "object" &&
    typeof (voice as Record<string, unknown>).audio === "string"
  );
}

/**
 * Return the work that the unattended path can still do.
 *
 * The map stage has a seeded brief from the moment a Take is created, so its
 * raw status can look ready while it is still waiting for structure to finish.
 * Count that dependency here as well; the number must match what the button
 * will actually run, not just what the seeded brief happens to contain.
 */
function pendingRunStages(
  stages: PipelineStage[],
  sourceCount: number,
): RunnableStage[] {
  if (sourceCount === 0) return [];

  const input = stages.find((stage) => stage.id === "input");
  const structure = stages.find((stage) => stage.id === "structure");
  const map = stages.find((stage) => stage.id === "map");
  if (!input || !structure || !map) return [];

  const pending: RunnableStage[] = [];
  const inputPending = input.status !== "ready";
  const structurePending = inputPending || structure.status !== "ready";
  const mapPending = structurePending || map.status !== "ready";

  if (inputPending) pending.push("extract");
  if (structurePending) pending.push("structure");
  if (mapPending) pending.push("map");
  return pending;
}

function ProductCmInputSection({
  brandId,
  videoId,
}: {
  brandId: string;
  videoId: string;
}) {
  // The button paths the user out to CM Maker (top page) so the LLM-driven
  // pipeline can build a fresh Brand Kit, then comes back to this page after
  // the user runs the voice step in the Maker. The Maker page already accepts
  // a `resumeFor={videoId}` query parameter — see app/page.tsx.
  return (
    <section className="rounded-2xl border border-hairline p-5">
      <h2 className="text-balance text-sm font-semibold">Product CM入力</h2>
      <p className="mt-2 text-pretty text-xs text-ink-muted">
        Brand Kit、ナレーションタイミング、固定済みWAVをTakeが保持します。
        MP4の再生成はローカルのキャンペーンジョブに依存しません。
      </p>
      <p className="mt-2 text-pretty text-xs text-ink-muted">
        このTakeはまだ音声が固定されていません。下のどちらかから始めて、Brand KitとWAVが揃ったあと、ページ上部の「MP4を作成」で書き出します。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/?resumeFor=${encodeURIComponent(videoId)}`}
          className="rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-paper transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          CM Makerで再生成する →
        </Link>
        <Link
          href={`/brands/${brandId}/video`}
          className="rounded-full border border-hairline px-5 py-2.5 text-xs font-semibold transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          動画一覧に戻る
        </Link>
      </div>
      <p className="mt-3 font-mono text-[10px] text-ink-faint">
        {videoId}
      </p>
    </section>
  );
}

export default function BrandVideoDetail({
  brandId,
  videoId,
}: {
  brandId: string;
  videoId: string;
}) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * What just happened, said where it can still be read.
   *
   * A destructive action cannot report itself from the surface it destroys: the
   * panel that held 「削除する」 unmounts the moment the brief comes back, so a
   * confirmation inside it would flash and vanish. Deleting the sixth picture
   * gave no feedback at all for exactly that reason. Announced as a status and
   * given focus, because the thing the user was looking at is gone and the
   * keyboard needs somewhere to land.
   */
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * What the page is waiting for, in the user's words.
   *
   * Paired with `saving` rather than replacing it: `saving` disables controls,
   * this names the reason. Set through `busy()` so no long step can be added
   * without saying what it is.
   */
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const busy = (label: string) => {
    setSaving(true);
    setBusyLabel(label);
    // A new attempt clears the last complaint: a banner left over from the
    // previous failure reads as though this one had failed too.
    setError(null);
  };
  const idle = () => {
    setSaving(false);
    setBusyLabel(null);
  };
  const [pipeline, setPipeline] = useState<
    (VideoPipelinePayload & { stages: PipelineStage[] }) | null
  >(null);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [sources, setSources] = useState<BriefSource[]>([]);
  const [runs, setRuns] = useState<TakeRunRecord[]>([]);
  const [runCards, setRunCards] = useState<RunCard[]>([]);

  // The workbench and the film, as a pair.
  //
  // Derived here, above everything that reads either of them, because the whole
  // screen turns on the difference: the storyboard edits the first, the player
  // runs the second, and three separate surfaces (the badge, the notice under
  // the player, the tooltip) have to agree about the gap between them (§9.7).
  const eventCm =
    resolved?.video.template === "event-cm" && resolved.video.brief
      ? {
          working: resolved.video.brief as EventCmBrief,
          baked: (resolved.video.bakedBrief ?? null) as EventCmBrief | null,
        }
      : null;
  /** What the one button still owes the film. Never includes MP4 (§9.4). */
  const filmSteps: FilmStep[] = eventCm
    ? pendingFilmSteps(eventCm.working, eventCm.baked)
    : [];
  const bake = eventCm ? bakeState(eventCm.working, eventCm.baked) : null;

  // Returns what it read as well as storing it: a multi-step run has to decide
  // its next step from the brief the previous step just wrote, and React state
  // set inside the same callback is not visible to the rest of that callback.
  const load = useCallback(async (): Promise<Resolved | null> => {
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "動画を取得できませんでした");
      }
      const next = (await res.json()) as Resolved;
      setResolved(next);
      setError(null);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "動画を取得できませんでした");
      return null;
    }
  }, [brandId, videoId]);

  useEffect(() => {
    // Kept off the synchronous effect path (same as CampaignDetail): setState
    // during the effect body triggers cascading renders.
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Keep polling while the MP4 render runs, so the player appears on its own.
  const rendering = resolved?.kind === "asset" && resolved.video.render?.status === "running";
  useEffect(() => {
    if (!rendering) return;
    const timer = setInterval(() => void load(), RENDER_POLL_MS);
    return () => clearInterval(timer);
  }, [rendering, load]);

  // The pipeline is derived from the same rows the video page reads, so
  // a successful take load is enough to fetch it. Re-fetching after each
  // load() keeps the bar honest when a render completes or the brief is
  // saved — a missing field there means a stale stage.
  useEffect(() => {
    if (!resolved || resolved.kind !== "asset") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await videoFetch(
          `/api/brands/${brandId}/videos/${videoId}/pipeline`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          pipeline?: VideoPipelinePayload & { stages: PipelineStage[] };
        };
        if (!cancelled && body.pipeline) setPipeline(body.pipeline);
      } catch {
        // A read failure here does not block the video page; the bar simply
        // stays in its previous state until the next successful fetch.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolved, brandId, videoId, rendering]);

  async function startRender() {
    busy("MP4を書き出しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/render`, {
        method: "POST",
      });
      if (!res.ok && res.status !== 202) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "MP4の作成を開始できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "MP4の作成を開始できませんでした");
    } finally {
      idle();
    }
  }

  // Writing the scenario is what turns a seeded film into this event's film:
  // the scene lengths stop being budgets and start following the words.
  /**
   * Draft the whole scenario again.
   *
   * `force` is what makes this reachable at all once somebody has edited a line:
   * the endpoint refuses to overwrite a hand-written scenario unless told to, and a
   * film whose shape changed under a human-edited scenario would otherwise have no
   * way back to a complete scenario. The caller is the one that warns.
   */
  async function writeScenario(force = false): Promise<boolean> {
    busy("シナリオを書いています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(force ? { force: true } : {}),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "シナリオを作成できませんでした");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "シナリオを作成できませんでした");
      return false;
    } finally {
      idle();
    }
  }

  /**
   * Fix the workbench as the film.
   *
   * The one step of the whole page that changes what somebody watching sees.
   * Everything else — reading a flyer, correcting a date, rewriting a line,
   * recording a voice — writes the working brief and leaves the player alone
   * (§9.5).
   */
  async function bakeFilm(): Promise<boolean> {
    busy("動画に反映しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/bake`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "動画に反映できませんでした");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "動画に反映できませんでした");
      return false;
    } finally {
      idle();
    }
  }

  /**
   * Save one panel's scenario line.
   *
   * The server marks the whole scenario `human` and drops the recording, which is
   * what makes the shape of the work right: correct a few lines, then re-record
   * once. A voice still reading the old words would be worse than silence.
   */
  async function editScenario(
    scene: { role: EventCmSceneRole; index?: number },
    text: string,
  ): Promise<boolean> {
    busy("シナリオを保存しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/scenario`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: [{ ...scene, text }] }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "シナリオを保存できませんでした");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "シナリオを保存できませんでした");
      return false;
    } finally {
      idle();
    }
  }

  /**
   * Remove one picture from the film.
   *
   * The rule is the template's (lib/event-cm/panel-actions.ts) and it is applied
   * through the ordinary fact edits, so nothing here is a second way to write a
   * brief: switching the speakers off is the same suppression the list does, and
   * removing a programme is the same edit as retyping the list without it.
   */
  async function deletePanel(scene: {
    role: EventCmSceneRole;
    index?: number;
  }): Promise<boolean> {
    const brief = resolved?.video.brief as EventCmBrief | undefined;
    if (!brief) return false;
    const decision = panelDeletion(brief, scene);
    // Not reported through `setError`: that replaces the whole page, and a
    // refused delete is not a page that failed to load.
    if (!decision.can) return false;

    if (decision.kind === "suppress") {
      const ok = await editFact({ path: decision.path, suppressed: true });
      if (ok) {
        setNotice(
          "登壇者のコマを削除しました。登壇者の情報は残っているので、下の一覧から戻せます",
        );
      }
      return ok;
    }
    // A programme picture exists because the programme does, so the picture goes
    // when the item does. The narration then describes an evening with one fewer
    // item, which `scenarioIsStale` reports and the mapping stage rewrites.
    const removed = brief.programs[decision.index]?.title ?? "";
    const ok = await editFact({
      path: "programs",
      lines: brief.programs
        .filter((_, index) => index !== decision.index)
        .map((program) => program.title),
    });
    if (ok) {
      setNotice(
        `プログラム「${removed}」のコマを削除しました。言う内容が変わったので、シナリオは書き直しが必要です`,
      );
    }
    return ok;
  }

  useEffect(() => {
    if (!notice) return;
    noticeRef.current?.focus();
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadSources = useCallback(async () => {
    const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/materials`);
    if (!res.ok) return;
    const body = (await res.json()) as { materials?: BriefSource[] };
    setSources(body.materials ?? []);
  }, [brandId, videoId]);

  const loadRuns = useCallback(async () => {
    const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/runs`);
    if (!res.ok) return;
    const body = (await res.json()) as { runs?: TakeRunRecord[] };
    setRuns(body.runs ?? []);
  }, [brandId, videoId]);

  // Kept off the synchronous effect path, same as the take load: setting state
  // during the effect body triggers cascading renders.
  useEffect(() => {
    if (resolved?.kind !== "asset" || resolved.video.template !== "event-cm") return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadSources();
      if (!cancelled) await loadRuns();
    })();
    return () => {
      cancelled = true;
    };
  }, [resolved, loadSources, loadRuns]);

  async function submitSource(
    init: RequestInit,
    options: { showError?: boolean } = {},
  ): Promise<boolean> {
    busy("資料を登録しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/materials`, {
        ...init,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "素材を追加できませんでした");
      }
      await loadSources();
      await load();
      return true;
    } catch (e) {
      if (options.showError !== false) {
        setError(e instanceof Error ? e.message : "素材を追加できませんでした");
      }
      return false;
    } finally {
      idle();
    }
  }

  async function addSource(
    body: Record<string, unknown>,
    options: { showError?: boolean } = {},
  ): Promise<boolean> {
    return submitSource(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options,
    );
  }

  async function addFileSource(file: File, label: string): Promise<boolean> {
    const form = new FormData();
    form.append("file", file, label);
    form.append("label", label);
    form.append("mediaType", file.type);
    form.append("lastModified", String(file.lastModified));
    return submitSource({ method: "POST", body: form }, { showError: false });
  }

  async function removeSource(materialId: string) {
    busy("資料を外しています…");
    try {
      await videoFetch(
        `/api/brands/${brandId}/videos/${videoId}/materials?materialId=${materialId}`,
        { method: "DELETE" },
      );
      await loadSources();
      await load();
    } finally {
      idle();
    }
  }

  const dismissRun = useCallback(
    (id: string) => setRunCards((cards) => cards.filter((card) => card.id !== id)),
    [],
  );

  const appendLine = (id: string, line: string) =>
    setRunCards((cards) =>
      cards.map((card) =>
        card.id === id ? { ...card, lines: [...card.lines, line] } : card,
      ),
    );

  /**
   * Run one stage, narrating it.
   *
   * The card is the answer to pressing a button and seeing nothing: it appears
   * immediately, says what is happening, and reports what changed. Success
   * clears itself after ten seconds; failure stays until dismissed. Either way
   * the run is in take_runs and shows up in the log at the bottom of the stage.
   */
  async function runStage(stage: RunnableStage): Promise<boolean> {
    const id = `${stage}-${Date.now()}`;
    const label = STAGE_RUN_LABEL[stage];
    setRunCards((cards) => [
      ...cards,
      { id, label, status: "running", lines: [], startedAt: Date.now(), endedAt: null },
    ]);
    busy(`${label}…`);
    setError(null);

    const settle = (status: "succeeded" | "failed", error?: string) =>
      setRunCards((cards) =>
        cards.map((card) =>
          card.id === id ? { ...card, status, endedAt: Date.now(), error } : card,
        ),
      );

    try {
      appendLine(id, `${sources.length}件の資料を対象に開始`);
      const res = await videoFetch(
        `/api/brands/${brandId}/videos/${videoId}/run/${stage}`,
        { method: "POST" },
      );
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        sources?: Array<{ label: string; mode: string; chars: number }>;
        applied?: Array<{ label: string; before: string; after: string }>;
        foundCount?: number;
        dropped?: Array<{ field: string; value: string; reason: string }>;
        keptUserValues?: string[];
        scenarioRewritten?: boolean;
        scenarioKept?: boolean;
        images?: { sent: number; judged: number };
        placedImages?: Array<{ label: string; materialLabel: string; reason: string }>;
        unusedImages?: Array<{ label: string; reason: string }>;
        note?: string | null;
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "実行できませんでした");

      if (stage === "structure") {
        appendLine(id, `資料から${json?.foundCount ?? 0}項目を読み取りました`);
        if (json?.images && json.images.sent > 0) {
          appendLine(
            id,
            `画像${json.images.sent}枚を渡し、${json.images.judged}枚を判定しました`,
          );
        }
        for (const drop of json?.dropped ?? []) {
          appendLine(id, `除外: ${drop.value}（${drop.reason}）`);
        }
        if (json?.note) appendLine(id, `読み取りメモ: ${json.note}`);
      } else if (stage === "extract") {
        for (const source of json?.sources ?? []) {
          appendLine(
            id,
            source.mode === "text"
              ? `読み取り: ${source.label}（${source.chars}字）`
              : source.mode === "passthrough"
                ? `次の段で直接読む: ${source.label}`
                : `対象外: ${source.label}`,
          );
        }
      } else {
        const applied = json?.applied ?? [];
        if (applied.length === 0) {
          appendLine(id, "資料から新しく分かったことはありませんでした");
        }
        for (const field of applied) {
          appendLine(id, `${field.label}: ${field.before || "（空）"} → ${field.after}`);
        }
        for (const kept of json?.keptUserValues ?? []) {
          appendLine(id, `あなたが決めた値のまま: ${kept}`);
        }
        // Both halves of the picture pass. A run that placed nothing still has
        // to say what it did with each image, or "画像が反映されない" has no
        // answer anywhere on the screen.
        for (const image of json?.placedImages ?? []) {
          appendLine(id, `${image.label}: ${image.materialLabel}（${image.reason}）`);
        }
        for (const image of json?.unusedImages ?? []) {
          appendLine(id, `未使用: ${image.label}（${image.reason}）`);
        }
        if (json?.scenarioRewritten) {
          appendLine(id, "シナリオを新しい内容で書き直しました");
          appendLine(id, "音声は作り直しが必要です");
        }
        if (json?.scenarioKept) {
          appendLine(id, "編集済みのシナリオはそのままにしました");
        }
        if (json?.note) appendLine(id, `読み取りメモ: ${json.note}`);
      }

      settle("succeeded");
      await load();
      await loadRuns();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "実行できませんでした";
      appendLine(id, message);
      settle("failed", message);
      await loadRuns();
      return false;
    } finally {
      idle();
    }
  }

  /**
   * Run everything, in order, and finish by making it the film.
   *
   *   資料 → 読み取り → 事実 → シナリオ → 読み上げ → 反映
   *
   * One button, one chain (§9.6). MP4 is deliberately not on it: exporting is
   * outside the chain (§9.4), and including it would spend several minutes of
   * rendering every time somebody tried a different voice.
   *
   * Unfinished steps first. With nothing unfinished it runs the whole thing
   * again from the top, because "everything has been done" is not the same as
   * "there is nothing you could want to do": every stage here is a model call,
   * and a reading that came out slightly wrong is an ordinary reason to ask
   * again. A button that refuses at exactly that moment makes the user hunt for
   * a way to re-run something they can see is re-runnable.
   *
   * Stops at the first failure rather than carrying on: a structuring step
   * that could not read the flyer has nothing for the mapping step to apply,
   * and running it anyway would report a second, confusing error. The film the
   * user is watching is untouched by a run that stopped halfway, because
   * nothing is watched until the last step.
   */
  async function runAll() {
    const stagesPending = pendingRunStages(pipeline?.stages ?? [], sources.length);
    // Asked with nothing outstanding: do it all again, words and voice included.
    const redo = stagesPending.length === 0 && filmSteps.length === 0;
    const stages: RunnableStage[] =
      stagesPending.length > 0 ? stagesPending : ["extract", "structure", "map"];
    for (const stage of stages) {
      const ok = await runStage(stage);
      if (!ok) return;
    }
    await runFilmSteps({ redo });
  }

  /**
   * The film half of the chain: scenario → voice → fix.
   *
   * Its own function because two controls reach it — the one button, and the
   * mapping drawer's step into the film stage (§9.6). Both ask
   * `pendingFilmSteps` rather than deciding for themselves, so a drawer cannot
   * run something the badge did not count.
   *
   * Reads the brief BACK before deciding, never the one the page was holding:
   * the mapping stage may have just rewritten the scenario, which changes what
   * is left to do.
   */
  async function runFilmSteps(options: { redo?: boolean } = {}): Promise<boolean> {
    const fresh = await load();
    const working = fresh?.video.brief as EventCmBrief | undefined;
    if (!working || fresh?.video.template !== "event-cm") return false;
    const steps = pendingFilmSteps(
      working,
      (fresh.video.bakedBrief ?? null) as EventCmBrief | null,
      options,
    );

    for (const step of steps) {
      const ok =
        step === "scenario"
          ? await writeScenario()
          : step === "voice"
            ? await speakScenario()
            : await bakeFilm();
      if (!ok) return false;
    }
    return true;
  }

  // The API keeps structure and map as separate, auditable runs. From the
  // input drawer they are one user intention: new material should reach the
  // storyboard. Keep the explicit map-stage button for users who want to
  // apply an already-recorded structure again.
  async function runStructureAndMap() {
    const structured = await runStage("structure");
    if (!structured) return;
    setOpenStage("map");
    await runStage("map");
  }

  // Correcting a fact, or switching one off. The film redraws from the saved
  // brief, so the change is visible in the player on the next load.
  async function editFact(edit: FactEdit): Promise<boolean> {
    busy("変更を保存しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/facts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "変更を保存できませんでした");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "変更を保存できませんでした");
      return false;
    } finally {
      idle();
    }
  }

  /** Answer the "rename this video to the event's title?" question. The server
   *  decides what each answer writes (lib/event-cm/title.ts). */
  async function answerTitleOffer(answer: "accept" | "decline") {
    busy("タイトルを保存しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleOffer: answer }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "タイトルを変更できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "タイトルを変更できませんでした");
    } finally {
      idle();
    }
  }

  // Speaking replaces the estimated timeline with the measured one. Returns
  // whether it worked, so the dialog that asked can say so and close itself.
  async function speakScenario(voiceId?: string): Promise<boolean> {
    busy("読み上げを作成しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voiceId ? { voiceId } : {}),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "読み上げを作成できませんでした");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み上げを作成できませんでした");
      return false;
    } finally {
      idle();
    }
  }

  /** Off: the film stops speaking and goes back to music and subtitles. The
   *  recording stays pinned to the take, so this is reversible. */
  async function turnNarrationOff(): Promise<boolean> {
    busy("読み上げを外しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/voice`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "読み上げを外せませんでした");
      }
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み上げを外せませんでした");
      return false;
    } finally {
      idle();
    }
  }

  async function togglePublished(next: boolean) {
    if (resolved?.kind !== "asset") return;
    busy(next ? "公開しています…" : "公開を終了しています…");
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "更新できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新できませんでした");
    } finally {
      idle();
    }
  }

  // The whole page is only replaced when there is no page: a video that could
  // not be loaded has nothing else to show. An action that failed — a line that
  // would not save, a run that errored — must NOT take the screen away. Saving
  // one scenario line used to throw the user onto an error page with a 「←
  // 動画一覧へ」 link, which reads as "this video is broken" rather than "that
  // save was refused", and loses the work in the textarea.
  if (error && !resolved) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700"
        >
          {error}
        </p>
        <Link href={`/brands/${brandId}/video`} className="mt-5 inline-block text-xs text-accent">
          ← 動画一覧へ
        </Link>
      </main>
    );
  }

  if (!resolved) {
    return <main className="px-6 py-10 text-sm text-ink-muted md:px-10">読み込み中…</main>;
  }

  const video = resolved.video;
  const openStageDef = pipeline?.stages.find((stage) => stage.id === openStage);
  const pendingStages = pendingRunStages(pipeline?.stages ?? [], sources.length);
  // One number for the whole chain. It used to count the three reading stages
  // only, so writing a scenario — the change that matters most — left the badge
  // reading 0 while the film was a version behind (§9.7).
  const pendingCount = pendingStages.length + filmSteps.length;
  // The exported file predates the film it claims to be of.
  const mp4Behind = renderIsBehind(video.render?.renderedAt ?? null, video.bakedAt);

  // Aspect, pixels, length. Computed here because the timeline is the film's
  // own (a scenario shortens or lengthens it), and shown with the other metadata
  // rather than over the picture. Read through eventCmFilm so the number here
  // is the number the player runs to — a raw-brief timeline once disagreed
  // with the film the moment a field was switched off.
  //
  // Of the PLAYED brief, not the workbench: the length beside the title is a
  // property of the film somebody can watch. Quoting the working brief's length
  // would move the number while the player kept running the old one.
  const eventCmMeta = (() => {
    if (video.template !== "event-cm" || !eventCm) return null;
    const film = eventCmFilm(eventCm.baked ?? eventCm.working);
    const seconds = (film.totalMs / 1000).toFixed(1);
    const measured = film.timingSource === "voice";
    return `16:9 / ${EVENT_WIDTH}×${EVENT_HEIGHT} / ${measured ? "" : "約"}${seconds}秒`;
  })();

  // A Product CM Take is created before narration is generated. Keep that
  // draft in the established authoring screen until the voice RPC pins the
  // WAV and timing into the Take; a refresh then lands in the V2 workspace.
  if (
    video.template === "product-cm" &&
    video.campaignJobId &&
    !hasPinnedProductVoice(video.brief)
  ) {
    return (
      <CampaignDetail
        id={video.campaignJobId}
        sampleHtml={null}
        embedded
        view="video"
        brandId={brandId}
      />
    );
  }

  return (
    // Full width on purpose. The storyboard is the working surface now, and a
    // 1024px column meant three pictures could never sit side by side — at which
    // point the overview says little more than one enlarged panel does. Anything
    // that reads badly wide (the title block, the player) caps itself.
    <main className="flex w-full flex-col gap-6 px-6 py-8 md:px-10">
      {pipeline ? (
        <div className="-mx-6 -mt-2 flex flex-wrap items-center gap-3 md:-mx-10">
          <div className="min-w-0 flex-1">
            <PipelineBar
              stages={pipeline.stages}
              openStage={openStage}
              onOpenStage={setOpenStage}
            />
          </div>
          {/* Outside the flow on purpose: the stages are one step each, and
              "do the rest" is a statement about the whole pipeline. */}
          {video?.template === "event-cm" ? (
            <button
              type="button"
              onClick={() => void runAll()}
              // Only two things stop it: a run already going, and no material
              // to read. "Nothing is pending" is not one of them — the badge
              // says whether there is new work, and the button stays available
              // for the re-run that a model result often deserves.
              disabled={saving || sources.length === 0}
              // Named for what it produces, not for how it runs. 「まとめて実行」
              // said nothing about where it stops, and this one stops before the
              // MP4 on purpose (§9.6).
              aria-label={
                pendingCount > 0
                  ? `動画を作り直す（未処理${pendingCount}件）`
                  : "動画を作り直す（すべて実行し直す）"
              }
              title={
                sources.length === 0
                  ? "先に資料を追加してください"
                  : pendingCount > 0
                    ? `未処理の${pendingCount}件を順番に実行し、動画に反映します（MP4は書き出しません）`
                    : "未処理はありません。資料の読み取りからシナリオ・読み上げまで、もう一度すべて実行し直します"
              }
              className={cn(
                "mr-6 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 md:mr-10",
                pendingCount > 0
                  ? "border-ink bg-ink text-paper hover:bg-accent"
                  : "border-hairline bg-paper text-ink-muted hover:border-ink hover:text-ink",
              )}
            >
              <span>{saving ? "実行中…" : "動画を作り直す"}</span>
              {pendingCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-full bg-red-500 font-mono text-[10px] font-bold leading-none text-white tabular-nums"
                >
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}
      {pipeline && openStageDef ? (
        <StageDrawer
          title={`${openStageDef.label} ステージ`}
          description={openStageDef.summary}
          onClose={() => setOpenStage(null)}
        >
          <VideoPipelinePanel
            stageId={openStageDef.id}
            payload={pipeline}
            runs={runs}
            intake={
              video?.template === "event-cm" ? (
                <BriefSourceIntake
                  sources={sources}
                  busy={saving}
                  onUpload={addFileSource}
                  onAddText={async (text) => {
                    await addSource({ text });
                  }}
                  onRemove={removeSource}
                />
              ) : undefined
            }
            extracted={
              video?.template === "event-cm" ? <ExtractResults runs={runs} /> : undefined
            }
            structured={
              video?.template === "event-cm" ? <StructureResults runs={runs} /> : undefined
            }
            action={
              video?.template === "event-cm" ? (
                <StageAction
                  stageId={openStageDef.id}
                  stages={pipeline.stages}
                  busy={saving}
                  disabled={sources.length === 0}
                  onRun={(stage) =>
                    void (stage === "structure" ? runStructureAndMap() : runStage(stage))
                  }
                  // The last step of the chain, reachable from the stage before
                  // it — same shape as every other drawer's step out (§9.6).
                  // Never `redo`: an explicit re-run of a finished film is the
                  // page-level button's job, and this one is disabled once the
                  // film has nothing outstanding.
                  onRunFilm={() => void runFilmSteps()}
                  filmSteps={filmSteps}
                  onOpenStage={(stage) => setOpenStage(stage)}
                  onRewriteScenario={() => void writeScenario()}
                />
              ) : undefined
            }
            facts={
              video?.template === "event-cm" && video.brief ? (
                <FactList
                  brief={video.brief as EventCmBrief}
                  goalFields={eventCmGoalState(video.brief as EventCmBrief).fields}
                  busy={saving}
                  onEdit={(edit) => void editFact(edit)}
                />
              ) : undefined
            }
            description={
              video?.template === "event-cm"
                ? "絵コンテで直した内容が、再生される動画になった時点。実行するまで絵コンテと動画は違っていて、それが正常な状態です。MP4の書き出しはこの先の別の操作です。"
                : undefined
            }
            output={
              video?.template === "event-cm" && bake ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-ink">動画に反映する</h3>
                  <p className="text-sm text-ink-muted">
                    {!bake.baked
                      ? "まだ一度も実行していません。「動画を作り直す」を押すと、資料の読み取りからシナリオ・読み上げまで通り、その結果が再生される動画になります。"
                      : bake.changes.length > 0
                        ? `絵コンテに、まだ反映していない変更が${bake.changes.length}件あります。「動画を作り直す」を押すと反映されます。`
                        : "いまの絵コンテの内容が、そのまま再生されています。"}
                  </p>
                  <p className="text-xs text-ink-faint">
                    MP4の書き出しと公開はこの段には含まれません（ページ上部のボタンから、必要なときだけ）。
                  </p>
                </div>
              ) : undefined
            }
          />
        </StageDrawer>
      ) : null}
      <nav aria-label="パンくず" className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
        <Link href={`/brands/${brandId}`} className="hover:text-ink">
          {video.brandName ?? "ブランド"}
        </Link>
        <span aria-hidden className="text-ink-faint">/</span>
        <Link href={`/brands/${brandId}/video`} className="hover:text-ink">
          動画
        </Link>
        <span aria-hidden className="text-ink-faint">/</span>
        <span className="font-semibold text-ink">{video.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-hairline pb-6">
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs font-semibold text-ink-muted">{video.templateName.toUpperCase()}</p>
          <h1 className="mt-2 text-balance font-display text-3xl font-semibold">{video.title}</h1>
          {video.template === "event-cm" && video.brief
            ? (() => {
                const proposed = titleOffer(
                  video.title,
                  video.brief as EventCmBrief,
                );
                return proposed ? (
                  <TitleOffer
                    proposed={proposed}
                    busy={saving}
                    onAccept={() => void answerTitleOffer("accept")}
                    onDecline={() => void answerTitleOffer("decline")}
                  />
                ) : null;
              })()
            : null}
          <p className="mt-3 text-[12px] text-ink-muted">
            {VIDEO_STATE_LABEL[video.state]}
            {video.published ? " ・ 公開中" : " ・ 未公開"}
            {/* The file's own properties, with the rest of the metadata. They
                used to sit above the player, where they read as part of the
                film. Aspect, size, length — and nothing about how the length
                was arrived at: a duration does not need to explain itself.
                Estimated lengths are marked 「約」 rather than described, since
                claiming 41.1 seconds to a tenth before anything has been read
                aloud would be precision the number does not have. */}
            {eventCmMeta ? ` ・ ${eventCmMeta}` : ""}
            {video.briefSlug ? ` ・ ブリーフ: ${video.briefSlug}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {video.published && video.publicUrl ? (
            <a
              href={video.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              公開動画 ↗
            </a>
          ) : null}
          {video.template === "event-cm"
            ? (() => {
                // The brief arrives with its pointers resolved so the player can
                // fetch them, so `brief.bgm` is a signed URL. Inverting the map
                // gives back the pointer the picker compares against.
                const brief = video.brief as EventCmBrief;
                const uriByUrl = new Map(
                  Object.entries(video.materialUrls ?? {}).map(([uri, url]) => [url, uri]),
                );
                const current = brief?.bgm
                  ? (uriByUrl.get(brief.bgm) ?? brief.bgm)
                  : null;
                return (
                  <BgmDialog
                    current={current}
                    pool={DEFAULT_ASSETS.filter((asset) => asset.kind === "bgm")}
                    uploads={sources.filter((source) => source.kind === "audio")}
                    ducks={Boolean(brief?.voice)}
                    busy={saving}
                    onChoose={(src) => editFact({ path: "bgm", src })}
                    onTurnOff={() => editFact({ path: "bgm", src: null })}
                  />
                );
              })()
            : null}
          {video.template === "event-cm"
            ? (() => {
                // A finishing step, not an authoring one: the scenario is written
                // in the pipeline, and speaking it costs money and half a
                // minute, so it happens once the words are settled — right
                // before the export it feeds. The control keeps one name and
                // one place whether or not a recording exists.
                const brief = video.brief as EventCmBrief;
                const track = brief?.voice?.track;
                return (
                  <NarrationDialog
                    hasVoice={Boolean(brief?.voice)}
                    currentVoiceId={narrationVoiceByName(track?.voice)?.id ?? null}
                    totalMs={track?.totalMs ?? null}
                    mock={Boolean(track?.mock)}
                    canSpeak={Boolean(brief?.scenario.scenes.length)}
                    busy={saving}
                    onSpeak={(voiceId) => speakScenario(voiceId)}
                    onTurnOff={() => turnNarrationOff()}
                  />
                );
              })()
            : null}
          <button
            type="button"
            onClick={() => void startRender()}
            disabled={saving || video.render?.status === "running" || !video.brief}
            className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink disabled:opacity-50"
          >
            {video.render?.status === "running"
              ? "MP4を作成中…"
              : video.mp4Url
                ? "MP4を作り直す"
                : "MP4を作成"}
          </button>
          <button
            type="button"
            onClick={() => void togglePublished(!video.published)}
            disabled={saving}
            className="rounded-full border border-ink px-4 py-2 text-xs font-semibold transition hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {saving ? "更新中…" : video.published ? "公開をやめる" : "公開する"}
          </button>
        </div>
      </header>

      {video.render?.status === "running" ? (
        <p className="flex items-center gap-2 rounded-xl border border-hairline bg-ink/5 px-4 py-2.5 text-[12px] text-ink-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
          MP4を作成中（数分）— このページを離れても処理は続き、完成するとここに表示されます
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-full border border-red-300 px-3 py-1 text-[11px] font-semibold hover:bg-red-100"
          >
            閉じる
          </button>
        </p>
      ) : null}
      {notice ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-medium text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {notice}
        </p>
      ) : null}
      {video.unresolvedMaterials?.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
          このテイクに固定されていない素材が{video.unresolvedMaterials.length}件あります。
          プレビューではその枠だけが表示されません（書き出しは失敗します）。
        </p>
      ) : null}
      {video.render?.status === "error" && video.render.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          MP4の作成に失敗しました: {video.render.error}
        </p>
      ) : null}
      {video.mp4Url ? (
        <section className="rounded-2xl border border-hairline p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">書き出したMP4</h2>
            <a href={video.mp4Url} download className="text-[11px] text-accent hover:underline">
              ダウンロード
            </a>
          </div>
          {/* Served from R2 through a signed same-origin route with Range
              support, so this is the same file any other machine would get. */}
          <video
            src={video.mp4Url}
            controls
            className="mt-3 w-full rounded-xl bg-[#0b0d13]"
            style={{ aspectRatio: "16 / 9" }}
          />
          {video.render?.renderedAt ? (
            <p className="mt-2 text-[11px] text-ink-faint">
              書き出し: {new Date(video.render.renderedAt).toLocaleString("ja-JP")}
            </p>
          ) : null}
          {/* Export sits outside the chain, so it goes out of date on its own
              and nothing pulls it back. Said here, next to the file it is about,
              rather than counted into the button — a re-export is minutes of
              rendering and is the user's call (§9.4). */}
          {mp4Behind ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              このMP4は、いま再生されている動画より古いバージョンです。
              「MP4を作り直す」で書き出し直せます。
            </p>
          ) : null}
        </section>
      ) : null}

      {video.template === "event-cm" && eventCm && bake ? (
        <EventCmWorkspace
          brief={eventCm.working}
          // Never run = play the workbench. The take's opening move is a
          // finished film with no model call behind it, and refusing to show it
          // until somebody presses a button would throw that away (§9.9).
          playing={eventCm.baked ?? eventCm.working}
          bake={bake}
          onEditFact={(edit) => void editFact(edit)}
          onEditScenario={(scene, text) => editScenario(scene, text)}
          onDeletePanel={(scene) => deletePanel(scene)}
          onRewriteScenario={(force) => void writeScenario(force)}
          // Photographs and marks alike: which slot a picture suits is the
          // user's call here, exactly as it is for audio.
          imageSources={sources.filter(
            (source) => source.kind === "photo" || source.kind === "logo",
          )}
          writing={saving}
        />
      ) : video.template === "event-promo" && video.brief ? (
        <EventVideoWorkspace brief={video.brief as EventBrief} />
      ) : video.template === "product-cm" && !hasPinnedProductVoice(video.brief) ? (
        // Product CM without a pinned voice: surface the regeneration actions.
        // Two ways in: CM Maker rebuilds the Brand Kit from a URL, then the
        // voice RPC pins the WAV; uploading a WAV skips the kit and attaches
        // a take-local material. Either path puts the Take in a state where
        // the "MP4を作成" button above becomes useful.
        <ProductCmInputSection brandId={brandId} videoId={videoId} />
      ) : video.template === "product-cm" ? (
        <section className="rounded-2xl border border-hairline p-5">
          <h2 className="text-balance text-sm font-semibold">Product CM入力</h2>
          <p className="mt-2 text-pretty text-xs text-ink-muted">
            Brand Kit、ナレーションタイミング、固定済みWAVをTakeが保持します。
            MP4の再生成はローカルのキャンペーンジョブに依存しません。
          </p>
        </section>
      ) : (
        <p className="rounded-xl border border-hairline bg-ink/[0.03] px-4 py-3 text-[12px] text-ink-muted">
          このイベント動画にはまだブリーフがありません。
        </p>
      )}
      {/* Last in the tree on purpose: the run log has to stay readable
          over an open stage drawer, so it must both out-rank it (z-50 vs
          z-40) and paint after it. */}
      <BusyBar label={busyLabel} />
      <RunOverlay runs={runCards} onDismiss={dismissRun} />
    </main>
  );
}
