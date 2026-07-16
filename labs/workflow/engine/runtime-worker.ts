import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mockupObjectKey } from "@/lib/mockups";
import { putR2Object } from "@/lib/r2";
import { createServerSupabaseForToken } from "@/lib/supabase/server";

const execFileAsync = promisify(execFile);
const NEON_ASSET_ID = "workflow-neon-sign-v1";
const NEON_SCRIPT = path.join(
  process.cwd(),
  "labs",
  "workflow",
  "scripts",
  "blender",
  "neon_sign.py",
);

export async function executeRuntimeAssetRun({
  accessToken,
  runId,
}: {
  accessToken: string;
  runId: string;
}) {
  return executeRuntimeAssetRunWithClient({
    supabase: createServerSupabaseForToken(accessToken),
    runId,
  });
}

async function executeRuntimeAssetRunWithClient({
  supabase,
  runId,
}: {
  supabase: SupabaseClient;
  runId: string;
}) {
  const { data: run, error: runError } = await supabase
    .from("logo_asset_runs")
    .select("id, candidate_id, asset_definition_id, params")
    .eq("id", runId)
    .single();
  if (runError || !run) throw runError ?? new Error("Asset run not found.");

  if (run.asset_definition_id !== NEON_ASSET_ID) {
    await failRun(supabase, runId, "Unsupported runtime asset definition.");
    return;
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("logo_candidates")
    .select("id, logo_id, svg")
    .eq("id", run.candidate_id)
    .single();
  if (candidateError || !candidate) {
    await failRun(
      supabase,
      runId,
      candidateError?.message ?? "Logo candidate not found.",
    );
    return;
  }

  await supabase
    .from("logo_asset_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", runId);

  const dir = await mkdtemp(path.join(os.tmpdir(), "logos-neon-"));
  const svgPath = path.join(dir, "master.svg");
  const outputPath = path.join(dir, "render.png");
  try {
    await writeFile(svgPath, candidate.svg, "utf8");
    await execFileAsync(await blenderExecutable(), [
      "-b",
      "-P",
      NEON_SCRIPT,
      "--",
      "--svg",
      svgPath,
      "--out",
      outputPath,
      "--samples",
      process.env.BLENDER_SAMPLES?.trim() || "150",
    ], { maxBuffer: 8 * 1024 * 1024 });

    const png = await readFile(outputPath);
    const objectKey = mockupObjectKey(
      candidate.logo_id,
      candidate.id,
      run.asset_definition_id,
    );
    await putR2Object(
      objectKey,
      png,
      "image/png",
      "private, no-cache",
    );

    const finishedAt = new Date().toISOString();
    const { error: mockupError } = await supabase.from("logo_mockups").upsert({
      candidate_id: candidate.id,
      slot: run.asset_definition_id,
      mockup_definition_id: run.asset_definition_id,
      asset_run_id: run.id,
      image_path: objectKey,
      params: run.params ?? {},
      updated_at: finishedAt,
    });
    if (mockupError) throw mockupError;

    const { error: finishError } = await supabase
      .from("logo_asset_runs")
      .update({
        status: "succeeded",
        output_path: objectKey,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      .eq("id", runId);
    if (finishError) throw finishError;
  } catch (error) {
    await failRun(
      supabase,
      runId,
      error instanceof Error ? error.message : "Runtime render failed.",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function blenderExecutable() {
  const configured = process.env.BLENDER_BIN?.trim();
  if (configured) return configured;
  const macPath = "/Applications/Blender.app/Contents/MacOS/Blender";
  try {
    await access(macPath);
    return macPath;
  } catch {
    return "blender";
  }
}

async function failRun(
  supabase: SupabaseClient,
  runId: string,
  message: string,
) {
  const now = new Date().toISOString();
  await supabase
    .from("logo_asset_runs")
    .update({
      status: "failed",
      error_message: message.slice(0, 2000),
      finished_at: now,
      updated_at: now,
    })
    .eq("id", runId);
}
