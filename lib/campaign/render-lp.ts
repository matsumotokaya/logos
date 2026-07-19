import type { BrandKit } from "./schema";

// Stage LP: render a Brand Kit into a standalone one-page site (inline CSS,
// no external dependencies). Quality lives in this template; the LLM only
// supplies structured content, so bad input can't break the layout.

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

export function renderLandingPage(kit: BrandKit, opts: { videoEmbed?: string } = {}): string {
  const { service, brand, copy } = kit;
  const font = FONT_STACKS[brand.font_style];
  const ctaHref = service.url ? esc(service.url) : "#";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(service.name)} — ${esc(service.tagline)}</title>
<meta name="description" content="${esc(service.description)}">
<meta name="theme-color" content="${brand.primary}">
<style>
:root{
  --primary:${brand.primary};
  --accent:${brand.accent};
  --bg:${brand.background};
  --surface:${brand.surface};
  --text:${brand.text};
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:${font};line-height:1.75;-webkit-font-smoothing:antialiased}
.container{max-width:1040px;margin:0 auto;padding:0 24px}
header{position:sticky;top:0;z-index:10;background:color-mix(in srgb, var(--bg) 85%, transparent);backdrop-filter:blur(12px);border-bottom:1px solid color-mix(in srgb, var(--text) 10%, transparent)}
.nav{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-weight:800;font-size:1.25rem;letter-spacing:.02em}
.logo .dot{color:var(--primary)}
.btn{display:inline-block;padding:.8em 2em;border-radius:999px;background:var(--primary);color:#fff;text-decoration:none;font-weight:700;transition:transform .15s ease, box-shadow .15s ease;box-shadow:0 4px 20px color-mix(in srgb, var(--primary) 40%, transparent)}
.btn:hover{transform:translateY(-2px)}
.btn.small{padding:.5em 1.4em;font-size:.9rem}
.hero{padding:96px 0 80px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:-40% -20% auto;height:120%;background:radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 65%);pointer-events:none}
.hero h1{font-size:clamp(2rem, 5.5vw, 3.6rem);font-weight:800;line-height:1.3;letter-spacing:.01em}
.hero p.sub{margin:24px auto 0;max-width:640px;font-size:1.1rem;opacity:.85}
.hero .cta{margin-top:40px}
.tagline{display:inline-block;margin-bottom:20px;padding:.35em 1.1em;border:1px solid color-mix(in srgb, var(--accent) 60%, transparent);color:var(--accent);border-radius:999px;font-size:.85rem;font-weight:600;letter-spacing:.05em}
section{padding:80px 0}
.section-title{font-size:clamp(1.5rem, 3.5vw, 2.2rem);font-weight:800;text-align:center;margin-bottom:48px;line-height:1.4}
.problem{background:var(--surface)}
.pains{display:grid;gap:16px;max-width:640px;margin:0 auto}
.pain{display:flex;gap:14px;align-items:flex-start;padding:18px 22px;border-radius:14px;background:color-mix(in srgb, var(--bg) 60%, var(--surface));border:1px solid color-mix(in srgb, var(--text) 8%, transparent)}
.pain::before{content:"✕";color:var(--primary);font-weight:800;flex-shrink:0}
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.feature{padding:32px 28px;border-radius:18px;background:var(--surface);border:1px solid color-mix(in srgb, var(--text) 8%, transparent)}
.feature .emoji{font-size:2rem}
.feature h3{margin:14px 0 8px;font-size:1.15rem}
.feature p{opacity:.85;font-size:.95rem}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;counter-reset:step}
.step{position:relative;padding:28px 24px 24px;border-radius:16px;background:var(--surface);border:1px solid color-mix(in srgb, var(--text) 8%, transparent);counter-increment:step}
.step::before{content:counter(step);position:absolute;top:-18px;left:24px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--accent);color:var(--bg);font-weight:800}
.step h3{margin-bottom:6px;font-size:1.05rem}
.step p{font-size:.92rem;opacity:.85}
.video-slot{max-width:800px;margin:0 auto 0;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:var(--surface);display:flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb, var(--text) 10%, transparent)}
.video-slot span{opacity:.5;font-size:.95rem}
.closing{text-align:center;background:linear-gradient(160deg, color-mix(in srgb, var(--primary) 22%, var(--bg)), var(--bg) 70%)}
.closing h2{font-size:clamp(1.6rem, 4vw, 2.6rem);font-weight:800}
.closing p{margin:18px 0 36px;opacity:.85}
footer{padding:40px 0;text-align:center;font-size:.85rem;opacity:.6;border-top:1px solid color-mix(in srgb, var(--text) 8%, transparent)}
@media (max-width:640px){section{padding:56px 0}.hero{padding:72px 0 56px}}
</style>
</head>
<body>
<header>
  <div class="container nav">
    <div class="logo">${esc(service.name)}<span class="dot">.</span></div>
    <a class="btn small" href="${ctaHref}">${esc(copy.hero.cta_label)}</a>
  </div>
</header>

<main>
  <div class="hero">
    <div class="container">
      <span class="tagline">${esc(service.tagline)}</span>
      <h1>${esc(copy.hero.headline)}</h1>
      <p class="sub">${esc(copy.hero.subheadline)}</p>
      <div class="cta"><a class="btn" href="${ctaHref}">${esc(copy.hero.cta_label)}</a></div>
    </div>
  </div>

  <section>
    <div class="container">
      ${
        opts.videoEmbed
          ? `<div class="video-slot">${opts.videoEmbed}</div>`
          : `<div class="video-slot"><span>▶ 紹介動画（生成中）</span></div>`
      }
    </div>
  </section>

  <section class="problem">
    <div class="container">
      <h2 class="section-title">${esc(copy.problem.headline)}</h2>
      <div class="pains">
        ${copy.problem.points.map((p) => `<div class="pain">${esc(p)}</div>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section>
    <div class="container">
      <h2 class="section-title">${esc(service.name)} ができること</h2>
      <div class="features-grid">
        ${copy.features
          .map(
            (f) => `<div class="feature">
          <div class="emoji">${esc(f.emoji)}</div>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.description)}</p>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section class="problem">
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

  <section class="closing">
    <div class="container">
      <h2>${esc(copy.closing.headline)}</h2>
      <p>${esc(copy.closing.subtext)}</p>
      <a class="btn" href="${ctaHref}">${esc(copy.closing.cta_label)}</a>
    </div>
  </section>
</main>

<footer>
  <div class="container">© ${new Date().getFullYear()} ${esc(service.name)}</div>
</footer>
</body>
</html>
`;
}
