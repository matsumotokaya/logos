// Together AI — FLUX.2 [pro]: the world-building engine (主エンジン).
// Material transformation, environment integration, cinematic "existence in
// a world". Together is ZDR by default; training use is opt-in and off.
//
// Verified 2026-07 (docs.together.ai): POST /v1/images/generations, model
// "black-forest-labs/FLUX.2-pro", $0.03/image, up to 8 reference images.
// NOTE(実機確認): reference_images is documented as an array of image URLs —
// data URIs are the standard way to inline images across Together's API, but
// confirm on the first live call with a real key.

import type { Provider, ProviderInput, ProviderOutput } from "./types";
import { expectOk } from "./types";

const ENDPOINT = "https://api.together.xyz/v1/images/generations";
const MODEL = "black-forest-labs/FLUX.2-pro";
const COST_PER_IMAGE_USD = 0.03;

async function generate(input: ProviderInput): Promise<ProviderOutput> {
  const key = process.env.TOGETHER_API_KEY;
  if (!key) throw new Error("TOGETHER_API_KEY が未設定");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.params.customModelId ?? MODEL,
      prompt: input.prompt,
      ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
      width: input.width,
      height: input.height,
      steps: input.params.steps,
      guidance_scale: input.params.guidanceScale,
      n: 1,
      reference_images: [
        `data:image/png;base64,${input.logoPng.toString("base64")}`,
      ],
      // base64 response = the image never sits on an external URL at all.
      response_format: "base64",
      output_format: "png",
    }),
  });
  await expectOk(res, "Together");

  const json = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const item = json.data?.[0];
  if (item?.b64_json)
    return { png: Buffer.from(item.b64_json, "base64"), costUsd: COST_PER_IMAGE_USD };
  if (item?.url) {
    // Fallback: collect immediately, never reference the external URL again.
    const img = await fetch(item.url);
    await expectOk(img, "Together(画像回収)");
    return { png: Buffer.from(await img.arrayBuffer()), costUsd: COST_PER_IMAGE_USD };
  }
  throw new Error("Together: 画像がレスポンスに含まれない");
}

export const togetherProvider: Provider = {
  id: "flux2",
  name: "FLUX.2 [pro] (Together)",
  roleJa: "主エンジン(世界構築): マテリアル変換・環境統合・シネマティック",
  costPerImageUsd: COST_PER_IMAGE_USD,
  notesJa: "ZDR既定・学習利用はopt-inでオフ。BFL直APIは規約上使用禁止(必ずTogether経由)",
  available: () => Boolean(process.env.TOGETHER_API_KEY),
  generate,
};
