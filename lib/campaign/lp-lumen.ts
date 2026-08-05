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

// LP template "lumen" — the bright one. Where noir is a dark cinematic stage,
// lumen is the daylight equivalent of the same ambition: near-white canvas,
// a single soft brand-tinted mesh behind the hero, very large tight-tracked
// headlines, hairline rules instead of boxes, and one inverted near-black
// band (pricing highlight + closing) so the page lands on contrast rather
// than fading out.
//
// This is the template for services that must read as trustworthy rather
// than futuristic — B2B tools, finance, healthcare. It is deliberately not a
// light reskin of noir: hero is asymmetric left-aligned rather than centered,
// capabilities are a rule-separated editorial grid rather than a bento, and
// the steps run on a single horizontal spine.
//
// Constraints (see render-lp.ts): no <script>, shared device mockup as the
// hero visual, video slot markers left intact.

export function renderLumenLandingPage(
  kit: BrandKit | CampaignBrandKit,
  opts: { videoEmbed?: string } = {}
): string {
  const { service, brand, copy } = kit;
  const ctaHref = service.url ? esc(service.url) : "#";
  const assets = "assets" in kit ? kit.assets : null;
  const screens = assets?.screens ?? { desktop: null, mobile: null };
  const logoHtml = logoLockupHtml(kit, { height: 26 });
  const { proof, testimonials, pricing, faq, hasPlaceholderData } = sectionData(kit);

  let sectionNo = 0;
  const eyebrow = (label: string) =>
    `<p class="eb">${pad2(++sectionNo)} / ${esc(label)}</p>`;

  const navLinks = [
    `<a href="#features">機能</a>`,
    `<a href="#how">使い方</a>`,
    pricing ? `<a href="#pricing">料金</a>` : "",
    faq ? `<a href="#faq">FAQ</a>` : "",
  ]
    .filter(Boolean)
    .join("\n      ");

  const featureVisual = (i: number): string =>
    i === 0
      ? deviceMockupHtml("laptop", screens, service.name, true)
      : i === 1
        ? deviceMockupHtml("mobile", screens, service.name, true)
        : featureSvg(i);

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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{
  --primary:${brand.primary};
  --accent:${brand.accent};
  --ink:#0b0d14;
  --bg:#ffffff;
  --tint:color-mix(in srgb, ${brand.primary} 4%, #fbfbfd);
  --muted:#5d6473;
  --line:color-mix(in srgb, ${brand.primary} 12%, #e3e5ec);
  --mono:'JetBrains Mono','SF Mono',ui-monospace,monospace;
  /* the shared artwork in lp-kit.ts imitates a light product UI */
  --screen-bg:#ffffff;--screen-surface:#f4f5f9;--screen-text:#0b0d14;--screen-line:#e3e5ec;
  --art-bg:#ffffff;--art-surface:#f4f5f9;--art-ink:#0b0d14;--art-line:#dcdfe8;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;color-scheme:light}
body{background:var(--bg);color:var(--ink);font-family:Inter,'Noto Sans JP',-apple-system,'Hiragino Sans','Segoe UI',sans-serif;line-height:1.8;-webkit-font-smoothing:antialiased;overflow-x:hidden}
h1,h2,h3{font-feature-settings:'palt' 1;letter-spacing:-.005em}
::selection{background:color-mix(in srgb,var(--primary) 22%,transparent)}
a:focus-visible{outline:2px solid var(--primary);outline-offset:3px;border-radius:4px}
.wrap{max-width:1140px;margin:0 auto;padding:0 28px}
section{padding:104px 0;position:relative}
.eb{font-family:var(--mono);font-size:.72rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--primary)}
.sec-head{display:grid;gap:16px;max-width:720px;margin-bottom:52px}
.sec-head h2{font-size:clamp(1.85rem,4vw,2.7rem);font-weight:800;line-height:1.32}
.sec-head .lead{color:var(--muted);font-size:1rem;max-width:56ch}
/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;padding:.85em 1.9em;border-radius:10px;font-weight:700;font-size:.95rem;text-decoration:none;color:#fff;background:var(--ink);box-shadow:0 1px 2px rgba(11,13,20,.16),0 10px 28px rgba(11,13,20,.14);transition:transform .16s ease,box-shadow .16s ease}
.btn:hover{transform:translateY(-2px);box-shadow:0 1px 2px rgba(11,13,20,.2),0 16px 36px rgba(11,13,20,.2)}
.btn.brand{background:var(--primary);box-shadow:0 1px 2px color-mix(in srgb,var(--primary) 40%,transparent),0 12px 32px color-mix(in srgb,var(--primary) 34%,transparent)}
.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line);box-shadow:none}
.btn.ghost:hover{background:var(--tint)}
.btn.small{padding:.55em 1.3em;font-size:.85rem;border-radius:8px}
.btn .ar{font-family:var(--mono);transition:transform .16s ease}
.btn:hover .ar{transform:translateX(3px)}
/* nav */
header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;gap:26px;height:68px}
.nav .logo{display:flex;align-items:center;margin-right:auto;font-weight:800;font-size:1.1rem;letter-spacing:-.01em}
.nav .logo .dot{color:var(--primary)}
.nav-links{display:flex;gap:26px;font-size:.9rem}
.nav-links a{color:var(--muted);text-decoration:none;transition:color .15s ease}
.nav-links a:hover{color:var(--ink)}
@media (max-width:820px){.nav-links{display:none}}
/* hero — asymmetric, copy left, device right */
.hero{position:relative;padding:96px 0 0;overflow:hidden;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--tint),#fff 72%)}
.hero::before{content:"";position:absolute;inset:-30% -10% auto;height:110%;pointer-events:none;background:radial-gradient(38% 44% at 76% 18%,color-mix(in srgb,var(--primary) 16%,transparent),transparent 70%),radial-gradient(34% 40% at 12% 4%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 70%)}
.hero .wrap{position:relative}
.hero-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:56px;align-items:center}
@media (max-width:940px){.hero-grid{grid-template-columns:1fr;gap:44px}}
.hero-eb{display:inline-flex;align-items:center;gap:9px;padding:.42em 1em;border-radius:999px;border:1px solid var(--line);background:#fff;font-size:.8rem;font-weight:600;color:var(--muted);box-shadow:0 1px 2px rgba(11,13,20,.04)}
.hero-eb i{width:6px;height:6px;border-radius:50%;background:var(--primary);flex-shrink:0}
.hero h1{margin-top:24px;font-size:clamp(2.3rem,5.2vw,3.9rem);font-weight:800;line-height:1.18;letter-spacing:-.02em}
.hero .sub{margin-top:22px;max-width:30em;font-size:1.06rem;color:var(--muted)}
.hero .cta{margin-top:34px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.hero .note{margin-top:16px;font-size:.8rem;color:var(--muted)}
.hero-model-stage{position:relative;width:100%;display:flex;align-items:center}
.hero-visual .device-mockup{filter:drop-shadow(0 30px 60px rgba(11,13,20,.18))}
/* stats — hairline row riding the hero's bottom edge */
.stats{display:grid;grid-template-columns:repeat(3,1fr);margin-top:78px;border-top:1px solid var(--line)}
.stat{padding:28px 30px 34px;border-left:1px solid var(--line)}
.stat:first-child{border-left:none;padding-left:0}
.stat .v{display:flex;align-items:baseline;gap:.08em;font-size:clamp(1.9rem,3.4vw,2.8rem);font-weight:800;letter-spacing:-.035em;line-height:1.1}
.stat .v .n{font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1}
.stat .v .u{font-size:.42em;font-weight:600;color:var(--muted)}
.stat .l{margin-top:6px;font-size:.8rem;color:var(--muted)}
/* clients */
.clients{padding:52px 0;border-bottom:1px solid var(--line);text-align:center}
.clients .cap{font-family:var(--mono);font-size:.68rem;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.client-row{margin-top:24px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:20px 52px}
.cl{display:inline-flex;align-items:center;gap:10px;color:#8b91a1;font-size:1.02rem;white-space:nowrap;transition:color .18s ease}
.cl:hover{color:var(--ink)}
.cl svg{width:18px;height:18px;flex-shrink:0}
/* video */
.videosec{padding:0}
.video-slot{max-width:900px;margin:88px auto 0;aspect-ratio:16/9;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:#000;box-shadow:0 30px 70px rgba(11,13,20,.16)}
.video-slot video{width:100%;height:100%;object-fit:cover;display:block}
/* problem — two-column ledger */
.pains{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:0 48px}
.pain{display:grid;grid-template-columns:34px 1fr;gap:14px;align-items:baseline;padding:22px 0;border-top:1px solid var(--line);font-size:1.02rem}
.pain .idx{font-family:var(--mono);font-size:.74rem;color:var(--primary)}
/* capabilities — rule-separated editorial grid */
.caps{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0}
.cap-card{display:flex;flex-direction:column;padding:34px 34px 30px;border-top:2px solid var(--ink);border-right:1px solid var(--line)}
.cap-card:first-child{padding-left:0}
.cap-card:last-child{border-right:none;padding-right:0}
.cap-card .idx{font-family:var(--mono);font-size:.72rem;letter-spacing:.18em;color:var(--muted)}
.cap-card h3{margin-top:14px;font-size:1.22rem;font-weight:800;line-height:1.4}
.cap-card p{margin-top:10px;font-size:.94rem;color:var(--muted)}
.cap-viz{margin-top:26px;padding:20px;border-radius:14px;background:var(--tint);border:1px solid var(--line)}
.cap-viz .device-mockup{max-width:340px;margin:0 auto}
@media (max-width:980px){.cap-card{padding:30px 0;border-right:none}}
/* showcase — one wide inverted panel with the duo mockup.
   The device is fully contained rather than bled off the bottom edge: a
   partially cropped phone reads as a clipping bug, not as art direction. */
.showcase{margin-top:20px;border-radius:24px;background:var(--ink);color:#fff;padding:52px 56px;display:grid;grid-template-columns:.92fr 1.08fr;gap:44px;align-items:center;overflow:hidden}
.showcase h3{font-size:clamp(1.4rem,2.6vw,1.9rem);font-weight:800;line-height:1.4}
.showcase p{margin-top:14px;font-size:.96rem;color:rgba(255,255,255,.68);max-width:40ch}
.showcase .sc-viz{position:relative}
.showcase .device-mockup{filter:drop-shadow(0 24px 50px rgba(0,0,0,.5))}
@media (max-width:940px){.showcase{grid-template-columns:1fr;padding:40px 32px}}
/* how it works — one horizontal spine */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;position:relative}
.step{position:relative;padding-top:34px}
.step::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:var(--line)}
.step .num{position:absolute;top:-13px;left:0;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--ink);color:#fff;font-family:var(--mono);font-size:.7rem;font-weight:500}
.step h3{font-size:1.06rem;font-weight:800}
.step p{margin-top:8px;font-size:.92rem;color:var(--muted)}
/* testimonials */
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.quote{display:flex;flex-direction:column;gap:20px;padding:32px 30px;border-radius:18px;border:1px solid var(--line);background:var(--tint)}
.quote .q{flex:1;font-size:1rem;line-height:1.9}
.person{display:flex;align-items:center;gap:12px}
.avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0}
.person .n{font-size:.88rem;font-weight:700;line-height:1.4}
.person .r{font-size:.78rem;color:var(--muted)}
/* pricing — the recommended plan inverts to near-black */
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;align-items:stretch}
.plan{position:relative;display:flex;flex-direction:column;padding:36px 32px;border-radius:20px;border:1px solid var(--line);background:#fff}
.plan.hot{background:var(--ink);color:#fff;border-color:var(--ink);box-shadow:0 30px 70px rgba(11,13,20,.24)}
.plan.hot::before{content:"RECOMMENDED";position:absolute;top:-10px;left:30px;padding:.32em 1em;border-radius:999px;background:var(--primary);color:#fff;font-family:var(--mono);font-size:.62rem;letter-spacing:.2em}
.plan .pn{font-weight:700;font-size:.95rem;letter-spacing:.03em}
.plan .pp{margin-top:12px;font-size:2.25rem;font-weight:800;letter-spacing:-.035em;line-height:1.15}
.plan .pp small{font-size:.85rem;font-weight:500;letter-spacing:0;color:var(--muted)}
.plan.hot .pp small,.plan.hot .pd{color:rgba(255,255,255,.66)}
.plan .pd{margin-top:8px;font-size:.88rem;color:var(--muted);min-height:2.6em}
.plan ul{margin:22px 0 28px;list-style:none;display:grid;gap:11px;font-size:.9rem}
.plan li{display:flex;gap:10px;align-items:flex-start}
.plan li::before{content:"✓";font-weight:800;flex-shrink:0;color:var(--primary)}
.plan .btn{margin-top:auto}
.plan.hot .btn{background:#fff;color:var(--ink);box-shadow:none}
/* faq */
.faq-list{max-width:780px}
.faq-list details{border-top:1px solid var(--line)}
.faq-list details:last-child{border-bottom:1px solid var(--line)}
.faq-list summary{cursor:pointer;padding:22px 4px;font-weight:700;font-size:1rem;list-style:none;display:flex;justify-content:space-between;gap:18px;align-items:center}
.faq-list summary::-webkit-details-marker{display:none}
.faq-list summary::after{content:"+";font-family:var(--mono);font-size:1.2em;color:var(--muted);transition:transform .2s ease}
.faq-list details[open] summary::after{transform:rotate(45deg)}
.faq-list .a{padding:0 4px 22px;font-size:.94rem;color:var(--muted);max-width:62ch}
/* closing — inverted band so the page ends on contrast */
.closing{background:var(--ink);color:#fff;padding:128px 0;text-align:center;position:relative;overflow:hidden}
/* The glow must live inside the clipped box: an offset-below pseudo-element
   put the gradient's centre outside overflow:hidden and rendered nothing. */
.closing::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(58% 82% at 50% 116%,color-mix(in srgb,var(--primary) 44%,transparent),transparent 68%)}
.closing .wrap{position:relative}
.closing h2{margin:0 auto;max-width:17em;font-size:clamp(2rem,4.8vw,3.2rem);font-weight:800;line-height:1.26;letter-spacing:-.02em}
.closing p{margin:20px auto 38px;max-width:540px;color:rgba(255,255,255,.68)}
.closing .btn{background:#fff;color:var(--ink);box-shadow:0 10px 34px rgba(0,0,0,.34)}
.sample-note{padding:26px 16px;text-align:center;font-size:.75rem;color:var(--muted);background:var(--tint)}
footer{padding:38px 0;border-top:1px solid var(--line)}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;font-size:.78rem;color:var(--muted)}
footer .mono{font-family:var(--mono);letter-spacing:.1em}
${DEVICE_CSS}
@supports (animation-timeline: view()){
  .rev{animation:rise both;animation-timeline:view();animation-range:entry 0% entry 55%}
  @keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
}
@media (prefers-reduced-motion: reduce){
  @supports (animation-timeline: view()){.rev{animation:none}}
}
/* Printing has no scroll, so a view() timeline never advances and every
   below-the-fold reveal would come out blank. */
@media print{.rev{animation:none !important;opacity:1 !important;transform:none !important}}
@media (max-width:640px){
  section{padding:68px 0}
  .hero{padding:64px 0 0}
  .stats{grid-template-columns:1fr;margin-top:52px}
  .stat{border-left:none;border-top:1px solid var(--line);padding:20px 0 22px}
  .stat:first-child{border-top:none}
  .closing{padding:90px 0}
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
    <a class="btn brand small" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
  </div>
</header>

<main>
  <div class="hero">
    <div class="wrap">
      <div class="hero-grid">
        <div>
          <p class="hero-eb"><i></i>${esc(service.tagline)}</p>
          <h1>${esc(copy.hero.headline)}</h1>
          <p class="sub">${esc(copy.hero.subheadline)}</p>
          <div class="cta">
            <a class="btn brand" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
            <a class="btn ghost" href="#features">機能を見る<span class="ar">→</span></a>
          </div>
          <p class="note">${esc(service.offering)}</p>
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
    <div class="wrap">
      <p class="cap">Trusted by teams</p>
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
      <div class="caps">
        ${copy.features
          .slice(0, -1)
          .map(
            (f, i) => `<div class="cap-card rev">
          <p class="idx">${pad2(i + 1)}</p>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.description)}</p>
          <div class="cap-viz">${featureVisual(i)}</div>
        </div>`
          )
          .join("\n        ")}
      </div>
      ${(() => {
        // The last capability gets the wide inverted panel — one focal claim
        // instead of an even grid that reads as a spec sheet.
        const last = copy.features[copy.features.length - 1];
        if (!last) return "";
        return `<div class="showcase rev">
        <div class="sc-copy">
          <p class="eb" style="color:var(--accent)">${pad2(copy.features.length)} / Highlight</p>
          <h3 style="margin-top:14px">${esc(last.title)}</h3>
          <p>${esc(last.description)}</p>
        </div>
        <div class="sc-viz">${deviceMockupHtml("duo", screens, service.name, true)}</div>
      </div>`;
      })()}
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
          <span class="num">${i + 1}</span>
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
