import assert from "node:assert/strict";
import test from "node:test";
import {
  bakeState,
  narrationIsOff,
  pendingFilmSteps,
  renderIsBehind,
  voiceReadsScenario,
} from "./bake";
import { setSuppressed } from "./facts";
import { seedEventCmBrief } from "./seed";
import { eventCmFilm } from "@/remotion/event-cm/film";
import { eventCmSceneKey, type EventCmBrief } from "@/remotion/event-cm/types";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-14T09:00:00+09:00"), seed: "take-1" },
);

/** A brief whose scenario covers every narrated picture of its own film. */
function written(brief: EventCmBrief, at: string): EventCmBrief {
  const scenes = eventCmFilm(brief)
    .scenes.filter((scene) => scene.narrated)
    .map((scene) => ({
      role: scene.role,
      ...(scene.index === undefined ? {} : { index: scene.index }),
      text: `${scene.key}の行`,
    }));
  return {
    ...brief,
    scenario: { version: 1, scenes, source: "llm", updatedAt: at, angle: "" },
  };
}

/** That scenario, read aloud. */
function spoken(brief: EventCmBrief, at: string): EventCmBrief {
  return {
    ...brief,
    voice: {
      audio: "material:00000000-0000-0000-0000-000000000001",
      track: {
        version: 1,
        generatedAt: at,
        totalMs: 34000,
        sampleRate: 24000,
        mock: true,
        provider: "mock",
        voice: "Zephyr",
        captions: [],
        scenes: brief.scenario.scenes.map((scene, index) => ({
          ...scene,
          startMs: index * 5000,
          durationMs: 4000,
        })),
      },
    },
  };
}

test("一度も実行していない動画は「未実行」で、差分は数えない", () => {
  const state = bakeState(SEEDED, null);
  assert.equal(state.baked, false);
  assert.deepEqual(state.changes, []);
});

test("焼き付けた版と同じなら差分は無い", () => {
  const brief = spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z");
  assert.deepEqual(bakeState(brief, brief).changes, []);
});

test("事実・シナリオ・読み上げは、それぞれ別の差分として言う", () => {
  const baked = spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z");
  assert.deepEqual(
    bakeState({ ...baked, factsUpdatedAt: "2026-08-14T11:00:00Z" }, baked).changes,
    ["facts"],
  );
  assert.deepEqual(
    bakeState(written(baked, "2026-08-14T12:00:00Z"), baked).changes,
    ["scenario"],
  );
  assert.deepEqual(
    bakeState(spoken(baked, "2026-08-14T13:00:00Z"), baked).changes,
    ["voice"],
  );
});

test("素材URLが署名し直されただけでは差分にならない", () => {
  const baked = spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z");
  // What the client actually receives: the same take, its pointers resolved to
  // freshly signed URLs. A deep equality would call this a change on every load.
  const reloaded: EventCmBrief = {
    ...baked,
    bgm: "/api/brands/b/takes/t/materials/m/bgm.mp3?key=k&sig=NEW",
    voice: { ...baked.voice!, audio: "/api/…/voice.wav?sig=NEW" },
  };
  assert.deepEqual(bakeState(reloaded, baked).changes, []);
});

test("読み上げは、いま書かれている言葉と一致するときだけ「合っている」", () => {
  const brief = written(SEEDED, "2026-08-14T10:00:00Z");
  assert.equal(voiceReadsScenario(brief), false, "録音が無いのに一致と言っている");

  const recorded = spoken(brief, "2026-08-14T10:05:00Z");
  assert.equal(voiceReadsScenario(recorded), true);

  const edited: EventCmBrief = {
    ...recorded,
    scenario: {
      ...recorded.scenario,
      scenes: recorded.scenario.scenes.map((scene, index) =>
        index === 1 ? { ...scene, text: "書き直した行" } : scene,
      ),
      source: "human",
      updatedAt: "2026-08-14T11:00:00Z",
    },
  };
  assert.equal(voiceReadsScenario(edited), false);
});

test("シナリオが未着手なら、書く・読む・反映するの3手", () => {
  assert.deepEqual(pendingFilmSteps(SEEDED, null), ["scenario", "voice", "bake"]);
});

test("手で直したシナリオは書き直さないし、件数にも入れない", () => {
  const brief = spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z");
  const edited: EventCmBrief = {
    ...brief,
    scenario: { ...brief.scenario, source: "human", updatedAt: "2026-08-14T11:00:00Z" },
    factsUpdatedAt: "2026-08-14T12:00:00Z",
  };
  // Facts moved under a hand-written scenario: the film is out of date, and the
  // button still must not offer to rewrite words somebody typed.
  assert.equal(pendingFilmSteps(edited, brief).includes("scenario"), false);
});

test("ナレーションをオフにした動画で、実行が勝手に音声を戻さない", () => {
  const brief = written(SEEDED, "2026-08-14T10:00:00Z");
  assert.ok(pendingFilmSteps(brief, brief).includes("voice"));

  const off = setSuppressed(brief, "voice", true);
  assert.equal(narrationIsOff(off), true);
  assert.equal(pendingFilmSteps(off, off).includes("voice"), false);
});

test("シナリオを書き直すなら、読み上げと反映も必ず続く", () => {
  const stale: EventCmBrief = {
    ...spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z"),
    factsUpdatedAt: "2026-08-14T12:00:00Z",
  };
  assert.deepEqual(pendingFilmSteps(stale, stale), ["scenario", "voice", "bake"]);
});

test("全部揃って焼き付け済みなら、やることは無い", () => {
  const brief = spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z");
  assert.deepEqual(pendingFilmSteps(brief, brief), []);
});

test("コマが増えた直後は、シナリオから追いつかせる", () => {
  const brief = spoken(written(SEEDED, "2026-08-14T10:00:00Z"), "2026-08-14T10:05:00Z");
  const withGuest: EventCmBrief = {
    ...brief,
    guests: [{ name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: null }],
  };
  // The film gained a picture, so the scenario has the wrong set of lines —
  // exactly the state `scenarioStaleness` calls "shape".
  const keys = eventCmFilm(withGuest)
    .scenes.filter((scene) => scene.narrated)
    .map((scene) => scene.key);
  assert.ok(keys.includes(eventCmSceneKey({ role: "guests" })));
  assert.deepEqual(pendingFilmSteps(withGuest, brief), ["scenario", "voice", "bake"]);
});

test("読む言葉が無いのに読み上げを予告しない", () => {
  // Hand-authored and still empty: the scenario step will not run (it never
  // overwrites human words) and there is nothing to speak, so listing 読み上げ
  // would promise a step that can only answer 「先に台本を作成してください」.
  const empty: EventCmBrief = {
    ...SEEDED,
    scenario: { version: 1, scenes: [], source: "human", updatedAt: "", angle: "" },
  };
  assert.deepEqual(pendingFilmSteps(empty, null), ["bake"]);
  assert.deepEqual(pendingFilmSteps(empty, empty), []);
  assert.deepEqual(pendingFilmSteps(empty, empty, { redo: true }), ["bake"]);
});

test("MP4は、焼き付けより古いときだけ古いと言う", () => {
  assert.equal(renderIsBehind("2026-08-14T10:00:00Z", "2026-08-14T11:00:00Z"), true);
  assert.equal(renderIsBehind("2026-08-14T12:00:00Z", "2026-08-14T11:00:00Z"), false);
  assert.equal(renderIsBehind(null, "2026-08-14T11:00:00Z"), false);
  assert.equal(renderIsBehind("2026-08-14T10:00:00Z", null), false);
});
