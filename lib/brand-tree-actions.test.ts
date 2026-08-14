import assert from "node:assert/strict";
import test from "node:test";
import {
  brandActions,
  deletionConsequence,
  logoActions,
  organizationActions,
  takeActions,
} from "./brand-tree-actions";

const reasonFor = (actions: ReturnType<typeof brandActions>, id: string) =>
  actions.find((action) => action.id === id)?.blockedReason ?? null;

test("空のOrganizationは削除できる", () => {
  const actions = organizationActions({
    movableBrandCount: 0,
    retainedLogoCount: 0,
    retainedAssetCount: 0,
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].id, "delete");
  assert.equal(actions[0].blockedReason, null);
});

test("Organizationはブランドを抱えている間は削除できず、何をすべきか言う", () => {
  // The reason has to name the next action. "削除できません" alone leaves the
  // user pressing a dead button.
  const actions = organizationActions({
    movableBrandCount: 2,
    retainedLogoCount: 0,
    retainedAssetCount: 0,
  });
  const reason = reasonFor(actions, "delete");
  assert.match(reason ?? "", /ブランド2件/);
  assert.match(reason ?? "", /移す|削除/);
});

test("移すブランドが無くても、企業ブランドに成果物が残っていれば止まる", () => {
  // takes.brand_id and logos are what Postgres restricts on; the menu says the
  // same thing the DELETE route would answer with.
  const reason = reasonFor(
    organizationActions({
      movableBrandCount: 0,
      retainedLogoCount: 1,
      retainedAssetCount: 3,
    }),
    "delete",
  );
  assert.match(reason ?? "", /ロゴ1件/);
  assert.match(reason ?? "", /動画・LP3件/);
});

test("ブランドは中身が空のときだけ削除できる", () => {
  assert.equal(
    reasonFor(brandActions({ logoCount: 0, videoCount: 0, lpCount: 0 }), "delete"),
    null,
  );
  assert.match(
    reasonFor(brandActions({ logoCount: 0, videoCount: 2, lpCount: 1 }), "delete") ?? "",
    /動画・LP3件/,
  );
});

test("コンテナは複製を持たない", () => {
  // Not a stylistic choice: a copied Organization or Brand carries none of
  // what makes it that Organization or Brand.
  for (const actions of [
    organizationActions({
      movableBrandCount: 0,
      retainedLogoCount: 0,
      retainedAssetCount: 0,
    }),
    brandActions({ logoCount: 0, videoCount: 0, lpCount: 0 }),
    logoActions(),
  ]) {
    assert.equal(
      actions.some((action) => action.id === "duplicate"),
      false,
    );
  }
});

test("動画とLPは複製でき、公開中は削除だけが止まる", () => {
  const live = takeActions("video", { published: true });
  assert.equal(reasonFor(live, "duplicate"), null);
  assert.match(reasonFor(live, "delete") ?? "", /公開/);

  const draft = takeActions("lp", { published: false });
  assert.equal(reasonFor(draft, "delete"), null);
  assert.equal(draft.find((action) => action.id === "delete")?.label, "LPを削除");
});

test("削除の確認文は名前から始まる1つの文になる", () => {
  // The dialog appends 「この操作は取り消せません。」 to this, so a fragment
  // here shows up as 「秋の展示会」この動画と… on screen.
  for (const kind of ["organization", "brand", "logo", "video", "lp"] as const) {
    const sentence = deletionConsequence(kind, "秋の展示会");
    assert.match(sentence, /^「秋の展示会」と、/);
    assert.match(sentence, /削除します。$/);
  }
  assert.match(deletionConsequence("logo", "x"), /プレゼンテーション/);
  assert.match(deletionConsequence("video", "x"), /MP4/);
});

test("削除は常に danger、複製は常にそうでない", () => {
  const actions = takeActions("video", { published: false });
  assert.equal(actions.find((action) => action.id === "delete")?.danger, true);
  assert.equal(actions.find((action) => action.id === "duplicate")?.danger, false);
});
