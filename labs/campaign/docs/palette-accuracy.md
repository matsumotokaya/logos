# パレット精度の改善計画（引き継ぎ資料）

最終更新: 2026-07-19
ステータス: **未着手（設計済み）**。次のラボ作業はここから。

## 1. 事象

`https://wealth-park.com/ja/business/` を入力すると、実サイトは「白ベース・黒文字・青アクセント」なのに、生成されたBrand Kitは**サイトのどこにも存在しない緑**をブランドカラーとして返した。

## 2. 原因（2026-07-19 実測で確定）

LLMに**色の証拠が一切渡っていない**まま、プロンプトの補完指示によって色が発明されている。

実測結果:

| 信号 | 結果 |
|---|---|
| `colorHints`（HTML本文の6桁hex正規表現） | **空配列**。このサイトは色を外部CSSで定義しており、現行実装は linked stylesheet を取得しない。`#fff` 短縮形・`rgb()`・CSS変数も拾えない |
| og:image（唯一の視覚素材） | 画素解析で**69%が白**、残りもグレースケール。青すら含まれない白背景バナー |
| テキスト | 「不動産管理SaaS」等の内容のみ |

→ Claudeは証拠ゼロの状態で、システムプロンプトの「ヒントが無ければジャンルに合うパレットを選べ」に従い、業種連想で緑を創作した。誤検出ではなく**根拠なき生成**。anthropic.com で精度が高く見えたのは、あのサイトがHTML内にインラインで色を持つ例外だったため。

構造的な問題: **レンダリング後の実画面を誰も見ていない**。HTMLソースの静的解析では、CSSカスケード・外部CSS・JSレンダリング後の見た目に到達できない。

## 3. 最強プラン（精度優先・コスト度外視 → 後から段階的に間引く）

方針: まず Tier S（最強）を実装して精度の上限を確認し、そこからコストと相談して Tier を下げる。アハ体験の初回品質が最優先。

### Tier S: レンダリング証拠 + 決定論候補 + VLM裁定 + 自己検証

**Stage 1 — 実画面の証拠収集（Playwright）**
1. Headless Chromiumで対象URLを開く（networkidle待ち）
2. 収集物:
   - スクリーンショット: デスクトップ1440px（above-the-fold + フルページ）、モバイル390px
   - **computed styleヒストグラム**: 可視DOM要素を走査し、`color` / `background-color` / `border-color` / SVG `fill` を**画面上の占有面積で重み付け**して集計（= 実際に見えている色の分布）
   - **アクセント検出（キモ）**: `a`, `button`, `[role=button]`, input系のcomputed styleだけを別枠で集計。ブランドのアクセント色はほぼ確実にインタラクティブ要素に現れる
   - `:root` のCSSカスタム変数（`--primary` 等の命名自体が強い信号）
   - ヘッダー内ロゴ要素（img/svg）の要素スクリーンショット + 高解像度favicon

**Stage 2 — 決定論的パレット候補生成**
- ヒストグラムをCIELAB空間でクラスタリング（ΔE閾値）し、役割候補を機械的に算出:
  - background = 最大面積の明色 / text = 大面積・高コントラスト色 / accent候補 = インタラクティブ要素の彩度上位色 + ロゴ主要色
- 各候補に証拠を添付: 「面積12%」「ボタン14個で使用」「ロゴに含まれる」

**Stage 3 — VLM裁定（Claude vision・structured output）**
- スクリーンショット群 + 候補リスト（証拠付き）をClaudeに渡し、役割割当（primary/accent/bg/surface/text）を行わせる
- **重要な制約**: 出力は候補hexの中からの選択に限定（enum的制約）。候補が不十分な場合は発明せず `palette_source: "generated"` フラグを立てて提案パレットであることを明示（UIで「サイトから抽出」/「AI提案」のバッジを分ける）
- 現行プロンプトの「Otherwise choose a palette...」を「証拠がある場合は絶対に発明しない」に書き換える

**Stage 4 — 自己検証ループ（最強たる所以）**
- 生成したBrand KitでLPをレンダリング → Playwrightでスクショ → 元サイトのスクショと並べてClaudeに「同じブランドに見えるか」を判定させる（structured: pass / palette_mismatch / tone_mismatch + 理由）
- 不一致なら指摘を添えて1回だけ再生成。これで「見れば一発でわかる間違い」が出荷されなくなる

### Tierラダー（チューニングの下げ方）

| Tier | 構成 | 追加コスト/1回 | 想定精度 |
|---|---|---|---|
| **S** | Playwright(2viewport) + 候補生成 + VLM裁定 + 自己検証 | スクショ数枚 + Claude呼び出し+2回 | 最高。まずここから |
| A | Playwright(1viewport) + 候補生成 + VLM裁定（検証なし） | +1回 | Sとの差分を計測して判断 |
| B | Playwright + computed styleヒストグラムのみ（裁定は既存creative呼び出しに証拠として同梱） | LLM追加なし | 候補品質が高ければ十分な可能性 |
| C(現行) | HTML正規表現 + og:image | — | wealth-parkで破綻することが実証済み |

### Tierに依らない即効修正（先にやってよい）
1. **linked stylesheetの取得**: `<link rel="stylesheet">` を数ファイル分fetchし、`#fff`短縮形・`rgb()`・CSS変数込みで色抽出 → `colorHints` の空振りを大幅に減らす（Playwright不要の底上げ）
2. **プロンプト修正**: 証拠の有無で分岐を明示 + `palette_source` フラグをスキーマに追加
3. og:imageの単色率チェック: ほぼ単色（証拠価値なし）なら「キービジュアル」としてLLMに渡す際の扱いを注記する

## 4. 実装メモ

- 新規ファイル想定: `lib/campaign/capture.ts`（Playwright制御・server専用）、`lib/campaign/palette.ts`（クラスタリング・候補生成）。`creative.ts` は候補+証拠を受け取る形に拡張、`schema.ts` に `palette_source` 追加
- Playwrightの実行環境: ローカル/ラボは `playwright` + chromiumで良い。**Vercel本番ではChromiumが動かない**ので、プロダクト化時は Browserless / Browserbase / Cloudflare Browser Rendering 等のマネージドに差し替える（`docs/deep-research-prompts.md` の§4がこの選定用）
- クラスタリングは依存を増やさず自前実装で足りる（CIELAB変換 + 単純な貪欲クラスタ）。sharpは導入済みで画素解析に使える

## 5. 受け入れ基準

- `wealth-park.com/ja/business/` → background 白系 / text 黒系 / accent 青系 が返ること。緑が出ないこと
- 証拠が取れたサイトで `palette_source: "extracted"`、取れないソース（テキストのみ入力等）で `"generated"` が正しく立つこと
- anthropic.com 等、現在うまくいっているケースが劣化しないこと（回帰確認）
