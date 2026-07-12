// The lab constellation — one catalog for every R&D lab, current and planned.
//
// Each lab is an isolated sandbox exploring one layer of the product's core
// bet: the first experience must make an uploaded logo look dignified. The
// layers form a staircase where technical sophistication, scarcity and
// pricing rise together: SVG motion costs nothing and ships to everyone;
// a 30-second promo video is the heaviest paid tier.
//
// Shared bar for every lab: 「ロゴが立派に見えるか」— never "does it move".

export type LabStatus = "active" | "planned";

export type LabModule = {
  title: string;
  body: string;
};

export type LabInfo = {
  /** URL segment under /labs/. */
  slug: string;
  /** Short product-style name, e.g. "Motion Lab". */
  name: string;
  /** Japanese descriptor shown next to the name. */
  titleJa: string;
  tagline: string;
  status: LabStatus;
  /** Where this lab sits in the experience/pricing staircase. */
  layer: string;
  description: string;
  /** What gets researched / built here. */
  scope: string[];
  /** Planned research modules (the deep-research plan). */
  modules: LabModule[];
};

export const LABS: LabInfo[] = [
  {
    slug: "motion",
    name: "Motion Lab",
    titleJa: "ロゴモーション研究所",
    tagline: "生成AI以前の、アルゴリズムで実行できる表現レイヤーの網羅",
    status: "active",
    layer: "レイヤー1〜2: 静的ガイドライン配置・SVG/3Dモーション(限界費用ゼロ・全ユーザーに無料で配れる層)",
    description:
      "SVG・CSS・Canvas・Three.js・Lottie による、コードだけで任意のロゴに自動適用できる表現のカタログ。全16実験が稼働中で、001 Classic Reveal を基準器として印象タグ・星評価・研究ノートで採用判断を蓄積する。技術的にシンプルだからこそ、センスとアイデアで印象が大幅に変わる層。",
    scope: [
      "Reveal(出現)系: 輪郭線ドロー・マスクワイプ・ブラーフォーカス・パス時差構築・粒子集合",
      "質感系: 金属光沢スイープ・ロングシャドウ",
      "常駐ループ系: ブリージング・アンビエント背景",
      "プレゼンテーション系: ガイドライン製図演出・ロックアップ切替",
      "3D系: 押し出しターンテーブル・マテリアル比較・ギャラリー空間",
      "書き出し検証: Lottie往復・動画書き出しフック",
    ],
    modules: [
      {
        title: "組み合わせ検証(v2)",
        body: "シーケンス再生(実験A→B)と、背景系実験+ロゴ系実験の重ね合わせの検証。",
      },
      {
        title: "本体への移植",
        body: "採用が決まった実験をプレゼンテーション(/p/[id])のシーンとして組み込む。各実験は1ファイル完結で移植前提の構造。",
      },
    ],
  },
  {
    slug: "image",
    name: "Image Lab",
    titleJa: "画像生成研究所",
    tagline: "ロゴを1ピクセルも崩さないハーネス付き画像生成",
    status: "planned",
    layer: "レイヤー3: 生成AIハーネス(看板・プロダクト・シーンへのロゴ配置。中位の課金層)",
    description:
      "生成AIで「ロゴ入りの商用品質画像」を作るためのパイプライン研究。生成モデルにロゴを描かせると必ず崩れるため、ロゴの完全性を保ったままシーンに溶け込ませる『ハーネスエンジニアリング』が本体。最も変化が速い領域のため、調査結果の賞味期限は3ヶ月程度と割り切って回す。",
    scope: [
      "ロゴ・テキスト保持に強いモデルの実測(Ideogram / Recraft 系)",
      "Flux系 ControlNet / inpainting によるロゴ領域の保護",
      "編集モデル(Nano Banana 系)によるシーン内ロゴ配置(本体シーン10 Generated が既存の入口)",
      "ハイブリッド構成: シーンだけ生成 → ロゴは後段でレイヤー合成(パース+ライティングマッチ)",
    ],
    modules: [
      {
        title: "調査モジュール(ディープリサーチ)",
        body: "評価軸はロゴ保持精度・API化可否・1枚あたりコスト・商用ライセンス(生成物の権利)。モデル比較ではなく『どのパイプライン構成が商用品質に届くか』を問う。",
      },
      {
        title: "実験場の構想",
        body: "Motion Lab と同じカタログUI: プロンプト/構成テンプレートを実験単位で登録し、選択中のロゴを流し込んで結果を並置比較・星評価する。",
      },
    ],
  },
  {
    slug: "video",
    name: "Video Lab",
    titleJa: "映像生成研究所",
    tagline: "ショートビデオ(5〜10秒)と30秒プロモビデオの生成パイプライン",
    status: "planned",
    layer: "レイヤー4〜5: 映像生成(1回あたり実費が大きい重課金層。無料キャンペーンは原価計算が前提)",
    description:
      "ロゴ/ブランド要素を起点にした企業プレゼン映像の研究。単発のショートビデオと、蓄積素材を組み立てる30秒プロモの2段構え。『構成はアルゴリズム、素材の一部だけ生成』が現実解という仮説を検証する。",
    scope: [
      "ショートビデオAPI: Seedance / Veo / Kling / Higgsfield / Runway の品質・コスト・レート制限・商用条件",
      "方式比較: image-to-video(Image Lab / Workflow Lab の出力を動かす)vs プロンプトのみ",
      "無料3回キャンペーンの原価計算(体験原資の単価。集客設計に直結)",
      "30秒プロモ: Remotion / ffmpeg テンプレート駆動のコンポジション+生成クリップ+テロップ+BGM(生成BGMのライセンス)",
    ],
    modules: [
      {
        title: "調査モジュール①: ショートビデオ生成API",
        body: "5〜10秒の企業プレゼン映像を各APIで実測し、1本あたり実費とロゴ保持品質を比較。ここで課金設計の数字の根拠が初めて具体化する。",
      },
      {
        title: "調査モジュール②: 30秒プロモの組み立て",
        body: "生成AIに30秒丸ごと作らせるのではなく、ブランドページ・モックアップ・生成クリップ・タグラインをテンプレートに流し込む編集パイプラインの検証。",
      },
    ],
  },
  {
    slug: "workflow",
    name: "Workflow Lab",
    titleJa: "制作連携研究所",
    tagline: "Figma・Blender・Photoshop 連携による高品質モックアップの自動合成",
    status: "planned",
    layer: "レイヤー2.5: 非生成AIの高品質合成(裏側でプロツールのワークフローを回す差別化の本丸)",
    description:
      "Webブラウザだけでは出せない品質を、サーバーサイドでプロツールのワークフローを回して作る研究。スマートオブジェクト方式のモックアップ合成を自動化できれば、生成AIに頼らず写実品質を安定供給できる。",
    scope: [
      "Photoshop API(スマートオブジェクト差し替え)の料金・制約、Photopea API 等の代替",
      "ヘッドレスBlender レンダーファーム: テンプレートシーンにロゴテクスチャを差し替えてレンダリング(コスト/秒)",
      "ImageMagick によるパース変換+ディスプレイスメントの自作合成",
      "Figma 連携: ロゴ・ガイドラインの取り込み/書き出しワークフロー(プラグイン / REST API)",
      "モックアップ素材の権利関係(市販PSDをSaaSの自動処理に使えるライセンスか)",
    ],
    modules: [
      {
        title: "調査モジュール(ディープリサーチ)",
        body: "判断基準は『1生成あたりのコストと秒数』『品質の上限』『テンプレート追加の作業量』。MCP経由でBlender/Photoshopを操作する構成もここで検証する。",
      },
    ],
  },
];

export function getLab(slug: string): LabInfo | undefined {
  return LABS.find((lab) => lab.slug === slug);
}
