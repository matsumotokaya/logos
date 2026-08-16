// The name a file is shown, exported and downloaded under.
//
// docs/asset-normalization.md §8. 「フォルダは便宜、名前は契約」: if the name
// alone carries the meaning, then the person who unzips the project, the person
// who greps it and the agent that reads it all arrive at the same
// understanding.
//
// DERIVED, NOT STORED — a departure from §8's first draft, which had the
// normalised name replacing `label` in the database.
//
// The name is a pure function of things the row already holds: the file it
// arrived as, what it depicts, what it measured. Storing the output of that
// function beside its inputs makes a second source of truth, and it goes stale
// the moment somebody corrects a classification — a photograph reclassified
// from 情景 to 人物 has to move folders and change name, and a stored label
// would keep the old one until something remembered to rewrite it. Deriving
// means the correction IS the rename, everywhere at once, which is what the
// pulldown promises. It also means no migration and no backfill.
//
// `label` therefore keeps meaning what it has always meant: the name this file
// arrived with. That is worth keeping — it is how somebody finds the file they
// dragged in.
//
// DETERMINISTIC, with no invention. Every part comes from a fact:
//
//   base        the uploaded filename, slugged
//   attributes  what was measured (a mark on a plate, a dark mark)
//   width       what was measured
//   extension   the media type
//
// What is NOT here is meaning the file never carried. §13-3 asked whether a
// model should supply short meaningful names — 「sake-tasting」 for
// AdobeStock_1894358160. It should not, at least not here: renaming somebody's
// file to a guess about its contents is the one operation where being wrong is
// silent and permanent-feeling. A meaningless name that is honestly the
// original beats a plausible name that is wrong.

import { isMaterialCategory, type MaterialCategory } from "./category";

/** What naming needs to know. A subset of the brand_materials row. */
export interface NameableMaterial {
  label: string;
  kind: string;
  category?: string | null;
  media_type?: string | null;
  width?: number | null;
  opaque?: boolean | null;
  luminance?: number | null;
  source_kind?: string | null;
}

/**
 * The columns a query must select for naming to work, as a select() fragment.
 *
 * Every field here is optional on the type, because a missing measurement is a
 * real state — so a caller that forgets one gets a name that is quietly poorer
 * rather than an error. That is exactly what happened: the inventory query left
 * `luminance` out and every mark lost its dark/light word, with the row in the
 * database holding 0.003 the whole time. Naming a shared constant is cheaper
 * than remembering.
 */
export const MATERIAL_NAMING_COLUMNS =
  "label, kind, category, media_type, width, opaque, luminance, source_kind";

/** Canonical extension per media type. The stored key has none — it is a
 *  checksum — which is why exports have been shipping extensionless files. */
const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
};

/** The folder a file lands in when there is no classification to go on. */
const FOLDER_BY_KIND: Record<string, string> = {
  logo: "logo",
  audio: "audio",
  video: "video",
  document: "document",
  font: "font",
};

/** A word for a file whose own name says nothing an ASCII path can carry. */
const FALLBACK_BY_KIND: Record<string, string> = {
  logo: "logo",
  photo: "photo",
  keyvisual: "photo",
  illustration: "illustration",
  audio: "audio",
  video: "video",
  document: "document",
  font: "font",
};

const extensionOf = (material: NameableMaterial): string => {
  const known = material.media_type ? EXTENSION[material.media_type] : undefined;
  if (known) return known;
  // Fall back to whatever the uploaded name ended in — better than nothing, and
  // it is at least what the file claimed to be.
  const tail = /\.([a-z0-9]{1,5})$/i.exec(material.label.trim());
  return tail ? tail[1].toLowerCase() : "bin";
};

/**
 * The uploaded name, reduced to something a path can carry everywhere.
 *
 * Japanese is dropped rather than transliterated: there is no deterministic
 * kana/kanji romanisation, and a ZIP's filename table carries no UTF-8 flag, so
 * `unzip` refuses Japanese directory entries (the same reason lib/export/naming.ts
 * exists). An empty result means the name said nothing transferable — not that
 * it said nothing at all, which is why the original stays on the row.
 */
export function slugOf(label: string): string {
  const withoutPath = label.split("/").pop() ?? label;
  const withoutExtension = withoutPath.replace(/\.[a-z0-9]{1,5}$/i, "");
  return withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}

/**
 * A word for a file the slug could not describe.
 *
 * System-made materials are the common case — 「貼り付けたテキスト」,
 * 「イベント紹介動画の読み上げ」 — and for those we know what they are without
 * guessing, because we made them.
 */
function fallbackBase(material: NameableMaterial): string {
  if (material.media_type === "text/plain") return "note";
  if (material.kind === "audio" && material.source_kind === "ai_generated") {
    return "narration";
  }
  return FALLBACK_BY_KIND[material.kind] ?? "asset";
}

/**
 * What a mark measured, in the two words that decide how it may be drawn.
 *
 * Only for marks, and only when measured: a null is 「測っていない」, and
 * writing `transparent` for it would put a measurement in the filename that
 * nobody took (§6). Silence is the honest third state.
 */
function markAttributes(material: NameableMaterial): string[] {
  if (material.kind !== "logo" && material.category !== "mark") return [];
  const attributes: string[] = [];
  if (material.opaque === true) attributes.push("plate");
  else if (material.opaque === false) attributes.push("transparent");
  if (typeof material.luminance === "number") {
    attributes.push(material.luminance < 0.5 ? "dark" : "light");
  }
  return attributes;
}

/** `1600w`, or `vector` for artwork that has no pixel size, or nothing. */
function sizePart(material: NameableMaterial, extension: string): string | null {
  if (extension === "svg") return "vector";
  return material.width && material.width > 0 ? `${material.width}w` : null;
}

/**
 * The file name, without a folder.
 *
 * `<base>[_<attributes>][_<width>].<ext>` — attributes only where they were
 * measured, so a name never claims knowledge the row does not have.
 */
export function materialFileName(material: NameableMaterial): string {
  const extension = extensionOf(material);
  const base = slugOf(material.label) || fallbackBase(material);
  const parts = [base, ...markAttributes(material)];
  const size = sizePart(material, extension);
  if (size) parts.push(size);
  return `${parts.join("_")}.${extension}`;
}

/**
 * The folder, which is the classification.
 *
 * `unsorted` rather than `other` for an unclassified file: 「まだ分類していない」
 * and 「分類したうえでどれでもなかった」 are different answers, and only the
 * second one is a decision.
 */
export function materialFolder(material: NameableMaterial): string {
  if (isMaterialCategory(material.category)) return material.category;
  return FOLDER_BY_KIND[material.kind] ?? "unsorted";
}

/** Where the file sits in an export or a download: `assets/<folder>/<name>`. */
export const materialPath = (material: NameableMaterial): string =>
  `assets/${materialFolder(material)}/${materialFileName(material)}`;

/**
 * Make every path in one export unique.
 *
 * Two files can normalise to the same name — the same filename, the same
 * classification, the same width — and a ZIP that silently keeps one of them is
 * worse than an ugly name. The suffix is a counter rather than the id, because
 * the point of the name is to be readable.
 */
export function uniqueMaterialPaths(
  materials: ReadonlyArray<NameableMaterial & { id: string }>,
): Map<string, string> {
  const taken = new Map<string, number>();
  const paths = new Map<string, string>();
  for (const material of materials) {
    const path = materialPath(material);
    const seen = taken.get(path) ?? 0;
    taken.set(path, seen + 1);
    if (seen === 0) {
      paths.set(material.id, path);
      continue;
    }
    const at = path.lastIndexOf(".");
    paths.set(material.id, `${path.slice(0, at)}-${seen + 1}${path.slice(at)}`);
  }
  return paths;
}

/** Category type re-export so callers do not need two imports. */
export type { MaterialCategory };
