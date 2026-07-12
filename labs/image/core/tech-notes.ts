// Turns a template's actual data into a technical explanation — this lab's
// whole point is to make the pipeline legible, not just show a pretty
// preview. Every sentence here describes what engine/compose.ts and
// engine/homography.ts literally do for THIS template's data, derived from
// the template.json fields rather than written as generic copy per card.

import type { BlendMode, LogoColorMode, Template2D } from "./template-format";

export type TechNote = { title: string; body: string };

export const BLEND_EXPLAIN: Record<BlendMode, string> = {
  over: "通常合成。ロゴのアルファをそのまま舞台に重ねる。ロゴが舞台から独立して見える(発光・切り文字)用途に使う。",
  multiply: "乗算。ロゴの明度と舞台の明度を掛け合わせる。白は透け、暗部は舞台の陰影を透過して沈むため、紙や布へのインク印刷・刻印の質感になる(このラボの既定ブレンド)。",
  screen: "スクリーン。反転乗算で明部だけを持ち上げる。ライティング層(スポット光)を舞台に足すのに使い、ロゴ本体には基本使わない。",
  overlay: "オーバーレイ。乗算とスクリーンを明度で切り替えつつブレンドし、コントラストを保ったまま馴染ませる。",
  "soft-light": "ソフトライト。overlayよりマイルドな階調圧縮で、強い光沢面のハイライト付けに向く。",
};

const COLOR_EXPLAIN: Record<LogoColorMode, string> = {
  original: "ロゴのオリジナルカラーをそのまま使う。印刷物などロゴ自体の配色が製品になる用途向け。",
  "mono-dark": "ロゴのRGBをすべて (23, 24, 26) に置換してからアルファだけ使う。切り文字サイン・箔押しなど、面の色そのものが素材になる用途向け。",
  "mono-light": "ロゴのRGBをすべて (250, 250, 250) に置換。暗い舞台での白抜き表現向け。",
};

const fmt = ([x, y]: readonly [number, number]) => `(${Math.round(x)}, ${Math.round(y)})`;

/** Ordered technical notes for the aside panel — derived from live template data. */
export function templateTechNotes(t: Template2D): TechNote[] {
  const notes: TechNote[] = [
    {
      title: "大原則: 舞台はテンプレート、ロゴは決定論的に合成",
      body: "このプレビューに生成AIは一切関与していない。舞台(背景)はデザイナーが作った静的なSVGで、ロゴの変形・配置・陰影はすべてピクセル単位のアルゴリズムの結果。現行の画像生成・編集モデルは『ロゴをなるべく保つ』ことはできても『絶対に不変』は保証しないため、ロゴが載る面だけはこの決定論的パイプラインで扱う。",
    },
  ];

  const c = t.surface.corners;
  notes.push({
    title: "幾何: 4点ホモグラフィ(DLT)",
    body: `テンプレート作者が指定した4隅 tl${fmt(c.tl)} tr${fmt(c.tr)} br${fmt(c.br)} bl${fmt(c.bl)}(design px)から、3×3の射影変換行列をDirect Linear Transformで解く。ロゴの矩形をこの4点が作る台形へ逆写像(inverse warp)し、宛先の各ピクセルから元画像側の対応点をバイリニアサンプリングする。パース・傾き・遠近が1回の行列演算に畳み込まれる。`,
  });

  const logo = t.surface.logo;
  const opacityNote =
    logo.opacity !== undefined && logo.opacity < 1
      ? ` 不透明度${Math.round(logo.opacity * 100)}%で下地を透過させる。`
      : "";
  notes.push({
    title: `ブレンド: ${logo.blend}`,
    body: BLEND_EXPLAIN[logo.blend] + opacityNote,
  });

  const colorMode = logo.colorMode ?? "original";
  notes.push({ title: `色処理: ${colorMode}`, body: COLOR_EXPLAIN[colorMode] });

  notes.push({
    title: "サイズ制約",
    body: `推奨幅は合成面の${Math.round(logo.placement.width * 100)}%。クリアスペース${logo.clearSpace}倍(ロゴ幅基準)を確保した上で、${Math.round(logo.minWidth * 100)}〜${Math.round(logo.maxWidth * 100)}%の範囲にクランプする。この範囲外は品質保証外として合成側が強制的に収める。`,
  });

  if (t.surface.displacement) {
    const d = t.surface.displacement;
    notes.push({
      title: "ディスプレイスメント(面のシワ・凹凸)",
      body: `1枚のRGB画像を変位場として使う。R成分の128からのズレでx方向、G成分で y方向にロゴのサンプリング座標をずらす(128=変位なし)。最大変位は出力解像度換算で±${d.strength}px相当。射影後のロゴがこのマップの起伏に沿って物理的に歪むため、印刷物が生地の凹凸に馴染んで見える。`,
    });
  }

  if (logo.shadow) {
    const s = logo.shadow;
    notes.push({
      title: "コンタクトシャドウ",
      body: `射影済みロゴのアルファチャンネルだけを抽出し、ぼかし半径${s.blur}px(design px)でガウスぼかし、(${s.dx}, ${s.dy})pxオフセットして不透明度${Math.round(s.opacity * 100)}%で舞台に落とす。ロゴ本体とは別レイヤーとして下に敷くため、シャドウの色はロゴの配色に影響されない。`,
    });
  }

  if (t.lighting?.length) {
    const chain = t.lighting
      .map((l) => `${l.blend}${l.opacity !== undefined ? `@${Math.round(l.opacity * 100)}%` : ""}`)
      .join(" → ");
    notes.push({
      title: `ライティング(${t.lighting.length}レイヤー、焼き込み済み)`,
      body: `ロゴを合成した最後に ${chain} の順で静的な光・影レイヤーを重ねる。スポット光やビネットなど実写のライティングをテンプレート側に閉じ込めており、生成AIによる自動照明調和(Firefly Object Compositeのような)には依存しない設計。この方式の品質限界は未解決事項として検証中(labs/image/README.md参照)。`,
    });
  }

  notes.push({
    title: "原価: $0.00(決定論的合成)",
    body: "外部の生成APIを一切呼ばないため、このプレビュー1枚の変動費はゼロ。呼び出したのはこのサーバー上のsharp(ラスタライズ・合成)と自作のホモグラフィ計算のみ。原価計測はページ下部のパネルでテンプレート単位に集計している。",
  });

  return notes;
}
