// Fetch the default sound-effect pool from 効果音ラボ.
//
// 効果音ラボ (https://soundeffect-lab.info) is the standard Japanese SFX
// library: free for commercial use, no credit, no link required. What its
// terms DO forbid is redistribution of the files themselves — which is why
// the mp3 bytes are gitignored (same rule as the default BGM) and this
// script, not the repository, is how a fresh environment gets them. The
// script IS the durable record: every file's source URL, label and role is
// written here, so "where did this sound come from" always has an answer.
//
// The selection is the general-purpose production set: chapter turns, title
// hits, Japanese instruments, shimmer, rolls and fanfares. Gag, horror and
// quiz-show cues were left out on purpose — this pool dresses business film,
// and a template asks for a role (sfx.ts asks by presence), not for a mood
// board. Add entries here when a template needs a role the pool lacks.
//
// WHERE THE FILES LIVE — three places, on purpose:
//
//   public/defaults/sfx/   this machine, for dev and local MP4 renders. Real
//                          files in a real directory; the renderer reads them
//                          through staticFile() like any other public asset.
//   R2 (--upload)          production. `npm run sfx:sync` puts the pool in the
//                          private bucket under defaults/sfx/, which is where
//                          a deployed render must read it from — Vercel builds
//                          from git, and git deliberately has none of these.
//   this script            the recipe. Any environment restores the pool from
//                          the source of record, so nothing is ever "lost".
//
// Git holds the catalog and never the bytes: this repository is PUBLIC, and
// pushing the files would be exactly the redistribution 効果音ラボ forbids.
// Uploading our own copy to a private bucket for our own rendering is not
// distribution, and burning the sounds into a customer's MP4 is the licensed
// use the site grants outright.
//
// Run from the repository root:
//   node scripts/fetch-default-sfx.mjs            # download missing files
//   node scripts/fetch-default-sfx.mjs --force    # re-download everything
//   node scripts/fetch-default-sfx.mjs --upload   # …and push the pool to R2
//
// After downloading it measures each file's first second (same method as
// labs/freehand/scripts/measure-sfx.mjs) and writes catalog.json next to the
// files: label, source URL, licence line, headDb and the gain that levels the
// file to −20 dB. Consumers read the catalog, never the raw file list.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "https://soundeffect-lab.info/sound/anime/mp3/";
const OUT_DIR = path.join(process.cwd(), "public/defaults/sfx");
const CATALOG = path.join(OUT_DIR, "catalog.json");

const LICENSE =
  "効果音ラボ（https://soundeffect-lab.info）商用利用無料・クレジット不要。ファイルの再配布は不可（このスクリプトで各環境が取得する）";

/** file → what it is, and the production role it usually plays. */
const SELECTION = [
  // 和 — the instruments this product's first art direction leans on.
  ["drum-japanese1.mp3", "和太鼓でドン", "重い一打。タイトル・決め"],
  ["drum-japanese2.mp3", "和太鼓でドドン", "二連打。登場・締め"],
  ["drum-japanese-kaka1.mp3", "和太鼓でカカッ", "フチ打ち。軽い合図"],
  ["hyoushigi1.mp3", "拍子木1", "開幕の合図"],
  ["hyoushigi2.mp3", "拍子木2", "二連。転換"],
  ["hyoushigi3.mp3", "拍子木3", "連打。芝居の幕"],
  ["koto-glissando1.mp3", "琴の滑奏", "和の導入フレーズ"],
  ["kotsudumi1.mp3", "小鼓", "能・歌舞伎の間"],
  ["shakuhachi1.mp3", "尺八", "和の情感"],
  ["bell1.mp3", "鈴を鳴らす", "人の登場・章の変わり目"],
  ["tirin1.mp3", "チリン", "凛とした登場"],
  ["temple-bell1.mp3", "お寺の鐘", "ゴーン。荘厳"],
  ["solemnity1.mp3", "荘厳な雰囲気", "ドラを弱く。格式"],
  ["ban1.mp3", "バーン", "ドラ鳴らし。強い決め"],
  ["doon1.mp3", "ドーン", "和太鼓+ビブラスラップ"],
  ["don-1.mp3", "ドーン（重い）", "重い演出"],
  ["buun1.mp3", "ブウーン", "重低音。スローモーション"],
  // 転換・タイトル — the cuts and reveals.
  ["sceneswitch1.mp3", "シーン切り替え1", "場面転換（木琴）"],
  ["sceneswitch2.mp3", "シーン切り替え2", "場面転換（ブオッ）"],
  ["title1.mp3", "タイトル表示", "ビジネスで使いやすい爽やかな音"],
  ["typewriter-1.mp3", "タイプライター1", "文字が打たれる"],
  ["typewriter-2.mp3", "タイプライター2", "連続で打つ"],
  ["presentation-title1.mp3", "プレゼンタイトル1", "明るい見出し"],
  ["presentation-title2.mp3", "プレゼンタイトル2", "水のイメージ"],
  ["news-title1.mp3", "ニュースタイトル1", "見出しが出る"],
  ["text-impact1.mp3", "文字表示の衝撃音1", "ザッ。映画PV風の強い見出し"],
  ["text-impact2.mp3", "文字表示の衝撃音2", "映画のPV風"],
  ["text-impact3.mp3", "文字表示の衝撃音3", "ズン"],
  ["metal-logo1.mp3", "金属タイトル1", "ガキーン"],
  ["metal-logo2.mp3", "金属タイトル2", "衝撃弱め"],
  ["metal-logo3.mp3", "金属タイトル3", "動きのあるロゴ"],
  ["logo-animation1.mp3", "文字アニメーション1", "デジタル"],
  ["logo-animation2.mp3", "文字アニメーション2", "柔らかい"],
  // 輝き — the glints that sell a product shot.
  ["shine1.mp3", "きらきら輝く1", "美しさの演出"],
  ["shine2.mp3", "きらきら輝く2", "ウインドチャイム長め"],
  ["shine4.mp3", "きらきら輝く4", "しゃらーん"],
  ["shine6.mp3", "きらきら輝く6", "ハープ生演奏"],
  ["kira1.mp3", "キラッ1", "鉄琴の一点"],
  ["shakin1.mp3", "シャキーン1", "決めポーズ"],
  // 祝祭・紹介 — rolls, fanfares, curtains.
  ["trumpet1.mp3", "ファンファーレ", "喜び・発表"],
  ["levelup1.mp3", "レベルアップ", "テッテレー"],
  ["drum-roll1.mp3", "ドラムロール", "ダラララ（生演奏）"],
  ["tympani-roll1.mp3", "ティンパニロール", "ドドドド（生演奏）"],
  ["roll-finish1.mp3", "ロールの閉め", "シンバル。発表の瞬間"],
  ["jean1.mp3", "ジャン！", "紹介"],
  ["jajean1.mp3", "ジャジャーン", "登場・紹介"],
  ["spotlight1.mp3", "スポットライト", "照明が当たる"],
  ["buzzer-opening1.mp3", "開演ブザー", "映画・演劇の幕開け"],
  ["projector1.mp3", "映写機", "昔の映像・回想"],
  ["piano-single1.mp3", "ピアノの単音", "深く落ち着いた一点"],
  // Added 2026-08-19 from the client's own selection. Everything they picked
  // that was not already here — verified byte-identical to this site's files
  // where it overlapped, so the whole set carries the same licence.
  ["amount-display1.mp3", "金額表示", "数字・価格の提示"],
  ["dj-scratch1.mp3", "DJのスクラッチ1", "ズビズビ。切り替え"],
  ["dj-scratch2.mp3", "DJのスクラッチ2", "バックスピン"],
  ["flash1.mp3", "ひらめく1", "気づき・発見"],
  ["pa1.mp3", "パッ", "軽く現れる"],
  ["papa1.mp3", "パパッ", "続けて現れる"],
  ["pafu1.mp3", "パフ", "ラッパ。ささやかな祝い"],
  ["peta1.mp3", "ペタッ", "スタンプ・貼り付け"],
  ["blink1.mp3", "目をパチパチ", "戸惑い・間"],
  ["shivering1.mp3", "カタカタ震える", "緊張・寒さ"],
  ["stupid1.mp3", "間抜け1", "ドジ・軽い失敗"],
  ["emergency-alert1.mp3", "警報が鳴る", "緊急・注意喚起"],
  ["costume-drama2.mp3", "時代劇演出2", "キハーダ。和の見得"],
];

/**
 * Supplied sounds this pool cannot take.
 *
 * Two files in the client's folder carry `artist=My Recording` ID3 tags where
 * every 効果音ラボ file carries none, and neither appears in any of the site's
 * seven categories — so they came from somewhere else and their licence is
 * unknown. A default asset's whole job is to be safe to burn into anybody's
 * MP4; an unsourced file cannot do that job. Named here rather than dropped
 * silently, because "we looked and could not place it" is the useful answer.
 */
export const UNSOURCED = ["スポッ.mp3", "歓声と拍手.mp3"];

const REFERENCE_DB = -20;
const MAX_GAIN = 3;

const headDb = (file) => {
  const { stderr } = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-t", "1", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const match = /mean_volume:\s*(-?\d+(?:\.\d+)?) dB/.exec(stderr ?? "");
  return match ? Number(match[1]) : null;
};

mkdirSync(OUT_DIR, { recursive: true });
const force = process.argv.includes("--force");

const catalog = { license: LICENSE, fetchedFrom: BASE, sounds: {} };
let downloaded = 0;
for (const [file, label, role] of SELECTION) {
  const dest = path.join(OUT_DIR, file);
  if (force || !existsSync(dest)) {
    // The CDN requires a browser-shaped request: without the category page as
    // Referer it answers 403 (measured 2026-08-18).
    const res = await fetch(BASE + file, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        referer: "https://soundeffect-lab.info/sound/anime/",
      },
    });
    if (!res.ok) {
      console.error(`FAILED ${file}: HTTP ${res.status}`);
      continue;
    }
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    downloaded += 1;
    // Politeness: one file at a time, a breath between requests.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  const db = headDb(dest);
  catalog.sounds[file] = {
    label,
    role,
    src: `defaults/sfx/${file}`,
    sourceUrl: BASE + file,
    headDb: db,
    gain: db === null ? 1 : Number(Math.min(MAX_GAIN, Math.pow(10, (REFERENCE_DB - db) / 20)).toFixed(3)),
  };
  console.log(`${file.padEnd(26)} ${label}`);
}

writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`\n${downloaded} downloaded, ${SELECTION.length} in pool → ${CATALOG}`);

// The production home. Same keys as the local paths, so a consumer that knows
// `defaults/sfx/bell1.mp3` finds it either way.
if (process.argv.includes("--upload")) {
  const { isR2Configured, putR2Object } = await import("../lib/r2.ts");
  if (!isR2Configured()) {
    console.error(
      "\nR2_* が未設定のためアップロードできません（.env.local を確認してください）",
    );
    process.exit(1);
  }
  console.log("\nR2 へ同期中…");
  for (const [file] of SELECTION) {
    const key = `defaults/sfx/${file}`;
    await putR2Object(key, readFileSync(path.join(OUT_DIR, file)), "audio/mpeg");
    console.log(`  ↑ ${key}`);
  }
  await putR2Object(
    "defaults/sfx/catalog.json",
    Buffer.from(JSON.stringify(catalog, null, 2)),
    "application/json",
  );
  console.log(`\n${SELECTION.length + 1} objects → R2 defaults/sfx/`);
}
