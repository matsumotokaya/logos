import "server-only";

import * as cheerio from "cheerio";
import { fetchPublicUrl } from "@/lib/public-url";

// Campaign ingest — turn a URL into raw service info for the creative stage.
// Only what the LLM needs: text content, meta info, brand color hints.

export interface RawServiceInfo {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  faviconUrl: string | null;
  themeColor: string | null;
  colorHints: string[];
  headings: string[];
  bodyText: string;
  /** Footer and structured organization hints are kept separately because
   * the visible body copy often names the service but not its operator. */
  footerText: string;
  organizationHints: string[];
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function scrapeUrl(url: string): Promise<RawServiceInfo> {
  const res = await fetchPublicUrl(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ja,en;q=0.8" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`ページを取得できませんでした (HTTP ${res.status})`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const base = new URL(res.url);

  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr("content") ??
    $(`meta[name="${name}"]`).attr("content") ??
    null;

  const title = meta("og:title") ?? ($("title").first().text().trim() || null);
  const description = meta("og:description") ?? meta("description");

  const ogImage = resolveMaybe(meta("og:image"), base);
  // Prefer icons sharp can decode (PNG/SVG): apple-touch-icon is almost
  // always a PNG, while bare /favicon.ico often defeats the logo fallback.
  const faviconUrl =
    resolveMaybe($('link[rel="apple-touch-icon"]').first().attr("href"), base) ??
    resolveMaybe(
      $('link[rel="icon"], link[rel="shortcut icon"]')
        .filter((_, el) => {
          const href = $(el).attr("href") ?? "";
          const type = $(el).attr("type") ?? "";
          return /png|svg/i.test(type) || /\.(png|svg)(\?|$)/i.test(href);
        })
        .first()
        .attr("href"),
      base
    ) ??
    resolveMaybe(
      $('link[rel="icon"], link[rel="shortcut icon"]').first().attr("href"),
      base
    ) ??
    new URL("/favicon.ico", base).href;

  const themeColor = meta("theme-color");

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length <= 120) headings.push(t);
  });

  const footerText = $("footer")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  const organizationHints = extractOrganizationHints($, footerText);

  $("script, style, noscript, svg, nav, footer").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  return {
    url: res.url,
    title,
    description,
    ogImage,
    faviconUrl,
    themeColor,
    colorHints: extractColorHints(html, themeColor),
    headings: headings.slice(0, 30),
    bodyText,
    footerText,
    organizationHints,
  };
}

function extractOrganizationHints(
  $: cheerio.CheerioAPI,
  footerText: string
): string[] {
  const hints = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const value = entry as Record<string, unknown>;
        const type = value["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.some((item) => typeof item === "string" && /Organization|Corporation|LocalBusiness|Person/i.test(item))) continue;
        if (typeof value.name === "string" && value.name.trim()) {
          hints.add(value.name.trim());
        }
        if (typeof value.legalName === "string" && value.legalName.trim()) {
          hints.add(value.legalName.trim());
        }
      }
    } catch {
      // Invalid JSON-LD is common and should not block page ingestion.
    }
  });

  for (const match of footerText.matchAll(
    /(?:株式会社|合同会社|有限会社|一般社団法人|一般財団法人|NPO法人)[^｜|・·©]{1,60}|[^｜|・·©]{1,60}(?:株式会社|合同会社|有限会社)/g
  )) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length <= 80) hints.add(value);
  }
  return [...hints].slice(0, 8);
}

function resolveMaybe(href: string | null | undefined, base: URL): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

// Collect frequent hex colors from inline styles / style blocks as brand hints.
function extractColorHints(html: string, themeColor: string | null): string[] {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const c = m[0].toLowerCase();
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const boring = new Set(["#ffffff", "#000000"]);
  const hints = [...counts.entries()]
    .filter(([c]) => !boring.has(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c]) => c);
  if (themeColor && /^#[0-9a-fA-F]{6}$/.test(themeColor)) {
    hints.unshift(themeColor.toLowerCase());
  }
  return [...new Set(hints)];
}

export type FetchedImage = {
  data: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
};

// Fetch an image (e.g. og:image) as base64 for passing to Claude vision.
export async function fetchImageAsBase64(url: string): Promise<FetchedImage | null> {
  try {
    const res = await fetchPublicUrl(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const mediaType = ct.includes("png")
      ? ("image/png" as const)
      : ct.includes("webp")
        ? ("image/webp" as const)
        : ct.includes("gif")
          ? ("image/gif" as const)
          : ct.includes("jpeg") || ct.includes("jpg")
            ? ("image/jpeg" as const)
            : null;
    if (!mediaType) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}
