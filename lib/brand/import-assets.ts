import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandUrlInspection } from "@/lib/brand-detail";

/** The brandAssets half of an inspection, once validated. */
export type BrandImport = NonNullable<BrandUrlInspection["brandAssets"]>;
import { newLogoId } from "@/lib/id";
import {
  adoptBrandKnowledge,
  knowledgeProfilesByBrand,
  mergeProfile,
  type AdoptKnowledgeField,
} from "@/lib/brand/knowledge";
import { logoPreviewUrl } from "@/lib/brand/logo-preview";

type Supabase = SupabaseClient;

const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const PALETTE_PATHS: Record<string, string> = {
  primary: "palette.primary",
  accent: "palette.accent",
  background: "palette.background",
  surface: "palette.surface",
  text: "palette.text",
  mode: "palette.mode",
  palette_source: "palette.source",
  font_style: "typography.font_style",
};

const TOKEN_PATHS: Record<string, string> = {
  body_font: "typography.body_font",
  heading_font: "typography.heading_font",
  button_radius: "tokens.button_radius",
  button_padding: "tokens.button_padding",
  section_spacing: "tokens.section_spacing",
  container_width: "tokens.container_width",
};

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/**
 * Validate the brandAssets an inspection produced. Rejecting the whole payload
 * because one part is malformed would throw away a good palette over a bad
 * logo, so each part is checked on its own.
 */
export function parseBrandImport(value: unknown): BrandImport | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BrandImport>;

  const rawPalette = candidate.palette;
  const palette =
    rawPalette && typeof rawPalette === "object"
      ? Object.fromEntries(
          Object.entries(rawPalette)
            .filter(
              ([key, color]) =>
                key.length <= 40 &&
                typeof color === "string" &&
                /^#[0-9a-f]{6}$/i.test(color),
            )
            .slice(0, 8),
        )
      : {};

  const tokenKeys = [
    "body_font",
    "heading_font",
    "button_radius",
    "button_padding",
    "section_spacing",
    "container_width",
  ] as const;
  const rawTokens = candidate.designTokens;
  const designTokens = rawTokens
    ? (Object.fromEntries(
        tokenKeys.map((key) => {
          const token = rawTokens[key];
          return [
            key,
            typeof token === "string" ? token.trim().slice(0, 240) : null,
          ];
        }),
      ) as BrandImport["designTokens"])
    : null;

  const rawLogo = candidate.logo;
  const sourceUrl = httpUrl(rawLogo?.sourceUrl);
  let logo: BrandImport["logo"] = null;
  if (rawLogo && sourceUrl) {
    const svg =
      typeof rawLogo.svg === "string" &&
      rawLogo.svg.includes("<svg") &&
      rawLogo.svg.length <= 400_000
        ? rawLogo.svg
        : null;
    const data =
      typeof rawLogo.data === "string" &&
      rawLogo.data.length > 0 &&
      rawLogo.data.length <= 2_000_000
        ? rawLogo.data
        : null;
    if (svg || data) {
      logo = {
        svg,
        data,
        mediaType: svg ? "image/svg+xml" : "image/png",
        sourceUrl,
      };
    }
  }

  if (Object.keys(palette).length === 0 && !designTokens && !logo) return null;
  return { palette, designTokens, logo };
}

export function brandAssetsFrom(
  inspection: Pick<BrandUrlInspection, "brandAssets">,
): BrandImport | null {
  return parseBrandImport(inspection.brandAssets);
}

/**
 * A raster mark still has to reach the logo tables, and those only accept SVG
 * (`create_brand_logo_with_presentation` requires a non-empty p_svg). Wrapping
 * the bitmap keeps one storage shape instead of two half-supported ones — but
 * it is a wrapper, not a vector, and `provenance.raster_wrapped` says so rather
 * than leaving later code to guess from the markup.
 */
function wrapRaster(base64: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"><image width="512" height="256" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${base64}"/></svg>`;
}

function analysisFor(svg: string, primary: string | undefined) {
  const hex = /^#[0-9a-f]{6}$/i.test(primary ?? "") ? primary! : "#101012";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b) / 255;
  const k = 1 - max;
  const cmyk =
    max === 0
      ? [0, 0, 0, 100]
      : [
          Math.round(((max - r / 255) / max) * 100),
          Math.round(((max - g / 255) / max) * 100),
          Math.round(((max - b / 255) / max) * 100),
          Math.round(k * 100),
        ];
  // viewBox is read off the file when it has one. The rest of the analysis
  // (anchors, handles, area-weighted colors) needs a browser, and
  // normalizeLogoData() completes it when the presentation renders.
  const viewBoxMatch = /viewBox\s*=\s*"([\d.\-\s]+)"/i.exec(svg);
  const parts = viewBoxMatch
    ? viewBoxMatch[1].trim().split(/[\s,]+/).map(Number)
    : [];
  const viewBox =
    parts.length === 4 && parts.every(Number.isFinite)
      ? { x: parts[0], y: parts[1], w: parts[2], h: parts[3] }
      : { x: 0, y: 0, w: 512, h: 256 };
  return {
    viewBox,
    colors: [{ hex, rgb: { r, g, b }, cmyk, share: 1 }],
    anchors: [],
    handles: [],
    fileName: "website-logo.svg",
  };
}

export interface SavedBrandAssets {
  profile: {
    inheritsParent: boolean;
    status: "confirmed";
    value: Record<string, unknown>;
  };
  logo: {
    id: string;
    title: string;
    role: string;
    visibility: string;
    previewUrl: string | null;
  } | null;
}

/**
 * Apply a URL capture to one Brand: adopt the palette and design tokens as
 * knowledge, then create or refresh its logo.
 *
 * Re-running is the point. The previous implementation created the logo only
 * when the brand had none, so a first capture that picked the wrong image
 * could never be corrected from the product — and a capture is exactly the
 * kind of thing that gets better as the extractor improves.
 */
export async function saveBrandAssetsFromUrl({
  supabase,
  userId,
  brandId,
  brandName,
  role,
  sourceUrl,
  value,
}: {
  supabase: Supabase;
  userId: string;
  brandId: string;
  brandName: string;
  role: string;
  sourceUrl: string;
  value: BrandImport;
}): Promise<SavedBrandAssets> {
  const currentKnowledge = await knowledgeProfilesByBrand(supabase, [brandId]);
  if (currentKnowledge.error) {
    throw new Error("ブランドプロフィールを確認できませんでした");
  }
  const profileValue = mergeProfile(currentKnowledge.data.get(brandId) ?? {}, {
    ...(Object.keys(value.palette).length > 0
      ? { palette: value.palette }
      : {}),
    ...(value.designTokens ? { design_tokens: value.designTokens } : {}),
  });

  const fields: AdoptKnowledgeField[] = [];
  for (const [key, fieldPath] of Object.entries(PALETTE_PATHS)) {
    const fieldValue = value.palette[key];
    if (typeof fieldValue === "string" && fieldValue) {
      fields.push({ field_path: fieldPath, layer: "expression", value: fieldValue });
    }
  }
  for (const [key, fieldPath] of Object.entries(TOKEN_PATHS)) {
    const fieldValue =
      value.designTokens?.[key as keyof NonNullable<BrandImport["designTokens"]>];
    if (typeof fieldValue === "string" && fieldValue) {
      fields.push({ field_path: fieldPath, layer: "expression", value: fieldValue });
    }
  }
  if (fields.length > 0) {
    const adopted = await adoptBrandKnowledge(supabase, {
      brandId,
      fields,
      sourceKind: "url_extraction",
      sourceRef: { source: "site_capture", source_url: sourceUrl },
      userId,
    });
    if (!adopted.ok) throw new Error("ブランドプロフィールを保存できませんでした");
  }

  const logo = await saveCapturedLogo({
    supabase,
    brandId,
    brandName,
    role,
    sourceUrl,
    value,
  });

  return {
    profile: { inheritsParent: false, status: "confirmed", value: profileValue },
    logo,
  };
}

async function saveCapturedLogo({
  supabase,
  brandId,
  brandName,
  role,
  sourceUrl,
  value,
}: {
  supabase: Supabase;
  brandId: string;
  brandName: string;
  role: string;
  sourceUrl: string;
  value: BrandImport;
}): Promise<SavedBrandAssets["logo"]> {
  const captured = value.logo;
  if (!captured) return null;

  let svg: string;
  let rasterWrapped = false;
  if (captured.svg) {
    svg = captured.svg;
  } else if (captured.data) {
    const buffer = Buffer.from(captured.data, "base64");
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      throw new Error("取得したロゴ画像が不正です");
    }
    svg = wrapRaster(captured.data);
    rasterWrapped = true;
  } else {
    return null;
  }

  const analysis = analysisFor(svg, value.palette.primary);
  const provenance = {
    source: "site_capture",
    source_url: sourceUrl,
    raster_wrapped: rasterWrapped,
    confirmed: false,
  };

  const existing = await supabase
    .from("logos")
    .select("id, title, visibility")
    .eq("subject_entity_id", brandId)
    .eq("role", role)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error("ロゴを確認できませんでした");

  if (existing.data) {
    // Refresh in place. Replacing the row would orphan the presentation Take
    // and the canonical slot that 0041 attached to this logo id.
    const logoId = existing.data.id as string;
    const candidate = await supabase
      .from("logo_candidates")
      .select("id")
      .eq("logo_id", logoId)
      .eq("is_primary", true)
      .maybeSingle();
    if (candidate.error || !candidate.data) {
      throw new Error("ロゴの主候補を確認できませんでした");
    }
    const updated = await supabase
      .from("logo_candidates")
      .update({
        svg,
        analysis,
        media_type: "image/svg+xml",
        file_path: null,
        label: "公式サイトから取得（仮）",
        source_url: captured.sourceUrl,
        asset_status: "provisional",
        provenance,
      })
      .eq("id", candidate.data.id);
    if (updated.error) throw new Error("ロゴを更新できませんでした");
    return {
      id: logoId,
      title: existing.data.title as string,
      role,
      visibility: existing.data.visibility as string,
      previewUrl: await logoPreviewUrl([
        { is_primary: true, svg, media_type: "image/svg+xml", file_path: null },
      ]),
    };
  }

  const logoId = newLogoId();
  const created = await supabase.rpc("create_brand_logo_with_presentation", {
    p_brand_id: brandId,
    p_logo_id: logoId,
    p_title: brandName,
    p_role: role,
    p_visibility: "draft",
    p_svg: svg,
    p_analysis: analysis,
  });
  if (created.error) {
    throw new Error("ロゴとプレゼンを登録できませんでした");
  }

  // The master and its presentation are committed atomically by the RPC;
  // capture provenance is added afterwards so it can be confirmed later.
  const candidate = await supabase
    .from("logo_candidates")
    .select("id")
    .eq("logo_id", logoId)
    .eq("is_primary", true)
    .maybeSingle();
  if (candidate.data) {
    await supabase
      .from("logo_candidates")
      .update({
        label: "公式サイトから取得（仮）",
        media_type: "image/svg+xml",
        source_url: captured.sourceUrl,
        asset_status: "provisional",
        provenance,
      })
      .eq("id", candidate.data.id);
  }

  return {
    id: logoId,
    title: brandName,
    role,
    visibility: "draft",
    previewUrl: await logoPreviewUrl([
      { is_primary: true, svg, media_type: "image/svg+xml", file_path: null },
    ]),
  };
}
