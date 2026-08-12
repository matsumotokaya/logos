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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { videoFetch } from "@/lib/video/client";
import CampaignDetail from "@/app/campaigns/[id]/CampaignDetail";
import EventVideoWorkspace from "@/components/video/EventVideoWorkspace";
import EventCmWorkspace from "@/components/video/EventCmWorkspace";
import type { FactEdit } from "@/components/video/FactList";
import BriefSourceIntake, { type BriefSource } from "@/components/video/BriefSourceIntake";
import FactList from "@/components/video/FactList";
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
import type { EventCmBrief } from "@/remotion/event-cm/types";

type VideoAsset = {
  id: string;
  brandId: string;
  title: string;
  template: VideoTemplateId;
  templateName: string;
  published: boolean;
  publicUrl: string | null;
  briefSlug: string | null;
  brief: EventBrief | Record<string, unknown> | null;
  campaignJobId: string | null;
  /** Materials the brief points at that are not pinned to this take. The
   *  preview cannot fetch them, so say so rather than let the player fail
   *  silently — an empty slot here would read as a designed fallback. */
  unresolvedMaterials?: string[];
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
  const [saving, setSaving] = useState(false);
  const [pipeline, setPipeline] = useState<
    (VideoPipelinePayload & { stages: PipelineStage[] }) | null
  >(null);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [sources, setSources] = useState<BriefSource[]>([]);
  const [runs, setRuns] = useState<TakeRunRecord[]>([]);
  const [runCards, setRunCards] = useState<RunCard[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "動画を取得できませんでした");
      }
      setResolved((await res.json()) as Resolved);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "動画を取得できませんでした");
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
    setSaving(true);
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
      setSaving(false);
    }
  }

  // Writing the narration is what turns a seeded film into this event's film:
  // the scene lengths stop being budgets and start following the words.
  async function writeScript() {
    setSaving(true);
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "台本を作成できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "台本を作成できませんでした");
    } finally {
      setSaving(false);
    }
  }

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

  async function addSource(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "素材を追加できませんでした");
      }
      await loadSources();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "素材を追加できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function removeSource(materialId: string) {
    setSaving(true);
    try {
      await videoFetch(
        `/api/brands/${brandId}/videos/${videoId}/materials?materialId=${materialId}`,
        { method: "DELETE" },
      );
      await loadSources();
      await load();
    } finally {
      setSaving(false);
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
    setSaving(true);
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
        narrationRewritten?: boolean;
        narrationKept?: boolean;
        note?: string | null;
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "実行できませんでした");

      if (stage === "structure") {
        appendLine(id, `資料から${json?.foundCount ?? 0}項目を読み取りました`);
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
        if (json?.narrationRewritten) {
          appendLine(id, "ナレーションを新しい内容で書き直しました");
          appendLine(id, "音声は作り直しが必要です");
        }
        if (json?.narrationKept) {
          appendLine(id, "編集済みのナレーションはそのままにしました");
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
      setSaving(false);
    }
  }

  /**
   * Everything that has not been done, in order.
   *
   * Stops at the first failure rather than carrying on: a structuring step
   * that could not read the flyer has nothing for the mapping step to apply,
   * and running it anyway would report a second, confusing error.
   */
  async function runAll() {
    for (const stage of ["extract", "structure", "map"] as const) {
      const ok = await runStage(stage);
      if (!ok) return;
    }
  }

  // Correcting a fact, or switching one off. The film redraws from the saved
  // brief, so the change is visible in the player on the next load.
  async function editFact(edit: FactEdit) {
    setSaving(true);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "変更を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  // Speaking replaces the estimated timeline with the measured one.
  async function speakScript() {
    setSaving(true);
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/voice`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "ナレーション音声を作成できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ナレーション音声を作成できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(next: boolean) {
    if (resolved?.kind !== "asset") return;
    setSaving(true);
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
      setSaving(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
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
          {video?.template === "event-cm" && sources.length > 0 ? (
            <button
              type="button"
              onClick={() => void runAll()}
              disabled={saving}
              className="mr-6 shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper transition hover:bg-accent disabled:opacity-50 md:mr-10"
            >
              {saving ? "実行中…" : "未処理をまとめて実行"}
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
                  onUpload={(file, data) =>
                    addSource({ label: file.name, mediaType: file.type, data })
                  }
                  onAddText={(text) => addSource({ text })}
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
                  busy={saving}
                  disabled={sources.length === 0}
                  onRun={(stage) => void runStage(stage)}
                  onRewriteScript={() => void writeScript()}
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
          />
        </StageDrawer>
      ) : null}
      <nav aria-label="パンくず" className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
        <Link href={`/brands/${brandId}`} className="hover:text-ink">
          ブランド
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
          <p className="mt-3 text-[12px] text-ink-muted">
            {VIDEO_STATE_LABEL[video.state]}
            {video.published ? " ・ 公開中" : " ・ 未公開"}
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
          {video.template === "event-cm" ? (
            // A finishing step, not an authoring one: the script is written in
            // the pipeline, and speaking it costs money and half a minute, so
            // it happens once the words are settled — immediately before the
            // export it feeds.
            <button
              type="button"
              onClick={() => void speakScript()}
              disabled={saving || !(video.brief as EventCmBrief)?.script?.scenes?.length}
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink disabled:opacity-50"
            >
              {(video.brief as EventCmBrief)?.voice ? "読み上げ直す" : "ナレーションを読み上げる"}
            </button>
          ) : null}
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
        </section>
      ) : null}

      {video.template === "event-cm" && video.brief ? (
        <EventCmWorkspace
          brief={video.brief as EventCmBrief}
          onEditFact={(edit) => void editFact(edit)}
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
      <RunOverlay runs={runCards} onDismiss={dismissRun} />
    </main>
  );
}
