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

// 実機確認(2026-07-13): FLUX.2 [pro] は総ピクセル数がこの範囲外だと 400。
// テンプレートの要求サイズをアスペクト比を保ったままこの範囲に収める。
const MIN_PIXELS = 3_686_400;
const MAX_PIXELS = 10_404_496;

function fitToPixelRange(w: number, h: number): { width: number; height: number } {
  const px = w * h;
  const scale =
    px < MIN_PIXELS ? Math.sqrt(MIN_PIXELS / px)
    : px > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / px)
    : 1;
  // Round UP to a multiple of 16 so the min bound survives the rounding.
  const r16 = (v: number) => Math.ceil((v * scale) / 16) * 16;
  return { width: r16(w), height: r16(h) };
}

async function generate(input: ProviderInput): Promise<ProviderOutput> {
  const key = process.env.TOGETHER_API_KEY;
  if (!key) throw new Error("TOGETHER_API_KEY が未設定");

  const size = fitToPixelRange(input.width, input.height);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.params.customModelId ?? MODEL,
      prompt: input.prompt,
      width: size.width,
      height: size.height,
      // 実機確認(2026-07-13): FLUX.2 [pro] は guidance_scale / negative_prompt
      // を 400 で拒否する(パラメータ非公開のマネージド設定。steps も同系統)。
      // 形状保持ダイヤルの数値側とネガティブ指定はプロンプト文(core/prompt.ts)
      // が担い、数値パラメータが必要になったら FLUX.2 [flex] を検討する。
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
