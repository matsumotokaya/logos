---
name: verify
description: Build, launch and drive this Next.js app end-to-end to verify changes at the browser surface.
---

# Verify logos (Next.js app)

## Build & launch

```bash
npm run build                 # Turbopack, ~10s. TypeScript checked here (build does NOT run eslint)
npx eslint app components lib # lint separately
npx next start -p 3100 &      # serve the production build on an isolated port
```

## Drive (browser surface)

All state is client-side localStorage, so curl only returns the HTML shell —
use Playwright (chromium is already cached in ~/Library/Caches/ms-playwright).
Install playwright into the session scratchpad, not the repo:

```bash
cd <scratchpad> && npm init -y && npm i playwright@1.61.1
node verify.mjs   # import { chromium } from "playwright"
```

## Flows worth driving

- `/` hero upload: click "Upload SVG" → `filechooser` event → setFiles(<svg>) → expect redirect to `/p/[12-char id]`
- Gallery on `/`: card `a[href="/p/<id>"]` appears after upload; empty state shows sample CTA
- `/p/sample` renders the built-in sample without persisting
- Rename via `header input` on /p/[id] persists to the gallery card title
- Probes: unknown id → "Logo not found"; legacy `/?logo=<id>` redirects; re-upload same SVG dedupes to same id; non-SVG file → inline `#upload-error`

- Presentation edit mode: header `Edit` button (stored logos only) turns
  catchphrase/story/scene leads into `[role="textbox"]` contentEditables;
  saves on blur; clearing restores auto copy; logs プレゼン編集 activity
- Logo info page `/admin/logos/[id]`: basic-info selects persist immediately;
  credits/trademarks are draft + 保存 button; file replace via `SVGを差し替え`
  filechooser; seed legacy-shaped rows via `localStorage.setItem("logos.v1.logos", ...)`
  to test migration defaults

## Gotchas

- Splash scene animates on presentation load — wait ~2.5s before screenshots
- UI copy defaults to English locale (dictionaries in lib/i18n)
