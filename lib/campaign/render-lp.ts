import type {
  BrandKit,
  CampaignBrandKit,
  CampaignScreenAsset,
} from "./schema";
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

type DeviceMockupKind = "laptop" | "mobile" | "duo";

// Brand-colored fallback screen. It deliberately contains no device chrome:
// the screen is the portable asset, while laptop/phone frames are renderers.
function fallbackScreenSvg(viewport: "desktop" | "mobile"): string {
  if (viewport === "mobile") {
    return `<svg viewBox="0 0 390 844" aria-hidden="true" preserveAspectRatio="xMidYMin slice">
  <rect width="390" height="844" fill="var(--bg)"/>
  <rect width="390" height="70" fill="var(--surface)"/>
  <circle cx="38" cy="35" r="15" fill="var(--primary)"/>
  <rect x="64" y="25" width="116" height="20" rx="10" fill="var(--text)" opacity=".72"/>
  <rect x="24" y="104" width="260" height="30" rx="10" fill="var(--text)" opacity=".88"/>
  <rect x="24" y="148" width="326" height="14" rx="7" fill="var(--text)" opacity=".28"/>
  <rect x="24" y="174" width="274" height="14" rx="7" fill="var(--text)" opacity=".2"/>
  <rect x="24" y="220" width="152" height="46" rx="23" fill="var(--primary)"/>
  <rect x="24" y="306" width="342" height="210" rx="24" fill="var(--primary)" opacity=".14"/>
  <circle cx="195" cy="400" r="58" fill="var(--accent)" opacity=".8"/>
  <rect x="24" y="552" width="342" height="112" rx="22" fill="var(--surface)" stroke="var(--line)"/>
  <rect x="48" y="580" width="190" height="16" rx="8" fill="var(--text)" opacity=".6"/>
  <rect x="48" y="612" width="270" height="11" rx="5.5" fill="var(--text)" opacity=".2"/>
  <rect x="24" y="688" width="342" height="112" rx="22" fill="var(--surface)" stroke="var(--line)"/>
</svg>`;
  }

  return `<svg viewBox="0 0 1440 900" aria-hidden="true" preserveAspectRatio="xMidYMin slice">
  <rect width="1440" height="900" fill="var(--bg)"/>
  <rect width="1440" height="78" fill="var(--surface)"/>
  <circle cx="54" cy="39" r="16" fill="var(--primary)"/>
  <rect x="84" y="27" width="180" height="24" rx="12" fill="var(--text)" opacity=".72"/>
  <rect x="1060" y="24" width="150" height="30" rx="15" fill="var(--text)" opacity=".12"/>
  <rect x="1232" y="19" width="164" height="40" rx="20" fill="var(--primary)"/>
  <rect x="80" y="156" width="680" height="58" rx="16" fill="var(--text)" opacity=".88"/>
  <rect x="80" y="238" width="570" height="22" rx="11" fill="var(--text)" opacity=".28"/>
  <rect x="80" y="278" width="490" height="22" rx="11" fill="var(--text)" opacity=".2"/>
  <rect x="80" y="340" width="220" height="62" rx="31" fill="var(--primary)"/>
  <rect x="850" y="142" width="510" height="332" rx="34" fill="var(--primary)" opacity=".14"/>
  <circle cx="1105" cy="308" r="106" fill="var(--accent)" opacity=".8"/>
  <rect x="80" y="550" width="392" height="250" rx="28" fill="var(--surface)" stroke="var(--line)"/>
  <rect x="524" y="550" width="392" height="250" rx="28" fill="var(--surface)" stroke="var(--line)"/>
  <rect x="968" y="550" width="392" height="250" rx="28" fill="var(--surface)" stroke="var(--line)"/>
  <circle cx="136" cy="612" r="24" fill="var(--primary)" opacity=".7"/>
  <circle cx="580" cy="612" r="24" fill="var(--accent)" opacity=".7"/>
  <rect x="1020" y="590" width="210" height="20" rx="10" fill="var(--text)" opacity=".42"/>
</svg>`;
}

function screenHtml(
  screen: CampaignScreenAsset | null | undefined,
  viewport: "desktop" | "mobile"
): string {
  if (!screen) return fallbackScreenSvg(viewport);
  return `<img src="data:${screen.media_type};base64,${screen.data}" alt="" loading="eager" decoding="async">`;
}

// Deterministic, reusable device renderers. A future model-viewer/GLB renderer
// consumes the same screens and only replaces this outer frame layer.
function deviceMockupHtml(
  kind: DeviceMockupKind,
  screens: { desktop?: CampaignScreenAsset | null; mobile?: CampaignScreenAsset | null },
  serviceName: string,
  decorative = false
): string {
  const a11y = decorative
    ? `aria-hidden="true"`
    : `role="img" aria-label="${esc(serviceName)} のPC・モバイル画面イメージ"`;
  const laptop = `<div class="device-laptop">
    <div class="device-laptop-lid"><span class="device-camera"></span><div class="device-screen">${screenHtml(screens.desktop, "desktop")}</div></div>
    <div class="device-laptop-base"><span></span></div>
  </div>`;
  const mobile = `<div class="device-phone">
    <div class="device-phone-shell"><span class="device-speaker"></span><div class="device-screen">${screenHtml(screens.mobile, "mobile")}</div></div>
  </div>`;

  return `<div class="device-mockup device-${kind}" ${a11y}>${
    kind === "laptop" ? laptop : kind === "mobile" ? mobile : `${laptop}${mobile}`
  }</div>`;
}

// SSOT: one device mockup implementation, used by every surface that shows
// "this service on a laptop and a phone" — the LP hero, the feature visuals,
// and the management thumbnail (which iframes this same HTML).
//
// There used to be a second one here: a model-viewer/GLB hero that only ran
// where scripts are allowed. The thumbnail's sandboxed iframe silently fell
// back to the markup below, so the same page rendered two different key
// visuals and only the 3D one carried the bugs (inverted screens, the phone
// intersecting the laptop, corners cropped on rotation). Do not reintroduce a
// script-dependent hero: whatever renders here must render identically in a
// sandboxed iframe. The 3D device work continues in Workflow Lab as a Draft
// asset (docs/device-mockup-fixes.md).
function heroVisualHtml(
  screens: { desktop?: CampaignScreenAsset | null; mobile?: CampaignScreenAsset | null },
  serviceName: string
): string {
  return `<div class="hero-model-stage">${deviceMockupHtml("duo", screens, serviceName)}</div>`;
}

// "120+" / "3秒" / "約3分" — separate the figure from the characters around it
// so each can be sized on its own. The Latin figures and the Japanese unit come
// from different families in the captured font stack; at one size and weight
// that reads as a rendering fault rather than as typography.
// Values with no figure at all pass through untouched.
export function statValueHtml(value: string): string {
  // Lazy prefix so "約3分" splits into 約 / 3 / 分 rather than leaving the
  // kanji to fight the figure at the same size and weight.
  const match = /^(\D*?)([+-]?[\d０-９][\d０-９.,]*)(.*)$/.exec(value.trim());
  if (!match) return `<span class="n">${esc(value.trim())}</span>`;
  const [, prefix, figure, suffix] = match;
  const unit = (part: string) =>
    part.trim() ? `<span class="u">${esc(part.trim())}</span>` : "";
  return `${unit(prefix)}<span class="n">${esc(figure)}</span>${unit(suffix)}`;
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

/** <video> markup for the LP's video slot (opts.videoEmbed / injectCmVideo). */
export function cmVideoEmbed(src: string): string {
  return `<video controls playsinline preload="metadata" src="${esc(src)}"></video>`;
}

const VIDEO_SLOT = /<!--cm-video-slot-->[\s\S]*?<!--\/cm-video-slot-->/;
// Job HTML stored before the marker existed still carries the bare placeholder.
const LEGACY_VIDEO_SLOT = /<div class="video-slot">(?:<span>[^<]*<\/span>|[\s\S]*?)<\/div>/;

/**
 * Swap the LP's video-slot placeholder for the real CM embed at serve time.
 * Stored job HTML predates the MP4, and signed video URLs expire, so the
 * embed can never be baked into the stored document — /c/[id] injects it on
 * every response instead.
 */
export function injectCmVideo(html: string, src: string): string {
  const embed = `<div class="video-slot">${cmVideoEmbed(src)}</div>`;
  if (VIDEO_SLOT.test(html))
    return html.replace(VIDEO_SLOT, `<!--cm-video-slot-->${embed}<!--/cm-video-slot-->`);
  return html.replace(LEGACY_VIDEO_SLOT, embed);
}

/**
 * Leave no video section at all while the MP4 does not exist yet.
 *
 * The LP is one source of truth about the video: it shows the CM when there is
 * an MP4 to show, and otherwise says nothing. It must never offer to *generate*
 * one — generation belongs to the authenticated management surface, and an LP
 * button for it made the same CM look ungenerated here while the management
 * screen already called it done.
 */
export function removeCmVideoSlot(html: string): string {
  if (VIDEO_SLOT.test(html))
    return html.replace(VIDEO_SLOT, "<!--cm-video-slot--><!--/cm-video-slot-->");
  return html.replace(LEGACY_VIDEO_SLOT, "");
}

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
  const screens = assets?.screens ?? { desktop: null, mobile: null };
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
.hero-model-stage{position:relative;width:100%;display:flex;align-items:center}
.device-mockup{position:relative;width:100%;margin:auto;color:#111827}
.device-screen{position:relative;width:100%;height:100%;overflow:hidden;background:var(--bg)}
.device-screen::after{content:"";position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.2),transparent 28%,transparent 72%,rgba(255,255,255,.08));pointer-events:none}
.device-screen img,.device-screen svg{width:100%;height:100%;display:block;object-fit:cover;object-position:top center}
.device-laptop{position:relative;width:100%;padding-bottom:5.5%}
.device-laptop-lid{position:relative;width:92%;aspect-ratio:16/10;margin:0 auto;padding:2.4% 2.2% 2.8%;border-radius:18px 18px 8px 8px;background:#20242b;border:1px solid rgba(255,255,255,.24);box-shadow:inset 0 0 0 1px rgba(0,0,0,.28)}
.device-laptop-lid .device-screen{border-radius:8px}
.device-camera{position:absolute;top:.85%;left:50%;width:4px;height:4px;border-radius:50%;background:#06070a;transform:translateX(-50%);z-index:1}
.device-laptop-base{position:absolute;left:0;right:0;bottom:0;height:7.4%;border-radius:3px 3px 18px 18px;background:linear-gradient(180deg,#eef0f2,#9ca3aa 70%,#717780);box-shadow:0 10px 16px rgba(0,0,0,.22)}
.device-laptop-base::before{content:"";position:absolute;inset:0 4%;border-top:1px solid rgba(255,255,255,.9)}
.device-laptop-base span{position:absolute;top:0;left:43%;width:14%;height:36%;border-radius:0 0 8px 8px;background:#8e949b}
.device-phone{position:relative;width:34%;margin:auto}
.device-phone-shell{position:relative;aspect-ratio:390/844;padding:5.8% 4.5%;border-radius:12% / 5.8%;background:#171a20;border:1px solid rgba(255,255,255,.32);box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),0 14px 24px rgba(0,0,0,.24)}
.device-phone-shell .device-screen{border-radius:9% / 4.4%}
.device-speaker{position:absolute;top:2.2%;left:50%;width:24%;height:.7%;border-radius:999px;background:#050609;transform:translateX(-50%);z-index:1}
.device-duo{min-height:330px;padding:5% 3% 0 0}
.device-duo>.device-laptop{width:94%;margin:0 auto 0 0}
.device-duo>.device-phone{position:absolute;right:0;bottom:0;width:25%;z-index:1}
.f-visual .device-mockup{max-width:440px}
.f-visual .device-duo{min-height:250px}
@media (max-width:520px){.device-laptop-lid{border-radius:12px 12px 5px 5px}.device-duo{min-height:220px}.device-duo>.device-phone{width:28%}}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-top:64px;position:relative}
.stat{background:var(--surface);padding:26px 20px;text-align:center}
/* Figures and their Japanese unit are set separately. At one size and weight
   the Latin numerals and the kanji come from different families in the stack
   and collide; a smaller, baseline-aligned unit makes that contrast read as
   typography instead of as a rendering fault. */
.stat .v{display:flex;align-items:baseline;justify-content:center;gap:.1em;font-size:clamp(1.9rem,3.4vw,2.6rem);font-weight:800;color:var(--primary);line-height:1.15}
.stat .v .n{letter-spacing:-.035em;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1}
.stat .v .u{display:inline-block;font-size:.46em;font-weight:700;letter-spacing:.04em;transform:translateY(-.1em)}
.stat .l{margin-top:8px;font-size:.82rem;letter-spacing:.02em;opacity:.65}
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
.video-slot video{width:100%;height:100%;object-fit:cover;display:block}
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
        <div class="hero-visual">${heroVisualHtml(screens, service.name)}</div>
      </div>
      ${
        proof
          ? `<div class="stats">
        ${proof.stats
          .map(
            (s) => `<div class="stat"><div class="v">${statValueHtml(s.value)}</div><div class="l">${esc(s.label)}</div></div>`
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
      <!--cm-video-slot-->${
        opts.videoEmbed ? `<div class="video-slot">${opts.videoEmbed}</div>` : ""
      }<!--/cm-video-slot-->
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
        <div class="f-visual">${
          i === 1
            ? deviceMockupHtml("laptop", screens, service.name, true)
            : i === 2
              ? deviceMockupHtml("duo", screens, service.name, true)
              : i === 3
                ? deviceMockupHtml("mobile", screens, service.name, true)
                : featureSvg(i)
        }</div>
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
