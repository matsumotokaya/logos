import type { BrandKit, CampaignBrandKit } from "./schema";
import { hexToRgb, luminance, rgbToHex } from "../color";
import { resolveTheme } from "./themes";
import {
  DEVICE_CSS,
  SAMPLE_NOTE,
  clientLogoHtml,
  deviceMockupHtml,
  esc,
  heroVisualHtml,
  logoLockupHtml,
  pad2,
  sectionData,
  statValueHtml,
} from "./lp-kit";

// LP template "editorial" — the quiet one. A printed art book rather than a
// product page: ink-black paper, a single metallic accent, Cormorant /
// Shippori Mincho display type set very large and very light, hairline rules,
// hanging Latin numerals, and no rounded corners or glows anywhere. Space is
// the main material; sections are asymmetric two-column spreads with wide
// margins instead of centered stacks.
//
// This is the template for businesses whose value is taste — galleries and
// studios, hotels and restaurants at the top of the market, jewellery,
// couture, spirits. The brand's accent replaces the default gold, so the
// metal changes per customer while the composition holds.
//
// The device mockup still appears (it is the one honest picture of the
// product) but is treated as a plate: no drop shadow theatrics, sitting in
// its own ruled frame.
//
// Constraints (see render-lp.ts): no <script>, shared device mockup as the
// hero visual, video slot markers left intact.

const LEAF = { r: 242, g: 230, b: 200 };

/**
 * The brand accent, lifted toward warm leaf until it reads as a highlight on
 * the ink field. Hue is preserved, so a violet brand gets violet-gold rather
 * than the same gold as everyone else — but a dark, saturated accent (very
 * common) is unreadable as hairline-spaced small caps on near-black, and
 * unreadable again as the CTA's own label, so it cannot be used raw.
 */
function metalFrom(hex: string): string {
  const base = hexToRgb(hex);
  let out = hex;
  for (let t = 0; t <= 0.9; t += 0.05) {
    out = rgbToHex({
      r: Math.round(base.r + (LEAF.r - base.r) * t),
      g: Math.round(base.g + (LEAF.g - base.g) * t),
      b: Math.round(base.b + (LEAF.b - base.b) * t),
    });
    if (luminance(out) >= 0.42) break;
  }
  return out;
}

export function renderEditorialLandingPage(
  kit: BrandKit | CampaignBrandKit,
  opts: { videoEmbed?: string } = {}
): string {
  const { service, brand, copy } = kit;
  const ctaHref = service.url ? esc(service.url) : "#";
  const assets = "assets" in kit ? kit.assets : null;
  const screens = assets?.screens ?? { desktop: null, mobile: null };
  const logoHtml = logoLockupHtml(kit, { height: 26 });
  const { proof, testimonials, pricing, faq, hasPlaceholderData } = sectionData(kit);

  const navLinks = [
    `<a href="#features">特長</a>`,
    `<a href="#how">流れ</a>`,
    pricing ? `<a href="#pricing">料金</a>` : "",
    faq ? `<a href="#faq">FAQ</a>` : "",
  ]
    .filter(Boolean)
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="ja" data-campaign-theme="${resolveTheme(kit).id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(service.name)} — ${esc(service.tagline)}</title>
<meta name="description" content="${esc(service.description)}">
<meta name="theme-color" content="${brand.primary}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300&family=Shippori+Mincho:wght@400;500;600&family=Inter:wght@300;400;500&display=swap">
<style>
:root{
  --primary:${brand.primary};
  /* The accent, lifted to a metallic value that survives on ink (metalFrom). */
  --metal:${metalFrom(brand.accent)};
  --ink:#0a0908;
  --paper:#f4f1ea;
  --text:#ece8e0;
  --muted:rgba(236,232,224,.6);
  --line:rgba(236,232,224,.16);
  --serif:'Cormorant Garamond','Shippori Mincho','Hiragino Mincho ProN','Noto Serif JP',Georgia,serif;
  --sans:Inter,'Shippori Mincho','Hiragino Sans','Noto Sans JP',sans-serif;
  /* the shared artwork in lp-kit.ts imitates a dark product UI */
  --screen-bg:#131110;--screen-surface:rgba(255,255,255,.05);--screen-text:#ece8e0;--screen-line:rgba(236,232,224,.14);
  --art-bg:#131110;--art-surface:rgba(255,255,255,.05);--art-ink:#ece8e0;--art-line:rgba(236,232,224,.18);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;color-scheme:dark}
body{background:var(--ink);color:var(--text);font-family:var(--sans);font-weight:300;line-height:2;-webkit-font-smoothing:antialiased;overflow-x:hidden}
/* paper tooth — a very fine noise so the ink field is not a flat fill */
body::after{content:"";position:fixed;inset:0;z-index:90;pointer-events:none;opacity:.035;background:url('data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Cfilter id="n"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="200" height="200" filter="url(%23n)"/%3E%3C/svg%3E')}
/* Lining figures in headings: Cormorant defaults to old-style, which turns a
   "1" inside Japanese copy into what reads as a Roman numeral I. */
h1,h2,h3{font-family:var(--serif);font-weight:300;font-feature-settings:'palt' 1;font-variant-numeric:lining-nums}
::selection{background:color-mix(in srgb,var(--metal) 40%,transparent)}
a:focus-visible{outline:1px solid var(--metal);outline-offset:4px}
.wrap{max-width:1180px;margin:0 auto;padding:0 40px}
@media (max-width:640px){.wrap{padding:0 24px}}
section{padding:116px 0;position:relative}
/* One display size for every section title, whichever layout holds it. */
section h2{font-size:clamp(2rem,4.2vw,3.1rem);line-height:1.26;letter-spacing:.01em}
/* Latin small-caps eyebrow with a hairline rule running off to the right */
.eb{display:flex;align-items:center;gap:20px;font-size:.68rem;font-weight:400;letter-spacing:.42em;text-transform:uppercase;color:var(--metal)}
.eb::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--metal) 50%,transparent),transparent)}
/* the asymmetric spread: title left, body right. Equal columns — a narrower
   title column broke Japanese headlines into one- and two-character orphan
   lines, which no amount of tracking rescues. */
.spread{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px;align-items:start}
@media (max-width:900px){.spread{grid-template-columns:1fr;gap:32px}}
.spread h2,.head h2{margin-top:26px}
.spread .lead{color:var(--muted);font-size:.98rem;max-width:52ch}
/* Sections whose header has no facing column let the title run wider.
   In px, not ch: a ch unit resolves against this block's own body font, not
   the display h2 inside it, so a ch cap here silently squeezed the headline
   into two- and three-character lines. */
.head{max-width:680px;margin-bottom:52px}
/* rules */
.rule{height:1px;background:var(--line)}
/* buttons — outlined metal, no fill, no radius */
.btn{display:inline-flex;align-items:center;gap:1em;padding:1.05em 2.4em;border:1px solid var(--metal);color:var(--metal);text-decoration:none;font-family:var(--sans);font-size:.78rem;font-weight:400;letter-spacing:.26em;text-transform:uppercase;background:transparent;transition:background .25s ease,color .25s ease}
.btn:hover{background:var(--metal);color:var(--ink)}
.btn.small{padding:.7em 1.5em;font-size:.68rem;letter-spacing:.2em}
.btn.solid{background:var(--metal);color:var(--ink)}
.btn.solid:hover{background:transparent;color:var(--metal)}
/* nav */
header{position:absolute;top:0;left:0;right:0;z-index:50}
.nav{display:flex;align-items:center;gap:32px;height:96px}
.nav .logo{display:flex;align-items:center;margin-right:auto;font-family:var(--serif);font-size:1.35rem;font-weight:400;letter-spacing:.16em}
.nav .logo .dot{color:var(--metal)}
.nav-links{display:flex;gap:34px;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase}
.nav-links a{color:var(--muted);text-decoration:none;transition:color .2s ease}
.nav-links a:hover{color:var(--metal)}
@media (max-width:860px){.nav-links{display:none}}
/* hero — the title plate */
.hero{position:relative;padding:196px 0 0;overflow:hidden}
.hero::before{content:"";position:absolute;inset:-10% -20% auto;height:90%;pointer-events:none;background:radial-gradient(42% 46% at 68% 10%,color-mix(in srgb,var(--metal) 9%,transparent),transparent 72%),radial-gradient(40% 40% at 10% 30%,color-mix(in srgb,var(--primary) 12%,transparent),transparent 72%)}
.hero .wrap{position:relative}
.hero .kicker{font-size:.7rem;letter-spacing:.44em;text-transform:uppercase;color:var(--metal)}
.hero h1{margin-top:34px;max-width:15em;font-size:clamp(2.7rem,7vw,5.4rem);line-height:1.1;letter-spacing:.012em}
.hero h1 em{font-style:italic;color:var(--metal)}
.hero .sub{margin-top:32px;max-width:42ch;font-size:1rem;color:var(--muted)}
.hero .cta{margin-top:48px;display:flex;gap:18px;flex-wrap:wrap;align-items:center}
/* the plate: device inside a ruled frame, bled to the page edge */
.plate{margin-top:104px;padding:44px 44px 38px;border-top:1px solid var(--line);border-left:1px solid var(--line);border-right:1px solid var(--line);position:relative}
.plate::before{content:"PLATE 01";position:absolute;top:-9px;left:44px;padding:0 14px;background:var(--ink);font-size:.6rem;letter-spacing:.34em;color:var(--metal)}
.hero-model-stage{position:relative;width:100%;display:flex;align-items:center}
@media (max-width:640px){.plate{padding:32px 20px 26px}.plate::before{left:20px}}
/* stats — hanging serif figures */
.stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);margin-top:0}
.stat{padding:38px 40px 42px;border-left:1px solid var(--line)}
.stat:first-child{border-left:none;padding-left:0}
.stat .v{display:flex;align-items:baseline;gap:.1em;font-family:var(--serif);font-size:clamp(2.4rem,4.4vw,3.6rem);font-weight:300;line-height:1;color:var(--metal)}
.stat .v .n{font-variant-numeric:lining-nums}
.stat .v .u{font-size:.36em;letter-spacing:.06em;color:var(--muted)}
.stat .l{margin-top:14px;font-size:.7rem;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
/* clients */
.clients{padding:88px 0;text-align:center;border-top:1px solid var(--line)}
.clients .cap{font-size:.64rem;letter-spacing:.42em;text-transform:uppercase;color:var(--muted)}
.client-row{margin-top:38px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:26px 64px}
.cl{display:inline-flex;align-items:center;gap:12px;color:rgba(236,232,224,.74);font-size:1rem;white-space:nowrap}
.cl svg{width:17px;height:17px;flex-shrink:0;color:var(--metal)}
/* video */
.videosec{padding:0}
.video-slot{margin:120px auto 0;max-width:960px;aspect-ratio:16/9;overflow:hidden;border:1px solid var(--line);background:#000}
.video-slot video{width:100%;height:100%;object-fit:cover;display:block}
/* problem — hanging numerals over rules */
.pains{margin-top:8px}
.pain{display:grid;grid-template-columns:88px 1fr;gap:24px;align-items:baseline;padding:30px 0;border-bottom:1px solid var(--line);font-size:1.02rem;line-height:1.9}
.pain:first-child{border-top:1px solid var(--line)}
/* Ordinals take lining figures: Cormorant's old-style zero reads as a
   lowercase "o", so "02" looks like a typo rather than like style. Prices keep
   the old-style default, where it reads as typography. */
.pain .idx{font-family:var(--serif);font-size:1.3rem;font-variant-numeric:lining-nums;color:var(--metal)}
/* features — alternating full-bleed spreads */
.feature{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;padding:62px 0;border-top:1px solid var(--line)}
.feature:nth-child(even) .f-viz{order:-1}
@media (max-width:900px){.feature{grid-template-columns:1fr;gap:32px;padding:44px 0}.feature:nth-child(even) .f-viz{order:0}}
/* Lining figures, set large enough to read: Cormorant's small tracked-out
   digits turn "01" into "OI" at body size. */
.feature .idx{font-family:var(--serif);font-size:1.5rem;letter-spacing:.14em;font-variant-numeric:lining-nums;color:var(--metal)}
.feature h3{margin-top:16px;font-size:clamp(1.5rem,2.8vw,2.1rem);line-height:1.36}
.feature p{margin-top:16px;font-size:.96rem;color:var(--muted);max-width:46ch}
.f-viz{padding:30px;border:1px solid var(--line)}
.f-viz .device-mockup{max-width:400px;margin:0 auto}
.f-viz .device-duo{min-height:230px}
/* how it works — a ruled index */
.steps{margin-top:8px}
.step{display:grid;grid-template-columns:88px 1fr;gap:24px;align-items:baseline;padding:34px 0;border-bottom:1px solid var(--line)}
.step:first-child{border-top:1px solid var(--line)}
.step .num{font-family:var(--serif);font-size:1.5rem;font-variant-numeric:lining-nums;color:var(--metal)}
.step h3{font-size:1.2rem;line-height:1.5}
.step p{margin-top:8px;font-size:.94rem;color:var(--muted);max-width:56ch}
/* testimonials — set as pull quotes, not cards */
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:56px;margin-top:8px}
.quote{border-top:1px solid var(--line);padding-top:34px}
.quote .q{font-family:var(--serif);font-size:1.32rem;font-style:italic;font-weight:300;line-height:1.7}
.person{margin-top:26px;font-size:.78rem;letter-spacing:.04em;color:var(--muted)}
.person .n{color:var(--text)}
/* pricing — ledger columns, the recommended one on paper */
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0;align-items:stretch;border-top:1px solid var(--line)}
.plan{display:flex;flex-direction:column;padding:46px 38px;border-left:1px solid var(--line);position:relative}
.plan:first-child{border-left:none;padding-left:0}
.plan.hot{background:var(--paper);color:var(--ink);border-left-color:var(--paper);padding-left:38px}
.plan.hot::before{content:"RECOMMENDED";position:absolute;top:20px;right:38px;font-size:.58rem;letter-spacing:.28em;color:color-mix(in srgb,var(--metal) 70%,var(--ink))}
.plan .pn{font-size:.72rem;letter-spacing:.32em;text-transform:uppercase;color:var(--metal)}
.plan.hot .pn{color:color-mix(in srgb,var(--metal) 68%,var(--ink))}
.plan .pp{margin-top:22px;font-family:var(--serif);font-size:2.6rem;font-weight:300;line-height:1.1}
.plan .pp small{font-family:var(--sans);font-size:.8rem;letter-spacing:.06em;color:var(--muted)}
.plan.hot .pp small,.plan.hot .pd{color:rgba(10,9,8,.6)}
.plan .pd{margin-top:14px;font-size:.88rem;color:var(--muted);min-height:3.4em;line-height:1.8}
.plan ul{margin:26px 0 34px;list-style:none;display:grid;gap:14px;font-size:.9rem;line-height:1.7}
.plan li{display:grid;grid-template-columns:18px 1fr;gap:10px;align-items:baseline}
.plan li::before{content:"—";color:var(--metal)}
.plan.hot li::before{color:color-mix(in srgb,var(--metal) 62%,var(--ink))}
.plan .btn{margin-top:auto;justify-content:center}
.plan.hot .btn{border-color:var(--ink);color:var(--ink)}
.plan.hot .btn:hover{background:var(--ink);color:var(--paper)}
@media (max-width:820px){.plan,.plan:first-child{border-left:none;border-top:1px solid var(--line);padding:36px 0}.plan.hot{padding:36px 28px}}
/* faq */
.faq-list{margin-top:8px}
.faq-list details{border-bottom:1px solid var(--line)}
.faq-list details:first-child{border-top:1px solid var(--line)}
.faq-list summary{cursor:pointer;padding:28px 0;font-family:var(--serif);font-size:1.2rem;list-style:none;display:flex;justify-content:space-between;gap:24px;align-items:baseline}
.faq-list summary::-webkit-details-marker{display:none}
.faq-list summary::after{content:"＋";font-family:var(--sans);font-size:.8em;color:var(--metal);transition:transform .25s ease}
.faq-list details[open] summary::after{transform:rotate(45deg)}
.faq-list .a{padding:0 0 30px;font-size:.94rem;color:var(--muted);max-width:60ch}
/* closing */
.closing{padding:170px 0 150px;text-align:center;border-top:1px solid var(--line)}
.closing::before{content:"";position:absolute;inset:auto 0 0;height:100%;pointer-events:none;background:radial-gradient(40% 60% at 50% 110%,color-mix(in srgb,var(--metal) 12%,transparent),transparent 72%)}
.closing .wrap{position:relative}
.closing h2{margin:0 auto;max-width:16em;font-size:clamp(2.3rem,5.6vw,4rem);line-height:1.2}
.closing p{margin:28px auto 48px;max-width:46ch;color:var(--muted);font-size:.98rem}
.sample-note{padding:30px 24px 0;text-align:center;font-size:.72rem;color:rgba(236,232,224,.34);line-height:1.9}
footer{margin-top:70px;padding:44px 0;border-top:1px solid var(--line)}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;font-size:.68rem;letter-spacing:.2em;color:rgba(236,232,224,.44)}
${DEVICE_CSS}
/* Art direction over the shared mockup: the stock silver laptop base is a
   bright bar across the ink field and steals the page. Space-black hardware,
   no drop shadow — the device is a plate, not a product shot. */
.device-mockup{filter:none}
.device-laptop-base{background:linear-gradient(180deg,#43423f,#22211f 68%,#141312);box-shadow:0 8px 18px rgba(0,0,0,.5)}
.device-laptop-base::before{border-top-color:rgba(255,255,255,.2)}
.device-laptop-base span{background:#2c2b28}
.device-laptop-lid{background:#181715}
.device-phone-shell{background:#141311}
@supports (animation-timeline: view()){
  .rev{animation:fade both;animation-timeline:view();animation-range:entry 0% entry 60%}
  @keyframes fade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
}
@media (prefers-reduced-motion: reduce){
  @supports (animation-timeline: view()){.rev{animation:none}}
}
/* Printing has no scroll, so a view() timeline never advances and every
   below-the-fold reveal would come out blank. */
@media print{.rev{animation:none !important;opacity:1 !important;transform:none !important}}
@media (max-width:640px){
  section{padding:84px 0}
  .hero{padding:150px 0 0}
  .plate{margin-top:64px}
  .stats{grid-template-columns:1fr}
  .stat{border-left:none;border-top:1px solid var(--line);padding:26px 0 28px}
  .stat:first-child{border-top:none}
  .pain,.step{grid-template-columns:52px 1fr;gap:16px}
  .closing{padding:110px 0 96px}
}
</style>
</head>
<body>
<header>
  <div class="wrap nav">
    <div class="logo">${logoHtml}</div>
    <nav class="nav-links" aria-label="ページ内">
      ${navLinks}
    </nav>
    <a class="btn small" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
  </div>
</header>

<main>
  <div class="hero">
    <div class="wrap">
      <p class="kicker">${esc(service.tagline)}</p>
      <h1>${esc(copy.hero.headline)}</h1>
      <p class="sub">${esc(copy.hero.subheadline)}</p>
      <div class="cta">
        <a class="btn solid" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
        <a class="btn" href="#features">特長を見る</a>
      </div>
      <div class="plate">${heroVisualHtml(screens, service.name)}</div>
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
    <div class="wrap">
      <p class="cap">Selected clients</p>
      <div class="client-row">
        ${proof.client_names.map((n, i) => clientLogoHtml(n, i)).join("\n        ")}
      </div>
    </div>
  </div>`
      : ""
  }

  <section class="videosec">
    <div class="wrap">
      <!--cm-video-slot-->${
        opts.videoEmbed ? `<div class="video-slot">${opts.videoEmbed}</div>` : ""
      }<!--/cm-video-slot-->
    </div>
  </section>

  <section>
    <div class="wrap spread">
      <div class="rev">
        <p class="eb">Problem</p>
        <h2>${esc(copy.problem.headline)}</h2>
      </div>
      <div class="pains rev">
        ${copy.problem.points
          .map(
            (p, i) => `<div class="pain"><span class="idx">${pad2(i + 1)}</span><p>${esc(p)}</p></div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section id="features">
    <div class="wrap">
      <div class="spread rev" style="margin-bottom:54px">
        <div>
          <p class="eb">Craft</p>
          <h2>${esc(service.name)} の特長</h2>
        </div>
        <p class="lead" style="padding-top:40px">${esc(service.offering)}</p>
      </div>
      ${copy.features
        .map(
          (f, i) => `<div class="feature rev">
        <div>
          <p class="idx">${pad2(i + 1)}</p>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.description)}</p>
        </div>
        <div class="f-viz">${
          i % 2 === 0
            ? deviceMockupHtml("laptop", screens, service.name, true)
            : deviceMockupHtml("duo", screens, service.name, true)
        }</div>
      </div>`
        )
        .join("\n      ")}
    </div>
  </section>

  <section id="how">
    <div class="wrap spread">
      <div class="rev">
        <p class="eb">Process</p>
        <h2>${esc(copy.how_it_works.headline)}</h2>
      </div>
      <div class="steps rev">
        ${copy.how_it_works.steps
          .map(
            (s, i) => `<div class="step">
          <span class="num">${pad2(i + 1)}</span>
          <div>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.description)}</p>
          </div>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  ${
    testimonials
      ? `<section>
    <div class="wrap">
      <div class="head rev">
        <p class="eb">Voices</p>
        <h2>お客さまの声</h2>
      </div>
      <div class="quotes rev">
        ${testimonials
          .map(
            (t) => `<div class="quote">
          <p class="q">${esc(t.quote)}</p>
          <p class="person"><span class="n">${esc(t.name)}</span> — ${esc(t.role)}</p>
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
      ? `<section id="pricing">
    <div class="wrap">
      <div class="head rev">
        <p class="eb">Pricing</p>
        <h2>${esc(pricing.headline)}</h2>
      </div>
      <div class="plans rev">
        ${pricing.plans
          .map(
            (p) => `<div class="plan${p.highlighted ? " hot" : ""}">
          <p class="pn">${esc(p.name)}</p>
          <p class="pp">${esc(p.price)}${p.period ? `<small>${esc(p.period)}</small>` : ""}</p>
          <p class="pd">${esc(p.description)}</p>
          <ul>
            ${p.features.map((f) => `<li><span>${esc(f)}</span></li>`).join("\n            ")}
          </ul>
          <a class="btn" href="${ctaHref}">${esc(p.cta_label)}</a>
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
    <div class="wrap spread">
      <div class="rev">
        <p class="eb">Questions</p>
        <h2>よくある質問</h2>
      </div>
      <div class="faq-list rev">
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
    <div class="wrap">
      <h2>${esc(copy.closing.headline)}</h2>
      <p>${esc(copy.closing.subtext)}</p>
      <a class="btn solid" href="${ctaHref}">${esc(copy.closing.cta_label)}</a>
    </div>
  </section>
</main>

${hasPlaceholderData ? `<p class="sample-note">${SAMPLE_NOTE}</p>` : ""}
<footer>
  <div class="wrap">
    <span>© ${new Date().getFullYear()} ${esc(service.name)}</span>
    <span>${esc(service.industry ?? "")}</span>
  </div>
</footer>
</body>
</html>
`;
}
