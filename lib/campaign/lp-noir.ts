import type { BrandKit, CampaignBrandKit } from "./schema";
import { resolveTheme } from "./themes";
import {
  DEVICE_CSS,
  SAMPLE_NOTE,
  clientLogoHtml,
  deviceMockupHtml,
  esc,
  featureSvg,
  heroVisualHtml,
  logoLockupHtml,
  pad2,
  sectionData,
  statValueHtml,
} from "./lp-kit";

// LP template "noir" — the cinematic dark one, modeled on current US AI /
// robotics product pages: oversized gradient display type, English mono
// micro-labels layered over Japanese content, a bento capability grid, a
// CSS-only client-logo marquee, aurora glows and film grain on a near-black
// canvas, and scroll-driven reveals via animation-timeline.
//
// Design-first, by intent: noir ignores the captured typography and spacing
// tokens and ships its own typographic system (Inter + Noto Sans JP display
// weights, JetBrains Mono labels). The brand keeps the color axis — primary /
// accent tint the canvas, drive the glows, the CTA gradient and the
// highlighted plan — because that is what has to survive per-customer, while
// a scraped 14px body font is not worth inheriting.
//
// Constraints (see render-lp.ts): no <script>, shared device mockup as the
// hero visual, video slot markers left intact. Everything script-shaped here
// is CSS: the marquee is an animation, the reveals are animation-timeline
// behind @supports, so the page is complete and static without either.

export function renderNoirLandingPage(
  kit: BrandKit | CampaignBrandKit,
  opts: { videoEmbed?: string } = {}
): string {
  const { service, brand, copy } = kit;
  const ctaHref = service.url ? esc(service.url) : "#";
  const assets = "assets" in kit ? kit.assets : null;
  const screens = assets?.screens ?? { desktop: null, mobile: null };
  const logoHtml = logoLockupHtml(kit);
  const { proof, testimonials, pricing, faq, hasPlaceholderData } = sectionData(kit);

  // Numbered English micro-labels ("01 — Problem") over Japanese content.
  let sectionNo = 0;
  const eyebrow = (label: string) =>
    `<p class="eb">${pad2(++sectionNo)} — ${esc(label)}</p>`;

  const navLinks = [
    `<a href="#features">機能</a>`,
    `<a href="#how">使い方</a>`,
    pricing ? `<a href="#pricing">料金</a>` : "",
    faq ? `<a href="#faq">FAQ</a>` : "",
  ]
    .filter(Boolean)
    .join("\n      ");

  const clientLogos =
    proof?.client_names?.map((n, i) => clientLogoHtml(n, i)).join("\n        ") ?? "";

  // Bento spans over a 12-column grid; single column under 900px.
  const featureCount = copy.features.length;
  const spans = featureCount === 3 ? [7, 5, 12] : [7, 5, 5, 7, 12, 12, 12];
  const featureVisual = (i: number): string => {
    if (i === 0) return deviceMockupHtml("laptop", screens, service.name, true);
    if (i === featureCount - 1)
      return deviceMockupHtml("duo", screens, service.name, true);
    return featureSvg(i);
  };

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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --primary:${brand.primary};
  --accent:${brand.accent};
  --bg:color-mix(in srgb, ${brand.primary} 8%, #04050b);
  --text:#f4f6fb;
  --muted:rgba(228,232,244,.64);
  --line:rgba(255,255,255,.09);
  --card:rgba(255,255,255,.035);
  --mono:'JetBrains Mono','SF Mono',ui-monospace,monospace;
  /* the shared artwork in lp-kit.ts imitates a dark product UI */
  --screen-bg:#0a0c16;--screen-surface:rgba(255,255,255,.06);--screen-text:#eef1f8;--screen-line:rgba(255,255,255,.12);
  --art-bg:#0a0c16;--art-surface:rgba(255,255,255,.06);--art-ink:#eef1f8;--art-line:rgba(255,255,255,.16);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;color-scheme:dark}
body{background:var(--bg);color:var(--text);font-family:Inter,'Noto Sans JP',-apple-system,'Hiragino Sans','Segoe UI',sans-serif;line-height:1.8;-webkit-font-smoothing:antialiased;overflow-x:hidden}
/* film grain — fixed, click-through, blended over everything */
body::after{content:"";position:fixed;inset:0;z-index:90;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background:url('data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="180" height="180"%3E%3Cfilter id="n"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="180" height="180" filter="url(%23n)"/%3E%3C/svg%3E')}
h1,h2,h3{font-feature-settings:'palt' 1}
::selection{background:color-mix(in srgb,var(--primary) 55%,transparent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.wrap{max-width:1160px;margin:0 auto;padding:0 28px}
.eb{display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:.72rem;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:var(--muted)}
.eb::before{content:"";width:7px;height:7px;border-radius:2px;background:var(--accent);box-shadow:0 0 14px var(--accent);flex-shrink:0}
.sec-head{display:grid;gap:18px;max-width:760px;margin-bottom:52px}
.sec-head h2{font-size:clamp(1.9rem,4.2vw,2.9rem);font-weight:900;line-height:1.3;letter-spacing:.01em}
.sec-head .lead{color:var(--muted);font-size:1rem;max-width:56ch}
section{padding:96px 0;position:relative}
/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;padding:.85em 1.9em;border-radius:999px;font-weight:700;font-size:.95rem;text-decoration:none;color:#fff;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--accent) 62%,var(--primary)));box-shadow:inset 0 0 0 1px rgba(255,255,255,.16),0 12px 40px color-mix(in srgb,var(--primary) 42%,transparent);transition:transform .16s ease,box-shadow .16s ease}
.btn:hover{transform:translateY(-2px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 16px 52px color-mix(in srgb,var(--primary) 55%,transparent)}
.btn.ghost{background:rgba(255,255,255,.04);box-shadow:none;border:1px solid rgba(255,255,255,.16);color:var(--text)}
.btn.ghost:hover{background:rgba(255,255,255,.08)}
.btn.lite{background:#fff;color:#0b0d16;box-shadow:0 6px 24px rgba(255,255,255,.16)}
.btn.small{padding:.55em 1.35em;font-size:.85rem}
.btn .ar{font-family:var(--mono);transition:transform .16s ease}
.btn:hover .ar{transform:translateX(3px)}
/* floating pill nav */
.nav-shell{position:fixed;top:18px;left:0;right:0;z-index:60;display:flex;justify-content:center;padding:0 18px}
.nav{display:flex;align-items:center;gap:24px;width:100%;max-width:880px;padding:10px 10px 10px 24px;border-radius:999px;background:rgba(8,10,18,.55);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);box-shadow:0 12px 40px rgba(0,0,0,.4)}
.nav .logo{display:flex;align-items:center;margin-right:auto;font-weight:800;font-size:1.05rem;letter-spacing:.02em}
.nav .logo .dot{color:var(--accent)}
.nav-links{display:flex;gap:22px;font-size:.88rem}
.nav-links a{color:var(--muted);text-decoration:none;transition:color .15s ease}
.nav-links a:hover{color:#fff}
@media (max-width:760px){.nav-links{display:none}}
/* hero */
.hero{position:relative;padding:190px 0 80px;text-align:center;overflow:hidden}
.hero::before{content:"";position:absolute;inset:-22% -30% auto;height:125%;pointer-events:none;filter:saturate(1.15);background:radial-gradient(46% 42% at 50% 8%,color-mix(in srgb,var(--primary) 36%,transparent),transparent 70%),radial-gradient(32% 34% at 78% 22%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 70%),radial-gradient(30% 30% at 16% 30%,color-mix(in srgb,var(--accent) 13%,transparent),transparent 72%)}
.hero::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:72px 72px;-webkit-mask-image:radial-gradient(ellipse 85% 55% at 50% 0%,#000 25%,transparent 72%);mask-image:radial-gradient(ellipse 85% 55% at 50% 0%,#000 25%,transparent 72%)}
.hero .wrap{position:relative;z-index:1}
.hero-eb{display:inline-flex;align-items:center;gap:10px;padding:.5em 1.25em;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);font-size:.82rem;font-weight:500;color:rgba(255,255,255,.82)}
.hero-eb i{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.hero h1{margin:28px auto 0;max-width:17em;font-size:clamp(2.4rem,6.2vw,4.4rem);font-weight:900;line-height:1.14;letter-spacing:.005em;color:#fff;background:linear-gradient(180deg,#fff 34%,rgba(255,255,255,.52));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero .sub{margin:26px auto 0;max-width:600px;font-size:1.06rem;color:var(--muted)}
.hero .cta{margin-top:40px;display:flex;justify-content:center;align-items:center;gap:14px;flex-wrap:wrap}
/* hero device stage — glow behind, canvas fade over the bottom edge */
.hero-stage{position:relative;max-width:940px;margin:80px auto 0}
.hero-stage::before{content:"";position:absolute;inset:4% -16% -28%;pointer-events:none;background:radial-gradient(50% 55% at 50% 45%,color-mix(in srgb,var(--primary) 30%,transparent),transparent 72%)}
.hero-stage::after{content:"";position:absolute;left:-40px;right:-40px;bottom:-6px;height:150px;pointer-events:none;background:linear-gradient(180deg,transparent,var(--bg) 88%)}
.hero-model-stage{position:relative;width:100%;display:flex;align-items:center}
.hero-stage .device-mockup{filter:drop-shadow(0 50px 90px rgba(0,0,0,.55))}
/* stats — hairline columns, oversized figures */
.stats{display:grid;grid-template-columns:repeat(3,1fr);max-width:900px;margin:72px auto 0;text-align:left}
.stat{padding:6px 32px;border-left:1px solid var(--line)}
.stat:first-child{border-left:none}
.stat .v{display:flex;align-items:baseline;gap:.08em;font-size:clamp(2rem,3.6vw,3rem);font-weight:800;letter-spacing:-.03em;line-height:1.12;color:#fff}
.stat .v .n{font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1}
.stat .v .u{font-size:.42em;font-weight:600;color:var(--muted)}
.stat .l{margin-top:6px;font-size:.76rem;letter-spacing:.14em;color:var(--muted)}
/* client logo marquee */
.clients{padding:72px 0 24px;text-align:center}
.clients .cap{font-family:var(--mono);font-size:.68rem;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.42)}
.marquee{margin-top:30px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}
.mq-track{display:flex;width:max-content;animation:marq 36s linear infinite}
.mq-set{display:flex;align-items:center;gap:72px;padding-right:72px}
@keyframes marq{to{transform:translateX(-50%)}}
.cl{display:inline-flex;align-items:center;gap:11px;color:rgba(255,255,255,.8);font-size:1.05rem;white-space:nowrap}
.cl svg{width:19px;height:19px;flex-shrink:0;color:color-mix(in srgb,var(--accent) 62%,#fff)}
/* video */
.videosec{padding:24px 0}
.video-slot{max-width:880px;margin:40px auto;aspect-ratio:16/9;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#000;box-shadow:0 40px 100px rgba(0,0,0,.55),0 0 80px color-mix(in srgb,var(--primary) 20%,transparent)}
.video-slot video{width:100%;height:100%;object-fit:cover;display:block}
/* problem — numbered ledger rows */
.pains{border-top:1px solid var(--line)}
.pain{display:grid;grid-template-columns:72px 1fr;gap:20px;align-items:baseline;padding:24px 4px;border-bottom:1px solid var(--line);font-size:1.04rem}
.pain .idx{font-family:var(--mono);font-size:.78rem;letter-spacing:.1em;color:color-mix(in srgb,var(--accent) 75%,#fff)}
/* features — bento grid */
.bento{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.bcard{position:relative;display:flex;flex-direction:column;gap:12px;padding:32px 30px 26px;border-radius:22px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015) 55%);overflow:hidden}
.bcard::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 42% at 50% 0%,color-mix(in srgb,var(--primary) 10%,transparent),transparent 72%)}
.bcard .idx{font-family:var(--mono);font-size:.72rem;letter-spacing:.22em;color:color-mix(in srgb,var(--accent) 80%,#fff)}
.bcard h3{font-size:1.3rem;font-weight:800;line-height:1.35}
.bcard p{font-size:.95rem;color:var(--muted);max-width:52ch}
.bviz{margin-top:auto;padding-top:20px}
.bviz .device-mockup{max-width:430px;margin:0 auto}
.bviz .device-duo{min-height:240px}
.bviz svg{max-width:340px;margin:0 auto}
.sp5{grid-column:span 5}.sp7{grid-column:span 7}.sp12{grid-column:span 12}
@media (max-width:900px){.sp5,.sp7,.sp12{grid-column:span 12}}
/* how it works — outlined mono numerals */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:36px}
.step{padding:26px 26px 0 0;border-top:1px solid var(--line)}
.step .num{font-family:var(--mono);font-size:2.1rem;font-weight:600;line-height:1;letter-spacing:.04em;color:rgba(255,255,255,.3)}
@supports (-webkit-text-stroke:1px #fff){.step .num{color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.42)}}
.step h3{margin-top:14px;font-size:1.08rem;font-weight:700}
.step p{margin-top:8px;font-size:.92rem;color:var(--muted)}
/* testimonials */
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.quote{display:flex;flex-direction:column;gap:20px;padding:32px 30px;border-radius:22px;border:1px solid var(--line);background:var(--card)}
.quote .q{flex:1;font-size:1.02rem;line-height:1.9}
.quote .q::before{content:"“";display:block;font-size:2.6rem;font-weight:800;line-height:1;margin-bottom:10px;color:color-mix(in srgb,var(--accent) 70%,#fff)}
.person{display:flex;align-items:center;gap:12px}
.avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0}
.person .n{font-size:.9rem;font-weight:700;line-height:1.4}
.person .r{font-size:.78rem;color:var(--muted)}
/* pricing */
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;align-items:stretch}
.plan{position:relative;display:flex;flex-direction:column;padding:36px 32px;border-radius:24px;border:1px solid var(--line);background:var(--card)}
.plan.hot{border-color:color-mix(in srgb,var(--primary) 60%,rgba(255,255,255,.4));background:linear-gradient(180deg,color-mix(in srgb,var(--primary) 16%,rgba(255,255,255,.02)),rgba(255,255,255,.02) 60%);box-shadow:0 30px 80px color-mix(in srgb,var(--primary) 22%,transparent)}
.plan.hot::before{content:"RECOMMENDED";position:absolute;top:-11px;left:30px;padding:.34em 1.1em;border-radius:999px;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;font-family:var(--mono);font-size:.62rem;font-weight:600;letter-spacing:.22em}
.plan .pn{font-weight:700;font-size:.95rem;letter-spacing:.04em}
.plan .pp{margin-top:12px;font-size:2.3rem;font-weight:800;letter-spacing:-.03em;line-height:1.15}
.plan .pp small{font-size:.85rem;font-weight:500;letter-spacing:0;color:var(--muted)}
.plan .pd{margin-top:8px;font-size:.88rem;color:var(--muted);min-height:2.6em}
.plan ul{margin:22px 0 28px;list-style:none;display:grid;gap:11px;font-size:.9rem}
.plan li{display:flex;gap:10px;align-items:flex-start}
.plan li::before{content:"✓";font-weight:700;flex-shrink:0;color:color-mix(in srgb,var(--accent) 80%,#fff)}
.plan .btn{margin-top:auto}
/* faq — hairline ledger */
.faq-list{max-width:760px}
.faq-list details{border-top:1px solid var(--line)}
.faq-list details:last-child{border-bottom:1px solid var(--line)}
.faq-list summary{cursor:pointer;padding:22px 4px;font-weight:700;font-size:1rem;list-style:none;display:flex;justify-content:space-between;gap:18px;align-items:center}
.faq-list summary::-webkit-details-marker{display:none}
.faq-list summary::after{content:"+";font-family:var(--mono);font-size:1.2em;color:var(--muted);transition:transform .2s ease}
.faq-list details[open] summary::after{transform:rotate(45deg)}
.faq-list .a{padding:0 4px 22px;font-size:.94rem;color:var(--muted);max-width:60ch}
/* closing */
.closing{padding:140px 0 120px;text-align:center;overflow:hidden}
.closing::before{content:"";position:absolute;inset:auto 0 0;height:120%;pointer-events:none;background:radial-gradient(55% 65% at 50% 118%,color-mix(in srgb,var(--primary) 34%,transparent),transparent 72%)}
.closing::after{content:"";position:absolute;left:12%;right:12%;bottom:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent) 80%,#fff),transparent);opacity:.5}
.closing .wrap{position:relative}
.closing h2{margin:0 auto;max-width:18em;font-size:clamp(2.1rem,5.4vw,3.6rem);font-weight:900;line-height:1.22;color:#fff;background:linear-gradient(180deg,#fff 30%,rgba(255,255,255,.5));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.closing p{margin:22px auto 42px;max-width:560px;color:var(--muted)}
.sample-note{padding:26px 16px 0;text-align:center;font-size:.75rem;color:rgba(255,255,255,.35)}
footer{margin-top:56px;padding:44px 0;border-top:1px solid var(--line)}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;font-size:.74rem;color:rgba(255,255,255,.42)}
/* No text-transform here: the service name may embed Latin inside Japanese
   ("会計SaaS"), and uppercasing turns that into "会計SAAS". */
footer .mono{font-family:var(--mono);letter-spacing:.14em}
${DEVICE_CSS}
/* scroll-driven reveal — progressive enhancement, static otherwise */
@supports (animation-timeline: view()){
  .rev{animation:rise both;animation-timeline:view();animation-range:entry 0% entry 55%}
  @keyframes rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
}
@media (prefers-reduced-motion: reduce){
  .mq-track,.hero-eb i{animation:none}
  @supports (animation-timeline: view()){.rev{animation:none}}
}
/* Printing has no scroll, so a view() timeline never advances and every
   below-the-fold reveal would come out blank. */
@media print{.rev{animation:none !important;opacity:1 !important;transform:none !important}}
@media (max-width:640px){
  section{padding:68px 0}
  .hero{padding:150px 0 56px}
  .stats{grid-template-columns:1fr;gap:0;margin-top:52px}
  .stat{border-left:none;border-top:1px solid var(--line);padding:18px 6px}
  .stat:first-child{border-top:none}
  .closing{padding:100px 0 88px}
}
</style>
</head>
<body>
<div class="nav-shell">
  <nav class="nav">
    <div class="logo">${logoHtml}</div>
    <div class="nav-links" aria-label="ページ内">
      ${navLinks}
    </div>
    <a class="btn lite small" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
  </nav>
</div>

<main>
  <div class="hero">
    <div class="wrap">
      <p class="hero-eb"><i></i>${esc(service.tagline)}</p>
      <h1>${esc(copy.hero.headline)}</h1>
      <p class="sub">${esc(copy.hero.subheadline)}</p>
      <div class="cta">
        <a class="btn" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
        <a class="btn ghost" href="#features">機能を見る<span class="ar">→</span></a>
      </div>
      <div class="hero-stage">${heroVisualHtml(screens, service.name)}</div>
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
    clientLogos
      ? `<div class="clients">
    <p class="cap">Trusted by forward-thinking teams</p>
    <div class="marquee">
      <div class="mq-track">
        <div class="mq-set">
        ${clientLogos}
        </div>
        <div class="mq-set" aria-hidden="true">
        ${clientLogos}
        </div>
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
    <div class="wrap">
      <div class="sec-head rev">
        ${eyebrow("Problem")}
        <h2>${esc(copy.problem.headline)}</h2>
      </div>
      <div class="pains">
        ${copy.problem.points
          .map(
            (p, i) => `<div class="pain rev"><span class="idx">${pad2(i + 1)}</span><p>${esc(p)}</p></div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section id="features">
    <div class="wrap">
      <div class="sec-head rev">
        ${eyebrow("Capabilities")}
        <h2>${esc(service.name)} ができること</h2>
        <p class="lead">${esc(service.offering)}</p>
      </div>
      <div class="bento">
        ${copy.features
          .map(
            (f, i) => `<div class="bcard sp${spans[i] ?? 12} rev">
          <p class="idx">${pad2(i + 1)}</p>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.description)}</p>
          <div class="bviz">${featureVisual(i)}</div>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section id="how">
    <div class="wrap">
      <div class="sec-head rev">
        ${eyebrow("How it works")}
        <h2>${esc(copy.how_it_works.headline)}</h2>
      </div>
      <div class="steps">
        ${copy.how_it_works.steps
          .map(
            (s, i) => `<div class="step rev">
          <p class="num">${pad2(i + 1)}</p>
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
    <div class="wrap">
      <div class="sec-head rev">
        ${eyebrow("Voices")}
        <h2>利用者の声</h2>
      </div>
      <div class="quotes">
        ${testimonials
          .map(
            (t) => `<div class="quote rev">
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
      ? `<section id="pricing">
    <div class="wrap">
      <div class="sec-head rev">
        ${eyebrow("Pricing")}
        <h2>${esc(pricing.headline)}</h2>
      </div>
      <div class="plans">
        ${pricing.plans
          .map(
            (p) => `<div class="plan${p.highlighted ? " hot" : ""} rev">
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
    <div class="wrap">
      <div class="sec-head rev">
        ${eyebrow("FAQ")}
        <h2>よくある質問</h2>
      </div>
      <div class="faq-list">
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
      <a class="btn" href="${ctaHref}">${esc(copy.closing.cta_label)}</a>
    </div>
  </section>
</main>

${hasPlaceholderData ? `<p class="sample-note">${SAMPLE_NOTE}</p>` : ""}
<footer>
  <div class="wrap">
    <span class="mono">© ${new Date().getFullYear()} ${esc(service.name)}</span>
    <span>${esc(service.industry ?? "")}</span>
  </div>
</footer>
</body>
</html>
`;
}
