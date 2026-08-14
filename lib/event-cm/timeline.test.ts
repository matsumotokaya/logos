import assert from "node:assert/strict";
import test from "node:test";
import {
  eventCmTimeline,
  EVENT_CM_INTRO_MS,
  EVENT_CM_OUTRO_MS,
  EVENT_CM_SCENE_GAP_MS,
} from "@/remotion/event-cm/timeline";
import {
  eventCmNarratedSteps,
  eventCmScenePlan,
  type EventCmBrief,
} from "@/remotion/event-cm/types";
import { seedEventCmBrief } from "./seed";

// The seeded brief announces nobody: people are never invented (seed.ts), so
// this film has no speaker picture and four scenario lines.
const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-11T09:00:00+09:00"), seed: "take-1" },
);

const GUESTS = [
  { name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: null },
  { name: "大西 美香", role: "Miss SAKE 代表理事", photo: null },
];

const withScenario = (brief: EventCmBrief, texts: string[]): EventCmBrief => ({
  ...brief,
  scenario: {
    ...brief.scenario,
    // One line per narrated PICTURE. A brief that lists three programmes has
    // three programme pictures, so a fixture handing over four lines pads with
    // its last one rather than leaving scenes wordless (which would silently
    // fall back to the budget and make the arithmetic below meaningless).
    scenes: eventCmNarratedSteps(brief).map(({ role, index }, i) => ({
      role,
      ...(index === undefined ? {} : { index }),
      text: texts[i] ?? texts[texts.length - 1] ?? "",
    })),
  },
});

test("台本が無くても全シーンの尺が決まる", () => {
  // This is what makes "add a video" produce something that plays: no LLM
  // call, no render, and still a complete film.
  const timeline = eventCmTimeline(SEEDED);

  assert.equal(timeline.source, "budget");
  assert.deepEqual(
    timeline.scenes.map((scene) => scene.role),
    eventCmScenePlan(SEEDED).map((step) => step.role),
  );
  assert.ok(timeline.scenes.every((scene) => scene.durationMs > 0));
});

test("ロゴで始まりロゴで終わる", () => {
  const timeline = eventCmTimeline(SEEDED);
  const first = timeline.scenes[0];
  const last = timeline.scenes[timeline.scenes.length - 1];

  assert.equal(first.role, "logoIn");
  assert.equal(first.fromMs, 0);
  assert.equal(first.durationMs, EVENT_CM_INTRO_MS);

  assert.equal(last.role, "logoOut");
  assert.equal(last.durationMs, EVENT_CM_OUTRO_MS);
  assert.equal(last.fromMs + last.durationMs, timeline.totalMs);
});

test("ナレーションは2番目のシーンから始まり、締めのロゴの前で終わる", () => {
  const timeline = eventCmTimeline(SEEDED);
  assert.equal(timeline.narrationStartMs, EVENT_CM_INTRO_MS);
  assert.equal(timeline.scenes[1].role, "title");
  assert.equal(timeline.scenes[1].fromMs, EVENT_CM_INTRO_MS);
  assert.equal(timeline.narrationEndMs, timeline.totalMs - EVENT_CM_OUTRO_MS);
});

test("登壇者が居なければそのシーンは存在しない", () => {
  // A speaker picture with nobody in it is not a line-up, and a scenario line
  // about guests who do not exist is worse than silence.
  const withoutGuests = eventCmTimeline(SEEDED).scenes.map((scene) => scene.role);
  const withGuests = eventCmTimeline({ ...SEEDED, guests: GUESTS }).scenes.map(
    (scene) => scene.role,
  );

  assert.equal(withoutGuests.includes("guests"), false);
  assert.equal(withGuests.includes("guests"), true);
  assert.equal(withGuests.length, withoutGuests.length + 1);
});

test("シーンは隙間なく連続する", () => {
  const timeline = eventCmTimeline({ ...SEEDED, guests: GUESTS });
  let expected = 0;
  for (const scene of timeline.scenes) {
    assert.equal(scene.fromMs, expected, `${scene.role} が前のシーンの直後から始まる`);
    expected += scene.durationMs;
  }
  assert.equal(timeline.totalMs, expected);
});

test("ロゴは認識できる長さだけ出る", () => {
  // A mark that appears and vanishes inside a second reads as a glitch.
  assert.ok(EVENT_CM_INTRO_MS >= 3500, "冒頭のロゴが短すぎる");
  assert.ok(EVENT_CM_OUTRO_MS >= 3500, "締めのロゴが短すぎる");
});

test("章のあいだに間がある", () => {
  // Each picture is a chapter. Without air between them the next line starts
  // before the last one has landed.
  const line = "あ".repeat(35);
  const timeline = eventCmTimeline(withScenario(SEEDED, [line, line, line, line]));
  const spokenMs = Math.round((35 / 7) * 1000);
  for (const scene of timeline.scenes) {
    if (scene.role === "logoIn" || scene.role === "logoOut") continue;
    assert.equal(
      scene.durationMs,
      spokenMs + EVENT_CM_SCENE_GAP_MS,
      `${scene.role} に間が入っていない`,
    );
  }
});

test("30秒を超えてよい——正しい尺が要件", () => {
  // The brief asked for "about 30 seconds" and the structure now costs more
  // than that: eight seconds of marks plus a pause per chapter. Forty-five is
  // fine; a breathless thirty is not.
  const timeline = eventCmTimeline(SEEDED);
  assert.ok(timeline.totalMs > 30_000, `${timeline.totalMs}ms — 駆け足に戻っている`);
  assert.ok(timeline.totalMs < 50_000, `${timeline.totalMs}ms — 長すぎる`);
});

test("台本を書くと尺がその文字数に従う", () => {
  const short = withScenario(SEEDED, [
    "あ".repeat(28),
    "い".repeat(45),
    "う".repeat(44),
    "え".repeat(36),
  ]);
  const long = withScenario(SEEDED, [
    "あ".repeat(28),
    "い".repeat(45),
    "う".repeat(140),
    "え".repeat(36),
  ]);

  const shortTimeline = eventCmTimeline(short);
  const longTimeline = eventCmTimeline(long);

  assert.equal(shortTimeline.source, "scenario");
  const shortProgram = shortTimeline.scenes.find((s) => s.role === "program")!;
  const longProgram = longTimeline.scenes.find((s) => s.role === "program")!;
  assert.ok(longProgram.durationMs > shortProgram.durationMs * 2, "長い台本は長いシーンになる");
  assert.ok(longTimeline.totalMs > shortTimeline.totalMs);
});

test("無音のシーンは台本の長さに影響されない", () => {
  // Their job is fixed: establish the mark, and let it go. A long scenario must
  // not stretch the opening logo.
  const timeline = eventCmTimeline(
    withScenario(SEEDED, ["あ".repeat(200), "い", "う", "え"]),
  );
  assert.equal(timeline.scenes[0].durationMs, EVENT_CM_INTRO_MS);
  assert.equal(
    timeline.scenes[timeline.scenes.length - 1].durationMs,
    EVENT_CM_OUTRO_MS,
  );
});

test("短すぎる一行でも読める最小の尺を確保する", () => {
  const terse = withScenario(SEEDED, ["短い", "短い", "短い", "短い"]);
  const timeline = eventCmTimeline(terse);
  const narrated = eventCmNarratedSteps(SEEDED).map((step) => step.role);
  assert.ok(
    timeline.scenes
      .filter((scene) => narrated.includes(scene.role))
      .every((scene) => scene.durationMs >= 2500),
    "1文字の行が0.3秒のカットにならない",
  );
});

test("音声があれば実測が台本の推定を上書きする", () => {
  const roles = eventCmNarratedSteps(SEEDED).map((step) => step.role);
  const written = withScenario(SEEDED, roles.map((_, i) => "あ".repeat(30 + i)));
  const spoken: EventCmBrief = {
    ...written,
    voice: {
      audio: "material:00000000-0000-0000-0000-000000000000",
      track: {
        version: 1,
        generatedAt: "2026-08-11T00:00:00.000Z",
        // As long as the pictures it covers: six seconds and a bit each, for
        // however many narrated pictures this brief has.
        totalMs: roles.length * 6_200,
        sampleRate: 24_000,
        mock: false,
        provider: "gemini",
        voice: "Schedar",
        scenes: roles.map((role, i) => ({
          role,
          text: "",
          startMs: i * 6_200,
          durationMs: 6_200,
        })),
        captions: [],
      },
    },
  };

  const timeline = eventCmTimeline(spoken);
  assert.equal(timeline.source, "voice");
  // The measured track, plus the mark at each end.
  assert.equal(
    timeline.totalMs,
    roles.length * 6_200 + EVENT_CM_INTRO_MS + EVENT_CM_OUTRO_MS,
  );
  assert.equal(timeline.scenes[1].fromMs, EVENT_CM_INTRO_MS);
  assert.equal(timeline.scenes[2].fromMs, 6_200 + EVENT_CM_INTRO_MS);
  assert.equal(timeline.narrationStartMs, EVENT_CM_INTRO_MS);
  assert.equal(timeline.narrationEndMs, roles.length * 6_200 + EVENT_CM_INTRO_MS);
});
