"use client";

import {
  ExplainerModule,
  LabExplainer,
} from "@/labs/shared/components/LabExplainer";

export default function ArchitectureNote() {
  return (
    <LabExplainer
      summary="仕組みを見る — なぜ生成AIにロゴを触らせないのか(5層アーキテクチャとPhase 1の位置づけ)"
      gridClass="sm:grid-cols-2 lg:grid-cols-5"
      footnote={
        <>
          大原則:「舞台はAIで生成し、ロゴは決定論的に合成する」。現行の画像生成・編集モデルは「ロゴをなるべく保つ」ことはできても「絶対に不変」は保証しないため、顧客のロゴを1ピクセルも崩さない価値はレイヤー合成・テンプレート差し替えという決定論的処理でのみ担保する。要件の正本は{" "}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">
            labs/workflow/README.md
          </code>
          。
        </>
      }
    >
      <ExplainerModule
        code="Layer 1"
        title="テンプレート層"
        active
        body="舞台の見た目とロゴ合成面の仕様(logos-2d-template@1)。四隅座標・ディスプレイスメント・ライティング・クリアスペースを持つ自前フォーマット。ディレクトリを置くだけでコード変更なしにカタログへ追加される。"
      />
      <ExplainerModule
        code="Layer 2"
        title="合成エンジン層"
        active
        body="sharp + 純TypeScriptのホモグラフィ/バイリニアワープ/アルファベースのコンタクトシャドウ。外部バイナリ(ImageMagick等)には依存しない、このラボが今動かしている核。"
      />
      <ExplainerModule
        code="Layer 3"
        title="舞台生成層"
        body="ユーザーが独自シーンを求めた時だけAIを使う(課金機能・Phase 3・未着手)。第一候補 Recraft V4.1。ロゴは相変わらずLayer 2で決定論的に合成し、AIは背景の生成のみ担当する。"
      />
      <ExplainerModule
        code="Layer 4"
        title="QAゲート層"
        body="合成結果がブランド準拠かをルールベースで自動判定(Phase 2・未着手)。ロゴ忠実度・配置ジオメトリ・生成物の不適切要素を検出する。"
      />
      <ExplainerModule
        code="Layer 5"
        title="仕上げ層"
        body="印刷向けアップスケール、ライティング調和(Phase 4・未着手)。当面はテンプレート焼き込みライティングのみで対応する方針。"
      />
    </LabExplainer>
  );
}
