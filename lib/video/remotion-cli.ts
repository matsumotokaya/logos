import "server-only";

// Running the Remotion CLI as a child process.
//
// Extracted so the v1 video-asset renderer and the v2 take renderer invoke it
// the same way. There is one place that knows the argv, the public directory and
// the NODE_OPTIONS reset, so a fix to any of those reaches both callers.
//
// Still needs headless Chrome, so this cannot run on Vercel serverless. The
// cloud renderer will replace this spawn and keep the contract: props in, file
// at outPath, or an error carrying the tail of stderr.

import { spawn } from "node:child_process";

export function renderRemotionComposition(
  composition: string,
  propsPath: string,
  outPath: string,
  publicDir = "public",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        "remotion/index.ts",
        composition,
        outPath,
        `--props=${propsPath}`,
        `--public-dir=${publicDir}`,
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
