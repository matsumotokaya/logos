import "server-only";

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
}

export type CreateTakeResult =
  | {
      ok: true;
      takeId: string;
      template: TemplateEntry;
      renderIds: string[];
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

  const { data: take, error: takeError } = await supabase
    .from("takes")
    .insert({
      brand_id: input.brandId,
      variant_id: input.variantId ?? null,
      work_id: input.workId ?? null,
      tool_kind: template.toolKind,
      template_id: template.id,
      template_version: template.version,
      brief_schema_version: template.briefSchemaVersion,
      brief: validated.brief,
      title: input.title?.trim() || template.name,
      status: "draft",
      created_by: input.createdBy,
    })
    .select("id")
    .maybeSingle();

  if (takeError || !take) {
    // A missing ledger row surfaces as a foreign key violation. That is the
    // intended failure: a take must not pin a version nobody recorded.
    return {
      ok: false,
      error:
        takeError?.code === "23503"
          ? `テンプレート版が台帳にありません（npm run templates:sync を実行してください）: ${template.id}@${template.version}`
          : (takeError?.message ?? "テイクを作成できませんでした"),
    };
  }

  const { data: renders, error: renderError } = await supabase
    .from("take_renders")
    .insert(
      template.defaultRenders.map((render) => ({
        take_id: take.id,
        locale: render.locale,
        aspect_ratio: render.aspectRatio,
        theme: render.theme,
        format: render.format,
        status: "pending",
      })),
    )
    .select("id");

  if (renderError) {
    return { ok: false, error: `出力単位を作成できませんでした: ${renderError.message}` };
  }

  return {
    ok: true,
    takeId: take.id,
    template,
    renderIds: (renders ?? []).map((render) => render.id as string),
  };
}
