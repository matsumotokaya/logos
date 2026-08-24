import assert from "node:assert/strict";
import test from "node:test";
import { phraseBlocks } from "@/remotion/kit/phrase";

// 「長い文章は両端が揃っている方がよいが、1〜3行しかない文章が言葉の途中で
//  折れると非常に違和感がある」 — the requester's rule, and the reason this
// module exists. The guarantee under test is NEVER MID-WORD; which boundary a
// line actually uses depends on what fits, and that is the layout's business.

test("助詞と送り仮名は前の語にくっつく", () => {
  assert.deepEqual(phraseBlocks("コンサルティングについて、話をします"), [
    "コンサルティングについて、",
    "話をします",
  ]);
  // 知 / ら / れ / ざる is what the segmenter alone returns. Breaking there
  // would split a single verb four ways.
  assert.deepEqual(phraseBlocks("知られざる日本酒業界の舞台裏"), [
    "知られざる",
    "日本酒業界の",
    "舞台裏",
  ]);
});

test("連続する漢字語はひとつの複合語として扱う", () => {
  // 金融 + 教育 come back as two nouns; 「金融/教育」 is not a place to break.
  assert.deepEqual(phraseBlocks("金融教育を、じっくり考える夜")[0], "金融教育を、");
});

test("句読点は前のブロックを閉じる", () => {
  // Without closing, the next word would glue onto the punctuation and produce
  // 「、じっくり」 — a block that starts with a comma.
  const blocks = phraseBlocks("一般論ではなく、実際に起きていることを。");
  assert.equal(blocks[0], "一般論ではなく、");
  assert.ok(
    blocks.every((block) => !/^[、。]/.test(block)),
    `句読点で始まるブロックがある: ${blocks.join(" / ")}`,
  );
  // The trailing 。 rides with the block it ends.
  assert.ok(blocks[blocks.length - 1].endsWith("。"));
});

test("どのブロックも語の途中で切れない", () => {
  // The invariant, stated precisely: a block may begin with kana ONLY when the
  // block before it was closed by punctuation.
  //
  // "Never begins with kana" was the first attempt and it is wrong — 「じっくり」
  // is a whole adverb, not a fragment. What makes 「につい|て、」 a defect is not
  // the kana, it is that the glue rule WOULD have joined it and something
  // stopped it. Punctuation is the only thing allowed to stop it.
  const closesBlock = (block: string) => /[、。，．！？…‥」』）】〉》]$/u.test(block);
  for (const text of [
    "コンサルティングについて、話をします",
    "金融教育を、じっくり考える夜",
    "知られざる日本酒業界の舞台裏",
    "一般論ではなく、実際に起きていることを。",
    "世界が恋する日本酒",
    "現場の話を、そのままお伝えします",
  ]) {
    const blocks = phraseBlocks(text);
    assert.equal(blocks.join(""), text, `${text}: 文字が落ちている`);
    for (const [at, block] of blocks.entries()) {
      if (at === 0) continue;
      if (!/^[ぁ-ゟ]/u.test(block)) continue;
      assert.ok(
        closesBlock(blocks[at - 1]),
        `${text}: 「${blocks[at - 1]}|${block}」が語の途中で切れている`,
      );
    }
  }
});

test("扱えない入力でも落ちず、そのまま1ブロックで返す", () => {
  // Typography must never throw. An unsupported language is not an error, it
  // is "no grouping" — which is exactly what the browser does on its own.
  assert.deepEqual(phraseBlocks(""), []);
  assert.deepEqual(phraseBlocks("Modern Japanese", "en"), ["Modern Japanese"]);
});
