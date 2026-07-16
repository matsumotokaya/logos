import {
  createServerSupabaseForToken,
  requireAccessToken,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const RUNTIME_ASSET_IDS = new Set(["workflow-neon-sign-v1"]);

export async function POST(req: Request) {
  try {
    const accessToken = await requireAccessToken(req);
    const body = (await req.json()) as {
      candidateId?: unknown;
      assetDefinitionId?: unknown;
      params?: unknown;
    };
    if (typeof body.candidateId !== "string") {
      throw new Error("candidateId is required.");
    }
    if (
      typeof body.assetDefinitionId !== "string" ||
      !RUNTIME_ASSET_IDS.has(body.assetDefinitionId)
    ) {
      throw new Error("Unknown runtime asset definition.");
    }
    if (
      body.params !== undefined &&
      (typeof body.params !== "object" ||
        body.params === null ||
        Array.isArray(body.params))
    ) {
      throw new Error("params must be an object.");
    }

    const supabase = createServerSupabaseForToken(accessToken);
    const [{ data: userData, error: userError }, { data: active, error: activeError }] =
      await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("logo_asset_runs")
          .select("id, asset_definition_id, status, params, error_message, queued_at, started_at, finished_at")
          .eq("candidate_id", body.candidateId)
          .eq("asset_definition_id", body.assetDefinitionId)
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (userError || !userData.user) throw new Error("Unauthorized");
    if (activeError) throw activeError;
    if (active) {
      return Response.json(
        { run: toAssetRun(active) },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: run, error } = await supabase
      .from("logo_asset_runs")
      .insert({
        candidate_id: body.candidateId,
        asset_definition_id: body.assetDefinitionId,
        params: body.params ?? {},
        triggered_by: userData.user.id,
      })
      .select("id, asset_definition_id, status, params, error_message, queued_at, started_at, finished_at")
      .single();
    if (error || !run) throw error ?? new Error("Failed to create asset run.");

    return Response.json(
      { run: toAssetRun(run) },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue render.";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}

function toAssetRun(row: Record<string, unknown>) {
  return {
    id: row.id,
    assetDefinitionId: row.asset_definition_id,
    status: row.status,
    params: row.params ?? {},
    errorMessage: row.error_message ?? null,
    queuedAt: row.queued_at,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
  };
}
