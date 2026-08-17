import assert from "node:assert/strict";
import test from "node:test";
import { assetById, DEFAULT_ASSETS, templateBgm } from "./defaults";
import { TEMPLATES, currentTemplate } from "@/lib/templates/catalog";

test("動画テンプレートは既定BGMを宣言している", () => {
  // 「新規作成時には一律で自動で入る」ので、動画テンプレートに未宣言があると
  // その種類の動画だけ無音で始まる。
  for (const template of TEMPLATES.filter((entry) => entry.toolKind === "video")) {
    assert.ok(template.defaultBgm, `${template.id} が既定BGMを持たない`);
  }
});

test("宣言されたIDはプールに実在し、BGMである", () => {
  // 台帳とプールは別ファイルなので、曲を差し替えるときにIDだけ残る事故が起きる。
  for (const template of TEMPLATES) {
    if (!template.defaultBgm) continue;
    const asset = assetById(template.defaultBgm);
    assert.ok(asset, `${template.id} の既定BGM ${template.defaultBgm} がプールに無い`);
    assert.equal(asset?.kind, "bgm", `${template.id} の既定BGMがBGMでない`);
  }
});

test("同じテンプレートなら誰が作っても同じ曲になる", () => {
  // 以前は業種由来の tone で選んでいたので、同じテンプレートの2本が
  // 誰も選んでいない理由で違う曲で始まり得た。
  const first = templateBgm(currentTemplate("event-cm")?.defaultBgm);
  const again = templateBgm(currentTemplate("event-cm")?.defaultBgm);
  assert.ok(first);
  assert.equal(first?.src, again?.src);
});

test("種類の違う動画は違う曲を持てる", () => {
  const event = currentTemplate("event-cm")?.defaultBgm;
  const product = currentTemplate("product-cm")?.defaultBgm;
  assert.notEqual(event, product, "テンプレートごとに持つ意味が無い");
});

test("宣言が無い・プールが失った場合は無音（別の曲で埋めない）", () => {
  assert.equal(templateBgm(undefined), null);
  assert.equal(templateBgm("bgm-does-not-exist"), null);
  // BGM以外のIDを既定BGMに書いても通さない。
  const notBgm = DEFAULT_ASSETS.find((asset) => asset.kind !== "bgm");
  if (notBgm) assert.equal(templateBgm(notBgm.id), null);
});

test("既定BGMは公開できるものだけ（書き出しで無音にならない）", () => {
  // licensed:false の除外はレンダー側が未実装なので、既定に据えると
  // 清算されていない曲がそのままMP4に焼かれる。
  for (const template of TEMPLATES) {
    if (!template.defaultBgm) continue;
    assert.equal(
      assetById(template.defaultBgm)?.licensed,
      true,
      `${template.id} の既定BGMが清算されていない`,
    );
  }
});
