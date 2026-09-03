import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignBrandKit } from "@/lib/campaign/schema";
import type { CampaignJob } from "@/lib/campaign/jobs";
import { appendBrandKnowledgeClaims } from "@/lib/brand/knowledge";
import { createTake } from "./create";
import { renderTake } from "./render";

/**
 * Persist one URL-generated Kit as an LP Take, without turning generated copy
 * into facts and without publishing it.
 *
 * Generation is a switch, publication is always an explicit act (v3 §19.4).
 * This used to call ensureCanonicalPublication, which made the LP the one
 * deliverable that went live the moment it existed.
 */
export async function createCampaignLpTake(
  supabase: SupabaseClient,
  input: {
    userId: string;
    brandId: string;
    job: CampaignJob;
    kit: CampaignBrandKit;
  },
): Promise<{ takeId: string; urlPath: string }> {
  const { userId, brandId, job, kit } = input;
  const sourceRef = { campaign_job_id: job.id, source_url: job.input.url };
  const claims = [
    ["offering.name", kit.service.name],
    ["offering.description", kit.service.description],
    ["offering.industry", kit.service.industry],
    ["offering.audience", kit.service.audience],
  ].map(([field_path, value]) => ({
    field_path,
    layer: "fact",
    value,
    confidence: "inferred",
  })) as Array<{
    field_path: string;
    layer: "fact";
    value: unknown;
    confidence: "inferred";
  }>;

  const { data: prior, error: priorError } = await supabase
    .from("takes")
    .select("id, take_renders(id, status, latest_artifact_id)")
    .eq("brand_id", brandId)
    .eq("template_id", "campaign-lp")
    .contains("brief", { campaignJobId: job.id })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (priorError)
    throw new Error(`既存LP Takeを読めませんでした: ${priorError.message}`);

  let takeId: string;
  let renderId: string | undefined;
  let renderIsReady = false;

  if (prior) {
    takeId = prior.id as string;
    const render = (prior.take_renders as
      | { id: string; status: string; latest_artifact_id: string | null }[]
      | null)?.[0];
    renderId = render?.id;
    renderIsReady = render?.status === "ready" && Boolean(render.latest_artifact_id);
  } else {
    const created = await createTake(supabase, {
      brandId,
      templateId: "campaign-lp",
      createdBy: userId,
      idempotencyKey: `campaign-job:${job.id}`,
      title: `${kit.service.name} LP`,
      brief: {
        kit,
        campaignJobId: job.id,
        sourceUrl: job.input.url,
        theme: kit.theme ?? null,
      },
    });
    if (!created.ok) throw new Error(created.error);
    takeId = created.takeId;
    renderId = created.renderIds[0];
    if (!created.created) {
      const state = await readRenderState(supabase, renderId);
      renderIsReady = state.ready;
    }
  }

  const runId = await ensureTakeRun(supabase, takeId, userId, job);
  const appended = await appendBrandKnowledgeClaims(supabase, {
    brandId,
    fields: claims,
    sourceKind: "llm_structuring",
    sourceRef,
    userId,
    runId,
  });
  if (!appended.ok) {
    throw new Error(`Knowledge claimを保存できませんでした: ${appended.error}`);
  }
  if (!renderId) throw new Error("LP Renderが作成されませんでした");
  if (!renderIsReady) {
    const rendered = await renderTake(supabase, renderId);
    if (!rendered.ok) throw new Error(rendered.error);
  }

  // The management path, not a live URL: nothing is published here.
  return { takeId, urlPath: `/brands/${brandId}/lp/${takeId}` };
}

async function readRenderState(
  supabase: SupabaseClient,
  renderId: string | undefined,
): Promise<{ ready: boolean }> {
  if (!renderId) return { ready: false };
  const { data, error } = await supabase
    .from("take_renders")
    .select("status, latest_artifact_id")
    .eq("id", renderId)
    .maybeSingle();
  if (error) throw new Error(`LP Renderを読めませんでした: ${error.message}`);
  return {
    ready: data?.status === "ready" && Boolean(data.latest_artifact_id),
  };
}

async function ensureTakeRun(
  supabase: SupabaseClient,
  takeId: string,
  userId: string,
  job: CampaignJob,
): Promise<string> {
  const { data: existing, error: readError } = await supabase
    .from("take_runs")
    .select("id, take_id")
    .eq("external_job_id", job.id)
    .maybeSingle();
  if (readError) throw new Error(`既存Take Runを読めませんでした: ${readError.message}`);
  if (existing) {
    if (existing.take_id !== takeId) {
      throw new Error("同じキャンペーンジョブが別のTakeに使われています");
    }
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("take_runs")
    .insert({
      take_id: takeId,
      stage: "structure",
      status: "succeeded",
      input: {
        source_url: job.input.url,
        has_text: job.input.hasText,
        file_count: job.input.files,
        file_kinds: job.input.fileKinds ?? [],
        selected_brand_id: job.input.brandEntityId ?? null,
      },
      steps: job.steps,
      usage: job.meta?.usage ?? {},
      external_job_id: job.id,
      triggered_by: userId,
      started_at: job.createdAt,
      finished_at: job.updatedAt,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Take Runを保存できませんでした: ${error?.message ?? "not found"}`);
  }
  return data.id as string;
}
