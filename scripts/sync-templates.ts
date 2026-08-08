// Write the code-side template catalog into the version ledger.
//
//   npm run templates:sync
//
// Run this whenever lib/templates/catalog.ts changes. It is idempotent, and it
// never promotes anything to production — that stays an operator action, so a
// deploy cannot silently make a draft template publishable.
//
// Needs SUPABASE_SERVICE_ROLE_KEY: template_versions has no client write
// policy, because a version appearing is a deploy event and not a user action.

import { syncTemplateVersions } from "@/lib/templates/ledger";
import { TEMPLATES } from "@/lib/templates/catalog";
import { definitionHash } from "@/lib/templates/ledger";

async function main() {
  for (const template of TEMPLATES) {
    console.log(
      `${template.id}@${template.version}  ${template.toolKind.padEnd(18)}` +
        `brief v${template.briefSchemaVersion}  ${definitionHash(template)}`,
    );
  }

  const report = await syncTemplateVersions();
  console.log(`\nwrote ${report.written.length} ledger rows`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
