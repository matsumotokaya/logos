// Guards for the two single-source-of-truth properties of a generated LP.
// Both have regressed before (docs/device-mockup-fixes.md):
//
// 1. The hero key visual must be the shared device mockup markup, rendered
//    from CSS alone. The management thumbnail iframes this same HTML with
//    sandbox="" — scripts blocked — so a script-dependent hero makes the two
//    surfaces show different things, and only one of them gets tested.
// 2. The video slot must reflect one fact: whether an MP4 exists. An LP must
//    never offer to generate one; that belongs to the authenticated surface.

import assert from "node:assert/strict";
import test from "node:test";
import {
  cmVideoEmbed,
  injectCmVideo,
  removeCmVideoSlot,
  renderLandingPage,
  statValueHtml,
} from "./render-lp";
import { sampleCampaignKit } from "./sample";

const html = renderLandingPage(sampleCampaignKit);

test("ヒーローは共通のデバイスモックアップを使い、スクリプトに依存しない", () => {
  // The shared markup from deviceMockupHtml(), not a second implementation.
  assert.match(html, /<div class="hero-model-stage"><div class="device-mockup device-duo"/);
  assert.match(html, /class="device-laptop"/);
  assert.match(html, /class="device-phone"/);
});

test("LPはmodel-viewerもサンドボックスで死ぬスクリプトも埋め込まない", () => {
  assert.doesNotMatch(html, /model-viewer/);
  assert.doesNotMatch(html, /ajax\.googleapis\.com/);
  assert.doesNotMatch(html, /<script/);
});

test("動画スロットはMP4があるときだけ動画を出す", () => {
  // No MP4: the section is empty — no placeholder, and above all no button.
  assert.match(html, /<!--cm-video-slot--><!--\/cm-video-slot-->/);
  assert.doesNotMatch(html, /製品紹介動画を生成/);
  assert.doesNotMatch(html, /video-generate/);

  const withVideo = renderLandingPage(sampleCampaignKit, {
    videoEmbed: cmVideoEmbed("/api/labs/campaign/video/abc"),
  });
  assert.match(withVideo, /<div class="video-slot"><video[^>]*src="\/api\/labs\/campaign\/video\/abc"/);
});

test("保存済みHTMLの動画スロットは、MP4の有無で入れ替えも撤去もできる", () => {
  const stored = renderLandingPage(sampleCampaignKit, {
    videoEmbed: cmVideoEmbed("/old-and-expired"),
  });
  const swapped = injectCmVideo(stored, "/fresh-signed-url");
  assert.match(swapped, /src="\/fresh-signed-url"/);
  assert.doesNotMatch(swapped, /old-and-expired/);

  const cleared = removeCmVideoSlot(swapped);
  assert.doesNotMatch(cleared, /<video/);
  assert.match(cleared, /<!--cm-video-slot--><!--\/cm-video-slot-->/);
});

test("実績数値は数字と前後の文字を別々の要素に分ける", () => {
  assert.equal(statValueHtml("3秒"), '<span class="n">3</span><span class="u">秒</span>');
  assert.equal(statValueHtml("120+"), '<span class="n">120</span><span class="u">+</span>');
  assert.equal(statValueHtml("1,200件"), '<span class="n">1,200</span><span class="u">件</span>');
  assert.equal(statValueHtml("98%"), '<span class="n">98</span><span class="u">%</span>');
  // Leading prefix as well as a trailing unit.
  assert.equal(
    statValueHtml("約3分"),
    '<span class="u">約</span><span class="n">3</span><span class="u">分</span>',
  );
  // No figure at all: nothing to split, and nothing may be dropped.
  assert.equal(statValueHtml("業界初"), '<span class="n">業界初</span>');
});

test("実績数値は分割しても元の文字を落とさない", () => {
  for (const value of ["3秒", "120+", "1,200件", "98%", "約3分", "0円", "業界初", "24/7"]) {
    const text = statValueHtml(value).replace(/<[^>]+>/g, "");
    assert.equal(text, value, `${value} の文字が欠けている`);
  }
});
