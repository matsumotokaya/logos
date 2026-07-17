// GET: serve a generated image from our own storage. This is the only URL
// a generation is ever referenced by — external provider URLs are collected
// immediately after generation and never stored.

import { readOutput } from "@/labs/generative/engine/storage";
import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!labsEnabled()) return labsDisabledResponse();
  const { name } = await params;
  try {
    const png = await readOutput(name);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Immutable by construction: one file per generation, never rewritten.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ error: "出力が見つからない" }, { status: 404 });
  }
}
