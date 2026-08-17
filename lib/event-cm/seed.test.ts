import assert from "node:assert/strict";
import test from "node:test";
import { proposedDate, seedEventCmBrief } from "./seed";
import { archetypeFor } from "./archetypes";
import { templateBgm } from "@/lib/assets/defaults";
import { currentTemplate } from "@/lib/templates/catalog";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import { validateBrief } from "@/lib/templates/brief-schemas";
import {
  eventCmNarratedSteps,
  scenarioIsStale,
  type EventCmBrief,
} from "@/remotion/event-cm/types";

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

test("スキーマが拒むのは、映像に置き場のない行だけ", () => {
  const brief = seedFor(WEALTHPARK_LAB);
  const narrated = eventCmNarratedSteps(brief).map((step) => step.role);

  // Not written yet: legal, and what a seeded take looks like.
  assert.equal(validateBrief("event-cm", brief).ok, true);

  // Fully written for this brief. The seeded one announces nobody, so the
  // speaker scene does not exist and neither does its line.
  assert.equal(narrated.includes("guests"), false);
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      scenario: {
        ...brief.scenario,
        scenes: eventCmNarratedSteps(brief).map(({ role, index }) => ({
          role,
          ...(index === undefined ? {} : { index }),
          text: "…",
        })),
      },
    }).ok,
    true,
  );

  // A line for a silent scene has no picture to sit on.
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      scenario: { ...brief.scenario, scenes: [{ role: "logoIn", text: "…" }] },
    }).ok,
    false,
  );

  // A role may repeat, but only as consecutive indexed pictures — that is what
  // one-programme-per-picture is. Unindexed repeats are still the same picture
  // written twice.
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      scenario: {
        ...brief.scenario,
        scenes: [
          { role: "title", text: "…" },
          { role: "program", index: 0, text: "…" },
          { role: "program", index: 1, text: "…" },
          { role: "cta", text: "…" },
        ],
      },
    }).ok,
    true,
  );
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      scenario: {
        ...brief.scenario,
        scenes: [
          { role: "program", index: 1, text: "…" },
          { role: "program", index: 0, text: "…" },
        ],
      },
    }).ok,
    false,
    "番号が戻るのは並び違い",
  );

  // The same scene twice, and scenes out of film order.
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      scenario: {
        ...brief.scenario,
        scenes: [
          { role: "title", text: "…" },
          { role: "title", text: "…" },
        ],
      },
    }).ok,
    false,
  );
  assert.equal(
    validateBrief("event-cm", {
      ...brief,
      scenario: {
        ...brief.scenario,
        scenes: [
          { role: "cta", text: "…" },
          { role: "title", text: "…" },
        ],
      },
    }).ok,
    false,
  );
});

test("シーンが増えたら、保存を拒まず「シナリオが古い」と言う", () => {
  // The flow this protects: drop in a flyer that names a speaker. The film gains
  // a scene the scenario has no line for, and refusing to save the speaker would
  // be the wrong answer to a fact somebody just supplied.
  const brief = seedFor(WEALTHPARK_LAB);
  const written: EventCmBrief = {
    ...brief,
    scenario: {
      ...brief.scenario,
      scenes: eventCmNarratedSteps(brief).map(({ role, index }) => ({
        role,
        ...(index === undefined ? {} : { index }),
        text: "…",
      })),
      updatedAt: "2026-08-13T00:00:00.000Z",
    },
  };
  assert.equal(scenarioIsStale(written), false);

  const withGuest: EventCmBrief = {
    ...written,
    guests: [{ name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: null }],
  };
  assert.equal(validateBrief("event-cm", withGuest).ok, true, "保存は通る");
  assert.equal(scenarioIsStale(withGuest), true, "シナリオは古いと分かる");
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

test("シードだけでシナリオ以外の必須項目が埋まる", () => {
  const state = eventCmGoalState(seedFor(WEALTHPARK_LAB));
  assert.deepEqual(
    state.progress.missingRequired.map((field) => field.path),
    ["scenario"],
    "残る必須項目はシナリオだけ",
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

test("新しい動画には最初からBGMが入る", () => {
  // Music is not something a user is asked for; nobody uploads a soundtrack.
  // Which track is the TEMPLATE's decision, so the expectation reads the
  // catalog rather than naming a file — swapping the placeholder for a
  // commissioned track must not break this.
  const brief = seedFor(WEALTHPARK_LAB);
  const declared = templateBgm(currentTemplate("event-cm")?.defaultBgm);
  assert.ok(declared, "event-cm が既定BGMを宣言していない");
  assert.equal(brief.bgm, declared?.src);
  assert.equal(brief.provenance?.bgm?.origin, "inferred");
});

test("既定のBGMはブランドが違っても同じ", () => {
  // A default that differs between two videos is not a default, it is a
  // surprise. Now structural rather than incidental: the track comes from the
  // template, so the brand cannot reach it (it used to be chosen from the
  // archetype's tone, which is derived from the brand's industry).
  const other = seedEventCmBrief(
    { name: "別のブランド", industry: "SaaS" },
    { now: NOW, seed: "take-zzz" },
  );
  assert.equal(other.bgm, seedFor(WEALTHPARK_LAB).bgm);
});

test("event-promo のフィールドは持たない", () => {
  // `EventCmBrief extends EventBrief` をやめた本体の確認
  // (remotion/event-cm/types.ts、docs/old/event-cm-refactor-plan.md §11.3)。
  //
  // Three fields no event-cm scene draws used to arrive here for free, and the
  // goal and the fact list offered all three to the user. Filling one changed
  // nothing on screen — which is worse than not offering it, because it teaches
  // that this list does not mean anything.
  const brief = seedFor(WEALTHPARK_LAB) as unknown as Record<string, unknown>;
  assert.equal("sideCopy" in brief, false, "sideCopy は event-promo の縦組みコピー");
  const visuals = brief.visuals as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(visuals).sort(),
    ["closing", "programs", "value"],
    "地を受け取るのは3シーンだけ（inkArt / texture は event-promo）",
  );
});

test("古いブリーフを保存すると、死んだフィールドは落ちる", () => {
  // Why §11.3 needed no migration. Every write path saves `validateBrief`'s
  // OUTPUT, and zod strips what the schema does not name — so a brief stored
  // before this change loses the three fields the next time it is saved, and
  // keeps everything else exactly as it was.
  const stored = {
    ...seedFor(WEALTHPARK_LAB),
    sideCopy: "縦組みの補足コピー",
    visuals: {
      ...seedFor(WEALTHPARK_LAB).visuals,
      inkArt: "defaults/art/sumi.png",
      texture: "defaults/photos/slate.jpg",
    },
  };
  const result = validateBrief("event-cm", stored);
  assert.equal(result.ok, true, result.ok ? "" : result.issues.join(" / "));
  if (!result.ok) return;
  const cleaned = result.brief as Record<string, unknown>;
  assert.equal("sideCopy" in cleaned, false);
  assert.deepEqual(
    Object.keys(cleaned.visuals as Record<string, unknown>).sort(),
    ["closing", "programs", "value"],
  );
  // The living fields survive: stripping is not a reset.
  assert.equal(cleaned.title, stored.title);
  assert.equal(cleaned.bgm, stored.bgm);
});
