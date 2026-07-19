import "server-only";

import { scrapeUrl, fetchImageAsBase64, type RawServiceInfo } from "./ingest";
import { captureSite, screenshotHtml, type SiteCapture } from "./capture";
import { buildPaletteCandidates, type PaletteCandidate } from "./palette";
import {
  generateBrandKit,
  adjudicatePalette,
  judgeBrandMatch,
  type SourceFile,
  type AdjudicatedPalette,
  type BrandMatchJudgment,
} from "./creative";
import { renderLandingPage } from "./render-lp";
import type { BrandAssets, CampaignBrandKit } from "./schema";

// Campaign pipeline orchestration — the single implementation behind both the
// API route and the CLI. Tier S (labs/campaign/docs/palette-accuracy.md):
//
//   Stage 1  capture   render the real page, collect visual evidence
//   Stage 2  palette   deterministic candidates with evidence
//   Stage 3  creative  VLM adjudication (choose-only) + Brand Kit generation
//   Stage 4  verify    LP screenshot vs. original site, one retry on mismatch
//
// Every stage degrades gracefully: no URL / no Chromium / failed capture all
// fall back to the pre-Tier-S path with palette_source: "generated".

export interface PipelineInput {
  url: string | null;
  userName?: string;
  userDescription?: string;
  pastedText?: string;
  files: SourceFile[];
}

export interface PipelineProgress {
  message: string;
  /** info = stage started, success = stage outcome, warn = degraded path */
  level: "info" | "success" | "warn";
}

export interface PipelineOptions {
  onProgress?: (event: PipelineProgress) => void;
  /** Stage 4 self-verification (needs capture + Chromium). Default true. */
  verify?: boolean;
}

export interface PipelineResult {
  kit: CampaignBrandKit;
  html: string;
  meta: {
    captured: boolean;
    adjudicated: boolean;
    candidates: PaletteCandidate[] | null;
    verification: (BrandMatchJudgment & { retried: boolean }) | null;
  };
  /** debug artifacts for CLI inspection */
  debug: {
    capture: SiteCapture | null;
    lpShot: string | null;
  };
}

export async function runCampaignPipeline(
  input: PipelineInput,
  opts: PipelineOptions = {}
): Promise<PipelineResult> {
  const progress = (message: string, level: PipelineProgress["level"] = "info") =>
    opts.onProgress?.({ message, level });
  const files = [...input.files];

  // Stage 1a: static ingest (text, meta, og:image) — also the fallback path.
  let raw: RawServiceInfo | null = null;
  if (input.url) {
    progress(`ingest: ${input.url} を取得・解析中…`);
    raw = await scrapeUrl(input.url);
    progress(
      `ingest: 「${raw.title ?? "(タイトルなし)"}」を取得（見出し${raw.headings.length}件・カラーヒント${raw.colorHints.length}色）`,
      "success"
    );
    if (!files.some((f) => f.kind === "image") && raw.ogImage) {
      const og = await fetchImageAsBase64(raw.ogImage);
      if (og) {
        files.push({ kind: "image", mediaType: og.mediaType, data: og.data });
        progress("ingest: og:image をキービジュアルとして取得", "success");
      }
    }
  }

  // Stage 1b: rendered-page evidence (Playwright).
  let capture: SiteCapture | null = null;
  if (input.url) {
    progress("capture: Chromiumで実画面をレンダリング中…");
    capture = await captureSite(raw?.url ?? input.url, { faviconUrl: raw?.faviconUrl });
    if (capture) {
      const shots = [
        capture.screenshots.desktop,
        capture.screenshots.fullPage,
        capture.screenshots.mobile,
      ].filter(Boolean).length;
      progress(
        `capture: スクリーンショット${shots}枚・CSS変数${capture.evidence.cssVars.length}件・ロゴ色${capture.evidence.logoColors.length}色を収集`,
        "success"
      );
      progress(
        capture.logoImage
          ? "capture: ロゴ画像を取得（Brand Kitに同梱）"
          : "capture: ロゴ画像は特定できず（ワードマークで代替）",
        capture.logoImage ? "success" : "warn"
      );
      const tokenCount = Object.values(capture.designTokens).filter(Boolean).length;
      if (tokenCount > 0)
        progress(
          `capture: デザイントークン${tokenCount}項目を推定（フォント・角丸・余白など）`,
          "success"
        );
    } else {
      progress(
        "capture: この環境ではブラウザレンダリングを実行できないためスキップ（パレットはAI提案になります）",
        "warn"
      );
    }
  }

  // Stage 2: deterministic palette candidates.
  let candidates: PaletteCandidate[] | null = null;
  if (capture) {
    candidates = buildPaletteCandidates(capture.evidence);
    progress(
      `palette: 証拠付き候補${candidates.length}色を抽出（${candidates
        .slice(0, 4)
        .map((c) => c.hex)
        .join(" ")}…）`,
      "success"
    );
  }

  // Stage 3a: VLM adjudication (choose-only, no invention).
  let adjudicated: AdjudicatedPalette | null = null;
  if (capture && candidates && candidates.length >= 2) {
    progress("adjudicate: スクリーンショットを見てパレットの役割を裁定中…");
    adjudicated = await adjudicatePalette({ capture, candidates });
    if (adjudicated) {
      progress(
        `adjudicate: primary ${adjudicated.primary} / accent ${adjudicated.accent} / bg ${adjudicated.background}（サイトから抽出）`,
        "success"
      );
    } else {
      progress("adjudicate: 候補が不十分と判定 — AI提案パレットに切り替え", "warn");
    }
  }

  // Deterministic kit parts: real assets + CSS-derived design tokens.
  const assets: BrandAssets | null =
    capture || raw
      ? {
          logo: capture?.logoImage
            ? { data: capture.logoImage, media_type: "image/png" }
            : null,
          favicon_url: raw?.faviconUrl ?? null,
          og_image_url: raw?.ogImage ?? null,
          source_url: raw?.url ?? input.url,
        }
      : null;
  const designTokens = capture?.designTokens ?? null;

  // Stage 3b: Brand Kit generation.
  progress("creative: Brand Kit を生成中…（コピー・ナレーション執筆、1〜2分かかります）");
  const creativeInput = {
    raw,
    userName: input.userName,
    userDescription: input.userDescription,
    pastedText: input.pastedText,
    files,
    adjudicated,
    designTokens,
  };
  const toCampaignKit = (generated: Awaited<ReturnType<typeof generateBrandKit>>) => ({
    ...generated,
    assets,
    design_tokens: designTokens,
  });
  let kit: CampaignBrandKit = toCampaignKit(await generateBrandKit(creativeInput));
  progress(`creative: 「${kit.service.name}」の Brand Kit を生成`, "success");
  let html = renderLandingPage(kit);

  // Stage 4: self-verification loop (one retry).
  let verification: (BrandMatchJudgment & { retried: boolean }) | null = null;
  let lpShot: string | null = null;
  if ((opts.verify ?? true) && capture) {
    progress("verify: 生成LPをスクリーンショットして元サイトと見比べ中…");
    lpShot = await screenshotHtml(html);
    if (lpShot) {
      let judgment = await judgeBrandMatch({
        originalShot: capture.screenshots.desktop,
        generatedShot: lpShot,
      });
      let retried = false;
      if (judgment.verdict !== "pass") {
        progress(`verify: ${judgment.verdict} — ${judgment.reason}`, "warn");
        progress("verify: 指摘を反映して1回だけ再生成中…");
        retried = true;
        const feedback = `前回生成したLPは元サイトと比較して "${judgment.verdict}" と判定されました。理由: ${judgment.reason}`;
        if (judgment.verdict === "palette_mismatch" && capture && candidates) {
          // Re-adjudicate with the reviewer's reason attached to the evidence.
          const redo = await adjudicatePalette({
            capture,
            candidates,
            feedback: judgment.reason,
          });
          if (redo) creativeInput.adjudicated = redo;
        }
        kit = toCampaignKit(await generateBrandKit({ ...creativeInput, feedback }));
        html = renderLandingPage(kit);
        const retryShot = await screenshotHtml(html);
        if (retryShot) {
          lpShot = retryShot;
          judgment = await judgeBrandMatch({
            originalShot: capture.screenshots.desktop,
            generatedShot: retryShot,
          });
        }
      }
      verification = { ...judgment, retried };
      progress(
        `verify: ${judgment.verdict}${retried ? "（1回再生成）" : ""} — ${judgment.reason}`,
        judgment.verdict === "pass" ? "success" : "warn"
      );
    }
  }

  return {
    kit,
    html,
    meta: {
      captured: capture !== null,
      adjudicated: adjudicated !== null,
      candidates,
      verification,
    },
    debug: { capture, lpShot },
  };
}
