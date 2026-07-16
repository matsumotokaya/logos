# logos(仮称)

SVGロゴを1つアップロードすると、Behance品質のブランドプレゼンテーションがゼロタッチで生成されるサービスのPoC。

サービス名は仮。[lib/config.ts](lib/config.ts) の `SERVICE_NAME` を変更すれば全体に反映される。

## ドキュメント(正本マップ)

**このREADMEが全ドキュメントの唯一の入り口。** ここ(または、ここからたどれるサブディレクトリのREADME)にリンクされていないドキュメントは存在しないものとして扱う。運用ルール:

1. 新しいドキュメントを作るときは、必ずこの表かサブREADMEにリンクを追加する。リンクを張る場所がない=作らずに既存の正本を更新する
2. **1テーマ=1正本**。似たテーマの文書を新設せず、既存文書を更新する(スコープは各正本の見出しに従う)
3. サブディレクトリのREADME(例: [labs/README.md](labs/README.md))は、その配下の入り口を兼ねる

| ドキュメント | 正本として扱う内容 |
|---|---|
| [PRODUCT.md](PRODUCT.md) | 事業構想・3層のプロダクト構想・収益モデル・差別化戦略 |
| [docs/account-design.md](docs/account-design.md) | アカウント・権限・URL体系・RLS方針(Supabase設計) |
| [docs/data-model.md](docs/data-model.md) | ロゴの正本(canonical record)・3層分離・CDN URL・サイト構造 |
| [docs/logo-entity-lab-integration.md](docs/logo-entity-lab-integration.md) | Labs↔ロゴ正本エンティティ統合の要件・実装状況・ランタイムassetの暫定手動運用と次セッション引き継ぎ |
| [labs/README.md](labs/README.md) | **研究所群の入り口**: モード分類(保証/探索/統合)・体験レイヤー=課金の階段・ラボ一覧と現在地・ラボ追加手順 |
| [labs/motion/README.md](labs/motion/README.md) | Motion Lab: 16実験カタログ・美的原則・使用技術とLottie比較 |
| [AGENTS.md](AGENTS.md) | AIエージェント向けの開発上の注意(CLAUDE.md はこれを参照するだけ) |

このほか `.claude/skills/` はClaude Code用のツール定義であり、ドキュメントではない。

## ページ構成

| パス | 内容 |
|---|---|
| `/` | ロゴ投稿UI(メイン導線)+ ギャラリー(「あなたのロゴ」+ 全ユーザーの公開ロゴの図鑑)。カードから各プレゼンへ |
| `/p/[id]` | 生成されたブランドプレゼンテーション(共有可能な固有URL)。**所有者のみ**ヘッダーの「編集」でキャッチコピー・ストーリー・各シーンのリード文に加え、**どの motion / mockup / generated asset を各プレゼン配置に採用するか**をその場で切り替えられる。`/p/sample` はサンプル(編集不可) |
| `/brand` | **Brand Manager**(旧称 Admin)。導入企業が**自社のブランド資産**(ロゴ・物品在庫・組織メンバー・公開ハンドル)を管理するハブ。プラットフォーム運営側の管理画面ではなく、そのブランドを持つ組織のための画面 |
| `/assets` | アセットライブラリ。自分/所属組織が管理するロゴアセットを一覧し、各アセット詳細へ入る |
| `/assets/[id]` | アセット詳細ページ。現時点ではロゴ正本の編集(正式名称・主体entity・ロゴ形式・役割・親子関係・公開範囲・公開スラッグ・コンタクト表示・タグ・制作クレジット・商標情報・マスターファイル差し替え・**組織への所有移管**・作業履歴)。あわせて**このロゴで現在どのプレゼン asset が採用されているか**、candidate配下のlockup / colorway階層も確認できる。旧 `/brand/logos/[id]` は同じ画面を指す互換URL |
| `/settings` | 設定ページ。現時点ではユーザー情報表示・プロフィール編集枠・退会導線のプレースホルダー |
| `/[handle]/[slug]` | バニティURL。組織ハンドル+ロゴスラッグを正規パーマリンク `/p/[id]` に解決(公開ロゴのみ) |
| `/labs` | **研究所インデックス**(noindex)。表現R&Dのラボ群を**保証モード/探索モード/統合(将来枠)**で分類: 稼働中の [Motion Lab](labs/motion/README.md)(`/labs/motion`)・[Workflow Lab](labs/workflow/README.md)(`/labs/workflow`、旧称 Image Lab)・[Generative Lab](labs/generative/README.md)(`/labs/generative`、探索モード)と、将来枠の Campaign Lab。**各ラボは「プレゼン本編に入る section asset を設計・検証し、採用候補を作る場」**として位置づける。全体像は [labs/README.md](labs/README.md)。旧 `/lab` → `/labs/motion`、旧 `/labs/image` → `/labs/workflow` へリダイレクト |

URL体系の設計意図(所有者を含まない壊れないパーマリンク等)は [docs/account-design.md](docs/account-design.md) を参照。

## プレゼン構成モデル

このプロダクトでは、プレゼンテーション本編を**固定実装の寄せ集め**としてではなく、**presentation asset catalog から組み立てるドキュメント**として扱う。

- 各 motion / mockup / generated asset はLabs共通カタログに入り、提供側の成熟度 `draft / production` と「どの presentation placement に入れられるか」を持つ
- `draft` はLabだけ、`production` はLabと利用者向けプレゼン編集UIに表示する
- 各ロゴはproduction assetについて「その placement に何を表示するか」という **per-logo の layout**(`enabled / order / params`)を持つ
- ラボは未完成・完成済みを含む全assetを置き、productionへ昇格できる品質かを判断する場である
- 将来的には利用者自身がこの catalog から構成を選び、プレゼンを後編集できる。現行実装もその前提で設計している

現時点での presentation placement は `splash.hero` / `social.primary` / `onsite.primary` / `merch.primary` / `generated.tile`。このうち特にラボとの接続が強いのは後半の mockup / generated 系 section で、現在は **07 Social / 08 On-site / 09 Merchandise / 10 Generated** が asset catalog から描画される。

## 生成されるプレゼンテーション(`/p/[id]`)

SVGをアップロードすると、以下が1本のガイドラインドキュメントとして生成される。冒頭に Splash(オープニングアニメーション)と Contents(目次)、続いて番号付きの10シーンが並ぶ。

| # | シーン | 内容 |
|---|--------|------|
| — | Splash | 巨大タイポ + ロゴマークのオープニング演出(スクロールキュー・リプレイ/一時停止) |
| — | Contents | 全シーンへ飛べる目次ナビ |
| 01 | The mark (Identity) | ロゴの意味・最小サイズ・余白などアイデンティティの基本 |
| 02 | Construction | ベジェのアンカー/ハンドルを実データから抽出して可視化 |
| 03 | Color | 面積加重で色を自動抽出し、HEX/RGB/CMYK付きカラーバンドに展開 |
| 04 | Logo usage | 配色パターングリッド(白地/ブランドカラー地/黒地/白抜き) |
| 05 | App icon | iOS風アイコンと配色バリエーション |
| 06 | Web | ブラウザクローム内ファビコン + 48/32/16pxサイズランプ |
| 07 | Social | Social placement に採用された asset 群。既定では認証バッジ付きプロフィールカードのモックアップ |
| 08 | On-site | On-site placement に採用された asset 群。既定ではラニヤード付き社員証モックアップ |
| 09 | Merchandise | Merchandise placement に採用された asset 群。既定ではTシャツへのmultiply合成(コードベースの精密配置)。Workflow Lab で作った名刺・トート等もここへ採用可能 |
| 10 | Generated | Generated placement に採用された asset 群。既定では Gemini API(Nano Banana)によるマグカップ/トート/キャップの写実モックアップ生成。**手動生成**——各タイルの「生成」ボタンで1枚ずつ(APIコストが発生するため自動生成はしない)。生成済みはロゴ単位でキャッシュされ再生成されない |

ロゴが手元になくても、ランディングの「サンプルを見る」からサンプルプレゼンを確認できる。

### 所有者によるプレゼン編集

所有者は `/p/[id]` のヘッダー「編集」から、以下の2層をその場で編集できる。

- **文言層**: キャッチコピー・ストーリー・各シーンのリード文
- **構成層**: 各 presentation placement にどの asset を採用するか、またその表示順

アセット詳細ページ `/assets/[id]` では、このロゴの**現在の採用 asset 一覧**を確認でき、そこから本編編集へ移動できる。

## 多言語対応

UIコピーは [lib/i18n/](lib/i18n/) の辞書で **en / ja / ko / zh-Hant / zh-Hans の5言語**に対応。ヘッダーの `LanguageSwitcher` で切り替え、選択は永続化され `<html lang>` にも反映される。英語を正本の型([lib/i18n/dictionaries.ts](lib/i18n/dictionaries.ts) の `Dict`)とし、全ロケールが完全な辞書を持つ(実行時フォールバックの穴を作らない)。

## Brand Manager(`/brand`)

> **名称について**: 以前は「Admin(管理コンソール)」だったが、"Admin" だと**プラットフォーム運営側の管理画面**なのか**導入企業側の管理画面**なのか曖昧だった。この画面は後者——**導入企業が自社のブランド資産を管理する**場——なので **Brand Manager** に改称した(2026-07-14。ルートも `/admin` → `/brand`、UIラベルとi18nキー `header.brandManager` も更新済み)。

白ベースのビジネスSaaS風ダッシュボード。KPI(登録アセット数・在庫アイテム数・要発注アイテム数・入荷待ち発注)、会社情報編集、**組織メンバーの招待・ロール管理(オーナー/管理者/編集者/購買担当/閲覧のみ)**、**公開URLハンドルの設定**、登録アセットの一覧・役割設定・削除、ロゴアイテムの在庫管理と発注(ダミーデータ)を表示する。ビジネスモデル(フェーズ3の物販事業)を体現する画面。メール招待は相手がそのメールで登録した瞬間に自動でメンバー化される(SMTP不要)。組織ロール名の「管理者(admin)」はこの画面名とは別物(組織メンバーの権限)。

各アセットの詳細(`/assets/[id]`、旧 `/brand/logos/[id]`)では、正本編集だけでなく**そのロゴのプレゼン構成の現在値**も確認する。つまり Brand Manager は「ロゴファイルを持つ場所」だけでなく、**そのロゴがどんなブランドドキュメントとして出力されるか**を見るハブでもある。

## アーキテクチャ

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- アニメーションは **motion**(scroll-in reveal 等)と **gsap**(Splashの演出)
- ロゴ解析は**全てクライアントサイド**(サーバー・DB不要)。アップロードされたSVGは外部送信されない
  - [lib/svg.ts](lib/svg.ts) — SVG正規化・計算済みスタイルの属性焼き込み・色抽出・単色変換・アウトライン化
  - [lib/paths.ts](lib/paths.ts) — path `d` 属性のパーサ(ベジェ骨格抽出)
  - [lib/color.ts](lib/color.ts) — HEX/RGB/CMYK変換・輝度判定
  - [lib/raster.ts](lib/raster.ts) — SVG→PNGラスタライズ(生成AIへの入力用)
- UIコピーは [lib/i18n/](lib/i18n/) で5言語対応(en/ja/ko/zh-Hant/zh-Hans)
- シーンは [components/scenes/](components/scenes/) にプラグイン式で追加できる([Reveal](components/scenes/Reveal.tsx) / [shared](components/scenes/shared.tsx) を共通部品として利用)
- プレゼン後半の mockup / generated 系 section は **presentation asset catalog** から解決して描画する。各 asset は placement 互換性と default mapping を持ち、ロゴごとの採用状態は `logo_presentations.layout` に保存される
- 写実モックアップ生成は [app/api/generate/route.ts](app/api/generate/route.ts) が Gemini API を呼び出すサーバーサイドルート(APIキーを隠すため)
- データ永続化は [lib/store/](lib/store/) の `BrandRepo` インターフェースで抽象化。Supabase環境変数があればRLS付き実DB、なければ [localStorage実装](lib/store/local.ts)へ切り替わる。Labsのロゴピッカーも同じ正本repoを使う

### presentation asset catalog の現時点の実装

- **概念上の正本**: `presentation_asset_definitions`(全assetの`draft / production`とversion) + `logo_presentations.layout`(利用者ごとのオン/オフ・順序・設定値) + `logo_asset_runs`(candidateごとの処理状態)
- **現時点の定義ソース**: built-in asset のコード定義 + Workflow Lab の `template.json`
- **取得API**: `/api/presentation-assets`

`0006_presentation_assets.sql` が定義とlayoutの基礎、`0007_asset_lifecycle.sql` が成熟度・不変version・実行状態を追加する。`0008_asset_registry.sql` はアセット詳細領域の基礎として、ロゴが表す実世界のブランド主体、lockup / colorway 階層、将来の移管・購入問い合わせを追加する。global asset definition の管理UI/同期はまだこれからで、現段階では **ロゴごとのlayoutとruntime成果物はDB、asset definition自体はcode/template側から供給**される。

### ランタイムBlender assetの暫定手動運用

永続ワーカーを作る前は、Workflow Labの依頼情報を**新しいローカルエージェントセッションへ貼り付けて手動実行する**。新しいセッションは、最初に [Labs↔ロゴ正本エンティティ統合](docs/logo-entity-lab-integration.md#5-ランタイムassetの暫定手動運用)を読むこと。

利用者側の手順:

1. `/labs/workflow/workflow-neon-sign-v1` を開き、bundled test logoではなく対象の正本ロゴを選ぶ
2. `依頼情報をコピー`を押す。処理履歴が必要な場合だけ、先に`レンダー依頼を作成`してRun IDを発行する
3. コピーした全文を新しいエージェントセッションへ貼り、「このruntime assetを実行し、結果を登録して表示まで確認してください」と依頼する

`Logo ID`はロゴをグローバルに一意に特定するため、アカウントIDを別途渡す必要はない。`Candidate ID`は今回使う正確なmaster SVG、`Asset Definition ID`とversionは実行するレシピを固定する。Run IDは暫定手動運用では任意であり、将来のキュー/ワーカー自動化で必須にする。

IDは対象を識別する情報であり、認証情報ではない。認証はprivateなSVGの取得やR2/DBへの書き込み権限を確認するためだけに使う。手動期間はエージェントがこのworkspaceの既存接続設定を使い、依頼文にはSupabase JWT/service role、R2キー、`.env.local`の内容を**含めない**。接続権限がなければ、エージェントは不足している接続または権限を報告し、秘密情報をチャットへ貼るよう求めない。

エージェントが使う標準コマンドは [run-runtime-asset.mjs](labs/workflow/scripts/run-runtime-asset.mjs)。ID照合、private SVG取得、Blender、4:3/中央配置QA、R2保存と読み戻し検証、`logo_mockups`登録を1回で行う。

```bash
node --env-file=.env.local labs/workflow/scripts/run-runtime-asset.mjs \
  --logo-id <Logo ID> \
  --candidate-id <Candidate ID> \
  --asset-id workflow-neon-sign-v1
```

詳細な事前確認、`--run-id`、低サンプル検証用`--no-publish`、合格条件は [暫定手動運用の正本](docs/logo-entity-lab-integration.md#5-ランタイムassetの暫定手動運用)を参照。

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

生成AIモックアップ(シーン10)を試すには `.env.local` に以下を設定して再起動する(生成は各タイルの手動ボタンで実行):

```
GEMINI_API_KEY=（Google AI Studioで発行したキー、課金有効なプロジェクトのもの）
```

Generative Lab(`/labs/generative`)の実エンジンを使うには `TOGETHER_API_KEY` / `RECRAFT_API_KEY` も設定する(未設定ならモックで全フローが動く)。詳細は [labs/generative/README.md](labs/generative/README.md)。

Cloudflare R2 を使う場合は `.env.local` に以下も設定する。現時点では **Generative Lab の生成画像保存先** と **シーン10 モックアップ(R2 + `logo_mockups`)** がこの設定を使い、Generative Lab のみ未設定時は `var/generative-lab/outputs/` へフォールバックする:

```
R2_ACCOUNT_ID=（Cloudflare Account ID）
R2_ACCESS_KEY_ID=（R2 API token の Access Key ID）
R2_SECRET_ACCESS_KEY=（R2 API token の Secret Access Key）
R2_BUCKET_NAME=logos-assets
```

### Supabase(DB移行)

スキーマの正本は [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)(アカウント・組織・ロゴ正本・RLS一式)。セットアップ手順:

1. Supabase の SQL Editor で `supabase/migrations/` 内のSQLを番号順に実行(0001→0008、いずれも冪等・再実行可)
2. Authentication → Sign In / Providers で **Anonymous sign-ins を有効化**(ゲスト投稿の前提)
3. `.env.local` に以下を追加:

```
NEXT_PUBLIC_SUPABASE_URL=（プロジェクトURL）
NEXT_PUBLIC_SUPABASE_ANON_KEY=（anon / publishable キー）
```

Supabase MCP(read-only)は [.mcp.json](.mcp.json) に設定済み。環境変数 `SUPABASE_ACCESS_TOKEN_LOGOS`(logosプロジェクトを持つアカウントの Dashboard → Account → Access Tokens で発行)を設定すると次回セッションから利用できる。

#### 認証(サインアップ)

匿名でアップロード → アカウント作成で本登録に昇格(`user_id` 不変、ロゴはそのまま引き継ぎ)。UIは Google → Apple → Figma → メール の順(ヘッダー右の「ログイン」から)。有効化に必要な設定:

- **メール+パスワード**: 既定で利用可。ただし **Confirm email が ON** だと確認メール後に本登録完了(UIは「確認メールを送信しました」を表示)。PoCで即時サインアップにしたい場合は Authentication → Providers → Email で **Confirm email を OFF** にする(組み込みSMTPは送信レート制限が厳しい点にも注意)
- **Google / Apple / Figma**: ボタンは配線済み。各プロバイダを Authentication → Providers で有効化し、OAuthクライアント情報を登録すると点灯する(Google Cloud / Apple Developer / Figma でクライアント発行が必要)
- **Adobe**: Supabaseに組み込みプロバイダが無いため未対応。デザイナー向けには Figma を採用している

Vercelにデプロイする場合は同じ環境変数を Settings → Environment Variables に追加する。

## 制約(PoC段階)

- 入力はSVGのみ。PNG/AI対応はロードマップ上(一般普及には必須)
- 発注ボタンはlocalStorageに記録するのみで、実際の物品発注には連携していない
- 会社・ユーザーごとのデータ分離やログインはまだない(単一ブラウザのlocalStorageのみ)

## 残タスク・既知の課題(検証Findingsより)

- **作業履歴の集約**: アセット詳細ページはセレクト変更のたびに「情報更新」が1行記録され、履歴がすぐ長くなる。連続する同種操作をまとめる集約(例: 一定時間内の同種更新を1行に)をSupabase移行時に検討する
- **公開範囲変更のadmin限定**: UIでは組織ロゴのvisibility変更を管理者以上に制限したが、RLSは行単位のため列単位の強制はサーバー側では未実装(0001_init.sqlにも注記)
- **プレゼン編集にUndoがない**: blur即保存のため取り消し手段は「自動生成コピーへの復帰」のみ。本格運用では編集の取り消しを検討
- **OAuth(Google/Apple/Figma)は要プロバイダ設定**: ボタンは配線済みだがSupabase側で各プロバイダを有効化するまで点灯しない
- **図鑑の検索・タグ絞り込みは未実装**: 公開ロゴは新着順48件のグリッド表示のみ。タグはデータとして保存済み
- **個人ハンドルは未対応**: バニティURLのハンドルは組織のみ(設計上は共有名前空間で個人も可能)。`/[handle]` 単体のプロフィールページも未実装
- **作業履歴の集約**(前掲)と同様、履歴・活動まわりの洗練は今後

## デプロイ

Vercelにリポジトリを接続(プリセット: Next.js)。将来のCDN配信は Cloudflare R2 + Workers を想定。
