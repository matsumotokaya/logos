import assert from "node:assert/strict";
import test from "node:test";
import {
  materialFileName,
  materialFolder,
  materialPath,
  slugOf,
  uniqueMaterialPaths,
  type NameableMaterial,
} from "./naming";

const material = (over: Partial<NameableMaterial> & { label: string }): NameableMaterial => ({
  kind: "photo",
  media_type: "image/jpeg",
  ...over,
});

test("測った寸法が名前に入る（あとから大小を判断できる）", () => {
  const name = materialFileName(
    material({ label: "miyao.jpg", category: "person", width: 960 }),
  );
  assert.equal(name, "miyao_960w.jpg");
});

test("ベクターは幅を持たないので vector と書く", () => {
  const name = materialFileName(
    material({
      label: "WealthPark Lab.svg",
      kind: "logo",
      media_type: "image/svg+xml",
      category: "mark",
      opaque: false,
      luminance: 0.003,
    }),
  );
  assert.equal(name, "wealthpark-lab_transparent_dark_vector.svg");
});

test("マークの地と明度が名前に出る（白抜きしてよいかが名前で分かる）", () => {
  const plated = materialFileName(
    material({
      label: "leopalace21.jpg",
      kind: "logo",
      category: "mark",
      opaque: true,
      luminance: 0.736,
      width: 800,
    }),
  );
  assert.equal(plated, "leopalace21_plate_light_800w.jpg");
});

test("測っていないマークは、測っていない属性を名乗らない", () => {
  // null は「透過していない」ではない。名前が測定を捏造すると、
  // 白板バグと同じ間違いをファイル名で繰り返すことになる。
  const name = materialFileName(
    material({ label: "mark.png", kind: "logo", media_type: "image/png" }),
  );
  assert.equal(name, "mark.png");
  assert.ok(!name.includes("plate") && !name.includes("transparent"));
});

test("拡張子は必ず付く（R2キーはチェックサムなので元は無い）", () => {
  for (const [mediaType, expected] of [
    ["image/jpeg", "jpg"],
    ["audio/wav", "wav"],
    ["application/pdf", "pdf"],
    ["text/plain", "txt"],
  ] as const) {
    const name = materialFileName(material({ label: "x", media_type: mediaType }));
    assert.ok(name.endsWith(`.${expected}`), `${mediaType} → ${name}`);
  }
});

test("日本語しかない名前はASCIIの語に落ちる（ZIPが展開を拒むため）", () => {
  assert.equal(slugOf("貼り付けたテキスト"), "");
  assert.equal(
    materialFileName(
      material({ label: "貼り付けたテキスト", kind: "document", media_type: "text/plain" }),
    ),
    "note.txt",
  );
  assert.equal(
    materialFileName(
      material({
        label: "イベント紹介動画の読み上げ",
        kind: "audio",
        media_type: "audio/wav",
        source_kind: "ai_generated",
      }),
    ),
    "narration.wav",
  );
});

test("意味の無い名前は意味を発明せず、そのまま持ち越す", () => {
  // AdobeStock_1894358160 に「sake-tasting」と名付けるのは推測であって
  // 正規化ではない。間違っても静かなので、やらない（§13-3）。
  const name = materialFileName(
    material({
      label: "sake/AdobeStock_1894358160.jpeg",
      category: "scenery",
      width: 5120,
    }),
  );
  assert.equal(name, "adobestock-1894358160_5120w.jpg");
});

test("フォルダは分類そのもの。未分類は other ではなく unsorted", () => {
  assert.equal(materialFolder(material({ label: "a.jpg", category: "person" })), "person");
  assert.equal(materialFolder(material({ label: "a.jpg" })), "unsorted");
  // 「まだ分類していない」と「分類したうえでどれでもなかった」は別の答え。
  assert.equal(materialFolder(material({ label: "a.jpg", category: "other" })), "other");
  assert.equal(
    materialFolder(material({ label: "a.mp3", kind: "audio", media_type: "audio/mpeg" })),
    "audio",
  );
});

test("書き出しのパスは assets/<分類>/<名前>", () => {
  assert.equal(
    materialPath(material({ label: "miyao.jpg", category: "person", width: 1600 })),
    "assets/person/miyao_1600w.jpg",
  );
});

test("同じ名前になる2件は、片方が消えずに区別される", () => {
  const rows = [
    { id: "a", ...material({ label: "kato.jpg", category: "person", width: 1400 }) },
    { id: "b", ...material({ label: "kato.jpg", category: "person", width: 1400 }) },
    { id: "c", ...material({ label: "kato.jpg", category: "person", width: 1400 }) },
  ];
  const paths = uniqueMaterialPaths(rows);
  assert.equal(paths.get("a"), "assets/person/kato_1400w.jpg");
  assert.equal(paths.get("b"), "assets/person/kato_1400w-2.jpg");
  assert.equal(paths.get("c"), "assets/person/kato_1400w-3.jpg");
  assert.equal(new Set(paths.values()).size, 3, "ZIPで1件が黙って消える");
});

test("分類を直すと名前もフォルダも動く（保存していないので即座に）", () => {
  const before = materialPath(material({ label: "brewer.jpg", category: "scenery", width: 2560 }));
  const after = materialPath(material({ label: "brewer.jpg", category: "person", width: 2560 }));
  assert.equal(before, "assets/scenery/brewer_2560w.jpg");
  assert.equal(after, "assets/person/brewer_2560w.jpg");
});
