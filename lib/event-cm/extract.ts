import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getR2Object } from "@/lib/r2";
import { SOURCE_ROLE } from "@/app/api/brands/[id]/videos/[videoId]/materials/route";

// Stage ②: reading the material, mechanically.
//
// Deterministic and free. No model runs here, which is the point (§17.2):
// whatever rules can reach, rules reach first, and what is left over is named
// honestly rather than quietly handed to a model as if it had been read.
//
// What rules reach today is text. A PDF's text layer and an image's words need
// a parser and an OCR engine this repo does not carry, and the existing path
// for PDFs hands the file to the model whole (lib/campaign/creative.ts). So a
// flyer is *carried* by this stage, not read by it, and the structuring stage
// reads it. The distinction is visible in the output: `text` for what was
// read, `passthrough` for what has to be looked at.

export interface ExtractedSource {
  materialId: string;
  label: string;
  mediaType: string;
  bytes: number;
  /** What this stage could do with it. */
  mode: "text" | "passthrough" | "skipped";
  /** Present when `mode` is "text". */
  text?: string;
  /** Base64 body, kept for the model when `mode` is "passthrough". */
  data?: string;
  /** Why it was skipped, when it was. */
  note?: string;
}

const TEXTUAL = /^text\//;
const MODEL_READABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;

/** Everything pinned to this take as briefing material, read as far as rules go. */
export async function extractTakeSources(
  supabase: SupabaseClient,
  takeId: string,
): Promise<ExtractedSource[]> {
  const { data, error } = await supabase
    .from("take_inputs")
    .select("material_id, brand_materials(id, label, media_type, bytes, r2_key)")
    .eq("take_id", takeId)
    .eq("role", SOURCE_ROLE);
  if (error) throw new Error(`素材を読めませんでした: ${error.message}`);

  type Material = {
    id: string;
    label: string;
    media_type: string | null;
    bytes: number | null;
    r2_key: string | null;
  };
  const rows = (data ?? []) as Array<{
    material_id: string;
    brand_materials: Material | Material[] | null;
  }>;

  const sources: ExtractedSource[] = [];
  for (const row of rows) {
    const material = Array.isArray(row.brand_materials)
      ? row.brand_materials[0]
      : row.brand_materials;
    if (!material?.r2_key) continue;

    const mediaType = material.media_type ?? "application/octet-stream";
    const base = {
      materialId: material.id,
      label: material.label,
      mediaType,
      bytes: material.bytes ?? 0,
    };

    if (TEXTUAL.test(mediaType)) {
      const bytes = await getR2Object(material.r2_key);
      sources.push(
        bytes
          ? { ...base, mode: "text", text: bytes.toString("utf8") }
          : { ...base, mode: "skipped", note: "R2に本体がありません" },
      );
      continue;
    }

    if (MODEL_READABLE.test(mediaType)) {
      const bytes = await getR2Object(material.r2_key);
      sources.push(
        bytes
          ? { ...base, mode: "passthrough", data: bytes.toString("base64") }
          : { ...base, mode: "skipped", note: "R2に本体がありません" },
      );
      continue;
    }

    // Audio and anything else is material for the film, not for reading.
    sources.push({ ...base, mode: "skipped", note: "読み取り対象ではありません" });
  }

  return sources;
}

/** What the run records: everything except the bodies, which are large. */
export const extractSummary = (sources: ExtractedSource[]) =>
  sources.map((source) => ({
    materialId: source.materialId,
    label: source.label,
    mediaType: source.mediaType,
    mode: source.mode,
    chars: source.text?.length ?? 0,
    note: source.note,
  }));
