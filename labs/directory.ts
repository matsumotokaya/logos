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
    titleJa: "ブランドビジュアル生成研究所",
    tagline: "舞台はAIで生成し、ロゴは決定論的に合成する",
    status: "active",
    layer: "レイヤー2.5〜3: テンプレート合成(低〜中課金)+ 生成AIハーネス(中位の課金層)",
    description:
      "モックアップ/ブランドビジュアル生成パイプラインの研究所。生成モデルにロゴ本体は絶対に触れさせず、レイヤー合成・テンプレート差し替えという決定論的処理でのみ扱う(要件の正本は labs/image/README.md)。Phase 1(2Dテンプレートフォーマット+合成エンジン+テンプレート3種)が稼働中: AI生成なし=変動費ほぼゼロで、無料体験の画像セットを成立させる層。",
    scope: [
      "2Dテンプレートフォーマット(合成面パース・ディスプレイスメント・ライティング乗算・クリアスペース)の設計と拡充",
      "決定論的合成エンジン(sharp+純TSホモグラフィ)と1ジョブ単位の原価計測",
      "Phase 2: QAゲート(忠実度・配置ジオメトリの回帰テスト)+ヘッドレスBlenderワーカー",
      "Phase 3: 舞台生成層(第一プロバイダ Recraft V4.1、Together経由FLUX、生成物の即時回収、プロバイダ抽象化)",
    ],
    modules: [
      {
        title: "Phase 1: 決定論的合成の実験場(稼働中)",
        body: "Motion Lab と同型のカタログUI。テンプレートはコード変更なしで追加でき(labs/image/templates/)、選択中のロゴが全テンプレートに即時合成される。星評価・研究ノートで品質判断を蓄積。",
      },
      {
        title: "未解決事項の検証",
        body: "テンプレート焼き込みライティングとAI生成舞台の光の整合(Phase 3前に小検証)、細線・グラデーションSVGのラスタライズ品質、Blenderレンダリング実コスト。",
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
      "ヘッドレスBlender レンダーファーム: テンプレートシーンにロゴテクスチャを差し替えてレンダリング(コスト/秒)。パイプライン要件は labs/image/README.md の Phase 2 と合流",
      "(2Dのパース変換+ディスプレイスメント自作合成は Image Lab Phase 1 で実装済み → 移管)",
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
