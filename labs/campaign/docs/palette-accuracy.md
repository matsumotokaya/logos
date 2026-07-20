# パレット精度の改善計画（引き継ぎ資料）

最終更新: 2026-07-19
ステータス: **Tier S 実装済み**（2026-07-19）。実装の対応表と実測結果は[§6](#6-tier-s-実装2026-07-19)。

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

## 6. Tier S 実装（2026-07-19）

§3の設計をそのまま実装した。設計とコードの対応:

| 設計 | 実装 |
|---|---|
| Stage 1 実画面証拠収集 | `lib/campaign/capture.ts` — `captureSite()`。Playwrightを動的import（Chromiumが無いホストではnullを返しフォールバック）。デスクトップ1440/モバイル390スクショ、フルページ（高さ4500pxまで・縮小）、computed styleヒストグラム（背景=面積、テキスト=文字数×fontSize²、ボーダー、インタラクティブ要素別枠）、`:root`CSS変数、ヘッダーロゴ要素スクショ+favicon画素解析（sharp） |
| Stage 2 決定論候補生成 | `lib/campaign/palette.ts` — `buildPaletteCandidates()`。CIELAB(ΔE76、閾値10)の貪欲クラスタリング。候補最大14色、各候補に証拠文字列（背景面積%・ボタン/リンク要素数・CSS変数名・ロゴ含有%） |
| Stage 3 VLM裁定 | `lib/campaign/creative.ts` — `adjudicatePalette()`。**候補hexのz.enumで出力を構造的に制約**（発明は不可能）。不十分なら`assessment: "insufficient"`→ generated経路へ。裁定結果は`generateBrandKit()`後にコードで強制上書き（LLMの従順さに依存しない） |
| Stage 4 自己検証 | `lib/campaign/creative.ts` `judgeBrandMatch()` + `lib/campaign/pipeline.ts`。生成LPを`screenshotHtml()`でスクショ→元サイトと比較→pass / palette_mismatch / tone_mismatch。不一致なら指摘をfeedbackとして1回だけ再裁定+再生成 |
| `palette_source`フラグ | `lib/campaign/schema.ts` の `BrandSchema`。UI（CampaignStudio）に「サイトから抽出」/「AI提案」バッジ |
| オーケストレーション | `lib/campaign/pipeline.ts` `runCampaignPipeline()` — API routeとCLIの唯一の実装。CLIは`--no-verify`でStage 4を省略可、`candidates.json` / `original.jpg` / `lp.jpg` をデバッグ出力 |

実装上の注意:

- **`page.evaluate`に関数を渡さない**。tsx(esbuild)のkeepNamesが`__name`ヘルパーを注入し、ブラウザ側で`ReferenceError: __name is not defined`になる。ページ内コレクタは純粋JSの文字列（`COLLECT_PAGE_COLORS`）として保持している
- Playwright/Chromiumはローカルに`npm i playwright && npx playwright install chromium`で導入済み。`playwright`はNext.jsの既定`serverExternalPackages`に含まれるためnext.config変更は不要。Vercel本番ではcaptureがnullになりgenerated経路に落ちる（設計どおり。マネージド差し替えは`docs/deep-research-prompts.md`§4）
- 裁定・検証のモデルは`lib/campaign/creative.ts`の`MODEL`（Tier S実装・受け入れ実測は`claude-opus-4-8`で実施。2026-07-19にOpenAI `gpt-5.6-terra`へ切り替え——請求体系の都合。Tierを下げる際の第一候補は検証の省略と裁定モデルの軽量化=luna）

### 実測結果（受け入れ基準の検証・2026-07-19）

| 基準 | 結果 |
|---|---|
| wealth-park.com/ja/business/ で白/黒/青・緑なし | ✅ `#ffffff` bg / `#000000` text・primary / `#1e6cff` accent（ボタン・リンク34要素 + `--wp-color-link` が証拠）。緑は候補にすら現れない。verification: pass |
| `palette_source` フラグ | ✅ capture成功時 `"extracted"`。capture失敗時（フォールバック経路を実測）は `"generated"` が立ち、AI提案パレット（このときはティール——まさに旧破綻経路）がバッジで明示される |
| anthropic.com の非劣化 | ✅ `#f0eee6`（実際のアイボリー）bg / `#141413` text・primary。verification: pass。静的解析時代より忠実 |

実測ログ・スクショ・候補リストは `var/campaign/<slug>/`（`candidates.json` / `original.jpg` / `lp.jpg`）。

実装後に見つけて塞いだ問題:

- **裁定が surface に暗色を選び黒地黒文字になる**ケース（anthropic.com 初回で発生。検証はabove-the-foldしか見ないためpassしてしまう）→ 裁定後に決定論ガードを追加: `contrast(surface, text) < 4.5` なら surface を background にスナップ（`creative.ts`）。品質はコード側で保証する原則どおり

## 7. 精度パス2（2026-07-20・funds.jp事例）

funds.jp の実測で3つの構造的な穴が見つかった。いずれも「証拠の収集範囲」の問題で、Tier S の骨格（決定論候補+choose-only裁定）自体は変えていない。

**事象**: (a) ヘッダーにインラインSVGロゴがあるのに「特定できず」 (b) 画面の過半を占める空色グラデーションのヒーローが候補にすら現れず、accent=primary=紺で裁定 (c) デザイントークンが宣言スタック先頭の機械採用（LP側もトークンを表示するだけで未使用）。

| 穴 | 原因 | 修正 |
|---|---|---|
| ロゴ不検出 | セレクタの**最初のマッチだけ**を試し、それが0×0のアイコンスプライト`<svg>`だと即諦めていた（funds.jpは3番目のマッチが本物） | `PICK_LOGO_ELEMENT`（capture.ts）: 全候補をページ内でスコアリング（logo/brand命名+3、`href="/"`内+3、上部+2、ワードマーク比率+2、アイコンサイズ減点等）し、最良1つをスクショ。**インラインSVGは計算済みfill/strokeを焼き込んでベクターのまま取得**（`assets.logo_svg`、LP/ダイジェストはPNGより優先）。faviconフォールバックはapple-touch-icon等PNG系を優先（ingest.ts） |
| ヒーロー色の欠落 | 証拠が computed style の `backgroundColor` のみ。**グラデーション（background-image）と画像はヒストグラムに構造的に映らない** | 証拠を3系統追加: ①`backgroundImage`のgradient色ストップ（面積加重）②レンダリング済みビューポートの**画素ヒストグラム**（sharp、16階調量子化）③**og:image（キービジュアル）の支配色**。palette.tsの候補選定に「グラデ背景」「画面ピクセル%」「キービジュアル%」枠を追加。裁定プロンプトも「ヒーロー/KVを支配する色相はボタンに出ていなくても正当なブランド色」「accentはprimaryと異なる第2色相を優先、モノクロームブランドのみ同色可」に更新。検証プロンプトに「原サイトを支配する色相が生成ページに皆無なら palette_mismatch」を追加 |
| トークンが雑 | フォント=宣言スタックの先頭（リセット由来でも採用）、ボタン=円形アイコンボタン（radius 50%）混入、**LPはトークンを使っていない** | フォント: genericと`* Fallback`（next/fontのシム）を除いた実ファミリー上位2つ（例 `Ubuntu, Noto Sans JP`）。ボタン: CTA色（彩度or暗色）かつボタン比率の要素のみ、`<a>`が未塗装なら単独子要素を追跡、pillは`999px`に正規化。**render-lpがトークンを実適用**: フォントスタック先頭（既知ファミリーはGoogle Fontsから読込=LPで唯一の外部依存）、`.btn`角丸、コンテナ幅（880–1240にクランプ）、セクション余白（56–140） |

**実測結果（2026-07-20）**:

| サイト | 結果 |
|---|---|
| funds.jp | ✅ ロゴ=インラインSVGベクター取得。候補11色（#70dbfdに「グラデ背景67%/画面ピクセル20%/KV34%」の証拠）。裁定 primary `#062952`（紺）/ accent `#70dbfd`（空色）。トークン `Ubuntu, Noto Sans JP`・pill・1100px がLPに実適用。verification: pass |
| anthropic.com 非劣化 | ✅ `#f0eee6` / `#141413` 維持。モノクロームブランドとして accent=primary を正しく維持。実フォント Anthropic Serif / Anthropic Sans を捕捉（Google Fonts外はフォールバック） |

デバッグはLLM無しで回せる: capture+palette だけを叩くハーネスをscratchpadに作り、候補リストと証拠行を直接見る（`NODE_OPTIONS=--conditions=react-server npx tsx` で `captureSite`+`buildPaletteCandidates` を呼ぶ）。
