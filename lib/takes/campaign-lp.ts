import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignBrandKit } from "@/lib/campaign/schema";
import type { CampaignJob } from "@/lib/campaign/jobs";
import { createTake } from "./create";
import { renderTake } from "./render";

/** Persist one URL-generated Kit into v2 without turning generated copy into facts. */
export async function createPublishedCampaignLp(
  supabase: SupabaseClient,
  input: {
    userId: string;
    brandId: string;
    workId?: string | null;
    job: CampaignJob;
    kit: CampaignBrandKit;
  },
): Promise<{ takeId: string; urlPath: string }> {
  const { userId, brandId, workId, job, kit } = input;
  const sourceRef = { campaign_job_id: job.id, source_url: job.input.url };
  const claims = [
    ["offering.name", kit.service.name],
    ["offering.description", kit.service.description],
    ["offering.industry", kit.service.industry],
    ["offering.audience", kit.service.audience],
  ].map(([field_path, value]) => ({
    brand_id: brandId,
    field_path,
    layer: "fact",
    value,
    confidence: "inferred",
    source_kind: "llm_structuring",
    source_ref: sourceRef,
    recorded_by: userId,
  }));
  if (!workId) {
    const { error: claimError } = await supabase
      .from("brand_knowledge_claims")
      .insert(claims);
    if (claimError)
      throw new Error(
        `Knowledge claimを保存できませんでした: ${claimError.message}`,
      );
  }

  const { data: prior, error: priorError } = await supabase
    .from("takes")
    .select("id")
    .eq("brand_id", brandId)
    .eq("template_id", "campaign-lp")
    .contains("brief", { campaignJobId: job.id })
    .maybeSingle();
  if (priorError)
    throw new Error(`既存LP Takeを読めませんでした: ${priorError.message}`);
  if (prior) return { takeId: prior.id as string, urlPath: `/c/${prior.id}` };

  const created = await createTake(supabase, {
    brandId,
    workId,
    templateId: "campaign-lp",
    createdBy: userId,
    title: `${kit.service.name} LP`,
    brief: {
      kit,
      campaignJobId: job.id,
      sourceUrl: job.input.url,
      theme: kit.theme ?? null,
    },
  });
  if (!created.ok) throw new Error(created.error);
  const renderId = created.renderIds[0];
  if (!renderId) throw new Error("LP Renderが作成されませんでした");
  const rendered = await renderTake(supabase, renderId);
  if (!rendered.ok) throw new Error(rendered.error);

  const urlPath = `/c/${created.takeId}`;
  const { error: publicationError } = await supabase
    .from("publications")
    .insert({
      render_id: renderId,
      surface: "canonical_url",
      url_path: urlPath,
      status: "live",
      published_at: new Date().toISOString(),
      published_by: userId,
      metadata: { campaign_job_id: job.id },
    });
  if (publicationError)
    throw new Error(`LPを公開できませんでした: ${publicationError.message}`);
  return { takeId: created.takeId, urlPath };
}
