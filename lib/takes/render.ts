import "server-only";

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentTemplate, type RenderFormat } from "@/lib/templates/catalog";
import { validateBrief } from "@/lib/templates/brief-schemas";
import { renderRemotionComposition } from "@/lib/video/remotion-cli";
import { putRenderArtifact } from "./storage";

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
  } | null;
}

export async function renderTake(
  supabase: SupabaseClient,
  renderId: string,
): Promise<RenderTakeResult> {
  const { data, error } = await supabase
    .from("take_renders")
    .select(
      "id, take_id, format, locale, aspect_ratio, theme, takes(brand_id, template_id, template_version, brief)",
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

  const validated = validateBrief(template.id, take.brief);
  if (!validated.ok) {
    return { ok: false, error: `briefが壊れています: ${validated.issues.join(", ")}` };
  }

  await supabase
    .from("take_renders")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", renderId);

  try {
    const bytes = await produce(template.id, render.format, validated.brief);
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
      throw new Error(artifactError?.message ?? "成果物を登録できませんでした");
    }

    await supabase
      .from("take_renders")
      .update({
        status: "ready",
        latest_artifact_id: artifact.id,
        updated_at: renderedAt,
      })
      .eq("id", renderId);

    return {
      ok: true,
      artifactId: artifact.id as string,
      r2Key: key,
      bytes: bytes.byteLength,
      renderedAt,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase
      .from("take_renders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", renderId);
    return { ok: false, error: message };
  }
}

/** Template-specific production. Each arm owns exactly one renderer; a template
 *  without one says so instead of producing an empty file. */
async function produce(
  templateId: string,
  format: RenderFormat,
  brief: unknown,
): Promise<Buffer> {
  if (templateId === "event-promo" && format === "mp4") {
    return renderEventMp4(brief);
  }
  throw new Error(
    `${templateId} の ${format} レンダラーはまだv2経路に接続されていません`,
  );
}

async function renderEventMp4(brief: unknown): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "logos-take-"));
  const propsPath = path.join(dir, "props.json");
  const outPath = path.join(dir, "out.mp4");
  try {
    await writeFile(propsPath, JSON.stringify({ brief }));
    await renderRemotionComposition("event", propsPath, outPath);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
