"use client";

// Workflow Lab — catalog page root.
// Phase 1 of the brand-visual pipeline: pre-built stage templates +
// deterministic composition. The bar is the same as every lab: does the
// logo itself look dignified? The logo is never touched by generative AI.
//
// Page skeleton (header / explainer / logo rail / logo-driven content)
// comes from the shared LabShell: pick a logo, every template below
// recomposes with it.

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  type TemplateCategory,
} from "@/labs/workflow/core/template-format";
import type { CatalogEntryDto } from "@/labs/workflow/core/pipeline";
import { fetchCatalog } from "@/labs/workflow/core/client";
import LabShell from "@/labs/shared/components/LabShell";
import FilterChips from "@/labs/shared/components/FilterChips";
import { LabExplainer, ExplainerModule } from "@/labs/shared/components/LabExplainer";
import TemplateCard from "./TemplateCard";
import ComposeModal from "./ComposeModal";
import CostPanel from "./CostPanel";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

export default function WorkflowLabApp() {
  const [catalog, setCatalog] = useState<CatalogEntryDto[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [jobTick, setJobTick] = useState(0);

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((e: unknown) =>
        setCatalogError(e instanceof Error ? e.message : "カタログ取得に失敗"),
      );
  }, []);

  const usedCategories = useMemo(
    () =>
      CATEGORIES.filter((c) =>
        (catalog ?? []).some((e) => e.template?.category === c),
      ),
    [catalog],
  );

  const filtered = (catalog ?? []).filter(
    (e) => category === "all" || !e.template || e.template.category === category,
  );

  const openEntry = openId
    ? catalog?.find((e) => e.id === openId && e.template)
    : undefined;

  return (
    <LabShell
      slug="workflow"
      explainer={<ArchitectureNote />}
      logoNote="SVG推奨。ロゴは合成のため自サーバーにのみ送信され、外部AI・外部APIには渡らない。"
    >
      {(logo) => (
        <>
          {usedCategories.length > 1 && (
            <div className="border-b border-hairline">
              <div className="mx-auto max-w-6xl px-6 md:px-10 py-3">
                <FilterChips
                  label="カテゴリ"
                  value={category}
                  onChange={(v) => setCategory(v as TemplateCategory | "all")}
                  options={usedCategories.map((c) => [c, CATEGORY_LABELS[c]])}
                />
              </div>
            </div>
          )}

          <main className="mx-auto max-w-6xl px-6 md:px-10 py-6">
            {catalogError ? (
              <p className="py-16 text-center text-sm text-red-600">{catalogError}</p>
            ) : catalog === null ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                テンプレートを読み込み中…
              </p>
            ) : catalog.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                テンプレートがまだない。labs/workflow/templates/ にディレクトリを追加する
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((entry) => (
                  <TemplateCard
                    key={entry.id}
                    entry={entry}
                    logo={logo}
                    onOpen={setOpenId}
                    onComposed={() => setJobTick((n) => n + 1)}
                  />
                ))}
              </div>
            )}
          </main>

          <CostPanel refreshKey={jobTick} />

          {openEntry?.template && (
            <ComposeModal
              template={openEntry.template}
              logo={logo}
              onClose={() => setOpenId(null)}
              onComposed={() => setJobTick((n) => n + 1)}
            />
          )}
        </>
      )}
    </LabShell>
  );
}

// The lab's whole premise ("logo untouched by AI") is easy to state and easy
// to disbelieve without seeing the pipeline. This panel is the condensed,
// UI-facing version of the requirement doc (labs/workflow/README.md) — the
// 5-layer architecture and where Phase 1 sits in it. Each card's own
// "技術解説" then drills into the specific numbers for that template.
function ArchitectureNote() {
  return (
    <LabExplainer
      summary="仕組みを見る — なぜ生成AIにロゴを触らせないのか(5層アーキテクチャとPhase 1の位置づけ)"
      gridClass="sm:grid-cols-2 lg:grid-cols-5"
      footnote={
        <>
          大原則:「舞台はAIで生成し、ロゴは決定論的に合成する」。現行の画像生成・編集モデルは「ロゴをなるべく保つ」ことはできても「絶対に不変」は保証しないため、顧客のロゴを1ピクセルも崩さない価値はレイヤー合成・テンプレート差し替えという決定論的処理でのみ担保する。要件の正本は{" "}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">labs/workflow/README.md</code>。
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
