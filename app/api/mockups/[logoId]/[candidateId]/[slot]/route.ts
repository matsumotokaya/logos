import { mockupObjectKey, MOCKUP_SLOT_RE } from "@/lib/mockups";
import { mockupImageUrl, verifyMockupSignature } from "@/lib/mockup-sign";
import { getR2Object, putR2Object } from "@/lib/r2";
import {
  createServerSupabase,
  createServerSupabaseForToken,
  requireAccessToken,
} from "@/lib/supabase/server";

// Generous cap for one mockup image; anything beyond it is abuse.
const MAX_IMAGE_DATA_URL_LENGTH = 12_000_000;

function parseDataUrlImage(image: unknown): Uint8Array {
  if (typeof image !== "string") throw new Error("image is required.");
  if (image.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("image is too large.");
  }
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/.exec(image);
  if (!match) throw new Error("image must be a base64 data URL.");
  return Buffer.from(match[2], "base64");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ logoId: string; candidateId: string; slot: string }> },
) {
  const { logoId, candidateId, slot } = await params;
  if (!MOCKUP_SLOT_RE.test(slot)) {
    return Response.json({ error: "Unknown mockup slot." }, { status: 400 });
  }

  // <img> cannot send Authorization, so access control works in two tiers:
  // a valid HMAC signature (minted by the authenticated list/save APIs), or
  // anonymous RLS visibility of the candidate (public/unlisted logos).
  const query = new URL(req.url).searchParams;
  const signed = verifyMockupSignature(
    logoId,
    candidateId,
    slot,
    query.get("exp"),
    query.get("sig"),
  );
  if (!signed) {
    const { data: visible } = await createServerSupabase()
      .from("logo_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("logo_id", logoId)
      .maybeSingle();
    if (!visible) {
      return Response.json({ error: "Mockup not found." }, { status: 404 });
    }
  }

  const png = await getR2Object(mockupObjectKey(logoId, candidateId, slot));
  if (!png) {
    return Response.json({ error: "Mockup not found." }, { status: 404 });
  }

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Runtime assets can be rerendered into the same canonical slot.
      "Cache-Control": "private, no-cache",
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

    // Authorize before touching storage: the candidate must belong to the
    // logo in the URL (so the R2 key cannot be forged for another logo) and
    // the upsert must pass the mockups_write RLS policy. Only then write R2;
    // a failed R2 write leaves a row pointing at the previous object, which
    // a regeneration repairs.
    const supabase = createServerSupabaseForToken(token);
    const { data: candidate, error: candidateError } = await supabase
      .from("logo_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("logo_id", logoId)
      .maybeSingle();
    if (candidateError) throw candidateError;
    if (!candidate) throw new Error("Unauthorized");

    const { error } = await supabase.from("logo_mockups").upsert({
      candidate_id: candidateId,
      slot,
      mockup_definition_id: slot,
      image_path: objectKey,
    });
    if (error) throw error;

    await putR2Object(
      objectKey,
      bytes,
      "image/png",
      "private, max-age=31536000, immutable",
    );

    return Response.json(
      { url: mockupImageUrl(logoId, candidateId, slot) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save mockup.";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
