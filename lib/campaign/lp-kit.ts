import type { BrandKit, CampaignBrandKit, CampaignScreenAsset } from "./schema";

// Shared primitives for every LP template (lib/campaign/render-lp.ts and the
// lp-*.ts design templates). Anything a second template would otherwise
// re-implement lives here — above all the device mockup, which has one
// implementation on purpose: the management thumbnail iframes the LP with
// sandbox="" (scripts blocked), so a template-local, script-dependent key
// visual would make the two surfaces show different things and only one of
// them would be tested (docs/device-mockup-fixes.md).

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const pad2 = (n: number) => String(n).padStart(2, "0");

// ---------- inline SVG artwork (inherits the brand via CSS variables) ----------

export type DeviceMockupKind = "laptop" | "mobile" | "duo";

// Brand-colored fallback screen. It deliberately contains no device chrome:
// the screen is the portable asset, while laptop/phone frames are renderers.
function fallbackScreenSvg(viewport: "desktop" | "mobile"): string {
  if (viewport === "mobile") {
    return `<svg viewBox="0 0 390 844" aria-hidden="true" preserveAspectRatio="xMidYMin slice">
  <rect width="390" height="844" fill="var(--screen-bg)"/>
  <rect width="390" height="70" fill="var(--screen-surface)"/>
  <circle cx="38" cy="35" r="15" fill="var(--primary)"/>
  <rect x="64" y="25" width="116" height="20" rx="10" fill="var(--screen-text)" opacity=".72"/>
  <rect x="24" y="104" width="260" height="30" rx="10" fill="var(--screen-text)" opacity=".88"/>
  <rect x="24" y="148" width="326" height="14" rx="7" fill="var(--screen-text)" opacity=".28"/>
  <rect x="24" y="174" width="274" height="14" rx="7" fill="var(--screen-text)" opacity=".2"/>
  <rect x="24" y="220" width="152" height="46" rx="23" fill="var(--primary)"/>
  <rect x="24" y="306" width="342" height="210" rx="24" fill="var(--primary)" opacity=".14"/>
  <circle cx="195" cy="400" r="58" fill="var(--accent)" opacity=".8"/>
  <rect x="24" y="552" width="342" height="112" rx="22" fill="var(--screen-surface)" stroke="var(--screen-line)"/>
  <rect x="48" y="580" width="190" height="16" rx="8" fill="var(--screen-text)" opacity=".6"/>
  <rect x="48" y="612" width="270" height="11" rx="5.5" fill="var(--screen-text)" opacity=".2"/>
  <rect x="24" y="688" width="342" height="112" rx="22" fill="var(--screen-surface)" stroke="var(--screen-line)"/>
</svg>`;
  }

  return `<svg viewBox="0 0 1440 900" aria-hidden="true" preserveAspectRatio="xMidYMin slice">
  <rect width="1440" height="900" fill="var(--screen-bg)"/>
  <rect width="1440" height="78" fill="var(--screen-surface)"/>
  <circle cx="54" cy="39" r="16" fill="var(--primary)"/>
  <rect x="84" y="27" width="180" height="24" rx="12" fill="var(--screen-text)" opacity=".72"/>
  <rect x="1060" y="24" width="150" height="30" rx="15" fill="var(--screen-text)" opacity=".12"/>
  <rect x="1232" y="19" width="164" height="40" rx="20" fill="var(--primary)"/>
  <rect x="80" y="156" width="680" height="58" rx="16" fill="var(--screen-text)" opacity=".88"/>
  <rect x="80" y="238" width="570" height="22" rx="11" fill="var(--screen-text)" opacity=".28"/>
  <rect x="80" y="278" width="490" height="22" rx="11" fill="var(--screen-text)" opacity=".2"/>
  <rect x="80" y="340" width="220" height="62" rx="31" fill="var(--primary)"/>
  <rect x="850" y="142" width="510" height="332" rx="34" fill="var(--primary)" opacity=".14"/>
  <circle cx="1105" cy="308" r="106" fill="var(--accent)" opacity=".8"/>
  <rect x="80" y="550" width="392" height="250" rx="28" fill="var(--screen-surface)" stroke="var(--screen-line)"/>
  <rect x="524" y="550" width="392" height="250" rx="28" fill="var(--screen-surface)" stroke="var(--screen-line)"/>
  <rect x="968" y="550" width="392" height="250" rx="28" fill="var(--screen-surface)" stroke="var(--screen-line)"/>
  <circle cx="136" cy="612" r="24" fill="var(--primary)" opacity=".7"/>
  <circle cx="580" cy="612" r="24" fill="var(--accent)" opacity=".7"/>
  <rect x="1020" y="590" width="210" height="20" rx="10" fill="var(--screen-text)" opacity=".42"/>
</svg>`;
}

function screenHtml(
  screen: CampaignScreenAsset | null | undefined,
  viewport: "desktop" | "mobile"
): string {
  if (!screen) return fallbackScreenSvg(viewport);
  return `<img src="data:${screen.media_type};base64,${screen.data}" alt="" loading="eager" decoding="async">`;
}

export interface Screens {
  desktop?: CampaignScreenAsset | null;
  mobile?: CampaignScreenAsset | null;
}

// Deterministic, reusable device renderers. A future model-viewer/GLB renderer
// consumes the same screens and only replaces this outer frame layer.
export function deviceMockupHtml(
  kind: DeviceMockupKind,
  screens: Screens,
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
// There used to be a second one: a model-viewer/GLB hero that only ran where
// scripts are allowed. The thumbnail's sandboxed iframe silently fell back to
// the markup above, so the same page rendered two different key visuals and
// only the 3D one carried the bugs (inverted screens, the phone intersecting
// the laptop, corners cropped on rotation). Do not reintroduce a
// script-dependent hero: whatever renders here must render identically in a
// sandboxed iframe. The 3D device work continues in Workflow Lab as a Draft
// asset (docs/device-mockup-fixes.md).
export function heroVisualHtml(screens: Screens, serviceName: string): string {
  return `<div class="hero-model-stage">${deviceMockupHtml("duo", screens, serviceName)}</div>`;
}

/**
 * CSS for the device mockup markup above. Templates paste this into their own
 * <style> and set the four --screen-* variables to whatever canvas the fallback
 * screen should imitate (the real product's UI, not the LP's own skin).
 */
export const DEVICE_CSS = `.device-mockup{position:relative;width:100%;margin:auto;color:#111827}
.device-screen{position:relative;width:100%;height:100%;overflow:hidden;background:var(--screen-bg)}
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
@media (max-width:520px){.device-laptop-lid{border-radius:12px 12px 5px 5px}.device-duo{min-height:220px}.device-duo>.device-phone{width:28%}}`;

// ---------- feature illustrations ----------

/** Feature illustrations, cycled by index. Consistent 4:3 stroke-based style. */
export function featureSvg(i: number): string {
  const frames = [
    // 0 — sources funnel in
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="46" y="44" width="92" height="118" rx="10" fill="var(--art-bg)" stroke="var(--art-line)" stroke-width="2"/>
      <rect x="62" y="66" width="60" height="7" rx="3.5" fill="var(--art-ink)" opacity=".4"/>
      <rect x="62" y="82" width="44" height="7" rx="3.5" fill="var(--art-ink)" opacity=".25"/>
      <rect x="62" y="98" width="52" height="7" rx="3.5" fill="var(--art-ink)" opacity=".25"/>
      <rect x="70" y="30" width="92" height="118" rx="10" fill="var(--art-surface)" stroke="var(--art-line)" stroke-width="2" transform="rotate(4 116 89)"/>
      <rect x="88" y="52" width="56" height="7" rx="3.5" fill="var(--art-ink)" opacity=".4" transform="rotate(4 116 89)"/>
      <rect x="88" y="68" width="40" height="7" rx="3.5" fill="var(--art-ink)" opacity=".25" transform="rotate(4 116 89)"/>
      <path d="M180 96 h44" stroke="var(--art-ink)" opacity=".35" stroke-width="2.5" stroke-dasharray="2 7"/>
      <circle cx="258" cy="96" r="34" fill="var(--primary)" opacity=".14"/>
      <circle cx="258" cy="96" r="34" stroke="var(--primary)" stroke-width="2.5"/>
      <path d="M244 96 l10 10 20 -22" stroke="var(--primary)" stroke-width="3.5"/>
      <circle cx="284" cy="58" r="4" fill="var(--accent)"/>
      <circle cx="228" cy="140" r="3" fill="var(--accent)" opacity=".7"/>
    </g>`,
    // 1 — brand kit: swatches + type specimen
    `<g fill="none" stroke-linecap="round">
      <rect x="44" y="46" width="232" height="148" rx="14" fill="var(--art-bg)" stroke="var(--art-line)" stroke-width="2"/>
      <circle cx="82" cy="86" r="16" fill="var(--primary)"/>
      <circle cx="120" cy="86" r="16" fill="var(--accent)"/>
      <circle cx="158" cy="86" r="16" fill="var(--art-ink)" opacity=".8"/>
      <circle cx="196" cy="86" r="16" fill="var(--art-surface)" stroke="var(--art-line)" stroke-width="2"/>
      <text x="66" y="140" font-family="Georgia,serif" font-size="34" fill="var(--art-ink)">Aa</text>
      <rect x="126" y="118" width="120" height="9" rx="4.5" fill="var(--art-ink)" opacity=".35"/>
      <rect x="126" y="136" width="90" height="9" rx="4.5" fill="var(--art-ink)" opacity=".2"/>
      <rect x="66" y="162" width="70" height="16" rx="8" fill="var(--primary)" opacity=".9"/>
      <rect x="144" y="162" width="70" height="16" rx="8" fill="none" stroke="var(--art-line)" stroke-width="2"/>
    </g>`,
    // 2 — page wireframe rising
    `<g fill="none" stroke-linecap="round">
      <rect x="70" y="34" width="180" height="172" rx="12" fill="var(--art-bg)" stroke="var(--art-line)" stroke-width="2"/>
      <rect x="70" y="34" width="180" height="30" rx="12" fill="var(--art-line)" opacity=".5"/>
      <rect x="70" y="50" width="180" height="14" fill="var(--art-line)" opacity=".5"/>
      <rect x="88" y="80" width="104" height="12" rx="6" fill="var(--art-ink)" opacity=".6"/>
      <rect x="88" y="100" width="140" height="8" rx="4" fill="var(--art-ink)" opacity=".25"/>
      <rect x="88" y="118" width="64" height="20" rx="10" fill="var(--primary)"/>
      <rect x="88" y="152" width="42" height="36" rx="8" fill="var(--primary)" opacity=".15"/>
      <rect x="138" y="152" width="42" height="36" rx="8" fill="var(--accent)" opacity=".18"/>
      <rect x="188" y="152" width="42" height="36" rx="8" fill="var(--art-ink)" opacity=".08"/>
      <path d="M262 150 l22 -22 M284 150 v-22 h-22" stroke="var(--accent)" stroke-width="3"/>
      <circle cx="52" cy="180" r="4" fill="var(--accent)" opacity=".7"/>
    </g>`,
    // 3 — video: play + timeline
    `<g fill="none" stroke-linecap="round">
      <rect x="52" y="42" width="216" height="126" rx="14" fill="var(--art-ink)" opacity=".85"/>
      <circle cx="160" cy="105" r="30" fill="var(--art-bg)" opacity=".95"/>
      <path d="M152 90 l26 15 -26 15 z" fill="var(--primary)"/>
      <rect x="52" y="184" width="216" height="14" rx="7" fill="var(--art-line)" opacity=".5"/>
      <rect x="52" y="184" width="92" height="14" rx="7" fill="var(--primary)"/>
      <circle cx="144" cy="191" r="10" fill="var(--art-bg)" stroke="var(--primary)" stroke-width="3"/>
      <rect x="236" y="60" width="18" height="8" rx="4" fill="var(--accent)" opacity=".9"/>
    </g>`,
  ];
  return `<svg viewBox="0 0 320 240" aria-hidden="true" style="width:100%;height:auto;display:block">${frames[i % frames.length]}</svg>`;
}

// ---------- fictional client logo wall ----------

// A geometric mark plus a distinct wordmark voice per name, so the row reads
// as real brand logos without shipping any images. Plain strings around the
// LLM-supplied names looked like a list of words, not like customers.
const WORDMARK_STYLES = [
  "font-weight:800;letter-spacing:.03em",
  "font-weight:600;letter-spacing:.24em;text-transform:uppercase;font-size:.78em",
  "font-family:Georgia,serif;font-style:italic;font-weight:600;font-size:1.04em",
  "font-family:'JetBrains Mono','SF Mono',monospace;font-weight:600;letter-spacing:-.01em;font-size:.88em",
  "font-weight:300;letter-spacing:.16em;text-transform:uppercase;font-size:.86em",
  "font-weight:900;letter-spacing:-.03em;font-style:italic",
];

// 20×20 currentColor glyphs (overlapping disks, outlined hexagon, delta,
// rising bars, outlined diamond, orbit ring, swoosh arc, dot matrix).
const CLIENT_MARKS = [
  `<circle cx="7.5" cy="10" r="5.5" opacity=".9"/><circle cx="13" cy="10" r="5.5" opacity=".45"/>`,
  `<path d="M10 1.8 17.2 5.9v8.2L10 18.2 2.8 14.1V5.9z" fill="none" stroke="currentColor" stroke-width="2"/>`,
  `<path d="M10 2.2 18.4 17.2H1.6z"/>`,
  `<rect x="3" y="10" width="3.4" height="8" rx="1"/><rect x="8.3" y="6" width="3.4" height="12" rx="1"/><rect x="13.6" y="2" width="3.4" height="16" rx="1"/>`,
  `<path d="M10 1.6 18.4 10 10 18.4 1.6 10z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="10" r="2.3"/>`,
  `<circle cx="10" cy="10" r="6.8" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="15.6" cy="4.4" r="2.5"/>`,
  `<path d="M2 18A16 16 0 0 1 18 2v6a10 10 0 0 0-10 10z"/>`,
  `<circle cx="5.5" cy="5.5" r="2.6"/><circle cx="14.5" cy="5.5" r="2.6"/><circle cx="5.5" cy="14.5" r="2.6"/><circle cx="14.5" cy="14.5" r="2.6" opacity=".45"/>`,
];

export function clientLogoHtml(name: string, i: number): string {
  // Offset the mark cycle against the style cycle so adjacent logos never
  // share both mark and voice.
  const mark = CLIENT_MARKS[(i * 3 + name.length) % CLIENT_MARKS.length];
  const style = WORDMARK_STYLES[i % WORDMARK_STYLES.length];
  return `<span class="cl"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">${mark}</svg><span style="${style}">${esc(name)}</span></span>`;
}

// ---------- header lockup ----------

/**
 * Real logo (captured from the source site) beats a typographic wordmark; the
 * inline-SVG vector beats the element screenshot (transparent, crisp).
 * `invert` lifts a dark-ink logo onto a dark canvas — captured logos are
 * usually drawn for a white page.
 */
export function logoLockupHtml(
  kit: BrandKit | CampaignBrandKit,
  opts: { height?: number } = {}
): string {
  const { service } = kit;
  const assets = "assets" in kit ? kit.assets : null;
  const logoSvg = assets?.logo_svg ?? null;
  const logo = assets?.logo ?? null;
  const style = `height:${opts.height ?? 30}px;width:auto;display:block`;
  return logoSvg
    ? `<img src="data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}" alt="${esc(service.name)}" style="${style}">`
    : logo
      ? `<img src="data:${logo.media_type};base64,${logo.data}" alt="${esc(service.name)}" style="${style}">`
      : `${esc(service.name)}<span class="dot">.</span>`;
}

// ---------- stat figures ----------

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

// ---------- section data guards ----------

/**
 * The SaaS-type extension sections, absent on Brand Kits generated before it.
 * Every template gates on the same shapes, so pre-extension kits render on all
 * of them.
 */
export function sectionData(kit: BrandKit | CampaignBrandKit) {
  const { copy } = kit;
  const proof = copy.proof?.stats?.length ? copy.proof : null;
  const testimonials = copy.testimonials?.length ? copy.testimonials : null;
  const pricing = copy.pricing?.plans?.length ? copy.pricing : null;
  const faq = copy.faq?.length ? copy.faq : null;
  return {
    proof,
    testimonials,
    pricing,
    faq,
    hasPlaceholderData: Boolean(proof || testimonials || pricing),
  };
}

/** The disclaimer for generated stats / clients / quotes / prices. */
export const SAMPLE_NOTE =
  "※ 実績数値・クライアント名・利用者の声・料金は自動生成された仮の内容（サンプル）です。正式な情報に差し替えてご利用ください。";
