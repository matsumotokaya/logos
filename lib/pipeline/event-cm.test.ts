import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_CM_GOAL, eventCmGoalState } from "./event-cm";
import type { EventCmBrief } from "@/remotion/event-cm/types";

const EMPTY: EventCmBrief = {
  presenter: "",
  seriesLabel: "",
  title: "",
  subtitle: "",
  sideCopy: null,
  valueLines: [],
  valueChip: null,
  programsHeading: "",
  programs: [],
  guestsHeading: "",
  guests: [],
  schedule: { date: "", weekday: "", time: "", venue: null, fee: null },
  cta: "",
  footnote: null,
  logos: [],
  visuals: { inkArt: null, value: null, programs: null, closing: null, texture: null },
  bgm: null,
  scenario: { version: 1, scenes: [], source: "llm", updatedAt: "", angle: "" },
};

const seeded: EventCmBrief = {
  ...EMPTY,
  title: "投資の本質を考える夜",
  presenter: "WealthPark Lab",
  valueLines: ["数字の向こうにある", "投資の意味を考える。"],
  programs: [{ title: "対談" }],
  schedule: { date: "2026.9.11", weekday: "FRI", time: "18:00 START", venue: null, fee: null },
  cta: "詳細・お申し込みはこちら",
  logos: [{ name: "WealthPark Lab", src: null }],
  scenario: {
    version: 1,
    scenes: [{ role: "title", text: "数字の向こうに、投資の意味がある。" }],
    source: "llm",
    updatedAt: "2026-08-11T00:00:00.000Z",
    angle: "投資を人生の側から考え直す夜",
  },
  provenance: {
    title: { origin: "inferred" },
    "schedule.date": { origin: "inferred" },
    "schedule.time": { origin: "inferred" },
    programs: { origin: "inferred" },
    valueLines: { origin: "inferred" },
    cta: { origin: "inferred" },
    scenario: { origin: "inferred" },
    presenter: { origin: "brand" },
    logos: { origin: "brand" },
  },
};

test("空のブリーフは必須項目をすべて不足として挙げる", () => {
  const state = eventCmGoalState(EMPTY);
  assert.equal(state.progress.filled.length, 0);
  assert.deepEqual(
    state.progress.missingRequired.map((field) => field.path).sort(),
    EVENT_CM_GOAL.filter((field) => field.required)
      .map((field) => field.path)
      .sort(),
  );
});

test("シード済みブリーフは必須を満たし、推定値だけを暫定として返す", () => {
  const state = eventCmGoalState(seeded);

  assert.deepEqual(state.progress.missingRequired, []);
  assert.deepEqual(
    state.provisional.map((field) => field.path).sort(),
    ["cta", "programs", "scenario", "schedule.date", "schedule.time", "title", "valueLines"],
  );
  // Brand-derived values are settled: they are not warned about on publish.
  const presenter = state.fields.find((field) => field.path === "presenter");
  assert.equal(presenter?.origin, "brand");
});

test("由来の記録が無い値は推定ではなく利用者の入力として扱う", () => {
  // Everything authored before provenance existed was written by a person.
  // Calling it "inferred" would put a warning on facts somebody checked.
  const withoutProvenance: EventCmBrief = { ...seeded };
  delete withoutProvenance.provenance;
  const state = eventCmGoalState(withoutProvenance);

  assert.deepEqual(state.provisional, []);
  assert.equal(
    state.fields.find((field) => field.path === "schedule.date")?.origin,
    "user",
  );
});

test("空文字と空配列は埋まっていないものとして数える", () => {
  const blank = { ...seeded, title: "   ", programs: [] };
  const state = eventCmGoalState(blank);
  const paths = state.progress.missing.map((field) => field.path);
  assert.ok(paths.includes("title"));
  assert.ok(paths.includes("programs"));
});
