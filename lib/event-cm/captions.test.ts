import assert from "node:assert/strict";
import test from "node:test";
import { captionAt, captionsFor, splitSentences } from "@/remotion/event-cm/captions";
import { eventCmTimeline, EVENT_CM_INTRO_MS } from "@/remotion/event-cm/timeline";
import { EVENT_CM_SCENE_ROLES, type EventCmBrief } from "@/remotion/event-cm/types";
import { seedEventCmBrief } from "./seed";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-12T09:00:00+09:00"), seed: "take-1" },
);

/** The narration actually written for the sake event. */
const SPOKEN = [
  "江戸切子の酒器で、日本酒六種類を飲み比べる午後が待っています。",
  "ウェルスパークラボがおくる、パッションアセットの世界。世界が恋する日本酒です。",
  "一杯の日本酒から、新しい出会いと学びが始まります。日本文化を味わい、仲間と語り合い、過ごす時間です。",
  "江戸切子の酒器で、六種類を飲み比べます。宮尾酒造当主のトークを聞き、味や香りを学びます。",
  "十月三日、土曜日、午後一時から。ご案内は、ホームページをご覧ください。",
];

const scripted: EventCmBrief = {
  ...SEEDED,
  script: {
    version: 1,
    scenes: EVENT_CM_SCENE_ROLES.map((role, i) => ({ role, text: SPOKEN[i] })),
    source: "llm",
    updatedAt: "2026-08-12T00:00:00.000Z",
    angle: "…",
  },
};

test("文で割る（句点を残す）", () => {
  assert.deepEqual(splitSentences("あ。い！う？"), ["あ。", "い！", "う？"]);
  assert.deepEqual(splitSentences("句点のない一文"), ["句点のない一文"]);
  assert.deepEqual(splitSentences("  "), []);
});

test("台本があれば、音声を待たずに字幕が出る", () => {
  // The whole reason subtitles are derived from the script: a film watched
  // muted must be readable before anyone has paid for TTS.
  const captions = captionsFor(scripted);
  assert.ok(captions.length > SPOKEN.length, "シーン数より多い＝文単位で割れている");
  assert.equal(captions[0].text, "江戸切子の酒器で、日本酒六種類を飲み比べる午後が待っています。");
});

test("台本が無ければ字幕も無い", () => {
  assert.deepEqual(captionsFor(SEEDED), []);
});

test("字幕は重ならず、隙間なく続く", () => {
  const captions = captionsFor(scripted);
  for (let i = 1; i < captions.length; i += 1) {
    assert.ok(
      captions[i].fromMs >= captions[i - 1].toMs,
      `${i - 1}番目と${i}番目が重なっている`,
    );
  }
  for (const caption of captions) {
    assert.ok(caption.toMs > caption.fromMs, "長さがゼロの字幕がある");
  }
});

test("字幕は音楽だけのイントロ中には出ない", () => {
  const captions = captionsFor(scripted);
  assert.equal(captions[0].fromMs, EVENT_CM_INTRO_MS);
  assert.equal(captionAt(captions, 0), null);
  assert.equal(captionAt(captions, EVENT_CM_INTRO_MS - 1), null);
});

test("字幕は映像の終わりを越えない", () => {
  const captions = captionsFor(scripted);
  const timeline = eventCmTimeline(scripted);
  const last = captions[captions.length - 1];
  assert.equal(last.toMs, timeline.totalMs, "最後の字幕はちょうど終わりで消える");
});

test("長い文には長く出る（文字数で配分する）", () => {
  // Compared inside one scene, and never against the last sentence: that one
  // absorbs the rounding so its subtitle ends exactly where the scene does.
  const brief: EventCmBrief = {
    ...SEEDED,
    script: {
      version: 1,
      scenes: EVENT_CM_SCENE_ROLES.map((role, i) => ({
        role,
        text:
          i === 0
            ? "短い一文。" + "長い方の文はこれくらいの分量があります。" + "締めの一文。"
            : SPOKEN[i],
      })),
      source: "llm",
      updatedAt: "2026-08-12T00:00:00.000Z",
      angle: "…",
    },
  };

  const [short, long] = captionsFor(brief);
  assert.equal(short.text, "短い一文。");
  assert.equal(long.text, "長い方の文はこれくらいの分量があります。");
  assert.ok(
    long.toMs - long.fromMs > short.toMs - short.fromMs,
    "長い文の方が長く表示される",
  );
});

test("どの瞬間にも字幕は最大1枚", () => {
  const captions = captionsFor(scripted);
  const total = eventCmTimeline(scripted).totalMs;
  for (let ms = 0; ms < total; ms += 250) {
    const showing = captions.filter(
      (caption) => ms >= caption.fromMs && ms < caption.toMs,
    );
    assert.ok(showing.length <= 1, `${ms}ms に${showing.length}枚出ている`);
  }
});
