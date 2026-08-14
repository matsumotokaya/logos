import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { getR2Object } from "@/lib/r2";
import { SOURCE_ROLE } from "@/app/api/brands/[id]/videos/[videoId]/materials/route";

// Stage ②: reading the material, mechanically.
//
// Deterministic and free. No model runs here, which is the point (§17.2):
// whatever rules can reach, rules reach first, and what is left over is named
// honestly rather than quietly handed to a model as if it had been read.
//
// What rules reach today is text, and the measurable properties of an image.
// A PDF's text layer and a flyer's words need a parser and an OCR engine this
// repo does not carry, and the existing path for PDFs hands the file to the
// model whole (lib/campaign/creative.ts). So a flyer is *carried* by this
// stage, not read by it, and the structuring stage reads it. The distinction
// is visible in the output: `text` for what was read, `passthrough` for what
// has to be looked at.
//
// Images are also *prepared* here rather than shipped as they arrived. An
// uploaded photograph is several megabytes; a dozen of them base64-encoded is
// not a large prompt, it is a request that never returns. Downscaling is a
// rule, so it belongs to the rules stage, and what could not be sent is
// reported instead of disappearing.

export interface ImageFacts {
  width: number;
  height: number;
  /** width / height. Portrait crops and full-bleed grounds want to know. */
  aspect: number;
  /**
   * Mean luminance of the non-transparent pixels, 0–1.
   *
   * Measured rather than asked, because it decides how a mark is drawn on the
   * ink ground: a dark logo needs knocking out, an already-white one must be
   * left alone. A model's guess at "is this artwork dark" is a guess; this is
   * the answer.
   */
  luminance: number | null;
  /**
   * Whether the artwork has no transparency at all.
   *
   * Decisive for a mark, and separate from brightness: a logo delivered as a
   * JPEG is artwork ON A PLATE, and drawing it as supplied on the ink ground
   * puts a white rectangle in the film. Brightness cannot tell that apart from
   * a white mark on transparency, because both measure bright.
   */
  opaque: boolean;
  /** The media type the model is handed, after preparation. */
  sentAs: string;
  /** Bytes actually sent, after downscaling. */
  sentBytes: number;
}

export interface ExtractedSource {
  materialId: string;
  label: string;
  /** The media type as uploaded. Preparation does not rewrite history. */
  mediaType: string;
  bytes: number;
  /** What this stage could do with it. */
  mode: "text" | "passthrough" | "skipped";
  /** Present when `mode` is "text". */
  text?: string;
  /** Base64 body, kept for the model when `mode` is "passthrough". */
  data?: string;
  /** Measured properties, for anything that is an image. */
  image?: ImageFacts;
  /** Why it was skipped, when it was. */
  note?: string;
}

const TEXTUAL = /^text\//;
const IMAGE = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;
const PDF = /^application\/pdf$/;

/**
 * What one run may hand to the model.
 *
 * A ceiling rather than a silent trim: everything above it is reported as not
 * sent, with the reason, so a user who dropped in thirty photographs is told
 * that twelve were looked at instead of wondering which ones counted.
 */
export const IMAGE_SEND_LIMIT = 12;
export const IMAGE_BUDGET_BYTES = 6_000_000;
const SEND_LONG_EDGE = 1024;
const SEND_QUALITY = 78;
/** Transparent artwork is flattened onto mid-grey so that both a black mark
 *  and a white one survive the trip. White would erase half the logos. */
const NEUTRAL_GROUND = { r: 128, g: 128, b: 128 };

interface PreparedImage {
  data: string;
  facts: ImageFacts;
}

/** Downscale for sending, and measure while the bytes are already decoded. */
async function prepareImage(body: Buffer): Promise<PreparedImage | null> {
  try {
    const source = sharp(body, { failOn: "none" });
    const meta = await source.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const jpeg = await sharp(body, { failOn: "none" })
      .rotate()
      .resize(SEND_LONG_EDGE, SEND_LONG_EDGE, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: NEUTRAL_GROUND })
      .jpeg({ quality: SEND_QUALITY })
      .toBuffer();

    const artwork = await measureArtwork(body);
    return {
      data: jpeg.toString("base64"),
      facts: {
        width,
        height,
        aspect: width > 0 && height > 0 ? Number((width / height).toFixed(3)) : 0,
        luminance: artwork.luminance,
        opaque: artwork.opaque,
        sentAs: "image/jpeg",
        sentBytes: jpeg.length,
      },
    };
  } catch {
    return null;
  }
}

/**
 * The artwork's own brightness, and whether it has a plate behind it.
 *
 * Luminance is weighted by opacity — the mark's brightness, not the brightness
 * of the space around it. Opacity is counted at the same time because the two
 * questions have one answer only when read together: a white mark on
 * transparency and a black mark on a white JPEG plate both measure bright, and
 * on an ink ground they need opposite treatments.
 */
async function measureArtwork(
  body: Buffer,
): Promise<{ luminance: number | null; opaque: boolean }> {
  try {
    const { data, info } = await sharp(body, { failOn: "none" })
      .resize(64, 64, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let total = 0;
    let counted = 0;
    let transparent = 0;
    for (let i = 0; i + 3 < data.length; i += info.channels) {
      const alpha = data[i + 3];
      if (alpha < 32) {
        transparent += 1;
        continue;
      }
      total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      counted += 1;
    }
    return {
      luminance: counted > 0 ? Number((total / counted).toFixed(3)) : null,
      // A couple of stray soft pixels do not make artwork cut out; a real
      // transparent delivery is transparent over most of its frame.
      opaque: transparent / Math.max(1, transparent + counted) < 0.02,
    };
  } catch {
    return { luminance: null, opaque: true };
  }
}

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
  let imagesSent = 0;
  let bytesSent = 0;

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

    if (IMAGE.test(mediaType)) {
      const bytes = await getR2Object(material.r2_key);
      if (!bytes) {
        sources.push({ ...base, mode: "skipped", note: "R2に本体がありません" });
        continue;
      }
      const prepared = await prepareImage(bytes);
      if (!prepared) {
        // Broken, or a format sharp could not decode. It stays in the list:
        // an image nobody can read is a fact about this take's material.
        sources.push({ ...base, mode: "skipped", note: "画像を読めませんでした" });
        continue;
      }
      if (
        imagesSent >= IMAGE_SEND_LIMIT ||
        bytesSent + prepared.facts.sentBytes > IMAGE_BUDGET_BYTES
      ) {
        sources.push({
          ...base,
          mode: "skipped",
          image: { ...prepared.facts, sentBytes: 0 },
          note: `画像の送信上限（${IMAGE_SEND_LIMIT}枚・${Math.round(IMAGE_BUDGET_BYTES / 1_000_000)}MB）を超えたため送っていません`,
        });
        continue;
      }
      imagesSent += 1;
      bytesSent += prepared.facts.sentBytes;
      sources.push({
        ...base,
        mode: "passthrough",
        data: prepared.data,
        image: prepared.facts,
      });
      continue;
    }

    if (PDF.test(mediaType)) {
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
    ...(source.image
      ? {
          image: {
            width: source.image.width,
            height: source.image.height,
            aspect: source.image.aspect,
            luminance: source.image.luminance,
            opaque: source.image.opaque,
            sentBytes: source.image.sentBytes,
          },
        }
      : {}),
    note: source.note,
  }));
