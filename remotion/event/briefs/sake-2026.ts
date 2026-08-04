// 「世界が恋する日本酒」 — レオパレス21 × WealthPark Lab
// 「文化資本と投資」シリーズ 第3弾 のイベントPVブリーフ。
//
// 出典:
//   - 文言・構成: 企画者からのSlackメッセージ + フライヤー(2026-08-04受領)
//   - 素材: /Users/kaya.matsumoto/Desktop/日本酒イベント/assets を
//     labs/event/scripts/prepare-assets.mjs が public/event/sake-2026/ へ整形
//
// 日時はダミー確定値(2026-10-02 金 17:00 — 依頼者指定の仮置き)。
// 会場・参加費はフライヤー上も未定(xxx)のため null = 画面では省略し、
// CTAで申込ページへ誘導する。事実は捏造しない。

import type { EventBrief } from "../types";

const A = "event/sake-2026";

export const sake2026Brief: EventBrief = {
  presenter: "レオパレス21 × WealthPark Lab",
  seriesLabel: "「文化資本と投資」シリーズ 第3弾",
  title: "世界が恋する日本酒",
  subtitle: "〜次世代へつなぐ、文化資本への投資〜",
  sideCopy: "特別な日本酒を楽しみながら、日本の文化資本の未来を考える",
  valueLines: ["百貨店には並ばない、", "蔵出しの特別な日本酒。"],
  valueChip: "特別な5種を、テイスティングで",
  programsHeading: "3つのプログラム",
  programs: [
    { title: "蔵出しの特別な日本酒5種類をテイスティング" },
    { title: "十一代目当主 × Miss SAKE代表理事が語る、日本酒業界の舞台裏" },
    { title: "2026 Miss SAKE 2名と学ぶ、楽しみ方を広げるワークショップ" },
  ],
  guestsHeading: "ゲスト",
  // focus/zoom: all three portraits are landscape frames with the face high
  // and off-centre, so each medallion is framed from data rather than a crop.
  guests: [
    {
      name: "宮尾 佳明",
      role: "宮尾酒造 十一代目当主",
      photo: { src: `${A}/photos/miyao.jpg`, focus: { x: 0.68, y: 0.3 }, zoom: 2.1 },
    },
    {
      name: "大西 美香",
      role: "一社）Miss SAKE 代表理事",
      photo: { src: `${A}/photos/onishi.jpg`, focus: { x: 0.52, y: 0.27 }, zoom: 2.0 },
    },
    {
      name: "加藤 航介",
      role: "モデレーター\nWealthPark研究所 代表",
      photo: { src: `${A}/photos/kato.jpg`, focus: { x: 0.47, y: 0.3 }, zoom: 1.9 },
    },
  ],
  schedule: {
    date: "2026.10.2",
    weekday: "FRI",
    time: "17:00 START",
    venue: null,
    fee: null,
  },
  cta: "詳細・お申し込みはこちら",
  footnote: "20歳以上より参加可・お一人からご家族まで歓迎",
  // 〆張鶴 and Miss SAKE ship white-on-transparent; Leopalace21 was knocked
  // out of its white JPEG plate at prep time; WealthPark's SVG is black-only.
  logos: [
    { name: "レオパレス21", src: `${A}/logos/leopalace21.png`, scale: 0.82 },
    { name: "WealthPark Lab", src: `${A}/logos/wealthpark-lab.svg`, treatment: "invert", scale: 0.8 },
    { name: "〆張鶴", src: `${A}/logos/shimeharitsuru.png`, scale: 1.25 },
    // Stacked lockup (Miss over SAKE), so it needs more height than the
    // horizontal wordmarks to read at the same optical size.
    { name: "Miss SAKE", src: `${A}/logos/miss-sake.png`, scale: 1.35 },
  ],
  visuals: {
    inkArt: `${A}/art/sake-kanji.png`,
    value: { src: `${A}/photos/pour-lanterns.jpg`, focus: { x: 0.5, y: 0.45 } },
    // Framed low so the brewer's face doesn't sit directly behind the heading.
    programs: { src: `${A}/photos/brewer.jpg`, focus: { x: 0.55, y: 0.68 } },
    closing: { src: `${A}/photos/masu.jpg`, focus: { x: 0.45, y: 0.5 } },
    texture: `${A}/photos/slate.jpg`,
  },
  bgm: `${A}/bgm.mp3`,
};
