import assert from "node:assert/strict";
import test from "node:test";
import { placeImagesIntoBrief, treatmentFor, type ImageMaterial } from "./place-images";
import { markUserEdited, setSuppressed } from "./facts";
import { seedEventCmBrief } from "./seed";
import type { ImageReading } from "./structure";
import type { EventCmBrief } from "@/remotion/event-cm/types";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-11T09:00:00+09:00"), seed: "take-1" },
);

const WITH_GUESTS: EventCmBrief = {
  ...SEEDED,
  guests: [
    { name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: null },
    { name: "大西 美香", role: "Miss SAKE 代表理事", photo: null },
  ],
};

const reading = (over: Partial<ImageReading> & { ref: string }): ImageReading => ({
  role: "scene-photo",
  caption: "",
  visibleText: [],
  personName: null,
  personEvidence: null,
  focusX: "centre",
  focusY: "centre",
  confidence: "high",
  reason: "",
  ...over,
});

const material = (id: string, over: Partial<ImageMaterial> = {}): ImageMaterial => ({
  materialId: id,
  label: `${id}.jpg`,
  luminance: 0.2,
  opaque: false,
  aspect: 1.5,
  sent: true,
  ...over,
});

test("氏名の根拠がある顔写真は、その登壇者に入る", () => {
  const result = placeImagesIntoBrief(
    WITH_GUESTS,
    [
      reading({
        ref: "img-1",
        role: "speaker-portrait",
        personName: "宮尾佳明",
        personEvidence: "image-caption",
        focusY: "upper",
      }),
    ],
    [material("img-1")],
    "フライヤー.pdf",
  );

  assert.equal(result.brief.guests[0].photo?.src, "material:img-1");
  assert.equal(result.brief.guests[0].photo?.focus?.y, 0.38);
  assert.equal(result.brief.guests[1].photo, null);
  assert.equal(result.placed[0].path, "guests[0].photo");
  assert.equal(result.brief.provenance?.["guests[0].photo"]?.origin, "extracted");
});

test("誰の顔か根拠が無ければ、置かずに理由を残す", () => {
  const result = placeImagesIntoBrief(
    WITH_GUESTS,
    [reading({ ref: "img-1", role: "speaker-portrait" })],
    [material("img-1")],
    "フライヤー.pdf",
  );

  assert.equal(result.placed.length, 0);
  assert.equal(result.brief.guests[0].photo, null);
  assert.match(result.unused[0].reason, /誰の写真か/);
  // One line per picture: the first reason is the real one, and repeating it
  // at the end as "no free slot" would count one image twice.
  assert.equal(result.unused.length, 1);
});

test("登壇者に居ない人の写真は置かない", () => {
  const result = placeImagesIntoBrief(
    WITH_GUESTS,
    [
      reading({
        ref: "img-1",
        role: "speaker-portrait",
        personName: "田中 太郎",
        personEvidence: "document-text",
      }),
    ],
    [material("img-1")],
    "フライヤー.pdf",
  );

  assert.equal(result.placed.length, 0);
  assert.match(result.unused[0].reason, /登壇者に居ません/);
});

test("キービジュアル・情景・会場が、主役／プログラム／締めへ順に入る", () => {
  const result = placeImagesIntoBrief(
    SEEDED,
    [
      reading({ ref: "img-1", role: "key-visual", caption: "乾杯の様子" }),
      reading({ ref: "img-2", role: "scene-photo", caption: "蔵での実演" }),
      reading({ ref: "img-3", role: "venue", caption: "会場全景" }),
    ],
    [material("img-1"), material("img-2"), material("img-3")],
    "フライヤー.pdf",
  );

  assert.equal(result.brief.visuals.value?.src, "material:img-1");
  assert.equal(result.brief.visuals.programs?.src, "material:img-2");
  assert.equal(result.brief.visuals.closing?.src, "material:img-3");
  assert.equal(result.unused.length, 0);
});

test("同じ画像を2つのスロットには入れない", () => {
  const result = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "key-visual" })],
    [material("img-1")],
    "フライヤー.pdf",
  );

  assert.equal(result.brief.visuals.value?.src, "material:img-1");
  assert.equal(result.brief.visuals.programs, null);
  assert.equal(result.brief.visuals.closing, null);
});

test("確信の持てない画像は勝手に採用しない", () => {
  const result = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "key-visual", confidence: "low" })],
    [material("img-1")],
    "フライヤー.pdf",
  );

  assert.equal(result.brief.visuals.value, null);
  assert.equal(result.placed.length, 0);
});

test("利用者が決めた写真も、消した枠も上書きしない", () => {
  const chosen = markUserEdited(
    {
      ...SEEDED,
      visuals: { ...SEEDED.visuals, value: { src: "material:mine" } },
    },
    "visuals.value",
  );
  const off = setSuppressed(chosen, "visuals.programs", true);

  const result = placeImagesIntoBrief(
    off,
    [
      reading({ ref: "img-1", role: "key-visual" }),
      reading({ ref: "img-2", role: "scene-photo" }),
    ],
    [material("img-1"), material("img-2")],
    "フライヤー.pdf",
  );

  assert.equal(result.brief.visuals.value?.src, "material:mine");
  assert.equal(result.brief.visuals.programs, null);
  // The slots a person settled are untouched; the one still free may be filled.
  // Either way every picture is accounted for, placed or listed with a reason.
  assert.equal(result.placed.length + result.unused.length, 2);
  assert.ok(result.placed.every((entry) => entry.path === "visuals.closing"));
});

test("資料そのものや質感は、映像のスロットに入れない", () => {
  const result = placeImagesIntoBrief(
    SEEDED,
    [
      reading({ ref: "img-1", role: "document" }),
      reading({ ref: "img-2", role: "unreadable" }),
    ],
    [material("img-1"), material("img-2")],
    "フライヤー.pdf",
  );

  assert.equal(result.placed.length, 0);
  assert.equal(result.unused.length, 2);
  assert.equal(result.brief.visuals.value, null);
});

test("ロゴの描き方は、透過と輝度の両方で決まる", () => {
  // Transparent artwork: brightness decides.
  assert.equal(treatmentFor(0.1, false), "knockout");
  assert.equal(treatmentFor(0.9, false), "light");
  // Opaque artwork is drawn as supplied, whatever it measures. Knocking it out
  // is what shipped wrong: the filter has no alpha to cut, so it painted the
  // plate AND the mark white and a corporate logo rendered as a blank box.
  assert.equal(treatmentFor(0.95, true), "light");
  assert.equal(treatmentFor(0.1, true), "light");
  // Unmeasurable falls to the treatment that cannot fail on an ink ground.
  assert.equal(treatmentFor(null, false), "knockout");

  const result = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "logo", visibleText: ["宮尾酒造"] })],
    [material("img-1", { luminance: 0.12 })],
    "フライヤー.pdf",
  );

  const added = result.brief.logos.at(-1);
  assert.equal(added?.src, "material:img-1");
  assert.equal(added?.name, "宮尾酒造");
  assert.equal(added?.treatment, "knockout");

  // The real case: a corporate mark supplied as a JPEG, dark artwork on a white
  // plate. It is drawn as it came — plate and all — because the alternative on
  // the screen was a blank white box with the mark destroyed.
  const opaque = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-2", role: "logo", visibleText: ["レオパレス21"] })],
    [material("img-2", { luminance: 0.93, opaque: true })],
    "フライヤー.pdf",
  );
  assert.equal(opaque.brief.logos.at(-1)?.treatment, "light");
});

test("判定が返らなかった画像も、消えずに理由が残る", () => {
  // Eleven images went to the model and ten came back. The eleventh must not
  // simply be absent from every list.
  const result = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "key-visual" })],
    [material("img-1"), material("img-2"), material("img-3", { sent: false, note: "画像の送信上限を超えたため送っていません" })],
    "フライヤー.pdf",
  );

  const unjudged = result.unused.find((entry) => entry.materialId === "img-2");
  assert.match(unjudged?.reason ?? "", /判定が返りません/);
  const unsent = result.unused.find((entry) => entry.materialId === "img-3");
  assert.match(unsent?.reason ?? "", /送信上限/);
  assert.equal(result.placed.length + result.unused.length, 3);
});

test("写真が入ってもナレーションは古くならない", () => {
  const result = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "key-visual" })],
    [material("img-1")],
    "フライヤー.pdf",
  );

  // A photograph changes what the film shows, not what it says.
  assert.equal(result.brief.factsUpdatedAt, SEEDED.factsUpdatedAt);
});

test("すでに入っているロゴでも、描き方が違えば直す", () => {
  // The self-healing case, and the one that repairs what shipped: a plated
  // mark stored as `knockout` renders as a blank white box, and a re-run has
  // to be able to take that back rather than refusing to look at a mark it has
  // seen before.
  const withWrongLogo: EventCmBrief = {
    ...SEEDED,
    logos: [
      ...SEEDED.logos,
      { name: "レオパレス21", src: "material:img-1", treatment: "knockout" },
    ],
  };
  const result = placeImagesIntoBrief(
    withWrongLogo,
    [reading({ ref: "img-1", role: "logo" })],
    [material("img-1", { luminance: 0.93, opaque: true })],
    "フライヤー.pdf",
  );

  assert.equal(result.brief.logos.at(-1)?.treatment, "light");
  assert.match(result.placed[0]?.reason ?? "", /そのまま描くように直しました/);
  // Idempotent: run it again and there is nothing left to fix.
  const again = placeImagesIntoBrief(
    result.brief,
    [reading({ ref: "img-1", role: "logo" })],
    [material("img-1", { luminance: 0.93, opaque: true })],
    "フライヤー.pdf",
  );
  assert.equal(again.placed.length, 0);
  assert.match(again.unused[0]?.reason ?? "", /すでにロゴ/);
});

test("初めて置くマークも、なぜその描き方なのかを事実どおりに記録する", () => {
  // The run log is where someone reads the rule back. It once said "透過の明るい
  // マーク" about a JPEG — artwork that cannot carry transparency at all — and
  // carried a second branch describing the plated-mark knockout that had just
  // been removed. Wording that contradicts the rule is how the rule gets
  // reintroduced.
  const plated = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "logo" })],
    [material("img-1", { luminance: 0.93, opaque: true })],
    "フライヤー.pdf",
  );
  assert.equal(plated.brief.logos.at(-1)?.treatment, "light");
  assert.match(plated.placed[0]?.reason ?? "", /地の付いた画像/);

  const darkOnAlpha = placeImagesIntoBrief(
    SEEDED,
    [reading({ ref: "img-1", role: "logo" })],
    [material("img-1", { luminance: 0.1, opaque: false })],
    "フライヤー.pdf",
  );
  assert.equal(darkOnAlpha.brief.logos.at(-1)?.treatment, "knockout");
  assert.match(darkOnAlpha.placed[0]?.reason ?? "", /透過した暗いマーク/);
});
