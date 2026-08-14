import assert from "node:assert/strict";
import test from "node:test";
import { duplicateTitle } from "./naming";

test("複製は元の名前に「のコピー」を足す", () => {
  assert.equal(duplicateTitle("秋の展示会", []), "秋の展示会のコピー");
});

test("同じ名前が空いていなければ番号を上げる", () => {
  const existing = ["秋の展示会", "秋の展示会のコピー", "秋の展示会のコピー2"];
  assert.equal(duplicateTitle("秋の展示会", existing), "秋の展示会のコピー3");
});

test("コピーを複製しても接尾辞は積み重ならない", () => {
  // Making a fifth version of a video should not read as
  // 「…のコピーのコピーのコピーのコピー」.
  assert.equal(
    duplicateTitle("秋の展示会のコピー2", ["秋の展示会のコピー"]),
    "秋の展示会のコピー2",
  );
  assert.equal(
    duplicateTitle("秋の展示会のコピー", ["秋の展示会のコピー"]),
    "秋の展示会のコピー2",
  );
});

test("名前が「のコピー」だけでも空文字にはしない", () => {
  assert.equal(duplicateTitle("のコピー", []), "のコピーのコピー");
});

test("前後の空白は名前の一部として扱わない", () => {
  assert.equal(duplicateTitle("  秋の展示会  ", ["秋の展示会のコピー"]), "秋の展示会のコピー2");
});
