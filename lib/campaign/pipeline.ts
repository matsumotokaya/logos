import "server-only";

import { scrapeUrl, fetchImageAsBase64, type RawServiceInfo } from "./ingest";
import {
  captureSite,
  imageDominantColors,
  screenshotHtml,
  type SiteCapture,
} from "./capture";
import { buildPaletteCandidates, type PaletteCandidate } from "./palette";
import {
  generateBrandKit,
  adjudicatePalette,
  judgeBrandMatch,
  formatUsage,
  LLM_ENGINE,
  LLM_MODEL,
  LLM_PROVIDER,
  type SourceFile,
  type AdjudicatedPalette,
  type BrandMatchJudgment,
  type LlmUsage,
} from "./creative";
import { renderLandingPage } from "./render-lp";
import { narrationTextFromScript, type BrandAssets, type CampaignBrandKit } from "./schema";

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
  /** Stage artifacts as soon as each stage finishes — drives the progressive
   *  result UI (logo pops in at ~20s instead of everything at 2-4min). */
  onPartial?: (patch: import("./schema").CampaignPartial) => void;
  /** Creative done, verify still ahead: the full kit + LP, published early. */
  onDraft?: (kit: CampaignBrandKit, html: string) => void;
  /** Stage 4 self-verification (needs capture + Chromium). Default true. */
  verify?: boolean;
}

export interface LlmUsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  breakdown: LlmUsage[];
}

export interface PipelineResult {
  kit: CampaignBrandKit;
  html: string;
  meta: {
    captured: boolean;
    adjudicated: boolean;
    candidates: PaletteCandidate[] | null;
    verification: (BrandMatchJudgment & { retried: boolean }) | null;
    usage: LlmUsageSummary;
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

  // Cost transparency: every LLM call is logged with model, tokens and an
  // estimated USD cost, and totalled at the end of the run.
  const usages: LlmUsage[] = [];
  const track = (usage: LlmUsage | null) => {
    if (usage) usages.push(usage);
  };
  progress(`engine: ${LLM_ENGINE} を使用`);

  // Stage 1a: static ingest (text, meta, og:image) — also the fallback path.
  let raw: RawServiceInfo | null = null;
  if (input.url) {
    progress(`ingest: ${input.url} を取得・解析中…`);
    raw = await scrapeUrl(input.url);
    progress(
      `ingest: 「${raw.title ?? "(タイトルなし)"}」を取得（見出し${raw.headings.length}件・カラーヒント${raw.colorHints.length}色）`,
      "success"
    );
    opts.onPartial?.({
      source: {
        title: raw.title,
        description: raw.description,
        url: raw.url,
        favicon_url: raw.faviconUrl,
      },
    });
  }

  // og:image = the site's own key visual. Used two ways: as a vision input
  // for the creative stage, and as palette evidence (its dominant hues are
  // brand colors even when no button uses them).
  let keyVisualColors: { hex: string; share: number }[] = [];
  if (raw?.ogImage) {
    const og = await fetchImageAsBase64(raw.ogImage);
    if (og) {
      keyVisualColors = await imageDominantColors(Buffer.from(og.data, "base64"));
      if (!files.some((f) => f.kind === "image")) {
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
        capture.logoSvg
          ? "capture: ロゴを取得（SVGベクター + PNG）"
          : capture.logoImage
            ? "capture: ロゴ画像を取得（Brand Kitに同梱）"
            : "capture: ロゴ画像は特定できず（ワードマークで代替）",
        capture.logoImage || capture.logoSvg ? "success" : "warn"
      );
      const tokenCount = Object.values(capture.designTokens).filter(Boolean).length;
      if (tokenCount > 0)
        progress(
          `capture: デザイントークン${tokenCount}項目を推定（フォント・角丸・余白など）`,
          "success"
        );
      opts.onPartial?.({
        logo: {
          logo: capture.logoImage
            ? { data: capture.logoImage, media_type: "image/png" }
            : null,
          logo_svg: capture.logoSvg ?? null,
        },
        ...(tokenCount > 0 ? { design_tokens: capture.designTokens } : {}),
      });
    } else {
      progress(
        "capture: この環境ではブラウザレンダリングを実行できないためスキップ（パレットはAI提案になります）",
        "warn"
      );
    }
  }

  // Stage 2: deterministic palette candidates (rendered evidence + og:image).
  let candidates: PaletteCandidate[] | null = null;
  if (capture) {
    candidates = buildPaletteCandidates({
      ...capture.evidence,
      keyVisual: keyVisualColors.map((c) => ({ hex: c.hex, weight: c.share })),
    });
    progress(
      `palette: 証拠付き候補${candidates.length}色を抽出（${candidates
        .slice(0, 4)
        .map((c) => c.hex)
        .join(" ")}…）`,
      "success"
    );
    opts.onPartial?.({ palette_candidates: candidates.slice(0, 8).map((c) => c.hex) });
  }

  // Stage 3a: VLM adjudication (choose-only, no invention).
  let adjudicated: AdjudicatedPalette | null = null;
  if (capture && candidates && candidates.length >= 2) {
    progress(`adjudicate: ${LLM_MODEL} にスクショ+候補を送信して役割を裁定中…`);
    const adj = await adjudicatePalette({ capture, candidates });
    track(adj.usage);
    adjudicated = adj.palette;
    if (adjudicated) {
      progress(
        `adjudicate: primary ${adjudicated.primary} / accent ${adjudicated.accent} / bg ${adjudicated.background}（サイトから抽出）${adj.usage ? `（${formatUsage(adj.usage)}）` : ""}`,
        "success"
      );
      opts.onPartial?.({
        palette: {
          primary: adjudicated.primary,
          accent: adjudicated.accent,
          background: adjudicated.background,
          surface: adjudicated.surface,
          text: adjudicated.text,
        },
      });
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
          logo_svg: capture?.logoSvg ?? null,
          favicon_url: raw?.faviconUrl ?? null,
          og_image_url: raw?.ogImage ?? null,
          source_url: raw?.url ?? input.url,
          screens: {
            desktop: capture
              ? {
                  source: "capture",
                  data: capture.screenshots.desktop,
                  media_type: "image/jpeg",
                  width: 1024,
                  height: 640,
                }
              : null,
            mobile: capture?.screenshots.mobile
              ? {
                  source: "capture",
                  data: capture.screenshots.mobile,
                  media_type: "image/jpeg",
                  width: 390,
                  height: 844,
                }
              : null,
          },
        }
      : null;
  const designTokens = capture?.designTokens ?? null;

  // Stage 3b: Brand Kit generation.
  progress(
    `creative: ${LLM_MODEL} で Brand Kit を生成中…（コピー・ナレーション執筆、1〜2分かかります）`
  );
  const creativeInput = {
    raw,
    userName: input.userName,
    userDescription: input.userDescription,
    pastedText: input.pastedText,
    files,
    adjudicated,
    designTokens,
  };
  const toCampaignKit = (generated: import("./schema").BrandKit): CampaignBrandKit => ({
    ...generated,
    narration: narrationTextFromScript(generated.cm_script),
    assets,
    design_tokens: designTokens,
  });
  const gen = await generateBrandKit(creativeInput);
  track(gen.usage);
  let kit: CampaignBrandKit = toCampaignKit(gen.kit);
  progress(
    `creative: 「${kit.service.name}」の Brand Kit を生成（${formatUsage(gen.usage)}）`,
    "success"
  );
  let html = renderLandingPage(kit);
  // Publish early: the digest fills completely while verify still runs.
  opts.onDraft?.(kit, html);

  // Stage 4: self-verification loop (one retry).
  let verification: (BrandMatchJudgment & { retried: boolean }) | null = null;
  let lpShot: string | null = null;
  if ((opts.verify ?? true) && capture) {
    progress(`verify: 生成LPをスクショし、${LLM_MODEL} で元サイトと見比べ中…`);
    lpShot = await screenshotHtml(html);
    if (lpShot) {
      const first = await judgeBrandMatch({
        originalShot: capture.screenshots.desktop,
        generatedShot: lpShot,
      });
      track(first.usage);
      let judgment = first.judgment;
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
          track(redo.usage);
          if (redo.palette) creativeInput.adjudicated = redo.palette;
        }
        const regen = await generateBrandKit({ ...creativeInput, feedback });
        track(regen.usage);
        kit = toCampaignKit(regen.kit);
        html = renderLandingPage(kit);
        const retryShot = await screenshotHtml(html);
        if (retryShot) {
          lpShot = retryShot;
          const second = await judgeBrandMatch({
            originalShot: capture.screenshots.desktop,
            generatedShot: retryShot,
          });
          track(second.usage);
          judgment = second.judgment;
        }
      }
      verification = { ...judgment, retried };
      progress(
        `verify: ${judgment.verdict}${retried ? "（1回再生成）" : ""} — ${judgment.reason}`,
        judgment.verdict === "pass" ? "success" : "warn"
      );
    }
  }

  const usageSummary: LlmUsageSummary = {
    calls: usages.length,
    inputTokens: usages.reduce((s, u) => s + u.inputTokens, 0),
    outputTokens: usages.reduce((s, u) => s + u.outputTokens, 0),
    estimatedCostUsd: usages.reduce((s, u) => s + u.estimatedCostUsd, 0),
    breakdown: usages,
  };
  progress(
    `cost: ${LLM_PROVIDER} 呼び出し${usageSummary.calls}回 — ${formatUsage(usageSummary)}`,
    "success"
  );

  return {
    kit,
    html,
    meta: {
      captured: capture !== null,
      adjudicated: adjudicated !== null,
      candidates,
      verification,
      usage: usageSummary,
    },
    debug: { capture, lpShot },
  };
}
