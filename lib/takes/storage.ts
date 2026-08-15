import "server-only";

// Where a render's artifact lives.
//
// One key per render, not per take: locale, aspect ratio, theme and format are
// what a render IS, so two outputs of the same take never collide. The timestamp
// makes a re-render a new object, so a cached or in-flight URL can never resolve
// to different bytes.
//
// R2 is the only source of truth. No local fallback, deliberately: two code
// paths would mean "which copy is canonical" depends on which machine served
// the request (docs/old/schema-v2.md §11).

import { isR2Configured, putR2Object } from "@/lib/r2";
import type { RenderFormat } from "@/lib/templates/catalog";

export const takeRenderKey = (
  brandId: string,
  takeId: string,
  renderId: string,
  name: string,
): string => `brands/${brandId}/takes/${takeId}/renders/${renderId}/${name}`;

const BASENAME: Record<RenderFormat, string> = {
  mp4: "video",
  html: "page",
  png: "image",
  pdf: "document",
  svg: "vector",
  wav: "audio",
};

export const MEDIA_TYPES: Record<RenderFormat, string> = {
  mp4: "video/mp4",
  html: "text/html; charset=utf-8",
  png: "image/png",
  pdf: "application/pdf",
  svg: "image/svg+xml",
  wav: "audio/wav",
};

export const artifactName = (format: RenderFormat, renderedAt: string): string =>
  `${BASENAME[format]}-${renderedAt.replace(/[^0-9]/g, "")}.${format}`;

export async function putRenderArtifact(
  brandId: string,
  takeId: string,
  renderId: string,
  format: RenderFormat,
  body: Uint8Array,
  renderedAt: string,
): Promise<{ key: string; mediaType: string }> {
  if (!isR2Configured()) {
    throw new Error(
      "R2 が未設定です。R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME を設定してください。",
    );
  }
  const key = takeRenderKey(
    brandId,
    takeId,
    renderId,
    artifactName(format, renderedAt),
  );
  const mediaType = MEDIA_TYPES[format];
  // Long max-age is safe: a re-render writes a new key, so a given key's bytes
  // never change.
  await putR2Object(key, body, mediaType, "public, max-age=31536000, immutable");
  return { key, mediaType };
}
