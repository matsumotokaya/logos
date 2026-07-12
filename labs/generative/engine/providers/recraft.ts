// Recraft — the derivation engine (派生生成機): pattern/背景/アイコン系の
// 造形展開。image_to_image の strength がダイヤル(形状保持⇄世界観)の実体。
// API terms: no training on API I/O (契約許可リスト入りの根拠)。
//
// Base URL verified 2026-07: https://external.api.recraft.ai/v1 (Bearer).
// NOTE(実機確認): モデルslugは "recraftv4_1" を第一候補とする(V4.1系がAPI
// 提供中であることは確認済み。slug表記が違う場合は最初の実呼び出しで
// /doc/#/ のSwaggerに合わせて修正。フォールバックは "recraftv3")。
// Recraftの生成URLは約24時間公開で残るため、レスポンス受領後ただちに
// バイト列へ回収し、以後外部URLは参照しない(基盤要件書の必須要件)。

import type { Provider, ProviderInput, ProviderOutput } from "./types";
import { expectOk } from "./types";

const ENDPOINT = "https://external.api.recraft.ai/v1/images/imageToImage";
const MODEL = "recraftv4_1";
const COST_PER_IMAGE_USD = 0.035;

async function generate(input: ProviderInput): Promise<ProviderOutput> {
  const key = process.env.RECRAFT_API_KEY;
  if (!key) throw new Error("RECRAFT_API_KEY が未設定");

  const form = new FormData();
  form.set(
    "image",
    new Blob([new Uint8Array(input.logoPng)], { type: "image/png" }),
    "logo.png",
  );
  form.set("prompt", input.prompt);
  form.set("strength", String(input.params.strength ?? 0.5));
  form.set("style", input.params.style ?? "realistic_image");
  form.set("model", input.params.customModelId ?? MODEL);
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
