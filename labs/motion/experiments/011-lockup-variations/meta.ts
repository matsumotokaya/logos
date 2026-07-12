import type { ExperimentMeta } from "@/labs/motion/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "011",
  slug: "lockup-variations",
  title: "Lockup Variations",
  category: "presentation",
  tech: ["gsap"],
  impressions: ["体系的", "端正", "ブランド"],
  duration: "縦組み/横組み/シンボル単体を各2.4s保持+1.05s遷移で巡回、約10.35sループ",
  supports: ["svg", "png"],
  easing: "layout: power3.inOut(位置・サイズ・不透明度を同一タイミングで遷移)",
  notes:
    "同梱ロゴは単一SVGでシンボルとワードマークが未分離のため、マーク全体(mountLogo)+logo.nameのテキストを1ロックアップ単位として扱う。縦組み(マーク上/テキスト下)・横組み(マーク左/テキスト右)・シンボル単体(マークのみ拡大)の3レイアウトをgsapタイムラインでクロスフェード遷移させながらrepeat:-1で巡回。マークは常にmountLogoのcontain-fitで描画し、サイズを変えるボックス自体がロゴの縦横比を保つため歪みは発生しない。テキストはvar(--font-display)+無彩色(--ink)のみ使用。",
  status: "done",
};
