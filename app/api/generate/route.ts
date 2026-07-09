import { NextResponse } from "next/server";
import { luminance } from "@/lib/color";

// Image generation can take a while on the model side.
export const maxDuration = 60;

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

// {surface} is filled with a product color chosen to contrast the logo ink.
const SCENE_PROMPTS: Record<string, string> = {
  mug: "a {surface} matte ceramic coffee mug with the logo printed large on its side, standing on a dark stone surface",
  tote: "a {surface} cotton tote bag with the logo printed large on the center, hanging against a dark concrete wall",
  cap: "a {surface} baseball cap with the logo embroidered on the front panel, resting on a dark surface",
};

// The attached logo is rasterized on a white background, so its dominant color is the ink.
function surfaceFor(inkHex: string): string {
  return luminance(inkHex) < 0.45
    ? "cream off-white"
    : "matte charcoal black";
}

function buildPrompt(target: string, brandName: string, inkHex: string) {
  const scene = SCENE_PROMPTS[target].replace("{surface}", surfaceFor(inkHex));
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

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { target, imageBase64, brandName, primaryHex } = body;
  if (!target || !(target in SCENE_PROMPTS)) {
    return NextResponse.json({ error: "Unknown generation target." }, { status: 400 });
  }
  if (!imageBase64) {
    return NextResponse.json({ error: "Missing logo image." }, { status: 400 });
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
