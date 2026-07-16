#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const ASSETS = {
  "workflow-neon-sign-v1": {
    familyId: "workflow-neon-sign",
    version: 1,
    script: "labs/workflow/scripts/blender/neon_sign.py",
    width: 1600,
    height: 1200,
  },
};

const args = parseArgs(process.argv.slice(2));
const asset = ASSETS[args.assetId];
if (!asset) fail(`Unsupported asset: ${args.assetId}`);

validateId("Logo ID", args.logoId, /^[A-Za-z0-9_-]{8,64}$/);
validateId("Candidate ID", args.candidateId, /^[0-9a-f-]{36}$/i);
if (args.runId) validateId("Run ID", args.runId, /^[0-9a-f-]{36}$/i);

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const managementToken = requiredEnv("SUPABASE_ACCESS_TOKEN_LOGOS");
const blender = await blenderExecutable();
const workDir = path.join(
  "var",
  "workflow-lab",
  "runtime",
  args.logoId,
  args.candidateId,
  args.assetId,
);
const svgPath = path.join(workDir, "master.svg");
const outputPath = path.join(
  workDir,
  args.publish ? "render.png" : `render-preview-${args.samples}.png`,
);
const objectKey = `logos/${args.logoId}/candidates/${args.candidateId}/mockups/${args.assetId}.png`;

await preflight();
await mkdir(workDir, { recursive: true });
const candidate = await getCandidate();
await writeFile(svgPath, candidate.svg, "utf8");

if (args.runId && !args.publish) fail("--run-id cannot be combined with --no-publish.");
if (args.runId) await updateRun("running");

try {
  await runBlender();
  const quality = await validateRender(outputPath, asset);
  const storage = args.publish ? await uploadAndVerify(outputPath, objectKey) : null;
  const registration = args.publish ? await registerOutput(objectKey) : null;
  if (args.runId) await updateRun("succeeded", objectKey);

  console.log(
    JSON.stringify(
      {
        projectRef,
        logo: { id: args.logoId, title: candidate.title },
        candidateId: args.candidateId,
        asset: { id: args.assetId, familyId: asset.familyId, version: asset.version },
        runId: args.runId ?? null,
        outputPath,
        quality,
        storage,
        registration,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (args.runId) {
    await updateRun("failed", null, error instanceof Error ? error.message : String(error));
  }
  throw error;
}

async function preflight() {
  const rows = await query(`
    select
      to_regclass('public.logo_asset_runs') is not null as has_runs,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'logo_mockups'
          and column_name = 'asset_run_id'
      ) as has_asset_run_column,
      exists (
        select 1 from public.presentation_asset_definitions
        where id = ${sql(args.assetId)}
      ) as has_definition
  `);
  const state = rows[0];
  if (!state?.has_runs || !state?.has_asset_run_column || !state?.has_definition) {
    fail("Asset lifecycle schema is missing. Apply supabase/migrations/0007_asset_lifecycle.sql first.");
  }
}

async function getCandidate() {
  const rows = await query(`
    select l.title, c.svg
    from public.logos l
    join public.logo_candidates c on c.logo_id = l.id
    where l.id = ${sql(args.logoId)} and c.id = ${sql(args.candidateId)}
  `);
  if (rows.length !== 1 || !rows[0].svg) {
    fail("Logo ID and Candidate ID do not resolve to one canonical SVG.");
  }
  return rows[0];
}

async function runBlender() {
  const blenderArgs = [
    "-b",
    "-P",
    asset.script,
    "--",
    "--svg",
    svgPath,
    "--out",
    outputPath,
    "--width",
    String(asset.width),
    "--height",
    String(asset.height),
    "--samples",
    String(args.samples),
    "--color-mode",
    args.colorMode,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(blender, blenderArgs, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Blender failed (${signal ?? `exit ${code}`}).`));
    });
  });
}

async function validateRender(file, definition) {
  const image = sharp(file).removeAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  if (info.width !== definition.width || info.height !== definition.height) {
    fail(`Unexpected output dimensions: ${info.width}x${info.height}.`);
  }
  if (info.width * 3 !== info.height * 4) fail("Runtime output is not 4:3.");

  const threshold = 220;
  let count = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const brightest = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      if (brightest < threshold) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (count < 100 || maxX < 0 || maxY < 0) fail("No usable bright artwork was detected.");

  const centerX = (minX + maxX) / 2 / info.width;
  const centerY = (minY + maxY) / 2 / info.height;
  const tolerance = 0.06;
  if (Math.abs(centerX - 0.5) > tolerance || Math.abs(centerY - 0.5) > tolerance) {
    fail(
      `Artwork is off-center: (${centerX.toFixed(3)}, ${centerY.toFixed(3)}), expected 0.5 +/- ${tolerance}.`,
    );
  }

  return {
    width: info.width,
    height: info.height,
    aspect: "4:3",
    brightPixelCount: count,
    artworkBounds: [minX, minY, maxX, maxY],
    artworkCenter: [Number(centerX.toFixed(4)), Number(centerY.toFixed(4))],
  };
}

async function uploadAndVerify(file, key) {
  const body = await readFile(file);
  const client = r2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: key,
      Body: body,
      ContentType: "image/png",
      CacheControl: "private, no-cache",
    }),
  );
  const response = await client.send(
    new GetObjectCommand({ Bucket: requiredEnv("R2_BUCKET_NAME"), Key: key }),
  );
  if (!response.Body) fail("R2 read-back returned an empty body.");
  const remote = Buffer.from(await response.Body.transformToByteArray());
  const localHash = sha256(body);
  const remoteHash = sha256(remote);
  if (localHash !== remoteHash) fail("R2 read-back checksum does not match the render.");
  return { key, bytes: body.length, sha256: localHash };
}

async function registerOutput(key) {
  const rows = await query(`
    insert into public.logo_mockups (
      candidate_id, slot, mockup_definition_id, asset_run_id,
      image_path, params, updated_at
    ) values (
      ${sql(args.candidateId)}, ${sql(args.assetId)}, ${sql(args.assetId)},
      ${args.runId ? sql(args.runId) : "null"}, ${sql(key)},
      ${sql(JSON.stringify({ colorMode: args.colorMode }))}::jsonb, now()
    )
    on conflict (candidate_id, slot) do update set
      mockup_definition_id = excluded.mockup_definition_id,
      asset_run_id = excluded.asset_run_id,
      image_path = excluded.image_path,
      params = excluded.params,
      updated_at = excluded.updated_at
    returning candidate_id, slot, asset_run_id, image_path, params, updated_at
  `);
  return rows[0];
}

async function updateRun(status, outputPathValue = null, errorMessage = null) {
  const timestampFields =
    status === "running"
      ? "started_at = now(), finished_at = null"
      : "finished_at = now()";
  const rows = await query(`
    update public.logo_asset_runs
    set status = ${sql(status)}, ${timestampFields},
        output_path = ${outputPathValue ? sql(outputPathValue) : "null"},
        error_message = ${errorMessage ? sql(errorMessage.slice(0, 2000)) : "null"},
        updated_at = now()
    where id = ${sql(args.runId)}
      and candidate_id = ${sql(args.candidateId)}
      and asset_definition_id = ${sql(args.assetId)}
    returning id
  `);
  if (rows.length !== 1) fail("Run ID does not match the candidate and asset definition.");
}

async function query(statement) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: statement }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
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

function parseArgs(argv) {
  const values = { samples: 150, publish: true, colorMode: "logo" };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--no-publish") {
      values.publish = false;
      continue;
    }
    const value = argv[index + 1];
    if (name === "--logo-id") values.logoId = value;
    else if (name === "--candidate-id") values.candidateId = value;
    else if (name === "--asset-id") values.assetId = value;
    else if (name === "--run-id") values.runId = value;
    else if (name === "--samples") values.samples = Number(value);
    else if (name === "--color-mode") values.colorMode = value;
    else fail(`Unknown argument: ${name}`);
    index += 1;
  }
  if (!values.logoId || !values.candidateId || !values.assetId) {
    fail("Usage: run-runtime-asset.mjs --logo-id <id> --candidate-id <uuid> --asset-id <id> [--run-id <uuid>] [--color-mode <logo|warm-white>] [--samples 150] [--no-publish]");
  }
  if (!Number.isInteger(values.samples) || values.samples <= 0) {
    fail("--samples must be a positive integer.");
  }
  if (!new Set(["logo", "warm-white"]).has(values.colorMode)) {
    fail("--color-mode must be logo or warm-white.");
  }
  return values;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is not configured.`);
  return value;
}

function validateId(label, value, pattern) {
  if (!pattern.test(value)) fail(`${label} is invalid.`);
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  throw new Error(message);
}
