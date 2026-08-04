// Which campaign job owns a brand asset's generated output.
//
// The job id lives in three places depending on when the asset was created:
// the generation run's external_job_id (current), legacy_campaign_id (rows
// migrated from the pre-hierarchy campaigns table), or, failing both, the
// public path the LP was published at. Both the brand tree API and the video
// portal need this, and getting it wrong is silent — a video simply looks
// "未作成" because its job was never found — so the resolution order lives
// here once rather than in each caller.

export interface JobIdAssetFields {
  generation_run_id: string | null;
  legacy_campaign_id: string | null;
  public_path?: string | null;
}

export interface JobIdRunFields {
  external_job_id: string | null;
}

export function resolveCampaignJobId(
  asset: JobIdAssetFields,
  runs: Map<string, JobIdRunFields>,
): string | null {
  const run = asset.generation_run_id ? runs.get(asset.generation_run_id) : undefined;
  if (run?.external_job_id) return run.external_job_id;
  if (asset.legacy_campaign_id) return asset.legacy_campaign_id;
  const publicMatch = asset.public_path?.match(/^\/c\/([^/?#]+)/);
  return publicMatch?.[1] ?? null;
}
