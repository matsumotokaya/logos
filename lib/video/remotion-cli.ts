import "server-only";

// Running the Remotion CLI as a child process.
//
// Shared Remotion CLI adapter used by the Take renderer.
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
        // BOTH streams. Remotion prints its fatal errors on stdout — a missing
        // asset arrives as 「Error fetching /public/... 404」 there — and this
        // used to discard it, so the reported reason was whatever happened to
        // be at the tail of stderr. A render that died on a 404 was reported as
        // a zod version warning, and the warning is what got chased.
        stdio: ["ignore", "pipe", "pipe"],
        // The parent may run under --conditions=react-server; Remotion's CJS
        // build cannot load under it.
        env: { ...process.env, NODE_OPTIONS: "" },
      },
    );
    let log = "";
    const collect = (chunk: unknown) => {
      log += String(chunk);
      if (log.length > 8000) log = log.slice(-8000);
    };
    child.stdout?.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      // The most useful line is rarely the last one: Remotion follows a fatal
      // error with a stack and a version banner. Prefer the error itself.
      const fatal = /^.*(?:Error|error:).*$/gm.exec(log)?.[0]?.trim();
      const tail = log.trim().slice(-600);
      reject(
        new Error(
          fatal && !tail.includes(fatal) ? `${fatal}\n---\n${tail}` : tail ||
            `render exited with ${code}`,
        ),
      );
    });
  });
}
