// Import the checked-in sake-2026 event drop into v2 Work materials.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/import-event-materials.ts \
//     --take <take UUID> [--dry-run]
//
// This is intentionally a one-off, explicit port rather than a general upload
// API. It proves the v2 invariant that one Work-scoped material can feed more
// than one Take while keeping every input immutable and checksum-pinned.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminSupabase } from "@/lib/supabase/server";
import { deleteR2Object, putR2Object } from "@/lib/r2";
import { materialUri } from "@/lib/takes/materials";
import type { EventBrief } from "@/remotion/event/types";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};
const dryRun = args.includes("--dry-run");

const EVENT_ROOT = "event/sake-2026";
const SOURCE_DIR = path.join(process.cwd(), "public", EVENT_ROOT);
const PROVENANCE = { imported_by: "scripts/import-event-materials.ts", source_root: EVENT_ROOT };

type MaterialSpec = {
  role: string;
  relativePath: string;
  kind: "logo" | "photo" | "illustration" | "audio";
  mediaType: string;
};

const MATERIALS: readonly MaterialSpec[] = [
  { role: "event.logo.leopalace21", relativePath: "logos/leopalace21.png", kind: "logo", mediaType: "image/png" },
  { role: "event.logo.wealthpark-lab", relativePath: "logos/wealthpark-lab.svg", kind: "logo", mediaType: "image/svg+xml" },
  { role: "event.logo.shimeharitsuru", relativePath: "logos/shimeharitsuru.png", kind: "logo", mediaType: "image/png" },
  { role: "event.logo.miss-sake", relativePath: "logos/miss-sake.png", kind: "logo", mediaType: "image/png" },
  { role: "event.guest.miyao", relativePath: "photos/miyao.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.guest.onishi", relativePath: "photos/onishi.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.guest.kato", relativePath: "photos/kato.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.visual.ink-art", relativePath: "art/sake-kanji.png", kind: "illustration", mediaType: "image/png" },
  { role: "event.visual.value", relativePath: "photos/pour-lanterns.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.visual.programs", relativePath: "photos/brewer.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.visual.closing", relativePath: "photos/masu.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.visual.texture", relativePath: "photos/slate.jpg", kind: "photo", mediaType: "image/jpeg" },
  { role: "event.bgm", relativePath: "bgm.mp3", kind: "audio", mediaType: "audio/mpeg" },
];

type TakeRow = { id: string; brand_id: string; work_id: string | null; title: string; brief: EventBrief; created_by: string | null };
type MaterialRow = { id: string; provenance: { legacy_path?: string } | null };

async function main() {
  const takeId = flag("take");
  if (!takeId) throw new Error("--take <UUID> が必要です");

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("takes")
    .select("id, brand_id, work_id, title, brief, created_by, template_id")
    .eq("id", takeId)
    .eq("template_id", "event-promo")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "event-promo Takeが見つかりません");
  const take = data as TakeRow;

  const sourceBytes = await Promise.all(
    MATERIALS.map(async (spec) => ({ spec, bytes: await readFile(path.join(SOURCE_DIR, spec.relativePath)) })),
  );
  console.log(`take: ${take.id}\nbrand: ${take.brand_id}\nmaterials: ${sourceBytes.length}`);
  if (dryRun) {
    for (const { spec, bytes } of sourceBytes) console.log(`  ${spec.role}  ${bytes.byteLength} bytes`);
    console.log("--dry-run: R2・DBは変更しません");
    return;
  }

  let workId = take.work_id;
  if (!workId) {
    const { data: work, error: workError } = await supabase
      .from("works")
      .insert({ brand_id: take.brand_id, name: take.title, status: "active", created_by: take.created_by })
      .select("id")
      .single();
    if (workError || !work) throw new Error(workError?.message ?? "Workを作成できませんでした");
    workId = work.id as string;
    const { error: takeError } = await supabase
      .from("takes")
      .update({ work_id: workId, updated_at: new Date().toISOString() })
      .eq("id", take.id);
    if (takeError) throw new Error(`TakeへWorkを結びつけられませんでした: ${takeError.message}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("brand_materials")
    .select("id, provenance")
    .eq("brand_id", take.brand_id)
    .eq("work_id", workId)
    .contains("provenance", PROVENANCE);
  if (existingError) throw new Error(`既存素材を読めませんでした: ${existingError.message}`);
  const existingByPath = new Map(
    ((existing ?? []) as MaterialRow[])
      .filter((row) => row.provenance?.legacy_path)
      .map((row) => [row.provenance!.legacy_path!, row.id]),
  );

  const materialIds = new Map<string, { id: string; checksum: string }>();
  for (const { spec, bytes } of sourceBytes) {
    const checksum = createHash("sha256").update(bytes).digest("hex");
    let materialId = existingByPath.get(spec.relativePath);
    if (!materialId) {
      const key = `brands/${take.brand_id}/works/${workId}/materials/${checksum}/${path.basename(spec.relativePath)}`;
      await putR2Object(key, bytes, spec.mediaType, "private, max-age=31536000, immutable");
      const { data: material, error: materialError } = await supabase
        .from("brand_materials")
        .insert({
          scope: "work",
          brand_id: take.brand_id,
          work_id: workId,
          kind: spec.kind,
          label: path.basename(spec.relativePath),
          media_type: spec.mediaType,
          r2_key: key,
          bytes: bytes.byteLength,
          checksum,
          source_kind: "upload",
          provenance: { ...PROVENANCE, legacy_path: spec.relativePath, role: spec.role },
          created_by: take.created_by,
        })
        .select("id")
        .single();
      if (materialError || !material) {
        await deleteR2Object(key);
        throw new Error(materialError?.message ?? `素材を登録できませんでした: ${spec.role}`);
      }
      materialId = material.id as string;
    }
    materialIds.set(spec.relativePath, { id: materialId, checksum });
  }

  const inputRows = MATERIALS.map((spec) => {
    const material = materialIds.get(spec.relativePath)!;
    return { take_id: take.id, material_id: material.id, role: spec.role, checksum: material.checksum };
  });
  const { error: inputsError } = await supabase.from("take_inputs").upsert(inputRows);
  if (inputsError) throw new Error(`入力素材を固定できませんでした: ${inputsError.message}`);

  const brief = replaceSources(take.brief, materialIds);
  const { error: briefError } = await supabase
    .from("takes")
    .update({ brief, updated_at: new Date().toISOString() })
    .eq("id", take.id);
  if (briefError) throw new Error(`briefを素材参照へ更新できませんでした: ${briefError.message}`);

  console.log(`work: ${workId}\nregistered: ${materialIds.size}\nbrief: material references pinned`);
}

function replaceSources(brief: EventBrief, materialIds: ReadonlyMap<string, { id: string }>): EventBrief {
  const source = (current: string): string => {
    const relative = current.startsWith(`${EVENT_ROOT}/`) ? current.slice(EVENT_ROOT.length + 1) : null;
    const material = relative ? materialIds.get(relative) : null;
    return material ? materialUri(material.id) : current;
  };
  return {
    ...brief,
    logos: brief.logos.map((logo) => ({ ...logo, src: logo.src ? source(logo.src) : null })),
    guests: brief.guests.map((guest) => ({
      ...guest,
      photo: guest.photo ? { ...guest.photo, src: source(guest.photo.src) } : null,
    })),
    visuals: {
      ...brief.visuals,
      inkArt: brief.visuals.inkArt ? source(brief.visuals.inkArt) : null,
      value: brief.visuals.value ? { ...brief.visuals.value, src: source(brief.visuals.value.src) } : null,
      programs: brief.visuals.programs ? { ...brief.visuals.programs, src: source(brief.visuals.programs.src) } : null,
      closing: brief.visuals.closing ? { ...brief.visuals.closing, src: source(brief.visuals.closing.src) } : null,
      texture: brief.visuals.texture ? source(brief.visuals.texture) : null,
    },
    bgm: brief.bgm ? source(brief.bgm) : null,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
