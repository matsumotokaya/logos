import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAssetChoice,
  applyFactEdit,
  isAssetSlot,
  applySuppression,
  isSuppressed,
  markUserEdited,
  previewOf,
  setSuppressed,
} from "./facts";
import { seedEventCmBrief } from "./seed";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-11T09:00:00+09:00"), seed: "take-1" },
);

test("直した値は「あなたの入力」になり、仮の値として警告されない", () => {
  const before = eventCmGoalState(SEEDED);
  assert.ok(before.provisional.some((field) => field.path === "schedule.date"));

  const edited = markUserEdited(
    applyFactEdit(SEEDED, "schedule.date", ["2026.11.14"])!,
    "schedule.date",
  );
  const after = eventCmGoalState(edited);

  assert.equal(edited.schedule.date, "2026.11.14");
  assert.ok(!after.provisional.some((field) => field.path === "schedule.date"));
});

test("消した項目は「不足」ではなく「決めたこと」として扱われる", () => {
  // Nobody should be asked to go and find a fee they decided not to show.
  const off = setSuppressed(SEEDED, "schedule.fee", true);
  const state = eventCmGoalState(off);

  assert.equal(isSuppressed(off, "schedule.fee"), true);
  assert.ok(!state.fields.some((field) => field.path === "schedule.fee"));
  assert.deepEqual(state.suppressed, ["schedule.fee"]);
});

test("消した項目は描画前に空にされる", () => {
  const off = setSuppressed(SEEDED, "seriesLabel", true);
  assert.equal(SEEDED.seriesLabel.length > 0, true);
  assert.equal(applySuppression(off).seriesLabel, "");
});

test("消してから戻すと元の値が返ってくる", () => {
  // Suppression hides; it never destroys.
  const off = setSuppressed(SEEDED, "valueChip", true);
  const on = setSuppressed(off, "valueChip", false);

  assert.equal(applySuppression(off).valueChip, null);
  assert.equal(applySuppression(on).valueChip, SEEDED.valueChip);
});

test("複数行の項目は1行1件として書き戻される", () => {
  const edited = applyFactEdit(SEEDED, "programs", [
    "基調講演",
    "",
    "  パネルディスカッション  ",
  ]);
  assert.deepEqual(edited?.programs, [
    { title: "基調講演" },
    { title: "パネルディスカッション" },
  ]);
});

test("編集できない項目への書き込みは拒否される", () => {
  assert.equal(applyFactEdit(SEEDED, "voice", ["なにか"]), null);
  assert.equal(applyFactEdit(SEEDED, "logos", ["なにか"]), null);
});

test("一覧の表示は生のJSONではなく読める形にする", () => {
  assert.equal(previewOf(SEEDED, "programs"), SEEDED.programs.map((p) => p.title).join(" / "));
  assert.equal(previewOf(SEEDED, "guests"), "");
  assert.equal(previewOf(SEEDED, "schedule.date"), SEEDED.schedule.date);
});

test("音源スロットは選ぶもので、任意の値は書き込めない", () => {
  const chosen = applyAssetChoice(SEEDED, "bgm", "defaults/bgm/ink-cinematic.mp3");
  assert.equal(chosen?.bgm, "defaults/bgm/ink-cinematic.mp3");

  // Clearing is a legitimate choice: a film with no music.
  assert.equal(applyAssetChoice(SEEDED, "bgm", null)?.bgm, null);

  // Only declared asset slots. Text fields are edited, not chosen.
  assert.equal(applyAssetChoice(SEEDED, "title", "x"), null);
  assert.equal(isAssetSlot("bgm"), true);
  assert.equal(isAssetSlot("title"), false);
});

test("音楽を選ぶと「あなたの入力」になる", () => {
  const chosen = markUserEdited(
    applyAssetChoice(SEEDED, "bgm", "defaults/bgm/ink-cinematic.mp3")!,
    "bgm",
  );
  assert.equal(chosen.provenance?.bgm?.origin, "user");
});
