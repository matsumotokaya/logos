import "server-only";

import { getR2Object } from "@/lib/r2";

/**
 * A logo candidate as every detail endpoint needs to select it. `svg` is the
 * vector master when we have one; `file_path` is the R2 object for everything
 * else — a PNG screenshot, a JPEG, the GIF an older site still ships.
 */
export interface LogoPreviewCandidate {
  is_primary: boolean;
  svg: string | null;
  media_type?: string | null;
  file_path?: string | null;
}

/** The columns `logoPreviewUrl` needs, for PostgREST select strings. */
export const LOGO_PREVIEW_COLUMNS = "is_primary, svg, media_type, file_path";

/**
 * Data URI for a logo, or null when the record carries no image at all.
 *
 * Raster is not a degraded case. A capture that produced a PNG is still the
 * brand's mark, and showing it beats falling back to the brand name set in
 * type — which is what the brand detail endpoint used to do by asking only for
 * `svg`, leaving captured logos invisible even though the file was in R2.
 */
export async function logoPreviewUrl(
  candidates: LogoPreviewCandidate[] | null | undefined,
): Promise<string | null> {
  const list = candidates ?? [];
  const candidate = list.find((item) => item.is_primary) ?? list[0];
  if (!candidate) return null;

  if (candidate.svg) {
    const encoded = Buffer.from(candidate.svg, "utf8").toString("base64");
    return `data:image/svg+xml;base64,${encoded}`;
  }
  if (!candidate.file_path) return null;

  const file = await getR2Object(candidate.file_path);
  if (!file) return null;
  return `data:${candidate.media_type || "image/png"};base64,${file.toString("base64")}`;
}
