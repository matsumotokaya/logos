import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentTemplate, type TemplateEntry } from "@/lib/templates/catalog";
import { validateBrief } from "@/lib/templates/brief-schemas";

// Creating a take — the one place where a template version gets pinned.
//
// Everything that must never drift afterwards is decided here and written in a
// single insert: the template id, its version, the brief schema version and the
// tool kind. The database refuses to let any of them change later (0026), so a
// take made today still describes what it was made with after the catalog moves
// on (docs/schema-v2.md §9).
//
// The default renders are created at the same time, empty. A take with no
// render row would leave the detail screen with nothing to show as the goal,
// and "which outputs does this take have" is not something the UI should have
// to infer from a template lookup.

export interface CreateTakeInput {
  brandId: string;
  templateId: string;
  brief: unknown;
  title?: string;
  workId?: string | null;
  variantId?: string | null;
  createdBy: string;
  /** Stable key for one logical external request. Omit when the caller really
   * wants another independent Take with identical content. */
  idempotencyKey?: string | null;
}

export type CreateTakeResult =
  | {
      ok: true;
      takeId: string;
      template: TemplateEntry;
      renderIds: string[];
      created: boolean;
    }
  | { ok: false; error: string; issues?: string[] };

export async function createTake(
  supabase: SupabaseClient,
  input: CreateTakeInput,
): Promise<CreateTakeResult> {
  const template = currentTemplate(input.templateId);
  if (!template) {
    return { ok: false, error: `テンプレートが見つかりません: ${input.templateId}` };
  }

  // Shape only. A brief with empty facts is legitimate — the missing pieces
  // become collection tasks, not a reason to refuse the take.
  const validated = validateBrief(template.id, input.brief);
  if (!validated.ok) {
    return {
      ok: false,
      error: "briefがテンプレートの形式と一致しません",
      issues: validated.issues,
    };
  }

  const title = input.title?.trim() || template.name;
  const request = {
    brandId: input.brandId,
    variantId: input.variantId ?? null,
    workId: input.workId ?? null,
    toolKind: template.toolKind,
    templateId: template.id,
    templateVersion: template.version,
    briefSchemaVersion: template.briefSchemaVersion,
    brief: validated.brief,
    title,
    renders: template.defaultRenders,
  };
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  const requestHash = idempotencyKey
    ? createHash("sha256").update(JSON.stringify(request)).digest("hex")
    : null;

  const { data, error } = await supabase.rpc("create_v2_take", {
    p_brand_id: input.brandId,
    p_variant_id: input.variantId ?? null,
    p_work_id: input.workId ?? null,
    p_tool_kind: template.toolKind,
    p_template_id: template.id,
    p_template_version: template.version,
    p_brief_schema_version: template.briefSchemaVersion,
    p_brief: validated.brief,
    p_title: title,
    p_created_by: input.createdBy,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_renders: template.defaultRenders.map((render) => ({
      locale: render.locale,
      aspect_ratio: render.aspectRatio,
      theme: render.theme,
      format: render.format,
    })),
  });
  const row = (data as
    | { take_id: string; render_ids: string[]; created: boolean }[]
    | null)?.[0];

  if (error || !row) {
    return {
      ok: false,
      error:
        error?.code === "23503"
          ? `テンプレート版が台帳にありません（npm run templates:sync を実行してください）: ${template.id}@${template.version}`
          : (error?.message ?? "テイクを作成できませんでした"),
    };
  }

  return {
    ok: true,
    takeId: row.take_id,
    template,
    renderIds: row.render_ids,
    created: row.created,
  };
}
