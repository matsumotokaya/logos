import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { isMeasurable, measureMaterial, measurementColumns, UNMEASURED } from "./measure";

// The cases that decide how a mark is drawn. Synthesised rather than fixtured,
// because what is being asserted is the reading of real pixels: a fixture that
// drifted would pass while the measurement rotted.

/** A dark mark on transparency — the ordinary SVG/PNG delivery. */
const darkOnAlpha = () =>
  sharp({
    create: { width: 200, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: {
          create: {
            width: 100,
            height: 40,
            channels: 4,
            background: { r: 17, g: 17, b: 17, alpha: 1 },
          },
        },
        top: 20,
        left: 50,
      },
    ])
    .png()
    .toBuffer();

/** The same mark flattened onto a white plate — what a JPEG delivery is. */
const darkOnPlate = () =>
  sharp({
    create: { width: 200, height: 80, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: {
          create: { width: 100, height: 40, channels: 3, background: { r: 17, g: 17, b: 17 } },
        },
        top: 20,
        left: 50,
      },
    ])
    .jpeg()
    .toBuffer();

/** A white mark on transparency — bright, but must not be knocked out. */
const lightOnAlpha = () =>
  sharp({
    create: { width: 200, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: {
          create: {
            width: 100,
            height: 40,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        },
        top: 20,
        left: 50,
      },
    ])
    .png()
    .toBuffer();

test("寸法を測って残す（width/height が null のままにならない）", async () => {
  const measured = await measureMaterial(await darkOnAlpha(), "image/png");
  assert.equal(measured.width, 200);
  assert.equal(measured.height, 80);
});

test("透過の暗いマークは「透過」かつ低輝度", async () => {
  const measured = await measureMaterial(await darkOnAlpha(), "image/png");
  assert.equal(measured.opaque, false);
  assert.ok(measured.luminance !== null && measured.luminance < 0.3, "暗いと読めていない");
});

test("地の付いた画像は、明るく見えても「地あり」と分かる", async () => {
  const plate = await measureMaterial(await darkOnPlate(), "image/jpeg");
  assert.equal(plate.opaque, true, "JPEGの地を透過と誤認している");

  // The bug this whole measurement exists for: a mark on a white plate and a
  // white mark on transparency both measure bright, so brightness alone cannot
  // decide the treatment. Only `opaque` separates them.
  const knockoutSafe = await measureMaterial(await lightOnAlpha(), "image/png");
  assert.equal(knockoutSafe.opaque, false);
  assert.ok(
    plate.luminance !== null &&
      knockoutSafe.luminance !== null &&
      plate.luminance > 0.5 &&
      knockoutSafe.luminance > 0.5,
    "両方とも明るいという前提が崩れている（このテストの意味が変わる）",
  );
});

test("読み取り対象でないものは UNMEASURED（false ではなく null）", async () => {
  const audio = await measureMaterial(Buffer.from("not an image"), "audio/mpeg");
  assert.deepEqual(audio, UNMEASURED);
  // null と false を混同すると「測っていない」が「透過している」になる。
  assert.equal(audio.opaque, null);
  assert.equal(isMeasurable("audio/mpeg"), false);
  assert.equal(isMeasurable("application/pdf"), false);
  assert.equal(isMeasurable(null), false);
});

test("壊れた画像でも例外を投げない（登録は続けられる）", async () => {
  const broken = await measureMaterial(Buffer.from("\x89PNG broken"), "image/png");
  assert.deepEqual(broken, UNMEASURED);
});

test("列は常に揃う（再測定が古い値を残さない）", () => {
  assert.deepEqual(Object.keys(measurementColumns(UNMEASURED)).sort(), [
    "height",
    "ink_ratio",
    "luminance",
    "opaque",
    "trim_height",
    "trim_width",
    "width",
  ]);
});

// 取り込み時の測定は「地の有無・明るさ」だけでなく「絵柄がフレームのどこまでか」
// も返す。§11 の正規化の提案がこの2列の上に乗るので、片方だけ埋まる状態を作らない。
test("余白のある画像は、絵柄の箱がフレームより小さいと測れる", async () => {
  const measured = await measureMaterial(await darkOnAlpha(), "image/png");
  assert.equal(measured.trimWidth, 100, "絵柄の幅が測れていない");
  assert.equal(measured.trimHeight, 40, "絵柄の高さが測れていない");
  // 100×40 の塗りが 100×40 の箱を埋めているので、箱の中は 100% インク。
  assert.ok(
    measured.inkRatio !== null && measured.inkRatio > 0.98,
    `箱の中の占有率が想定と違う: ${measured.inkRatio}`,
  );
});

test("白地に載ったマークは、地を剥がした後の絵柄として測れる", async () => {
  const measured = await measureMaterial(await darkOnPlate(), "image/jpeg");
  // JPEGなので透過は無い。それでも「絵柄はここまで」が出るのがこの測定の要点で、
  // 出ないとインベントリは白地のロゴを写真と同じに見る。
  assert.equal(measured.opaque, true);
  assert.ok(
    measured.trimWidth !== null && measured.trimWidth < 200,
    `白地を剥がせていない: ${measured.trimWidth}`,
  );
  // 写真は 1.0 に張り付く。ここが 1.0 未満に落ちることが「フレーム全体が絵柄
  // ではない」の証拠で、実素材（miss-sake-red.webp）は 0.254 まで落ちる。この
  // フィクスチャは塗りのベタなので、実物ほどは落ちない。
  assert.ok(
    measured.inkRatio !== null && measured.inkRatio < 0.95,
    `絵柄の占有率が写真並みに出ている: ${measured.inkRatio}`,
  );
});
