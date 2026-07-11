import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "009",
  slug: "ambient-background",
  title: "Ambient Background",
  category: "ambient",
  tech: ["gsap", "css"],
  impressions: ["静謐", "上質", "空気感"],
  duration: "背景blob 13〜22sの非同期ドリフトループ(ロゴは静止)",
  supports: ["svg", "png"],
  easing: "drift: sine.inOut(yoyo, 4つのblobで尺をずらして拍が揃わないようにする)",
  notes:
    "ロゴ抽出パレット(logo.colors、支配色優先)を極低アルファ(約0.10〜0.22)のradial-gradient blobに変換し、blur(30px)で滲ませて背景に配置。色そのものはロゴ由来のみで無彩色フォールバックあり。ロゴと背景の間に白いradial-gradientビネットを重ね、blobの位置に関わらずロゴ中央のクリアスペースを常にほぼ白へ保つことで「ロゴが埋もれない」を担保。ロゴはmountLogoで60%ボックスに静止表示し、一切アニメーションしない。blobはxPercent/yPercentで中心固定した上でleft/top/scaleのみをgsapでトゥイーンし、インラインtransform文字列と衝突しないようにしている。",
  status: "done",
};
