import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignJob } from "@/lib/campaign/jobs";
import type { CmVoiceTrack } from "@/lib/campaign/cm-types";
import { deleteR2Object, headR2Object, putR2Object } from "@/lib/r2";
import { createTake } from "./create";
import { renderTake } from "./render";

export async function ensureProductCmTake(
  supabase: SupabaseClient,
  input: { userId: string; job: CampaignJob; brandId?: string | null },
): Promise<{ takeId: string; renderId: string; brandId: string }> {
  if (!input.job.kit) throw new Error("Product CMのBrand Kitがありません");

  let brandId = input.brandId ?? null;
  let workId: string | null = input.job.catalog?.workId ?? null;
  if (!brandId) {
    const { data: lpTake, error } = await supabase
      .from("takes")
      .select("brand_id, work_id")
      .eq("template_id", "campaign-lp")
      .contains("brief", { campaignJobId: input.job.id })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`LP Takeを確認できませんでした: ${error.message}`);
    brandId = (lpTake?.brand_id as string | undefined) ?? input.job.catalog?.brandId ?? null;
    workId = (lpTake?.work_id as string | null | undefined) ?? workId;
  }
  if (!brandId) throw new Error("Product CMを所属させるBrandがありません");

  const created = await createTake(supabase, {
    brandId,
    workId,
    templateId: "product-cm",
    createdBy: input.userId,
    idempotencyKey: `product-cm-job:${input.job.id}`,
    title: `${input.job.kit.service.name} 製品紹介動画`,
    brief: {
      kit: input.job.kit,
      campaignJobId: input.job.id,
      sourceUrl: input.job.input.url,
      theme: input.job.kit.theme ?? null,
    },
  });
  if (!created.ok) throw new Error(created.error);
  const renderId = created.renderIds[0];
  if (!renderId) throw new Error("Product CM Renderが作成されませんでした");
  return { takeId: created.takeId, renderId, brandId };
}

export async function attachProductCmVoice(
  supabase: SupabaseClient,
  input: {
    takeId: string;
    brandId: string;
    userId: string;
    jobId: string;
    wav: Buffer;
    track: CmVoiceTrack;
  },
): Promise<{ materialId: string; checksum: string; created: boolean }> {
  const checksum = createHash("sha256").update(input.wav).digest("hex");
  const r2Key =
    `brands/${input.brandId}/takes/${input.takeId}/materials/` +
    `product-cm-voice-${checksum.slice(0, 16)}.wav`;
  const existed = await headR2Object(r2Key);
  if (!existed) {
    await putR2Object(
      r2Key,
      input.wav,
      "audio/wav",
      "private, max-age=31536000, immutable",
    );
  } else if (existed.size !== input.wav.byteLength) {
    throw new Error("同じ音声キーに異なるサイズのR2オブジェクトがあります");
  }

  const materialId = randomUUID();
  const { data, error } = await supabase.rpc("attach_product_cm_voice", {
    p_take_id: input.takeId,
    p_material_id: materialId,
    p_r2_key: r2Key,
    p_bytes: input.wav.byteLength,
    p_checksum: checksum,
    p_duration_ms: Math.round(input.track.totalMs),
    p_track: input.track,
    p_created_by: input.userId,
    p_source_ref: { campaign_job_id: input.jobId },
  });
  if (error) {
    if (!existed) {
      try {
        await deleteR2Object(r2Key);
      } catch (cleanupError) {
        throw new Error(
          `${error.message}; R2補償削除にも失敗しました: ${
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }`,
        );
      }
    }
    throw new Error(`Product CM音声を固定できませんでした: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  const adoptedId = (row as { material_id?: string } | null)?.material_id;
  if (!adoptedId) throw new Error("固定したProduct CM音声を解決できませんでした");
  return {
    materialId: adoptedId,
    checksum,
    created: (row as { created?: boolean } | null)?.created === true,
  };
}

export async function renderProductCmJob(
  supabase: SupabaseClient,
  input: {
    userId: string;
    job: CampaignJob;
    wav: Buffer;
    track: CmVoiceTrack;
    brandId?: string | null;
  },
) {
  const take = await ensureProductCmTake(supabase, input);
  const voice = await attachProductCmVoice(supabase, {
    takeId: take.takeId,
    brandId: take.brandId,
    userId: input.userId,
    jobId: input.job.id,
    wav: input.wav,
    track: input.track,
  });
  if (!voice.created) {
    const { data: ready, error } = await supabase
      .from("take_renders")
      .select("latest_artifact_id, render_artifacts!take_renders_latest_artifact_fkey(r2_key, bytes)")
      .eq("id", take.renderId)
      .eq("status", "ready")
      .maybeSingle();
    if (error) throw new Error(`Product CM Renderを確認できませんでした: ${error.message}`);
    const joined = ready?.render_artifacts as
      | { r2_key: string; bytes: number | null }
      | Array<{ r2_key: string; bytes: number | null }>
      | null
      | undefined;
    const artifact = Array.isArray(joined) ? joined[0] : joined;
    if (ready?.latest_artifact_id && artifact?.r2_key) {
      return {
        ...take,
        artifactId: ready.latest_artifact_id as string,
        r2Key: artifact.r2_key,
        bytes: Number(artifact.bytes ?? 0),
        renderedAt: "",
        rendered: false,
      };
    }
  }
  const rendered = await renderTake(supabase, take.renderId);
  if (!rendered.ok) throw new Error(rendered.error);
  return { ...take, ...rendered, rendered: true };
}
