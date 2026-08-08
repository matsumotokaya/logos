import "server-only";

import { createHash } from "node:crypto";
import {
  TEMPLATES,
  templateSpec,
  type TemplateEntry,
} from "./catalog";
import { productionTemplateDrift } from "./ledger-guard";
import { createAdminSupabase } from "@/lib/supabase/server";

// Writing the code-side catalog into public.template_versions.
//
// The ledger is not a copy of the authority — it is the record that a version
// existed, so a take pinned to (template_id, version) can prove what it was
// made with even after the catalog moves on. Nothing reads a definition from
// it; everything reads lib/templates/catalog.ts.
//
// Writes need the service role because the table has no client write policy:
// a template version appearing is a deploy event, not a user action.

/** Stable hash of the serializable definition. A changed hash on an unchanged
 *  version means somebody edited a released template in place — the ledger says
 *  so instead of the change passing silently. */
export function definitionHash(template: TemplateEntry): string {
  const payload = JSON.stringify({
    id: template.id,
    version: template.version,
    toolKind: template.toolKind,
    briefSchemaVersion: template.briefSchemaVersion,
    rendererRevision: template.rendererRevision,
    spec: templateSpec(template),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export interface LedgerRow {
  template_id: string;
  version: number;
  tool_kind: string;
  brief_schema_version: number;
  renderer_revision: string;
  definition_hash: string;
  spec: Record<string, unknown>;
}

export function ledgerRow(template: TemplateEntry): LedgerRow {
  return {
    template_id: template.id,
    version: template.version,
    tool_kind: template.toolKind,
    brief_schema_version: template.briefSchemaVersion,
    renderer_revision: template.rendererRevision,
    definition_hash: definitionHash(template),
    spec: templateSpec(template),
  };
}

export interface SyncReport {
  written: string[];
}

/**
 * Idempotent upsert of every catalog entry. `stage` and `published_at` are NOT
 * written here: promotion to production is an operator action, the same way
 * presentation_asset_definitions.release_stage works.
 */
export async function syncTemplateVersions(): Promise<SyncReport> {
  const supabase = createAdminSupabase();
  const rows = TEMPLATES.map(ledgerRow);

  const { data: existing, error: readError } = await supabase
    .from("template_versions")
    .select("template_id, version, definition_hash, stage");
  if (readError) throw new Error(`ledger read failed: ${readError.message}`);

  const driftedProduction = productionTemplateDrift(
    (existing ?? []).map((row) => ({
      template_id: row.template_id as string,
      version: row.version as number,
      definition_hash: row.definition_hash as string,
      stage: row.stage as string,
    })),
    rows,
  );

  // Never overwrite the evidence before reporting the problem. The previous
  // implementation upserted these rows and only then returned a non-zero exit
  // code, so the next sync could no longer detect what had drifted.
  if (driftedProduction.length > 0) {
    throw new Error(
      "公開済みテンプレート版がコード上で変更されています: " +
        driftedProduction.join(", ") +
        "。同じ版を上書きせずversionを上げてください。台帳は変更していません。",
    );
  }

  const { error: writeError } = await supabase
    .from("template_versions")
    .upsert(
      rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
      { onConflict: "template_id,version" },
    );
  if (writeError) throw new Error(`ledger write failed: ${writeError.message}`);

  return {
    written: rows.map((row) => `${row.template_id}@${row.version}`),
  };
}
