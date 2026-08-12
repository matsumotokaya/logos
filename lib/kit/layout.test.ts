import assert from "node:assert/strict";
import test from "node:test";
import { distribute, LAYOUTS, overCapacity, SCENE_LAYOUTS, type Scene } from "@/remotion/kit/layout";
import type { SceneComponent } from "@/remotion/kit/components";

const person: SceneComponent = {
  kind: "person",
  person: { name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: null },
};
const heading: SceneComponent = { kind: "heading", text: "世界が恋する日本酒" };
const body: SceneComponent = { kind: "body", text: "蔵出しの特別な五種を味わう。" };

test("すべての配置が少なくとも1つのスロットと容量を持つ", () => {
  for (const layout of SCENE_LAYOUTS) {
    const spec = LAYOUTS[layout];
    assert.ok(spec.slots.length > 0, `${layout} にスロットが無い`);
    assert.ok(spec.capacity > 0, `${layout} の容量が0`);
  }
});

test("単一スロットの配置は全部品をそこへ入れる", () => {
  const scene: Scene = { layout: "centre-stack", components: [heading, body, person] };
  const groups = distribute(scene);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 3);
});

test("分割配置では人物と写真が図版側、文字が本文側へ行く", () => {
  // A rule, not a choice: a portrait in the text column is never what was meant.
  const scene: Scene = { layout: "split-copy-figure", components: [heading, person, body] };
  const [copy, figure] = distribute(scene);

  assert.deepEqual(copy.map((c) => c.kind), ["heading", "body"]);
  assert.deepEqual(figure.map((c) => c.kind), ["person"]);
});

test("全面配置では写真が全面スロットへ行く", () => {
  const image: SceneComponent = {
    kind: "image",
    photo: { src: "material:x", focus: { x: 0.5, y: 0.5 } },
  };
  const scene: Scene = { layout: "full-bleed-overlay", components: [image, heading] };
  const groups = distribute(scene);
  const fullSlot = LAYOUTS["full-bleed-overlay"].slots.findIndex((s) => s.region === "full");

  assert.deepEqual(groups[fullSlot].map((c) => c.kind), ["image"]);
});

test("容量を超えた部品は「超過」として報告される", () => {
  const scene: Scene = {
    layout: "row",
    components: [heading, body, person, person, heading, body],
  };
  assert.equal(LAYOUTS.row.capacity, 4);
  assert.equal(overCapacity(scene).length, 2, "詰め込まずに超過を数える");
});

test("容量内なら超過はゼロ", () => {
  const scene: Scene = { layout: "centre-stack", components: [heading, body] };
  assert.deepEqual(overCapacity(scene), []);
});
