// Recraft — the derivation engine (派生生成機): pattern/背景/アイコン系の
// 造形展開。image_to_image の strength がダイヤル(形状保持⇄世界観)の実体。
// API terms: no training on API I/O (契約許可リスト入りの根拠)。
//
// 実機確認済み(2026-07-13、OpenAPI spec /doc/spec/api.yaml で照合):
// - モデルslug "recraftv4_1" は有効。ただし V4.1 は写実系のみで、
//   digital_illustration 等のイラスト系styleは 400("doesn't support style")
//   → イラスト系styleは recraftv3 に自動フォールバックする(下のマップ)。
//   テンプレートは engineParams.model で明示上書きも可能。
// - response_format: b64_json 対応(即時回収に使用)。negative_prompt 対応。
// - 将来メモ: controls.colors(パレット条件付け)と controls.no_text が
//   存在する — 色保持ダイヤルとE-5(文字抑制)の実装フックに使える。
// Recraftの生成URLは約24時間公開で残るため、レスポンス受領後ただちに
// バイト列へ回収し、以後外部URLは参照しない(基盤要件書の必須要件)。

import type { Provider, ProviderInput, ProviderOutput } from "./types";
import { expectOk } from "./types";

const ENDPOINT = "https://external.api.recraft.ai/v1/images/imageToImage";
const MODEL_REALISTIC = "recraftv4_1";
const MODEL_ILLUSTRATION = "recraftv3";
const ILLUSTRATION_STYLES = new Set([
  "digital_illustration",
  "vector_illustration",
  "icon",
]);
const COST_PER_IMAGE_USD = 0.035;

function defaultModelFor(style: string): string {
  return ILLUSTRATION_STYLES.has(style) ? MODEL_ILLUSTRATION : MODEL_REALISTIC;
}

async function generate(input: ProviderInput): Promise<ProviderOutput> {
  const key = process.env.RECRAFT_API_KEY;
  if (!key) throw new Error("RECRAFT_API_KEY が未設定");

  const form = new FormData();
  form.set(
    "image",
    new Blob([new Uint8Array(input.logoPng)], { type: "image/png" }),
    "logo.png",
  );
  const style = input.params.style ?? "realistic_image";
  form.set("prompt", input.prompt);
  if (input.negativePrompt) form.set("negative_prompt", input.negativePrompt);
  form.set("strength", String(input.params.strength ?? 0.5));
  form.set("style", style);
  form.set(
    "model",
    input.params.customModelId ?? input.params.model ?? defaultModelFor(style),
  );
  form.set("n", "1");
  form.set("response_format", "b64_json");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  await expectOk(res, "Recraft");

  const json = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const item = json.data?.[0];
  if (item?.b64_json)
    return { png: Buffer.from(item.b64_json, "base64"), costUsd: COST_PER_IMAGE_USD };
  if (item?.url) {
    // 即時回収: fetch the bytes now; the ~24h public URL is never stored.
    const img = await fetch(item.url);
    await expectOk(img, "Recraft(画像回収)");
    return { png: Buffer.from(await img.arrayBuffer()), costUsd: COST_PER_IMAGE_USD };
  }
  throw new Error("Recraft: 画像がレスポンスに含まれない");
}

export const recraftProvider: Provider = {
  id: "recraft",
  name: "Recraft V4.1",
  roleJa: "派生生成機(造形展開): パターン・背景システム・ベクター系展開",
  costPerImageUsd: COST_PER_IMAGE_USD,
  notesJa: "API入出力を学習に使わない明文規定。生成物URLは約24h残るため即時回収を実装済み",
  available: () => Boolean(process.env.RECRAFT_API_KEY),
  generate,
};
