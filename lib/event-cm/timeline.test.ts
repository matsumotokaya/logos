import assert from "node:assert/strict";
import test from "node:test";
import { eventCmTimeline, EVENT_CM_INTRO_MS } from "@/remotion/event-cm/timeline";
import { EVENT_CM_SCENE_ROLES, type EventCmBrief } from "@/remotion/event-cm/types";
import { seedEventCmBrief } from "./seed";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-11T09:00:00+09:00"), seed: "take-1" },
);

const withScript = (brief: EventCmBrief, texts: string[]): EventCmBrief => ({
  ...brief,
  script: {
    ...brief.script,
    scenes: EVENT_CM_SCENE_ROLES.map((role, i) => ({ role, text: texts[i] })),
  },
});

test("台本が無くても5シーンの尺が決まる", () => {
  // This is what makes "add a video" produce something that plays: no LLM
  // call, no render, and still a complete film.
  const timeline = eventCmTimeline(SEEDED);

  assert.equal(timeline.source, "budget");
  assert.deepEqual(
    timeline.scenes.map((scene) => scene.role),
    [...EVENT_CM_SCENE_ROLES],
  );
  assert.ok(timeline.scenes.every((scene) => scene.durationMs > 0));
  assert.ok(timeline.totalMs > 20_000 && timeline.totalMs < 40_000, "30秒前後に収まる");
});

test("シーンは隙間なく連続する", () => {
  const timeline = eventCmTimeline(SEEDED);
  let expected = 0;
  for (const scene of timeline.scenes) {
    assert.equal(scene.fromMs, expected, `${scene.role} が前のシーンの直後から始まる`);
    expected += scene.durationMs;
  }
  assert.equal(timeline.totalMs, expected);
});

test("台本を書くと尺がその文字数に従う", () => {
  const short = withScript(SEEDED, ["あ".repeat(28), "い".repeat(35), "う".repeat(49), "え".repeat(56), "お".repeat(42)]);
  const long = withScript(SEEDED, ["あ".repeat(28), "い".repeat(35), "う".repeat(49), "え".repeat(140), "お".repeat(42)]);

  const shortTimeline = eventCmTimeline(short);
  const longTimeline = eventCmTimeline(long);

  assert.equal(shortTimeline.source, "script");
  const shortProgram = shortTimeline.scenes.find((s) => s.role === "program")!;
  const longProgram = longTimeline.scenes.find((s) => s.role === "program")!;
  assert.ok(longProgram.durationMs > shortProgram.durationMs * 2, "長い台本は長いシーンになる");
  assert.ok(longTimeline.totalMs > shortTimeline.totalMs);
});

test("短すぎる一行でも読める最小の尺を確保する", () => {
  const terse = withScript(SEEDED, ["短い", "短い", "短い", "短い", "短い"]);
  const timeline = eventCmTimeline(terse);
  assert.ok(
    timeline.scenes.every((scene) => scene.durationMs >= 2500),
    "1文字の行が0.3秒のカットにならない",
  );
});

test("音声があれば実測が台本の推定を上書きする", () => {
  const scripted = withScript(SEEDED, ["あ".repeat(28), "い".repeat(35), "う".repeat(49), "え".repeat(56), "お".repeat(42)]);
  const spoken: EventCmBrief = {
    ...scripted,
    voice: {
      audio: "material:00000000-0000-0000-0000-000000000000",
      track: {
        version: 1,
        generatedAt: "2026-08-11T00:00:00.000Z",
        totalMs: 31_000,
        sampleRate: 24_000,
        mock: false,
        provider: "gemini",
        voice: "Schedar",
        scenes: EVENT_CM_SCENE_ROLES.map((role, i) => ({
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
  // The measured track plus the music's lead-in.
  assert.equal(timeline.totalMs, 31_000 + EVENT_CM_INTRO_MS);
  assert.equal(timeline.scenes[1].fromMs, 6_200 + EVENT_CM_INTRO_MS);
  assert.equal(timeline.narrationStartMs, EVENT_CM_INTRO_MS);
  assert.equal(timeline.narrationEndMs, 31_000 + EVENT_CM_INTRO_MS);
});

test("音楽だけで始まる時間が必ず先頭にある", () => {
  // A film that starts talking on frame one has no opening, and the lead-in is
  // the only moment where the music is at full level.
  const timeline = eventCmTimeline(SEEDED);
  assert.equal(timeline.narrationStartMs, EVENT_CM_INTRO_MS);
  assert.ok(timeline.scenes[0].durationMs > EVENT_CM_INTRO_MS, "冒頭の絵は最初から出ている");
  assert.equal(timeline.scenes[0].fromMs, 0);
});
