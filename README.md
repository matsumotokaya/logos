# logos(仮称)

SVGロゴを1つアップロードすると、Behance品質のブランドプレゼンテーションがゼロタッチで生成されるサービスのPoC。

サービス名は仮。[lib/config.ts](lib/config.ts) の `SERVICE_NAME` を変更すれば全体に反映される。

事業構想・ビジネスモデルは [PRODUCT.md](PRODUCT.md) を、アカウント・権限・URL設計(Supabase移行方針)は [docs/account-design.md](docs/account-design.md) を、ロゴのデータモデル・CDN URL・サイト構造は [docs/data-model.md](docs/data-model.md) を参照。

## ページ構成

| パス | 内容 |
|---|---|
| `/` | ロゴ投稿UI(メイン導線)+ ギャラリー(「あなたのロゴ」+ 全ユーザーの公開ロゴの図鑑)。カードから各プレゼンへ |
| `/p/[id]` | 生成されたブランドプレゼンテーション(共有可能な固有URL)。**所有者のみ**ヘッダーの「編集」でキャッチコピー・ストーリー・各シーンのリード文をその場で書き換えられる(空にすると自動生成コピーに戻る)。`/p/sample` はサンプル(編集不可) |
| `/admin` | 管理コンソール |
| `/admin/logos/[id]` | ロゴ情報ページ(正本の編集: 正式名称・ロゴ形式・役割・親子関係・公開範囲・公開スラッグ・コンタクト表示・タグ・制作クレジット・商標情報・マスターファイル差し替え・**組織への所有移管**・作業履歴) |
| `/[handle]/[slug]` | バニティURL。組織ハンドル+ロゴスラッグを正規パーマリンク `/p/[id]` に解決(公開ロゴのみ) |

URL体系の設計意図(所有者を含まない壊れないパーマリンク等)は [docs/account-design.md](docs/account-design.md) を参照。

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
| 07 | Social | 認証バッジ付きプロフィールカードのモックアップ |
| 08 | On-site | ラニヤード付き社員証モックアップ |
| 09 | Merchandise | Tシャツへのmultiply合成(コードベースの精密配置) |
| 10 | Generated | Gemini API(Nano Banana)によるマグカップ/トート/キャップの写実モックアップ生成 |

ロゴが手元になくても、ランディングの「サンプルを見る」からサンプルプレゼンを確認できる。

## 多言語対応

UIコピーは [lib/i18n/](lib/i18n/) の辞書で **en / ja / ko / zh-Hant / zh-Hans の5言語**に対応。ヘッダーの `LanguageSwitcher` で切り替え、選択は永続化され `<html lang>` にも反映される。英語を正本の型([lib/i18n/dictionaries.ts](lib/i18n/dictionaries.ts) の `Dict`)とし、全ロケールが完全な辞書を持つ(実行時フォールバックの穴を作らない)。

## 管理コンソール(`/admin`)

白ベースのビジネスSaaS風ダッシュボード。KPI(登録ロゴ数・在庫アイテム数・要発注アイテム数・入荷待ち発注)、会社情報編集、**組織メンバーの招待・ロール管理(オーナー/管理者/編集者/購買担当/閲覧のみ)**、**公開URLハンドルの設定**、登録ロゴの一覧・役割設定・削除、ロゴアイテムの在庫管理と発注(ダミーデータ)を表示する。ビジネスモデル(フェーズ3の物販事業)を体現する画面。メール招待は相手がそのメールで登録した瞬間に自動でメンバー化される(SMTP不要)。

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
- 写実モックアップ生成は [app/api/generate/route.ts](app/api/generate/route.ts) が Gemini API を呼び出すサーバーサイドルート(APIキーを隠すため)
- データ永続化は [lib/store/](lib/store/) の `BrandRepo` インターフェースで抽象化。現在は localStorage 実装([lib/store/local.ts](lib/store/local.ts))だが、実DB(Supabase等)への移行はこのインターフェースを実装するだけで済む

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

生成AIモックアップ(シーン09)を試すには `.env.local` に以下を設定して再起動する:

```
GEMINI_API_KEY=（Google AI Studioで発行したキー、課金有効なプロジェクトのもの）
```

### Supabase(DB移行)

スキーマの正本は [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)(アカウント・組織・ロゴ正本・RLS一式)。セットアップ手順:

1. Supabase の SQL Editor で `supabase/migrations/` 内のSQLを番号順に実行(0001→0005、いずれも冪等・再実行可)
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

- **作業履歴の集約**: ロゴ情報ページはセレクト変更のたびに「情報更新」が1行記録され、履歴がすぐ長くなる。連続する同種操作をまとめる集約(例: 一定時間内の同種更新を1行に)をSupabase移行時に検討する
- **公開範囲変更のadmin限定**: UIでは組織ロゴのvisibility変更を管理者以上に制限したが、RLSは行単位のため列単位の強制はサーバー側では未実装(0001_init.sqlにも注記)
- **プレゼン編集にUndoがない**: blur即保存のため取り消し手段は「自動生成コピーへの復帰」のみ。本格運用では編集の取り消しを検討
- **OAuth(Google/Apple/Figma)は要プロバイダ設定**: ボタンは配線済みだがSupabase側で各プロバイダを有効化するまで点灯しない
- **図鑑の検索・タグ絞り込みは未実装**: 公開ロゴは新着順48件のグリッド表示のみ。タグはデータとして保存済み
- **個人ハンドルは未対応**: バニティURLのハンドルは組織のみ(設計上は共有名前空間で個人も可能)。`/[handle]` 単体のプロフィールページも未実装
- **作業履歴の集約**(前掲)と同様、履歴・活動まわりの洗練は今後

## デプロイ

Vercelにリポジトリを接続(プリセット: Next.js)。将来のCDN配信は Cloudflare R2 + Workers を想定。
