import { mockupObjectKey, MOCKUP_SLOT_RE } from "@/lib/mockups";
import { getR2Object, putR2Object } from "@/lib/r2";
import {
  createServerSupabaseForToken,
  requireAccessToken,
} from "@/lib/supabase/server";

function parseDataUrlImage(image: unknown): Uint8Array {
  if (typeof image !== "string") throw new Error("image is required.");
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/.exec(image);
  if (!match) throw new Error("image must be a base64 data URL.");
  return Buffer.from(match[2], "base64");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ logoId: string; candidateId: string; slot: string }> },
) {
  const { logoId, candidateId, slot } = await params;
  if (!MOCKUP_SLOT_RE.test(slot)) {
    return Response.json({ error: "Unknown mockup slot." }, { status: 400 });
  }

  const png = await getR2Object(mockupObjectKey(logoId, candidateId, slot));
  if (!png) {
    return Response.json({ error: "Mockup not found." }, { status: 404 });
  }

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ logoId: string; candidateId: string; slot: string }> },
) {
  try {
    const token = await requireAccessToken(req);
    const { logoId, candidateId, slot } = await params;
    if (!MOCKUP_SLOT_RE.test(slot)) throw new Error("Unknown mockup slot.");

    const body = (await req.json()) as { image?: string };
    const bytes = parseDataUrlImage(body.image);
    const objectKey = mockupObjectKey(logoId, candidateId, slot);

    await putR2Object(
      objectKey,
      bytes,
      "image/png",
      "private, max-age=31536000, immutable",
    );

    const supabase = createServerSupabaseForToken(token);
    const { error } = await supabase.from("logo_mockups").upsert({
      candidate_id: candidateId,
      slot,
      mockup_definition_id: slot,
      image_path: objectKey,
    });
    if (error) throw error;

    return Response.json(
      { url: `/api/mockups/${logoId}/${candidateId}/${slot}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save mockup.";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
