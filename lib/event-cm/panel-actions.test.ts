import assert from "node:assert/strict";
import test from "node:test";
import { panelDeletion } from "./panel-actions";
import { seedEventCmBrief } from "./seed";
import type { EventCmBrief } from "@/remotion/event-cm/types";

const SEEDED = seedEventCmBrief(
  { name: "WealthPark Lab", industry: "金融教育メディア" },
  { now: new Date("2026-08-14T09:00:00+09:00"), seed: "take-1" },
);

const WITH_GUESTS: EventCmBrief = {
  ...SEEDED,
  guests: [{ name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: null }],
};

test("登壇者のシーンは削除できる（値は残るので戻せる）", () => {
  const decision = panelDeletion(WITH_GUESTS, { role: "guests" });
  assert.equal(decision.can, true);
  assert.equal(decision.can && decision.kind, "suppress");
  assert.equal(decision.can && decision.kind === "suppress" && decision.path, "guests");
});

test("プログラムが2つ以上あれば、1つずつ削除できる", () => {
  assert.ok(SEEDED.programs.length >= 2);
  const decision = panelDeletion(SEEDED, { role: "program", index: 1 });
  assert.equal(decision.can, true);
  assert.equal(decision.can && decision.kind, "remove-program");
  assert.ok(
    decision.can &&
      decision.kind === "remove-program" &&
      decision.confirm.includes(SEEDED.programs[1].title),
    "何を消すのか名前で言っていない",
  );
});

test("最後のプログラムは削除できない（空の枠が残るだけになる）", () => {
  const one: EventCmBrief = { ...SEEDED, programs: [SEEDED.programs[0]] };
  const decision = panelDeletion(one, { role: "program", index: 0 });
  assert.equal(decision.can, false);
  assert.match(decision.can === false ? decision.reason : "", /1つ残ります/);
});

test("構成が固定のシーンは削除できず、理由を言う", () => {
  for (const role of ["logoIn", "title", "value", "cta", "logoOut"] as const) {
    const decision = panelDeletion(SEEDED, { role });
    assert.equal(decision.can, false, `${role} が削除できることになっている`);
    assert.ok(
      decision.can === false && decision.reason.length > 10,
      `${role} の理由が説明になっていない`,
    );
  }
});
