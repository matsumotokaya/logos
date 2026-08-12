import assert from "node:assert/strict";
import test from "node:test";
import {
  collectMaterialIds,
  materialUri,
  replaceMaterialUris,
  takeMaterialSignatureToken,
} from "./material-uri";

const BRIEF = {
  bgm: materialUri("aaa"),
  logos: [{ name: "A", src: materialUri("bbb") }, { name: "B", src: null }],
  visuals: { closing: { src: materialUri("ccc"), focus: { x: 0.5, y: 0.5 } } },
  schedule: { venue: null, date: "2026.10.2" },
  title: "material-ish text that is not a reference",
};

test("brief のあらゆる深さから素材IDを集める", () => {
  assert.deepEqual([...collectMaterialIds(BRIEF)].sort(), ["aaa", "bbb", "ccc"]);
});

test("素材参照だけを差し替え、他の値と構造は保つ", () => {
  const resolved = replaceMaterialUris(BRIEF, (id) => `/api/material/${id}`);

  assert.equal(resolved.bgm, "/api/material/aaa");
  assert.equal(resolved.logos[0].src, "/api/material/bbb");
  assert.equal(resolved.logos[1].src, null);
  assert.equal(resolved.visuals.closing.src, "/api/material/ccc");
  assert.deepEqual(resolved.visuals.closing.focus, { x: 0.5, y: 0.5 });
  assert.equal(resolved.schedule.venue, null);
  assert.equal(resolved.title, BRIEF.title);
});

test("解決できない素材は空にせず参照のまま残す", () => {
  // An empty slot means "the template designed a substitute". A material that
  // is not pinned is a data problem, and must not be dressed up as one.
  const resolved = replaceMaterialUris(BRIEF, (id) =>
    id === "bbb" ? null : `/api/material/${id}`,
  );

  assert.equal(resolved.logos[0].src, materialUri("bbb"));
  assert.equal(resolved.bgm, "/api/material/aaa");
});

test("署名対象は brand / take / material / key をすべて束縛する", () => {
  const token = takeMaterialSignatureToken("brand-1", "take-1", "mat-1", "brands/brand-1/x.png");
  assert.equal(token, "take-material:brand-1:take-1:mat-1:brands/brand-1/x.png");
  assert.notEqual(
    token,
    takeMaterialSignatureToken("brand-1", "take-2", "mat-1", "brands/brand-1/x.png"),
  );
});
