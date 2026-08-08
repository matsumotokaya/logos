import assert from "node:assert/strict";
import test from "node:test";
import { productionTemplateDrift } from "./ledger-guard";

test("production版の同一version変更を検出する", () => {
  assert.deepEqual(
    productionTemplateDrift(
      [
        {
          template_id: "campaign-lp",
          version: 2,
          definition_hash: "old",
          stage: "production",
        },
      ],
      [{ template_id: "campaign-lp", version: 2, definition_hash: "new" }],
    ),
    ["campaign-lp@2"],
  );
});

test("draft変更と新versionはdriftにしない", () => {
  assert.deepEqual(
    productionTemplateDrift(
      [
        {
          template_id: "event-promo",
          version: 1,
          definition_hash: "old",
          stage: "draft",
        },
        {
          template_id: "campaign-lp",
          version: 1,
          definition_hash: "old",
          stage: "production",
        },
      ],
      [
        { template_id: "event-promo", version: 1, definition_hash: "new" },
        { template_id: "campaign-lp", version: 2, definition_hash: "new" },
      ],
    ),
    [],
  );
});
