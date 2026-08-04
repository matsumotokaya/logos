import "server-only";

// MP4 render of one event-promo take, straight into R2.
//
// The brief comes from the take's own row, so the render reflects whatever the
// owner has edited — the bundled brief only ever seeded it. The finished file
// is uploaded to R2 and the local copy discarded: R2 is the source of truth, so
// a render produced on one machine is playable from any other (see
// lib/video/storage.ts).
//
// Still needs headless Chrome, so it cannot run on Vercel serverless. That
// constraint is unchanged by this file; what changes is that the *output* no
// longer only exists where the render happened. The cloud renderer replaces the
// spawn below and keeps the same contract: bytes in, R2 key out.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EventBrief } from "@/remotion/event/types";
import { putTakeOutput, renderedKey } from "./storage";

export interface EventRenderResult {
  key: string;
  bytes: number;
  renderedAt: string;
}

export async function renderEventTake(
  brandId: string,
  takeId: string,
  brief: EventBrief,
): Promise<EventRenderResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "logos-event-"));
  const propsPath = path.join(dir, "props.json");
  const outPath = path.join(dir, "out.mp4");
  try {
    await writeFile(propsPath, JSON.stringify({ brief }));
    await runRemotion(propsPath, outPath);
    const bytes = await readFile(outPath);
    const renderedAt = new Date().toISOString();
    const key = await putTakeOutput(
      brandId,
      takeId,
      renderedKey(renderedAt),
      bytes,
      "video/mp4",
    );
    return { key, bytes: bytes.byteLength, renderedAt };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runRemotion(propsPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        "remotion/index.ts",
        "event",
        outPath,
        `--props=${propsPath}`,
        // Materials still live under public/ and are referenced by
        // staticFile(); moving them into the material library is a separate
        // step (see docs/deliverable-architecture.md R4/R5).
        "--public-dir=public",
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "ignore", "pipe"],
        // The parent may run under --conditions=react-server; Remotion's CJS
        // build cannot load under it.
        env: { ...process.env, NODE_OPTIONS: "" },
      },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().slice(-500) || `render exited with ${code}`));
    });
  });
}
