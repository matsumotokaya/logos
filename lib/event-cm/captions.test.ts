import assert from "node:assert/strict";
import test from "node:test";
import {
  captionAt,
  captionsFor,
  splitCards,
  splitSentences,
} from "@/remotion/event-cm/captions";
import { eventCmTimeline, EVENT_CM_INTRO_MS } from "@/remotion/event-cm/timeline";
import { eventCmNarratedSteps, type EventCmBrief } from "@/remotion/event-cm/types";
import { seedEventCmBrief } from "./seed";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-12T09:00:00+09:00"), seed: "take-1" },
);

/** The narration actually written for the sake event — one line per picture,
 *  starting with the title call. */
const SPOKEN: Record<string, string> = {
  title: "ウェルスパークラボがおくる、パッションアセットの世界。世界が恋する日本酒です。",
  value: "一杯の日本酒から、新しい出会いと学びが始まります。日本文化を味わい、仲間と語り合い、過ごす時間です。",
  program: "江戸切子の酒器で、六種類を飲み比べます。宮尾酒造当主のトークを聞き、味や香りを学びます。",
  guests: "宮尾酒造の当主が、知られざる舞台裏を語ります。",
  cta: "十月三日、土曜日、午後一時から。ご案内は、ホームページをご覧ください。",
};

const scripted: EventCmBrief = {
  ...SEEDED,
  script: {
    version: 1,
    scenes: eventCmNarratedSteps(SEEDED).map(({ role, index }) => ({
      role,
      ...(index === undefined ? {} : { index }),
      text: SPOKEN[role],
    })),
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
  assert.ok(
    captions.length > scripted.script.scenes.length,
    "シーン数より多い＝文単位で割れている",
  );
  // The first thing anyone reads is the title call.
  assert.equal(captions[0].text, "ウェルスパークラボがおくる、パッションアセットの世界。");
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

test("字幕は冒頭のロゴシーンには出ない", () => {
  const captions = captionsFor(scripted);
  assert.equal(captions[0].fromMs, EVENT_CM_INTRO_MS);
  assert.equal(captionAt(captions, 0), null);
  assert.equal(captionAt(captions, EVENT_CM_INTRO_MS - 1), null);
});

test("字幕は締めのロゴシーンには残らない", () => {
  // The film ends on the mark, alone. A subtitle still on screen over it would
  // be a line whose picture has already gone.
  const captions = captionsFor(scripted);
  const timeline = eventCmTimeline(scripted);
  const last = captions[captions.length - 1];
  assert.equal(last.toMs, timeline.narrationEndMs, "最後の字幕はナレーションの終わりで消える");
  assert.ok(last.toMs < timeline.totalMs);
});

test("長い文には長く出る（文字数で配分する）", () => {
  // Compared inside one scene, and never against the last sentence: that one
  // absorbs the rounding so its subtitle ends exactly where the scene does.
  const brief: EventCmBrief = {
    ...SEEDED,
    script: {
      version: 1,
      scenes: eventCmNarratedSteps(SEEDED).map(({ role, index }) => ({
        role,
        ...(index === undefined ? {} : { index }),
        text:
          role === "title"
            ? "短い一文。" + "長い方の文はこれくらいの分量があります。" + "締めの一文。"
            : SPOKEN[role],
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

/** The same script, with one picture's line replaced. */
const briefWith = (valueText: string): EventCmBrief => ({
  ...scripted,
  script: {
    ...scripted.script,
    scenes: scripted.script.scenes.map((scene) =>
      scene.role === "value" ? { ...scene, text: valueText } : scene,
    ),
  },
});

test("長すぎる一文は、画面を覆う代わりにカードへ割る", () => {
  // The failure this prevents: the band has no line limit, so one 1,200-character
  // "sentence" with no 。 grew a plate that covered the picture it was
  // subtitling. Nothing about the film stops a person writing that line.
  const runOn = "あ".repeat(1200);
  const brief = briefWith(runOn);
  const captions = captionsFor(brief);

  assert.ok(captions.length > 1, "一枚のままになっている");
  assert.ok(
    captions.every((caption) => caption.text.replace(/\s/g, "").length <= 28),
    "28字を超えるカードが残っている",
  );
  // Still bounded by its own scene, and still contiguous.
  const scene = eventCmTimeline(brief).scenes.find((entry) => entry.role === "value")!;
  const own = captions.filter(
    (caption) => caption.fromMs >= scene.fromMs && caption.toMs <= scene.fromMs + scene.durationMs,
  );
  assert.equal(own.length, captions.filter((c) => c.text.startsWith("あ")).length);
});

test("読点があれば、そこで割る", () => {
  const cards = splitCards("百貨店には並ばない蔵出しの日本酒を、五種類、じっくり味わいながら、その楽しみ方を学びます");
  assert.ok(cards.length >= 2);
  assert.ok(cards.every((card) => card.length <= 28));
  // Nothing is lost.
  assert.equal(cards.join(""), "百貨店には並ばない蔵出しの日本酒を、五種類、じっくり味わいながら、その楽しみ方を学びます");
});
