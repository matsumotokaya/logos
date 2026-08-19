import assert from "node:assert/strict";
import test from "node:test";

import { normalizationProposal, opticalScales, type MeasuredMark } from "./optical";

// The baseline is the Freehand Lab's five partner marks, measured from the real
// files (labs/freehand/sake-2026/src/freehand/marks.json). Those numbers were
// looked at by the person who signed the film off, so a change in the maths that
// moves them is a change in a judgement somebody already made — this file is
// where that shows up as a failure instead of as a differently-sized logo.
const SAKE_ROW: MeasuredMark[] = [
  // wealthpark-lab.svg — 270×42 trimmed, a long thin wordmark
  { id: "wealthpark-lab", inkRatio: 0.223, trimWidth: 270, trimHeight: 42 },
  // leopalace21.png — 800×183, a solid wordmark
  { id: "leopalace21", inkRatio: 0.3283, trimWidth: 800, trimHeight: 183 },
  // shimeharitsuru.png — 246×246, a square seal
  { id: "shimeharitsuru", inkRatio: 0.2966, trimWidth: 246, trimHeight: 246 },
  // miss-sake.png — 185×100, a two-line lockup
  { id: "miss-sake", inkRatio: 0.2527, trimWidth: 185, trimHeight: 100 },
  // miss-sake-red.webp — 351×192 after its white plate was lifted. Part of the
  // row rather than a footnote: it is what moves the median, and dropping it
  // changes every other mark's scale.
  { id: "miss-sake-red", inkRatio: 0.254, trimWidth: 351, trimHeight: 192 },
];

test("実素材5件のスケールがラボの判定値と一致する", () => {
  const scales = opticalScales(SAKE_ROW);
  // 幅の上限（4.6）に当たって引き戻された1件。aspect 6.43 なので 4.6/6.43。
  assert.ok(
    Math.abs((scales.get("wealthpark-lab") ?? 0) - 0.716) < 0.02,
    `wealthpark-lab: ${scales.get("wealthpark-lab")}`,
  );
  // 下限（0.78）に当たった1件。インクが最も多いので縮める側。
  assert.equal(scales.get("leopalace21"), 0.78);
  // 正方形の印章は、同じ高さだと軽く見えるので大きくする。
  assert.ok(
    Math.abs((scales.get("shimeharitsuru") ?? 0) - 1.124) < 0.02,
    `shimeharitsuru: ${scales.get("shimeharitsuru")}`,
  );
  // 中央値の担い手はそのまま。
  assert.equal(scales.get("miss-sake"), 1);
  // 白地を剥がした後は、同じロゴの透過版とほぼ同じ重さに測れる。
  assert.ok(
    Math.abs((scales.get("miss-sake-red") ?? 0) - 1.003) < 0.02,
    `miss-sake-red: ${scales.get("miss-sake-red")}`,
  );
});

test("正方形の印章は横長ワードマークより大きく置かれる", () => {
  const scales = opticalScales(SAKE_ROW);
  const seal = scales.get("shimeharitsuru") ?? 0;
  const wordmark = scales.get("leopalace21") ?? 0;
  // これがこの計算の存在理由。同じ高さで並べると印章が格下に見える。
  assert.ok(seal > wordmark, `印章 ${seal} がワードマーク ${wordmark} を上回っていない`);
});

test("1件だけの行には補正を出さない（比べる相手がいない）", () => {
  assert.equal(opticalScales([SAKE_ROW[0]]).size, 0);
  assert.equal(opticalScales([]).size, 0);
});

test("測っていないマークは結果に入らない（1で上書きしない）", () => {
  const scales = opticalScales([
    ...SAKE_ROW,
    { id: "unmeasured", inkRatio: null, trimWidth: null, trimHeight: null },
    { id: "zero-ink", inkRatio: 0, trimWidth: 100, trimHeight: 100 },
  ]);
  // undefined は「測っていない」。1 を書くと、人が入れたスケールを黙って消す。
  assert.equal(scales.has("unmeasured"), false);
  assert.equal(scales.has("zero-ink"), false);
  assert.equal(scales.size, SAKE_ROW.length);
});

test("外れ値1件が行全体を引きずらない（基準は中央値）", () => {
  const withOutlier = opticalScales([
    ...SAKE_ROW,
    { id: "hairline", inkRatio: 0.01, trimWidth: 400, trimHeight: 400 },
  ]);
  // 中央値が動くので基準はずれるが、既存5件が上限・下限へ吹き飛ばされない。
  assert.ok((withOutlier.get("miss-sake") ?? 0) < 1.5);
  assert.ok((withOutlier.get("leopalace21") ?? 0) >= 0.78);
});

// --- 正規化を提案するか ------------------------------------------------------

test("白地に載った余白だらけの実素材には提案する", () => {
  // miss-sake-red.webp の実測: 1536×542 のフレームに 351×192 の絵柄。
  const proposal = normalizationProposal({
    kind: "photo",
    media_type: "image/webp",
    width: 1536,
    height: 542,
    opaque: true,
    inkRatio: 0.254,
    trimWidth: 351,
    trimHeight: 192,
  });
  assert.equal(proposal.propose, true);
  // 順序は結果の重さの順。地は映像に白い長方形を出し、余白は位置をずらすだけ。
  assert.deepEqual(proposal.reasons, ["白い地に載っています", "余白が大きい（絵柄は8%）"]);
  assert.equal(proposal.fill, 0.081);
});

test("写真には提案しない（フレーム全部が絵柄）", () => {
  const proposal = normalizationProposal({
    kind: "photo",
    media_type: "image/jpeg",
    width: 4000,
    height: 2250,
    opaque: true,
    inkRatio: 1,
    trimWidth: 4000,
    trimHeight: 2250,
  });
  // ここで提案すると、全部の写真に同じ問いが出て、誰も読まなくなる。
  assert.equal(proposal.propose, false);
  assert.deepEqual(proposal.reasons, []);
});

test("縁が白いだけの写真を「白地に載っている」と言わない", () => {
  // 実素材 sake/AdobeStock_1858867289.jpeg: 明るい写真。地を剥がすと絵柄の密度は
  // 0.286 まで落ちるが、**箱はフレームのまま**——空が白いだけで、板ではない。
  // opaque だけを根拠にすると、この1枚を含む写真7枚に提案が出た（2026-08-19 実測）。
  const brightPhoto = normalizationProposal({
    kind: "photo",
    media_type: "image/jpeg",
    width: 5824,
    height: 3264,
    opaque: true,
    inkRatio: 0.286,
    trimWidth: 5824,
    trimHeight: 3264,
  });
  assert.equal(brightPhoto.propose, false);

  // 同じ形の測定でも、マークだと分かっていれば板として扱う。JPEGで届いた企業ロゴ
  // （leopalace21.jpg）がこれで、白い長方形として焼かれるのを止められる唯一の経路。
  const knownMark = normalizationProposal({
    kind: "logo",
    media_type: "image/jpeg",
    width: 800,
    height: 183,
    opaque: true,
    inkRatio: 0.3231,
    trimWidth: 800,
    trimHeight: 183,
  });
  assert.deepEqual(knownMark.reasons, ["白い地に載っています"]);

  // 分類でも同じことが起きる。プルダウンで「マーク」を選ぶと提案が現れる。
  const classified = normalizationProposal({
    kind: "photo",
    category: "mark",
    media_type: "image/jpeg",
    width: 800,
    height: 183,
    opaque: true,
    inkRatio: 0.3231,
    trimWidth: 800,
    trimHeight: 183,
  });
  assert.equal(classified.propose, true);
});

test("余白の無い透過ロゴには提案しない（直すものが無い）", () => {
  // leopalace21.png の実測: 800×183 全面が絵柄の箱。
  const proposal = normalizationProposal({
    kind: "logo",
    media_type: "image/png",
    width: 800,
    height: 183,
    opaque: false,
    inkRatio: 0.3283,
    trimWidth: 800,
    trimHeight: 183,
  });
  assert.equal(proposal.propose, false);
  assert.equal(proposal.fill, 1);
});

test("余白のある透過ロゴには提案する", () => {
  // miss-sake.png の実測: 190×104 に 185×100。境界すれすれ（93.6%）なので出ない。
  const almost = normalizationProposal({
    kind: "logo",
    media_type: "image/png",
    width: 190,
    height: 104,
    opaque: false,
    inkRatio: 0.2527,
    trimWidth: 185,
    trimHeight: 100,
  });
  assert.equal(almost.propose, false, "数ピクセルの余白で提案してはいけない");

  const padded = normalizationProposal({
    kind: "logo",
    media_type: "image/png",
    width: 1000,
    height: 1000,
    opaque: false,
    inkRatio: 0.3,
    trimWidth: 600,
    trimHeight: 400,
  });
  assert.equal(padded.propose, true);
  assert.deepEqual(padded.reasons, ["余白が大きい（絵柄は24%）"]);

  // 実素材 sake-kanji.png（2200×1634 に 2014×1565 = 88%）。切っても得るものが
  // 少なく、この程度の余白は絵の一部であることが多い。
  const slightlyPadded = normalizationProposal({
    kind: "illustration",
    media_type: "image/png",
    width: 2200,
    height: 1634,
    opaque: false,
    inkRatio: 0.356,
    trimWidth: 2014,
    trimHeight: 1565,
  });
  assert.equal(slightlyPadded.propose, false);
});

test("SVGには提案しない（viewBoxが絵柄で、切ると拡大できなくなる）", () => {
  const proposal = normalizationProposal({
    kind: "logo",
    media_type: "image/svg+xml",
    width: 285,
    height: 52,
    opaque: false,
    inkRatio: 0.223,
    trimWidth: 270,
    trimHeight: 42,
  });
  assert.equal(proposal.propose, false);
});

test("測っていない素材には提案しない（推測で余白を言わない）", () => {
  const proposal = normalizationProposal({
    kind: "logo",
    media_type: "image/png",
    width: null,
    height: null,
    opaque: null,
    inkRatio: null,
    trimWidth: null,
    trimHeight: null,
  });
  assert.equal(proposal.propose, false);
  assert.equal(proposal.fill, null);
});
