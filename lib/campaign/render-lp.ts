import type { BrandKit, CampaignBrandKit } from "./schema";
import { resolveTheme } from "./themes";

// Stage LP: render a Brand Kit into a standalone SaaS-style sales page
// (inline CSS + inline SVG, no external dependencies). Quality lives in this
// template; the LLM only supplies structured content, so bad input can't
// break the layout.
//
// The kit's design theme (lib/campaign/themes.ts) selects the template
// variant: "flat" is the original light SaaS layout; "glass" reskins the same
// structure into a dark frosted-glass world — luminous brand-color washes on
// a near-black canvas, translucent blurred cards (photography is not embedded
// so the page stays self-contained). Industry-specific structural variants
// can join later as further templates on the same axis.
//
// Sections: nav / hero (+product mock) / proof stats / client row / problem /
// features (alternating rows with illustrations) / how-it-works / video /
// testimonials / pricing / FAQ / closing / footer. Sections whose data is
// missing (older Brand Kits) are skipped, so pre-extension kits still render.

const FONT_STACKS: Record<BrandKit["brand"]["font_style"], string> = {
  "modern-sans":
    '"Hiragino Sans", "Noto Sans JP", -apple-system, "Segoe UI", sans-serif',
  "elegant-serif": '"Hiragino Mincho ProN", "Noto Serif JP", Georgia, serif',
  "tech-mono": '"SF Mono", "Hiragino Sans", "Noto Sans JP", monospace, sans-serif',
  "rounded-friendly":
    '"Hiragino Maru Gothic ProN", "Noto Sans JP", -apple-system, sans-serif',
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Fonts the captured design tokens may name that Google Fonts can serve.
// The LP is otherwise self-contained; this is the one external request we
// allow, because typography is half of "looks like the same brand".
const GOOGLE_FONTS = new Set([
  "Noto Sans JP",
  "Noto Serif JP",
  "M PLUS 1p",
  "M PLUS 2",
  "M PLUS Rounded 1c",
  "Zen Kaku Gothic New",
  "Zen Maru Gothic",
  "BIZ UDPGothic",
  "BIZ UDGothic",
  "Shippori Mincho",
  "Sawarabi Gothic",
  "Kosugi Maru",
  "IBM Plex Sans JP",
  "Murecho",
  "Kiwi Maru",
  "Inter",
  "Ubuntu",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Lato",
  "Open Sans",
  "DM Sans",
  "Outfit",
  "Manrope",
  "Raleway",
  "Nunito",
  "Work Sans",
  "Figtree",
  "Sora",
  "Plus Jakarta Sans",
]);

// A captured font token may hold multiple families ("Ubuntu, Noto Sans JP").
const splitFamilies = (v: string | null | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

const quoteFamily = (f: string) => (/[^a-zA-Z0-9-]/.test(f) ? `"${f}"` : f);

const familyStack = (v: string | null | undefined): string | null => {
  const fams = splitFamilies(v);
  return fams.length ? fams.map(quoteFamily).join(", ") : null;
};

const pxOf = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const m = v.trim().match(/^(-?[\d.]+)px$/);
  return m ? parseFloat(m[1]) : null;
};

// ---------- inline SVG artwork (inherits the brand via CSS variables) ----------

// Abstract product-UI mock for the hero: a browser window assembling a page.
// Everything is var(--primary)/var(--accent)/currentColor, so it adapts to
// any palette without shipping raster assets.
function heroMockSvg(serviceName: string): string {
  return `<svg viewBox="0 0 560 420" role="img" aria-label="${esc(serviceName)} の画面イメージ" style="width:100%;height:auto;display:block">
  <defs>
    <linearGradient id="hm-hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--primary)"/>
      <stop offset="1" stop-color="var(--accent)"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="544" height="404" rx="18" fill="var(--surface)" stroke="var(--line)"/>
  <rect x="8" y="8" width="544" height="40" rx="18" fill="var(--line-soft)"/>
  <rect x="8" y="30" width="544" height="18" fill="var(--line-soft)"/>
  <circle cx="34" cy="28" r="5" fill="var(--primary)" opacity=".55"/>
  <circle cx="52" cy="28" r="5" fill="var(--accent)" opacity=".55"/>
  <circle cx="70" cy="28" r="5" fill="var(--text)" opacity=".2"/>
  <rect x="150" y="19" width="260" height="18" rx="9" fill="var(--bg)" stroke="var(--line)"/>
  <!-- page being assembled -->
  <rect x="36" y="72" width="300" height="26" rx="6" fill="var(--text)" opacity=".85"/>
  <rect x="36" y="106" width="230" height="12" rx="6" fill="var(--text)" opacity=".35"/>
  <rect x="36" y="126" width="190" height="12" rx="6" fill="var(--text)" opacity=".25"/>
  <rect x="36" y="154" width="120" height="34" rx="17" fill="url(#hm-hero)"/>
  <rect x="166" y="154" width="110" height="34" rx="17" fill="none" stroke="var(--line)"/>
  <!-- key visual card -->
  <rect x="368" y="70" width="156" height="120" rx="12" fill="url(#hm-hero)" opacity=".92"/>
  <circle cx="446" cy="118" r="26" fill="var(--bg)" opacity=".92"/>
  <path d="M439 105 l22 13 -22 13 z" fill="var(--primary)"/>
  <rect x="384" y="160" width="124" height="9" rx="4.5" fill="var(--bg)" opacity=".8"/>
  <!-- three feature cards -->
  <g>
    <rect x="36" y="216" width="152" height="104" rx="12" fill="var(--bg)" stroke="var(--line)"/>
    <circle cx="60" cy="244" r="12" fill="var(--primary)" opacity=".18"/>
    <circle cx="60" cy="244" r="5" fill="var(--primary)"/>
    <rect x="50" y="268" width="98" height="9" rx="4.5" fill="var(--text)" opacity=".5"/>
    <rect x="50" y="284" width="120" height="8" rx="4" fill="var(--text)" opacity=".22"/>
    <rect x="50" y="298" width="86" height="8" rx="4" fill="var(--text)" opacity=".22"/>
  </g>
  <g>
    <rect x="204" y="216" width="152" height="104" rx="12" fill="var(--bg)" stroke="var(--line)"/>
    <circle cx="228" cy="244" r="12" fill="var(--accent)" opacity=".2"/>
    <circle cx="228" cy="244" r="5" fill="var(--accent)"/>
    <rect x="218" y="268" width="98" height="9" rx="4.5" fill="var(--text)" opacity=".5"/>
    <rect x="218" y="284" width="120" height="8" rx="4" fill="var(--text)" opacity=".22"/>
    <rect x="218" y="298" width="86" height="8" rx="4" fill="var(--text)" opacity=".22"/>
  </g>
  <g>
    <rect x="372" y="216" width="152" height="104" rx="12" fill="var(--bg)" stroke="var(--line)"/>
    <polyline points="388,300 412,278 436,288 462,254 492,262 508,240" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="508" cy="240" r="5" fill="var(--accent)"/>
    <rect x="388" y="234" width="60" height="8" rx="4" fill="var(--text)" opacity=".35"/>
  </g>
  <rect x="36" y="342" width="488" height="46" rx="12" fill="var(--primary)" opacity=".08"/>
  <rect x="56" y="358" width="180" height="12" rx="6" fill="var(--primary)" opacity=".55"/>
  <rect x="404" y="352" width="100" height="26" rx="13" fill="var(--primary)"/>
</svg>`;
}

// Feature illustrations, cycled by index. Consistent 4:3 stroke-based style.
function featureSvg(i: number): string {
  const frames = [
    // 0 — sources funnel in
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="46" y="44" width="92" height="118" rx="10" fill="var(--bg)" stroke="var(--line)" stroke-width="2"/>
      <rect x="62" y="66" width="60" height="7" rx="3.5" fill="var(--text)" opacity=".4"/>
      <rect x="62" y="82" width="44" height="7" rx="3.5" fill="var(--text)" opacity=".25"/>
      <rect x="62" y="98" width="52" height="7" rx="3.5" fill="var(--text)" opacity=".25"/>
      <rect x="70" y="30" width="92" height="118" rx="10" fill="var(--surface)" stroke="var(--line)" stroke-width="2" transform="rotate(4 116 89)"/>
      <rect x="88" y="52" width="56" height="7" rx="3.5" fill="var(--text)" opacity=".4" transform="rotate(4 116 89)"/>
      <rect x="88" y="68" width="40" height="7" rx="3.5" fill="var(--text)" opacity=".25" transform="rotate(4 116 89)"/>
      <path d="M180 96 h44" stroke="var(--text)" opacity=".35" stroke-width="2.5" stroke-dasharray="2 7"/>
      <circle cx="258" cy="96" r="34" fill="var(--primary)" opacity=".14"/>
      <circle cx="258" cy="96" r="34" stroke="var(--primary)" stroke-width="2.5"/>
      <path d="M244 96 l10 10 20 -22" stroke="var(--primary)" stroke-width="3.5"/>
      <circle cx="284" cy="58" r="4" fill="var(--accent)"/>
      <circle cx="228" cy="140" r="3" fill="var(--accent)" opacity=".7"/>
    </g>`,
    // 1 — brand kit: swatches + type specimen
    `<g fill="none" stroke-linecap="round">
      <rect x="44" y="46" width="232" height="148" rx="14" fill="var(--bg)" stroke="var(--line)" stroke-width="2"/>
      <circle cx="82" cy="86" r="16" fill="var(--primary)"/>
      <circle cx="120" cy="86" r="16" fill="var(--accent)"/>
      <circle cx="158" cy="86" r="16" fill="var(--text)" opacity=".8"/>
      <circle cx="196" cy="86" r="16" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
      <text x="66" y="140" font-family="Georgia,serif" font-size="34" fill="var(--text)">Aa</text>
      <rect x="126" y="118" width="120" height="9" rx="4.5" fill="var(--text)" opacity=".35"/>
      <rect x="126" y="136" width="90" height="9" rx="4.5" fill="var(--text)" opacity=".2"/>
      <rect x="66" y="162" width="70" height="16" rx="8" fill="var(--primary)" opacity=".9"/>
      <rect x="144" y="162" width="70" height="16" rx="8" fill="none" stroke="var(--line)" stroke-width="2"/>
    </g>`,
    // 2 — page wireframe rising
    `<g fill="none" stroke-linecap="round">
      <rect x="70" y="34" width="180" height="172" rx="12" fill="var(--bg)" stroke="var(--line)" stroke-width="2"/>
      <rect x="70" y="34" width="180" height="30" rx="12" fill="var(--line-soft)"/>
      <rect x="70" y="50" width="180" height="14" fill="var(--line-soft)"/>
      <rect x="88" y="80" width="104" height="12" rx="6" fill="var(--text)" opacity=".6"/>
      <rect x="88" y="100" width="140" height="8" rx="4" fill="var(--text)" opacity=".25"/>
      <rect x="88" y="118" width="64" height="20" rx="10" fill="var(--primary)"/>
      <rect x="88" y="152" width="42" height="36" rx="8" fill="var(--primary)" opacity=".15"/>
      <rect x="138" y="152" width="42" height="36" rx="8" fill="var(--accent)" opacity=".18"/>
      <rect x="188" y="152" width="42" height="36" rx="8" fill="var(--text)" opacity=".08"/>
      <path d="M262 150 l22 -22 M284 150 v-22 h-22" stroke="var(--accent)" stroke-width="3"/>
      <circle cx="52" cy="180" r="4" fill="var(--accent)" opacity=".7"/>
    </g>`,
    // 3 — video: play + timeline
    `<g fill="none" stroke-linecap="round">
      <rect x="52" y="42" width="216" height="126" rx="14" fill="var(--text)" opacity=".85"/>
      <circle cx="160" cy="105" r="30" fill="var(--bg)" opacity=".95"/>
      <path d="M152 90 l26 15 -26 15 z" fill="var(--primary)"/>
      <rect x="52" y="184" width="216" height="14" rx="7" fill="var(--line-soft)"/>
      <rect x="52" y="184" width="92" height="14" rx="7" fill="var(--primary)"/>
      <circle cx="144" cy="191" r="10" fill="var(--bg)" stroke="var(--primary)" stroke-width="3"/>
      <rect x="236" y="60" width="18" height="8" rx="4" fill="var(--accent)" opacity=".9"/>
    </g>`,
  ];
  return `<svg viewBox="0 0 320 240" aria-hidden="true" style="width:100%;height:auto;display:block">${frames[i % frames.length]}</svg>`;
}

// Wordmark styles for the fictional client row — four voices so the names
// read as different brands without shipping any images.
const WORDMARK_STYLES = [
  "font-weight:800;letter-spacing:.04em",
  "font-weight:600;letter-spacing:.22em;text-transform:uppercase;font-size:.82em",
  "font-family:Georgia,serif;font-style:italic;font-weight:600",
  "font-family:'SF Mono',monospace;font-weight:700;letter-spacing:-.01em;font-size:.9em",
];

export function renderLandingPage(
  kit: BrandKit | CampaignBrandKit,
  opts: { videoEmbed?: string } = {}
): string {
  const { service, brand, copy } = kit;
  const ctaHref = service.url ? esc(service.url) : "#";
  const theme = resolveTheme(kit);
  const glass = theme.lp.variant === "glass";
  // Theme-assigned hero photo (served from this origin's public/campaigns/bg/).
  const heroBg = theme.lp.heroBackground;

  // Real logo (captured from the source site) beats a typographic wordmark;
  // the inline-SVG vector beats the element screenshot (transparent, crisp).
  const assets = "assets" in kit ? kit.assets : null;
  const logoSvg = assets?.logo_svg ?? null;
  const logo = assets?.logo ?? null;
  const logoHtml = logoSvg
    ? `<img src="data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}" alt="${esc(service.name)}" style="height:30px;width:auto;display:block">`
    : logo
      ? `<img src="data:${logo.media_type};base64,${logo.data}" alt="${esc(service.name)}" style="height:30px;width:auto;display:block">`
      : `${esc(service.name)}<span class="dot">.</span>`;

  // Captured design tokens are applied for real, not just displayed: the
  // rendered font leads the stack (loaded from Google Fonts when it is a
  // known family), button radius / container width / section spacing follow
  // the source site within sane clamps.
  const dt = "design_tokens" in kit ? kit.design_tokens : null;
  const styleStack = FONT_STACKS[brand.font_style];
  const bodyStack = familyStack(dt?.body_font);
  const font = bodyStack ? `${bodyStack}, ${styleStack}` : styleStack;
  const headingStack = familyStack(dt?.heading_font);
  const headingFont =
    headingStack && dt?.heading_font !== dt?.body_font
      ? `${headingStack}, ${font}`
      : null;
  const webFonts = [
    ...new Set(
      [...splitFamilies(dt?.body_font), ...splitFamilies(dt?.heading_font)].filter(
        (f) => GOOGLE_FONTS.has(f)
      )
    ),
  ];
  const fontLinks = webFonts.length
    ? `\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${webFonts
        .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700;800`)
        .join("&")}&display=swap">`
    : "";
  const radiusPx = pxOf(dt?.button_radius);
  const btnRadius =
    dt?.button_radius === "999px" || (radiusPx !== null && radiusPx > 40)
      ? "999px"
      : radiusPx !== null
        ? `${Math.max(0, Math.round(radiusPx))}px`
        : "999px";
  const containerPx = pxOf(dt?.container_width);
  const containerW =
    containerPx !== null ? Math.min(1240, Math.max(880, Math.round(containerPx))) : 1080;
  const sectionPx = pxOf(dt?.section_spacing);
  const sectionPad =
    sectionPx !== null ? Math.min(140, Math.max(56, Math.round(sectionPx))) : 84;

  // Sections added by the SaaS-type extension — absent on older Brand Kits.
  const proof = copy.proof?.stats?.length ? copy.proof : null;
  const testimonials = copy.testimonials?.length ? copy.testimonials : null;
  const pricing = copy.pricing?.plans?.length ? copy.pricing : null;
  const faq = copy.faq?.length ? copy.faq : null;
  const hasPlaceholderData = Boolean(proof || testimonials || pricing);

  const navLinks = [
    `<a href="#features">機能</a>`,
    `<a href="#how">使い方</a>`,
    pricing ? `<a href="#pricing">料金</a>` : "",
    faq ? `<a href="#faq">FAQ</a>` : "",
  ]
    .filter(Boolean)
    .join("\n      ");

  // Glass variant tokens: a near-black canvas tinted with the brand primary,
  // white-ish text, translucent hairlines. An extracted dark palette keeps
  // its own background/text; light palettes are re-grounded onto the dark
  // canvas while primary/accent still carry the brand.
  const glassBg =
    brand.mode === "dark"
      ? brand.background
      : `color-mix(in srgb, ${brand.primary} 12%, #070b18)`;
  const glassText = brand.mode === "dark" ? brand.text : "#f4f6fb";

  return `<!DOCTYPE html>
<html lang="ja" data-campaign-theme="${theme.id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(service.name)} — ${esc(service.tagline)}</title>
<meta name="description" content="${esc(service.description)}">
<meta name="theme-color" content="${brand.primary}">${fontLinks}
<style>
:root{
  --primary:${brand.primary};
  --accent:${brand.accent};
  --bg:${glass ? glassBg : brand.background};
  --surface:${glass ? "rgba(255,255,255,0.07)" : brand.surface};
  --text:${glass ? glassText : brand.text};
  --line:${glass ? "rgba(255,255,255,0.16)" : "color-mix(in srgb, var(--text) 12%, transparent)"};
  --line-soft:${glass ? "rgba(255,255,255,0.09)" : "color-mix(in srgb, var(--text) 6%, transparent)"};
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:${font};line-height:1.75;-webkit-font-smoothing:antialiased}
${headingFont ? `h1,h2,h3{font-family:${headingFont}}` : ""}
.container{max-width:${containerW}px;margin:0 auto;padding:0 24px}
header{position:sticky;top:0;z-index:10;background:color-mix(in srgb, var(--bg) 85%, transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line-soft)}
.nav{display:flex;align-items:center;justify-content:space-between;height:64px;gap:20px}
.logo{font-weight:800;font-size:1.25rem;letter-spacing:.02em}
.logo .dot{color:var(--primary)}
.nav-links{display:flex;gap:26px;font-size:.9rem}
.nav-links a{color:var(--text);opacity:.75;text-decoration:none}
.nav-links a:hover{opacity:1}
@media (max-width:760px){.nav-links{display:none}}
.btn{display:inline-block;padding:.8em 2em;border-radius:${btnRadius};background:var(--primary);color:#fff;text-decoration:none;font-weight:700;transition:transform .15s ease, box-shadow .15s ease;box-shadow:0 4px 20px color-mix(in srgb, var(--primary) 40%, transparent)}
.btn:hover{transform:translateY(-2px)}
.btn.small{padding:.5em 1.4em;font-size:.9rem}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--line);box-shadow:none}
.hero{padding:88px 0 64px;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:-40% -20% auto;height:130%;background:radial-gradient(ellipse at 30% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%),radial-gradient(ellipse at 85% 20%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 55%);pointer-events:none}
.hero-grid{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
@media (max-width:860px){.hero-grid{grid-template-columns:1fr;gap:40px}}
.hero h1{font-size:clamp(2rem, 4.6vw, 3.3rem);font-weight:800;line-height:1.28;letter-spacing:.01em}
.hero p.sub{margin:22px 0 0;max-width:560px;font-size:1.08rem;opacity:.85}
.hero .cta{margin-top:36px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.tagline{display:inline-block;margin-bottom:18px;padding:.35em 1.1em;border:1px solid color-mix(in srgb, var(--accent) 60%, transparent);color:var(--accent);border-radius:999px;font-size:.85rem;font-weight:600;letter-spacing:.05em}
.hero-visual{filter:drop-shadow(0 24px 48px color-mix(in srgb, var(--text) 18%, transparent))}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-top:64px;position:relative}
.stat{background:var(--surface);padding:26px 20px;text-align:center}
.stat .v{font-size:clamp(1.6rem,3vw,2.2rem);font-weight:800;color:var(--primary);line-height:1.2}
.stat .l{margin-top:4px;font-size:.85rem;opacity:.7}
.clients{padding:44px 0 8px;text-align:center}
.clients .cap{font-size:.78rem;letter-spacing:.14em;opacity:.5;text-transform:uppercase}
.client-row{margin-top:18px;display:flex;flex-wrap:wrap;justify-content:center;gap:18px 44px;font-size:1.05rem;opacity:.55}
section{padding:${sectionPad}px 0}
.section-title{font-size:clamp(1.5rem, 3.5vw, 2.2rem);font-weight:800;text-align:center;margin-bottom:14px;line-height:1.4}
.section-lead{max-width:620px;margin:0 auto 52px;text-align:center;font-size:.98rem;opacity:.75}
.alt{background:var(--surface)}
.pains{display:grid;gap:16px;max-width:640px;margin:0 auto}
.pain{display:flex;gap:14px;align-items:flex-start;padding:18px 22px;border-radius:14px;background:color-mix(in srgb, var(--bg) 60%, var(--surface));border:1px solid var(--line-soft)}
.pain::before{content:"✕";color:var(--primary);font-weight:800;flex-shrink:0}
.feature-row{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;padding:36px 0}
.feature-row:nth-child(even) .f-visual{order:-1}
@media (max-width:820px){.feature-row{grid-template-columns:1fr;gap:24px}.feature-row:nth-child(even) .f-visual{order:0}}
.f-visual{border-radius:20px;background:var(--surface);border:1px solid var(--line-soft);padding:28px}
.alt .f-visual{background:var(--bg)}
.f-copy .emoji{font-size:1.9rem}
.f-copy h3{margin:12px 0 10px;font-size:1.35rem;font-weight:800;line-height:1.4}
.f-copy p{opacity:.85;max-width:460px}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;counter-reset:step;margin-top:52px}
.step{position:relative;padding:30px 24px 24px;border-radius:16px;background:var(--surface);border:1px solid var(--line-soft);counter-increment:step}
.alt .step{background:var(--bg)}
.step::before{content:counter(step);position:absolute;top:-18px;left:24px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--accent);color:var(--bg);font-weight:800}
.step h3{margin-bottom:6px;font-size:1.05rem}
.step p{font-size:.92rem;opacity:.85}
.video-slot{max-width:800px;margin:0 auto;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:var(--surface);display:flex;align-items:center;justify-content:center;border:1px solid var(--line)}
.video-slot span{opacity:.5;font-size:.95rem}
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.quote{display:flex;flex-direction:column;gap:18px;padding:30px 28px;border-radius:18px;background:var(--surface);border:1px solid var(--line-soft)}
.alt .quote{background:var(--bg)}
.quote p.q{flex:1;font-size:.98rem}
.quote p.q::before{content:"“";color:var(--primary);font-size:1.6em;font-weight:800;line-height:0;vertical-align:-.18em;margin-right:.1em}
.person{display:flex;align-items:center;gap:12px}
.avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0}
.person .n{font-size:.9rem;font-weight:700;line-height:1.4}
.person .r{font-size:.78rem;opacity:.65}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;max-width:900px;margin:0 auto;align-items:stretch}
.plan{display:flex;flex-direction:column;padding:34px 30px;border-radius:20px;background:var(--surface);border:1px solid var(--line)}
.alt .plan{background:var(--bg)}
.plan.hot{border:2px solid var(--primary);position:relative;box-shadow:0 18px 44px color-mix(in srgb, var(--primary) 18%, transparent)}
.plan.hot::before{content:"おすすめ";position:absolute;top:-13px;left:28px;padding:.15em 1em;border-radius:999px;background:var(--primary);color:#fff;font-size:.75rem;font-weight:700}
.plan .pn{font-weight:800;font-size:1.05rem}
.plan .pp{margin-top:10px;font-size:2rem;font-weight:800;line-height:1.2}
.plan .pp small{font-size:.9rem;font-weight:600;opacity:.6}
.plan .pd{margin-top:8px;font-size:.88rem;opacity:.75;min-height:2.6em}
.plan ul{margin:20px 0 26px;list-style:none;display:grid;gap:10px;font-size:.9rem}
.plan li{display:flex;gap:10px;align-items:flex-start}
.plan li::before{content:"✓";color:var(--primary);font-weight:800;flex-shrink:0}
.plan .btn{margin-top:auto;text-align:center}
.plan .btn.ghost{color:var(--text)}
.faq-list{max-width:720px;margin:0 auto;display:grid;gap:12px}
.faq-list details{border:1px solid var(--line-soft);border-radius:14px;background:var(--surface);overflow:hidden}
.alt .faq-list details{background:var(--bg)}
.faq-list summary{cursor:pointer;padding:18px 22px;font-weight:700;font-size:.95rem;list-style:none;display:flex;justify-content:space-between;gap:16px;align-items:center}
.faq-list summary::-webkit-details-marker{display:none}
.faq-list summary::after{content:"+";font-size:1.3em;font-weight:400;opacity:.5;transition:transform .2s}
.faq-list details[open] summary::after{transform:rotate(45deg)}
.faq-list .a{padding:0 22px 18px;font-size:.92rem;opacity:.85}
.closing{text-align:center;background:linear-gradient(160deg, color-mix(in srgb, var(--primary) 22%, var(--bg)), var(--bg) 70%)}
.closing h2{font-size:clamp(1.6rem, 4vw, 2.6rem);font-weight:800}
.closing p{margin:18px 0 36px;opacity:.85}
.sample-note{padding:18px 0 0;text-align:center;font-size:.78rem;opacity:.55}
footer{padding:40px 0;text-align:center;font-size:.85rem;opacity:.6;border-top:1px solid var(--line-soft)}
@media (max-width:640px){section{padding:56px 0}.hero{padding:64px 0 48px}.stats{grid-template-columns:1fr;margin-top:44px}}
${
  glass
    ? `/* ---- glass theme overrides (same structure, dark frosted-glass skin) ---- */
body{background:radial-gradient(1100px 700px at 82% -10%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%),radial-gradient(900px 640px at -10% 26%, color-mix(in srgb, var(--primary) 38%, transparent), transparent 62%),radial-gradient(1200px 800px at 55% 115%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 62%),var(--bg);background-attachment:fixed}
header{background:color-mix(in srgb, var(--bg) 62%, transparent)}
.stat,.pain,.f-visual,.step,.quote,.plan,.video-slot,.faq-list details{background:rgba(255,255,255,.06);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.alt{background:rgba(255,255,255,.04)}
.alt .f-visual,.alt .step,.alt .quote,.alt .plan,.alt .faq-list details{background:rgba(255,255,255,.06)}
.plan.hot{border-color:var(--primary);box-shadow:0 18px 44px color-mix(in srgb, var(--primary) 32%, transparent)}
.btn.ghost{border-color:rgba(255,255,255,.3)}
.tagline{color:color-mix(in srgb, var(--accent) 40%, #fff);border-color:color-mix(in srgb, var(--accent) 50%, rgba(255,255,255,.45))}
.step::before{color:#fff}
.hero-visual{filter:drop-shadow(0 24px 48px rgba(0,0,0,.45))}
.closing{background:linear-gradient(160deg, color-mix(in srgb, var(--primary) 30%, transparent), transparent 72%)}
`
    : ""
}${
  heroBg
    ? `/* ---- theme-assigned hero background photo (white text over scrim) ---- */
.hero{color:#fff;background:linear-gradient(${heroBg.scrim},${heroBg.scrim}),url('${heroBg.src}') center/cover no-repeat}
.hero::before{content:none}
.hero .stat{color:var(--text)}
.hero .btn.ghost{color:#fff;border-color:rgba(255,255,255,.45)}
.hero .tagline{color:color-mix(in srgb, var(--accent) 30%, #fff);border-color:rgba(255,255,255,.45)}
`
    : ""
}</style>
</head>
<body>
<header>
  <div class="container nav">
    <div class="logo">${logoHtml}</div>
    <nav class="nav-links" aria-label="ページ内">
      ${navLinks}
    </nav>
    <a class="btn small" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
  </div>
</header>

<main>
  <div class="hero">
    <div class="container">
      <div class="hero-grid">
        <div>
          <span class="tagline">${esc(service.tagline)}</span>
          <h1>${esc(copy.hero.headline)}</h1>
          <p class="sub">${esc(copy.hero.subheadline)}</p>
          <div class="cta">
            <a class="btn" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
            <a class="btn ghost" href="#how">使い方を見る</a>
          </div>
        </div>
        <div class="hero-visual">${heroMockSvg(service.name)}</div>
      </div>
      ${
        proof
          ? `<div class="stats">
        ${proof.stats
          .map(
            (s) => `<div class="stat"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`
          )
          .join("\n        ")}
      </div>`
          : ""
      }
    </div>
  </div>

  ${
    proof && proof.client_names?.length
      ? `<div class="clients">
    <div class="container">
      <p class="cap">Trusted by teams</p>
      <div class="client-row">
        ${proof.client_names
          .map((n, i) => `<span style="${WORDMARK_STYLES[i % WORDMARK_STYLES.length]}">${esc(n)}</span>`)
          .join("\n        ")}
      </div>
    </div>
  </div>`
      : ""
  }

  <section>
    <div class="container">
      ${
        opts.videoEmbed
          ? `<div class="video-slot">${opts.videoEmbed}</div>`
          : `<div class="video-slot"><span>▶ 紹介動画（生成中）</span></div>`
      }
    </div>
  </section>

  <section class="alt">
    <div class="container">
      <h2 class="section-title">${esc(copy.problem.headline)}</h2>
      <div class="pains" style="margin-top:44px">
        ${copy.problem.points.map((p) => `<div class="pain">${esc(p)}</div>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section id="features">
    <div class="container">
      <h2 class="section-title">${esc(service.name)} ができること</h2>
      <p class="section-lead">${esc(service.offering)}</p>
      ${copy.features
        .map(
          (f, i) => `<div class="feature-row">
        <div class="f-copy">
          <div class="emoji">${esc(f.emoji)}</div>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.description)}</p>
        </div>
        <div class="f-visual">${featureSvg(i)}</div>
      </div>`
        )
        .join("\n      ")}
    </div>
  </section>

  <section id="how" class="alt">
    <div class="container">
      <h2 class="section-title">${esc(copy.how_it_works.headline)}</h2>
      <div class="steps">
        ${copy.how_it_works.steps
          .map(
            (s) => `<div class="step">
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.description)}</p>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  ${
    testimonials
      ? `<section>
    <div class="container">
      <h2 class="section-title">利用者の声</h2>
      <div class="quotes" style="margin-top:48px">
        ${testimonials
          .map(
            (t) => `<div class="quote">
          <p class="q">${esc(t.quote)}</p>
          <div class="person">
            <div class="avatar">${esc((t.name || "?").trim().charAt(0))}</div>
            <div><p class="n">${esc(t.name)}</p><p class="r">${esc(t.role)}</p></div>
          </div>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    pricing
      ? `<section id="pricing" class="alt">
    <div class="container">
      <h2 class="section-title">${esc(pricing.headline)}</h2>
      <div class="plans" style="margin-top:52px">
        ${pricing.plans
          .map(
            (p) => `<div class="plan${p.highlighted ? " hot" : ""}">
          <p class="pn">${esc(p.name)}</p>
          <p class="pp">${esc(p.price)}${p.period ? `<small>${esc(p.period)}</small>` : ""}</p>
          <p class="pd">${esc(p.description)}</p>
          <ul>
            ${p.features.map((f) => `<li>${esc(f)}</li>`).join("\n            ")}
          </ul>
          <a class="btn${p.highlighted ? "" : " ghost"}" href="${ctaHref}">${esc(p.cta_label)}</a>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    faq
      ? `<section id="faq">
    <div class="container">
      <h2 class="section-title">よくある質問</h2>
      <div class="faq-list" style="margin-top:48px">
        ${faq
          .map(
            (item) => `<details>
          <summary>${esc(item.q)}</summary>
          <p class="a">${esc(item.a)}</p>
        </details>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
      : ""
  }

  <section class="closing">
    <div class="container">
      <h2>${esc(copy.closing.headline)}</h2>
      <p>${esc(copy.closing.subtext)}</p>
      <a class="btn" href="${ctaHref}">${esc(copy.closing.cta_label)}</a>
    </div>
  </section>
</main>

${
  hasPlaceholderData
    ? `<p class="sample-note">※ 実績数値・クライアント名・利用者の声・料金は自動生成された仮の内容（サンプル）です。正式な情報に差し替えてご利用ください。</p>`
    : ""
}
<footer>
  <div class="container">© ${new Date().getFullYear()} ${esc(service.name)}</div>
</footer>
</body>
</html>
`;
}
