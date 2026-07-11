import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "012",
  slug: "extrude-turntable",
  title: "Extrude Turntable",
  category: "three",
  tech: ["three"],
  impressions: ["立体", "重厚", "上質"],
  duration: "約20sで1回転(等速ターンテーブル)",
  supports: ["svg"],
  easing: "turntable: 等速回転(演出は照明とマット質感で作る)",
  notes:
    "SVGパスを押し出して立体化し、マットな標準マテリアルでゆっくり水平回転させる。SVGLoaderでパスをShape化→ExtrudeGeometry(面取りあり)。y反転はジオメトリ側で行い法線を保つ。色はパス各fill(ロゴ抽出色)。照明はソフトな環境光+キーライトのみで、質感で立派さを出す。SVG専用。",
  status: "done",
};
