import test from "node:test";
import assert from "node:assert/strict";
import { projectFilename, projectSlug } from "./naming";

const TAKE = "920d4cfe-3843-4a6c-b538-7238e79707d2";

test("ZIPの中のフォルダ名はASCIIになる", () => {
  // Two systems refuse anything else. The zip's filename table is written as
  // raw bytes with no UTF-8 flag, so `unzip` met a Japanese directory as
  // mojibake and refused to create it — the export unpacked to nothing. npm
  // rejects a non-ASCII `name` just as flatly.
  const slug = projectSlug("世界が恋する日本酒", TAKE);
  assert.match(slug, /^[a-z0-9-]+$/, `ASCIIでない: ${slug}`);
  assert.equal(slug, `event-cm-${TAKE.slice(0, 8)}`);
});

test("英字のタイトルは読める名前のまま残る", () => {
  assert.equal(projectSlug("Miss SAKE Night 2026", TAKE), "miss-sake-night-2026");
  // npm names are lowercase, and a trailing separator is not a name.
  assert.equal(projectSlug("Tokyo — Night!!", TAKE), "tokyo-night");
});

test("短すぎる名前より、IDのほうが役に立つ", () => {
  // "a" tells the recipient nothing about which video this is.
  assert.equal(projectSlug("あ", TAKE), `event-cm-${TAKE.slice(0, 8)}`);
  assert.equal(projectSlug("…", TAKE), `event-cm-${TAKE.slice(0, 8)}`);
});

test("ダウンロードするファイル名はイベントの名前のまま", () => {
  // The one place the reader sees the title, so it keeps the Japanese: the
  // header carries it percent-encoded (RFC 5987), not as raw bytes.
  assert.equal(projectFilename("世界が恋する日本酒", TAKE), "世界が恋する日本酒.zip");
});

test("ファイル名からはパス区切りと制御文字を落とす", () => {
  // A title is user input, and "/" in a filename is a directory.
  assert.equal(projectFilename("A/B:C*D?", TAKE), "ABCD.zip");
  // A control character would corrupt the header the name travels in.
  assert.equal(projectFilename("a\u0000b", TAKE), "ab.zip");
  // A space is legal in a filename, so the title keeps it.
  assert.equal(projectFilename("Miss SAKE Night", TAKE), "Miss SAKE Night.zip");
  // Nothing left to use falls back to the slug rather than to ".zip".
  assert.equal(projectFilename("///", TAKE), `event-cm-${TAKE.slice(0, 8)}.zip`);
});
