import "server-only";

import { createHash } from "node:crypto";
import {
  TEMPLATES,
  templateSpec,
  type TemplateEntry,
} from "./catalog";
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
  /** Versions whose definition changed since they were recorded. Reported
   *  rather than hidden: on a production row this means takes were pinned to
   *  something that no longer matches the code. */
  driftedProduction: string[];
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

  const before = new Map(
    (existing ?? []).map((row) => [
      `${row.template_id}@${row.version}`,
      row as { definition_hash: string; stage: string },
    ]),
  );

  const driftedProduction = rows
    .filter((row) => {
      const previous = before.get(`${row.template_id}@${row.version}`);
      return (
        previous &&
        previous.stage === "production" &&
        previous.definition_hash !== row.definition_hash
      );
    })
    .map((row) => `${row.template_id}@${row.version}`);

  const { error: writeError } = await supabase
    .from("template_versions")
    .upsert(
      rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
      { onConflict: "template_id,version" },
    );
  if (writeError) throw new Error(`ledger write failed: ${writeError.message}`);

  return {
    written: rows.map((row) => `${row.template_id}@${row.version}`),
    driftedProduction,
  };
}
