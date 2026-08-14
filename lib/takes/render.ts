import "server-only";

import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentTemplate, type RenderFormat } from "@/lib/templates/catalog";
import { validateBrief } from "@/lib/templates/brief-schemas";
import { renderRemotionComposition } from "@/lib/video/remotion-cli";
import { renderLandingPage } from "@/lib/campaign/render-lp";
import type { CampaignBrandKit } from "@/lib/campaign/schema";
import { deleteR2Object } from "@/lib/r2";
import { putRenderArtifact } from "./storage";
import { stageBriefMaterials } from "./materials";

// Rendering one render of one take.
//
// The state lives on the row, not in server memory, so a reload — or a different
// machine — still sees what happened. The artifact row is what proves the file
// exists; take_renders.latest_artifact_id is a pointer to the current one, and
// older artifacts stay behind as history rather than being overwritten.
//
// An artifact is deliberately NOT a material. It becomes one only if somebody
// promotes it, and then both rows point at the same R2 object (there is never a
// second copy of the bytes — docs/schema-v2.md §11).

export type RenderTakeResult =
  | {
      ok: true;
      artifactId: string;
      r2Key: string;
      bytes: number;
      renderedAt: string;
    }
  | { ok: false; error: string };

interface RenderRow {
  id: string;
  take_id: string;
  format: RenderFormat;
  locale: string;
  aspect_ratio: string;
  theme: string;
  takes: {
    brand_id: string;
    template_id: string;
    template_version: number;
    brief: unknown;
    /** The brief a run fixed, for templates that have one (migration 0050). */
    baked_brief: unknown;
  } | null;
}

export async function renderTake(
  supabase: SupabaseClient,
  renderId: string,
): Promise<RenderTakeResult> {
  const { data, error } = await supabase
    .from("take_renders")
    .select(
      "id, take_id, format, locale, aspect_ratio, theme, takes(brand_id, template_id, template_version, brief, baked_brief)",
    )
    .eq("id", renderId)
    .maybeSingle();

  if (error) return { ok: false, error: `出力単位を読めませんでした: ${error.message}` };
  const render = data as RenderRow | null;
  if (!render?.takes) return { ok: false, error: "出力単位が見つかりません" };

  const take = render.takes;
  const template = currentTemplate(take.template_id);
  if (!template) {
    return { ok: false, error: `テンプレートが見つかりません: ${take.template_id}` };
  }

  // A take pinned to an older version may only be re-rendered when that version
  // declared it. Rendering it on today's code instead would quietly change the
  // output somebody already approved (docs/deliverable-architecture.md §4.3).
  if (take.template_version !== template.version && !template.rerenderable) {
    return {
      ok: false,
      error:
        `このテイクは ${take.template_id}@${take.template_version} で作られており、` +
        `現在の版(${template.version})での再レンダーは保証されていません`,
    };
  }

  // The export is a file of the film the player showed, not of the workbench.
  //
  // Reading the working brief here would hand somebody an MP4 of edits they
  // were still making — including a scenario with no recording, which would
  // export at the estimated length rather than the measured one. Templates with
  // no fixing step (product-cm, event-promo) have no `baked_brief`, and for
  // them this is the brief it always was (migration 0050, §9.4).
  const source = take.baked_brief ?? take.brief;
  const validated = validateBrief(template.id, source);
  if (!validated.ok) {
    return { ok: false, error: `briefが壊れています: ${validated.issues.join(", ")}` };
  }

  const { error: startError } = await supabase
    .from("take_renders")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", renderId);
  if (startError) {
    return { ok: false, error: `レンダーを開始できませんでした: ${startError.message}` };
  }

  let renderReady = false;
  try {
    const bytes = await produce(supabase, render.take_id, template.id, render.format, validated.brief);
    const renderedAt = new Date().toISOString();
    const { key, mediaType } = await putRenderArtifact(
      take.brand_id,
      render.take_id,
      render.id,
      render.format,
      bytes,
      renderedAt,
    );

    const { data: artifact, error: artifactError } = await supabase
      .from("render_artifacts")
      .insert({
        render_id: render.id,
        r2_key: key,
        media_type: mediaType,
        bytes: bytes.byteLength,
        checksum: createHash("sha256").update(bytes).digest("hex").slice(0, 32),
        status: "ready",
      })
      .select("id")
      .maybeSingle();
    if (artifactError || !artifact) {
      // The object has no durable DB owner yet. Remove it immediately instead
      // of relying on a future global garbage collector to find it.
      try {
        await deleteR2Object(key);
      } catch (cleanupError) {
        const cleanupMessage =
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        throw new Error(
          `${artifactError?.message ?? "成果物を登録できませんでした"}; ` +
            `R2補償削除にも失敗しました: ${cleanupMessage}`,
        );
      }
      throw new Error(artifactError?.message ?? "成果物を登録できませんでした");
    }

    const { error: readyError } = await supabase
      .from("take_renders")
      .update({
        status: "ready",
        latest_artifact_id: artifact.id,
        updated_at: renderedAt,
      })
      .eq("id", renderId);
    if (readyError) {
      throw new Error(`成果物の採用状態を更新できませんでした: ${readyError.message}`);
    }
    renderReady = true;

    const { count: unfinished, error: countError } = await supabase
      .from("take_renders")
      .select("*", { count: "exact", head: true })
      .eq("take_id", render.take_id)
      .neq("status", "ready");
    if (countError) {
      throw new Error(`テイクの完了状態を確認できませんでした: ${countError.message}`);
    }
    if ((unfinished ?? 0) === 0) {
      const { error: takeReadyError } = await supabase
        .from("takes")
        .update({ status: "ready", updated_at: renderedAt })
        .eq("id", render.take_id);
      if (takeReadyError) {
        throw new Error(`テイクを完了状態にできませんでした: ${takeReadyError.message}`);
      }
    }

    return {
      ok: true,
      artifactId: artifact.id as string,
      r2Key: key,
      bytes: bytes.byteLength,
      renderedAt,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (renderReady) {
      // The output itself is durable and adopted. A follow-up state update
      // failing must not rewrite that truthful ready state to failed.
      return { ok: false, error: message };
    }
    const { error: failError } = await supabase
      .from("take_renders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", renderId);
    return {
      ok: false,
      error: failError
        ? `${message}; 失敗状態も保存できませんでした: ${failError.message}`
        : message,
    };
  }
}

/** Template-specific production. Each arm owns exactly one renderer; a template
 *  without one says so instead of producing an empty file. */
async function produce(
  supabase: SupabaseClient,
  takeId: string,
  templateId: string,
  format: RenderFormat,
  brief: unknown,
): Promise<Buffer> {
  if (templateId === "event-promo" && format === "mp4") {
    return renderEventMp4(supabase, takeId, brief);
  }
  if (templateId === "product-cm" && format === "mp4") {
    return renderProductCmMp4(supabase, takeId, brief);
  }
  if (templateId === "campaign-lp" && format === "html") {
    const kit = (brief as { kit?: CampaignBrandKit }).kit;
    if (!kit) throw new Error("LPのService Brand Kitが未充足です");
    return Buffer.from(renderLandingPage(kit), "utf8");
  }
  throw new Error(
    `${templateId} の ${format} レンダラーはまだv2経路に接続されていません`,
  );
}

async function renderProductCmMp4(
  supabase: SupabaseClient,
  takeId: string,
  brief: unknown,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "logos-product-cm-"));
  const propsPath = path.join(dir, "props.json");
  const outPath = path.join(dir, "out.mp4");
  const publicDir = path.join(dir, "public");
  try {
    const staged = await stageBriefMaterials(supabase, takeId, brief, publicDir);
    const productBrief = staged as {
      kit?: CampaignBrandKit;
      voice?: { track?: unknown; audio?: string };
    };
    if (!productBrief.kit || !productBrief.voice?.track || !productBrief.voice.audio) {
      throw new Error("Product CMのBrand Kitまたは固定済み音声が未充足です");
    }

    let bgmSrc: string | null = null;
    try {
      await copyFile(
        path.join(process.cwd(), "public", "campaigns", "bgm.mp3"),
        path.join(publicDir, "bgm.mp3"),
      );
      bgmSrc = "bgm.mp3";
    } catch {
      // BGM is a template-owned optional asset. Narration alone is a complete
      // render and stays deterministic when the optional file is absent.
    }
    await writeFile(
      propsPath,
      JSON.stringify({
        kit: productBrief.kit,
        track: productBrief.voice.track,
        audioSrc: productBrief.voice.audio,
        bgmSrc,
      }),
    );
    await renderRemotionComposition("cm", propsPath, outPath, publicDir);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function renderEventMp4(
  supabase: SupabaseClient,
  takeId: string,
  brief: unknown,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "logos-take-"));
  const propsPath = path.join(dir, "props.json");
  const outPath = path.join(dir, "out.mp4");
  const publicDir = path.join(dir, "public");
  try {
    const stagedBrief = await stageBriefMaterials(supabase, takeId, brief, publicDir);
    await writeFile(propsPath, JSON.stringify({ brief: stagedBrief }));
    await renderRemotionComposition("event", propsPath, outPath, publicDir);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
