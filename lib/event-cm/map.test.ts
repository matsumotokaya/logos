import assert from "node:assert/strict";
import test from "node:test";
import { mapFactsIntoBrief } from "./map";
import { markUserEdited, setSuppressed } from "./facts";
import { seedEventCmBrief } from "./seed";
import { EVENT_CM_SCENE_ROLES, scriptIsStale, type EventCmBrief } from "@/remotion/event-cm/types";
import type { EventFacts } from "./structure";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-11T09:00:00+09:00"), seed: "take-1" },
);

const withScript = (brief: EventCmBrief, at: string, source: "llm" | "human" = "llm"): EventCmBrief => ({
  ...brief,
  script: {
    version: 1,
    scenes: EVENT_CM_SCENE_ROLES.map((role) => ({ role, text: "…" })),
    source,
    updatedAt: at,
    angle: "…",
  },
});

const EMPTY_FACTS: EventFacts = {
  title: null,
  subtitle: null,
  seriesLabel: null,
  presenter: null,
  valueLines: null,
  valueChip: null,
  programs: null,
  guests: null,
  date: null,
  weekday: null,
  time: null,
  venue: null,
  fee: null,
  cta: null,
  footnote: null,
  note: null,
};

const NOW = "2026-08-12T00:00:00.000Z";

test("資料が言っていることを反映し、由来を「資料から読んだ」にする", () => {
  const result = mapFactsIntoBrief(
    SEEDED,
    { ...EMPTY_FACTS, title: "世界が恋する日本酒", date: "2026.10.2", weekday: "FRI" },
    "フライヤー.pdf",
    NOW,
  );

  assert.equal(result.brief.title, "世界が恋する日本酒");
  assert.equal(result.brief.schedule.date, "2026.10.2");
  assert.equal(result.brief.schedule.weekday, "FRI");
  assert.equal(result.brief.provenance?.title?.origin, "extracted");
  assert.equal(result.brief.provenance?.title?.source, "フライヤー.pdf");
  assert.deepEqual(result.applied.map((field) => field.path).sort(), [
    "schedule.date",
    "title",
  ]);
});

test("資料が言っていない項目は、仮の値のまま残す", () => {
  // null means "no new information", not "the material says this is empty".
  const result = mapFactsIntoBrief(SEEDED, EMPTY_FACTS, "メモ", NOW);

  assert.equal(result.brief.title, SEEDED.title);
  assert.deepEqual(result.applied, []);
  assert.equal(result.brief.factsUpdatedAt, undefined, "何も変わらなければ刻印しない");
});

test("人が決めた値は資料でも上書きしない", () => {
  const edited = markUserEdited(SEEDED, "title");
  const result = mapFactsIntoBrief(
    edited,
    { ...EMPTY_FACTS, title: "資料にあるタイトル" },
    "フライヤー.pdf",
    NOW,
  );

  assert.equal(result.brief.title, SEEDED.title);
  assert.deepEqual(result.keptUserValues, ["イベント名"]);
});

test("消すと決めた項目は資料でも復活しない", () => {
  const off = setSuppressed(SEEDED, "seriesLabel", true);
  const result = mapFactsIntoBrief(
    off,
    { ...EMPTY_FACTS, seriesLabel: "第3弾" },
    "フライヤー.pdf",
    NOW,
  );

  assert.notEqual(result.brief.seriesLabel, "第3弾");
});

test("登壇者は資料に書いてあれば入る（シードは絶対に埋めない項目）", () => {
  assert.deepEqual(SEEDED.guests, []);
  const result = mapFactsIntoBrief(
    SEEDED,
    {
      ...EMPTY_FACTS,
      guests: [{ name: "宮尾 佳明", role: "宮尾酒造 十一代目当主" }],
    },
    "フライヤー.pdf",
    NOW,
  );

  assert.equal(result.brief.guests.length, 1);
  assert.equal(result.brief.guests[0].name, "宮尾 佳明");
  assert.equal(result.brief.guests[0].photo, null);
});

test("事実が変わるとナレーションが古くなる", () => {
  // The bug this exists to catch: reading a flyer changed the event and left
  // the film narrating the seeded proposal.
  const scripted = withScript(SEEDED, "2026-08-11T10:00:00.000Z");
  assert.equal(scriptIsStale(scripted), false);

  const result = mapFactsIntoBrief(
    scripted,
    { ...EMPTY_FACTS, title: "世界が恋する日本酒" },
    "フライヤー.pdf",
    NOW,
  );

  assert.equal(scriptIsStale(result.brief), true);
});

test("項目を手で直してもナレーションが古くなる", () => {
  const scripted = withScript(SEEDED, "2026-08-11T10:00:00.000Z");
  const edited = markUserEdited(scripted, "schedule.date", NOW);
  assert.equal(scriptIsStale(edited), true);
});

test("台本が無いうちは「古い」にならない", () => {
  const result = mapFactsIntoBrief(
    SEEDED,
    { ...EMPTY_FACTS, title: "世界が恋する日本酒" },
    "フライヤー.pdf",
    NOW,
  );
  assert.equal(result.brief.script.scenes.length, 0);
  assert.equal(scriptIsStale(result.brief), false);
});
