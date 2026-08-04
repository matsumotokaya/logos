import "server-only";

// Where a take's rendered output lives.
//
// R2 is the source of truth, not the local disk. Before this, every rendered
// MP4 sat in var/ on whichever machine ran the render, so a deployed instance
// could not serve a video it had not itself produced — and Vercel cannot run
// Chromium, so it never produces any. Keys follow the existing R2 convention
// (`logos/<logoId>/candidates/...`) extended with the brand/take hierarchy.
//
// Deliberately no local fallback: two code paths would mean "which copy is
// canonical" depends on the environment the request happened to land in.

import { getR2ObjectRange, headR2Object, isR2Configured, putR2Object } from "@/lib/r2";

export const takeOutputKey = (brandId: string, takeId: string, name: string): string =>
  `brands/${brandId}/takes/${takeId}/output/${name}`;

export const MP4_NAME = "video.mp4";

export async function putTakeOutput(
  brandId: string,
  takeId: string,
  name: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error(
      "R2 が未設定です。R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME を設定してください。",
    );
  }
  const key = takeOutputKey(brandId, takeId, name);
  // Long max-age is safe: a re-render writes a new key (see renderedKey), so a
  // given key's bytes never change.
  await putR2Object(key, body, contentType, "public, max-age=31536000, immutable");
  return key;
}

/** Content-addressed-ish key: the render timestamp makes a re-render a new
 *  object, so a cached or in-flight URL never resolves to different bytes. */
export const renderedKey = (renderedAt: string): string =>
  `${MP4_NAME.replace(/\.mp4$/, "")}-${renderedAt.replace(/[^0-9]/g, "")}.mp4`;

export { getR2ObjectRange, headR2Object };
