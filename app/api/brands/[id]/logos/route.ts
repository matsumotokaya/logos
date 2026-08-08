import type { LogoData } from "@/lib/svg";
import type { LogoRole } from "@/lib/store/types";
import { newLogoId } from "@/lib/id";
import { guardLabsRequest } from "@/lib/labs-access";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

const LOGO_ROLES = new Set<LogoRole>([
  "brand",
  "corporate",
  "service",
  "subsidiary",
  "other",
]);

function logoTitle(value: unknown): string {
  if (typeof value !== "string") throw new Error("ロゴ名が不正です");
  const normalized = value.trim();
  if (!normalized) throw new Error("ロゴ名を入力してください");
  if (normalized.length > 160) throw new Error("ロゴ名が長すぎます");
  return normalized;
}

function logoRole(value: unknown): LogoRole {
  if (typeof value !== "string" || !LOGO_ROLES.has(value as LogoRole)) {
    throw new Error("ロゴの種類が不正です");
  }
  return value as LogoRole;
}

function logoSvg(value: unknown): string {
  if (typeof value !== "string") throw new Error("SVGファイルが不正です");
  const normalized = value.trim();
  if (!normalized.startsWith("<svg") || normalized.length > 2_000_000) {
    throw new Error("2MB以下のSVGファイルを選択してください");
  }
  if (
    /<\s*(script|foreignObject)\b/i.test(normalized) ||
    /\son[a-z]+\s*=/i.test(normalized) ||
    /(?:href|xlink:href)\s*=\s*["']\s*javascript:/i.test(normalized)
  ) {
    throw new Error("安全でない要素を含むSVGは登録できません");
  }
  return normalized;
}

function logoAnalysis(value: unknown): Omit<LogoData, "svg"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SVGの解析結果が不正です");
  }
  const analysis = value as Partial<Omit<LogoData, "svg">>;
  if (
    !analysis.viewBox ||
    !Number.isFinite(analysis.viewBox.x) ||
    !Number.isFinite(analysis.viewBox.y) ||
    !Number.isFinite(analysis.viewBox.w) ||
    !Number.isFinite(analysis.viewBox.h) ||
    analysis.viewBox.w <= 0 ||
    analysis.viewBox.h <= 0 ||
    !Array.isArray(analysis.colors) ||
    !Array.isArray(analysis.anchors) ||
    !Array.isArray(analysis.handles)
  ) {
    throw new Error("SVGの解析結果が不正です");
  }
  return analysis as Omit<LogoData, "svg">;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const { id: brandId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const title = logoTitle(body.title);
    const role = logoRole(body.role);
    const svg = logoSvg(body.svg);
    const analysis = logoAnalysis(body.analysis);
    const logoId = newLogoId();

    const { data: takeId, error } = await supabase.rpc(
      "create_brand_logo_with_presentation",
      {
        p_brand_id: brandId,
        p_logo_id: logoId,
        p_title: title,
        p_role: role,
        p_visibility: "draft",
        p_svg: svg,
        p_analysis: analysis,
      },
    );
    if (error) {
      if (error.code === "42501") {
        return Response.json(
          { error: "このブランドにロゴを追加する権限がありません" },
          { status: 403 },
        );
      }
      throw new Error("ロゴとプレゼンを登録できませんでした");
    }

    return Response.json(
      {
        logo: {
          id: logoId,
          title,
          role,
          visibility: "draft",
          previewUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
          takeId,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "入力内容が不正です" },
      { status: 400 },
    );
  }
}
