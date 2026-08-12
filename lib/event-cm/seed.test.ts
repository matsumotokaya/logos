import assert from "node:assert/strict";
import test from "node:test";
import { proposedDate, seedEventCmBrief } from "./seed";
import { archetypeFor } from "./archetypes";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import { validateBrief } from "@/lib/templates/brief-schemas";
import { EVENT_CM_SCENE_ROLES } from "@/remotion/event-cm/types";

/** The real brand, as it stands in the database after the site import. */
const WEALTHPARK_LAB = {
  name: "WealthPark Lab",
  industry: "金融教育メディア",
  description:
    "WealthPark研究所は、投資の本質をテーマに記事、対談、金融経済教育プログラムなどを発信する情報メディアです。",
};

const NOW = new Date("2026-08-11T09:00:00+09:00");
const seedFor = (brand: typeof WEALTHPARK_LAB) =>
  seedEventCmBrief(brand, { now: NOW, seed: "take-1" });

test("シードしたブリーフはテンプレートの形式を満たす", () => {
  // The take is created from exactly this object, so a schema it cannot pass
  // means "add a video" fails with no way to see why from the seeder alone.
  const result = validateBrief("event-cm", seedFor(WEALTHPARK_LAB));
  assert.equal(result.ok, true, result.ok ? "" : result.issues.join(" / "));
});

test("台本は未着手か5役そろっているかのどちらかしか許さない", () => {
  const brief = seedFor(WEALTHPARK_LAB);
  // Not written yet: legal, and what a seeded take looks like.
  assert.equal(validateBrief("event-cm", brief).ok, true);

  // Fully written: legal.
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      script: {
        ...brief.script,
        scenes: EVENT_CM_SCENE_ROLES.map((role) => ({ role, text: "…" })),
      },
    }).ok,
    true,
  );

  // Half written: nothing produces this on purpose and no renderer can use it.
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      script: { ...brief.script, scenes: [{ role: "hook", text: "…" }] },
    }).ok,
    false,
  );
});

test("提案する日付は4週間以上先の最初の金曜日", () => {
  const date = proposedDate(NOW);
  assert.equal(date.getDay(), 5, "金曜日であること");
  const daysOut = Math.round((date.getTime() - NOW.getTime()) / 86_400_000);
  assert.ok(daysOut >= 28, `4週間以上先であること (${daysOut}日後)`);
  assert.ok(daysOut < 35, "先すぎないこと");
});

test("業種から金融向けのイベント型を選ぶ", () => {
  assert.equal(archetypeFor(WEALTHPARK_LAB).id, "finance-talk");
});

test("業種が読めなければ一般セミナーに落ちる", () => {
  assert.equal(archetypeFor({ industry: "", description: "" }).id, "general-seminar");
});

test("シードだけで台本以外の必須項目が埋まる", () => {
  const state = eventCmGoalState(seedFor(WEALTHPARK_LAB));
  assert.deepEqual(
    state.progress.missingRequired.map((field) => field.path),
    ["script"],
    "残る必須項目はナレーション台本だけ",
  );
});

test("推定した値だけが暫定として報告される", () => {
  const state = eventCmGoalState(seedFor(WEALTHPARK_LAB));
  const provisional = state.provisional.map((field) => field.path).sort();

  assert.ok(provisional.includes("schedule.date"));
  assert.ok(provisional.includes("title"));
  assert.ok(provisional.includes("programs"));
  // The brand's own name is not a guess.
  assert.ok(!provisional.includes("presenter"));
});

test("登壇者を捏造しない", () => {
  // A guessed date is a proposal. A guessed speaker is a fabricated person.
  assert.deepEqual(seedFor(WEALTHPARK_LAB).guests, []);
});

test("誰も言っていない事実は空のままにする", () => {
  const brief = seedFor(WEALTHPARK_LAB);
  assert.equal(brief.schedule.venue, null, "会場を「未定」と書かない");
  assert.equal(brief.schedule.fee, null);
  assert.equal(brief.footnote, null);
});

test("同じブランドからは毎回同じブリーフが出る", () => {
  // A re-render with no changed input must not produce a different film.
  assert.deepEqual(seedFor(WEALTHPARK_LAB), seedFor(WEALTHPARK_LAB));
});

test("素材プールが空でもブリーフは成立する", () => {
  const brief = seedFor(WEALTHPARK_LAB);
  // Null visual slots are carried by the composition's designed fallbacks.
  assert.equal(brief.visuals.value, null);
  assert.ok(brief.title.length > 0);
  assert.ok(brief.programs.length > 0);
});
