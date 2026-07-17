import { NextResponse } from "next/server";
import { luminance } from "@/lib/color";
import {
  createServerSupabaseForToken,
  requireUser,
  type VerifiedUser,
} from "@/lib/supabase/server";

// Image generation can take a while on the model side.
export const maxDuration = 60;

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

// Each call is a paid provider request, so generation is restricted to
// registered (non-anonymous) users and capped per rolling 24h window.
const DAILY_LIMIT = Math.max(
  1,
  Number(process.env.GENERATION_DAILY_LIMIT) || 20
);
// The client rasterizes logos at 1024px; anything far beyond that is abuse.
const MAX_IMAGE_BASE64_LENGTH = 4_000_000;
const MAX_BRAND_NAME_LENGTH = 120;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// {surface} is filled with a product color chosen to contrast the logo ink.
const SCENE_PROMPTS: Record<string, string> = {
  mug: "a {surface} matte ceramic coffee mug with the logo printed large on its side, standing on a dark stone surface",
  tote: "a {surface} cotton tote bag with the logo printed large on the center, hanging against a dark concrete wall",
  cap: "a {surface} baseball cap with the logo embroidered on the front panel, resting on a dark surface",
  wall: "a minimal architectural interior with a large smooth concrete or plaster wall, the logo applied to the wall as a clean flat white sign, centered with generous empty space around it",
};

// The attached logo is rasterized on a white background, so its dominant color is the ink.
function surfaceFor(inkHex: string): string {
  return luminance(inkHex) < 0.45
    ? "cream off-white"
    : "matte charcoal black";
}

function buildPrompt(target: string, brandName: string, inkHex: string) {
  const scene = SCENE_PROMPTS[target].replace("{surface}", surfaceFor(inkHex));
  if (target === "wall") {
    // Brand hero scene: white sign in daylight instead of the dark studio look.
    return [
      `Create a photorealistic brand hero photo for the brand "${brandName}": ${scene}.`,
      "Use the exact logo shape from the attached image, rendered entirely in matte white — do not redraw, distort, restyle or add elements to the logo.",
      "The wall is a muted mid-to-dark tone so the white sign stays clearly legible.",
      "Editorial architectural photography: soft natural daylight, subtle material texture, generous negative space, premium brand-guideline presentation style.",
      "No text anywhere in the image other than the logo itself.",
    ].join(" ");
  }
  return [
    `Create a photorealistic product mockup photo for the brand "${brandName}": ${scene}.`,
    "Use the exact logo from the attached image. Reproduce its shape and colors precisely — do not redraw, distort, restyle or add elements to the logo.",
    "The logo must be clearly legible with strong contrast against the product surface. Never render the logo in the same tone as the product it sits on (no black logo on a black product, no white logo on a white product).",
    "Cinematic dark editorial studio aesthetic: near-black surroundings, soft directional lighting, shallow depth of field, premium brand-guideline presentation style. The product itself stays light or dark as specified so the logo reads clearly.",
    "No text anywhere in the image other than the logo itself.",
  ].join(" ");
}

type GenerateBody = {
  target?: string;
  imageBase64?: string;
  brandName?: string;
  primaryHex?: string;
};

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set. Add it to .env.local (or Vercel env vars) and restart." },
      { status: 500 }
    );
  }

  let user: VerifiedUser;
  try {
    user = await requireUser(req);
  } catch {
    return NextResponse.json(
      { error: "Sign in to generate mockups." },
      { status: 401 }
    );
  }
  if (user.isAnonymous) {
    return NextResponse.json(
      { error: "Create an account to generate mockups." },
      { status: 403 }
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { target, imageBase64 } = body;
  if (!target || !(target in SCENE_PROMPTS)) {
    return NextResponse.json({ error: "Unknown generation target." }, { status: 400 });
  }
  if (typeof imageBase64 !== "string" || !imageBase64) {
    return NextResponse.json({ error: "Missing logo image." }, { status: 400 });
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json({ error: "Logo image is too large." }, { status: 413 });
  }
  const brandName =
    typeof body.brandName === "string"
      ? body.brandName.slice(0, MAX_BRAND_NAME_LENGTH)
      : "";
  const primaryHex =
    typeof body.primaryHex === "string" && HEX_RE.test(body.primaryHex)
      ? body.primaryHex
      : "#000000";

  // Quota runs under the caller's own RLS. Record the attempt FIRST, then
  // count the last 24h including our own row: with count-then-insert,
  // parallel requests could all pass the check before any row landed and
  // blow past the cap in one burst.
  const supabase = createServerSupabaseForToken(user.token);
  const { error: quotaError } = await supabase
    .from("generation_events")
    .insert({ target });
  if (quotaError) {
    return NextResponse.json(
      { error: "Quota check failed. Apply migration 0010_generation_quota.sql." },
      { status: 500 }
    );
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("generation_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (countError) {
    return NextResponse.json(
      { error: "Quota check failed." },
      { status: 500 }
    );
  }
  if ((count ?? 0) > DAILY_LIMIT) {
    return NextResponse.json(
      { error: "Daily generation limit reached." },
      { status: 429 }
    );
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildPrompt(target, brandName || "the brand", primaryHex || "#000000") },
              { inlineData: { mimeType: "image/png", data: imageBase64 } },
            ],
          },
        ],
      }),
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data?.error?.message || `Image generation failed (HTTP ${res.status}).`;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  type Part = { inlineData?: { mimeType?: string; data?: string }; text?: string };
  const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    const text = parts.find((p) => p.text)?.text;
    return NextResponse.json(
      { error: text || "The model returned no image." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
  });
}
