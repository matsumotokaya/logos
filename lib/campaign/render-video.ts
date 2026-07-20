import "server-only";

// MP4 render of a campaign's CM, spawned from the voice job (local-first).
// Delegates to labs/campaign/scripts/render-cm.mjs so the CLI and the web
// flow share one implementation. Requires the Remotion CLI + headless Chrome
// — on hosts without them (e.g. Vercel serverless) the spawn fails and the
// caller degrades gracefully: the browser Player keeps working, only the
// LP's <video> embed stays absent.

import { spawn } from "node:child_process";

export function renderCmMp4(jobId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Via `npm run` on purpose: spawning `node <script>` directly makes
    // Turbopack statically analyze and try to bundle the script file.
    const child = spawn("npm", ["run", "campaign:render", "--", "--job", jobId], {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "pipe"],
      // The parent may run under --conditions=react-server (Next server /
      // campaign CLI); Remotion's CJS build cannot load under it.
      env: { ...process.env, NODE_OPTIONS: "" },
    });
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
