# logos(仮称)

URL・資料・ロゴを起点に、Organizationと企業・事業ブランドの情報を補完しながら、LP・動画・モックアップ・ブランド資産を一体管理するサービスのPoC。Organizationはコンテナ、企業／事業／対象別は同じBrandのカテゴリーとして扱う。

サービス名は仮。[lib/config.ts](lib/config.ts) の `SERVICE_NAME` を変更すれば全体に反映される。

## ドキュメント(正本マップ)

**このREADMEが全ドキュメントの唯一の入り口。** ここ(または、ここからたどれるサブディレクトリのREADME)にリンクされていないドキュメントは存在しないものとして扱う。運用ルール:

1. 新しいドキュメントを作るときは、必ずこの表かサブREADMEにリンクを追加する。リンクを張る場所がない=作らずに既存の正本を更新する
2. **1テーマ=1正本**。似たテーマの文書を新設せず、既存文書を更新する(スコープは各正本の見出しに従う)
3. サブディレクトリのREADME(例: [labs/README.md](labs/README.md))は、その配下の入り口を兼ねる

| ドキュメント                                                               | 正本として扱う内容                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)                                                   | 事業構想・3層のプロダクト構想・収益モデル・差別化戦略                                                                                                                                                                                                                                                                                                                                                                             |
| [docs/deliverable-architecture.md](docs/deliverable-architecture.md)       | **ピボット後の全体アーキテクチャ要件定義の正本**(2026-08-04 第2版・外部レビュー反映): マーケティングツール生成への再定義、Organization(ネスト)/Brand/Work のエンティティモデル、ブランドアセットとマーケティングツールの2系統、BrandKnowledge(主張モデル)・3段素材スコープ・版固定Template・Take/Run/Render/Artifact・Publication、段階移行の手順。依頼者の原文と未決定事項を含む。**§15 にパイプライン統一の決定(2026-08-08)、§16 に次フェーズの計画**。**次にアーキテクチャを触るセッションの出発点** |
| [docs/schema-v2.md](docs/schema-v2.md)                                     | **v2移行の履歴と判断記録**(2026-08-04〜08-08・**移行完了**)。現在形の正本ではない——稼働構造は data-model.md を見る。本書には設計判断の理由、migration 0023〜0046 の段取り、切替の実測、監査コマンド `npm run v2:audit` が残る。「なぜこの形なのか」を遡るときだけ読む                                                                                             |
| [docs/account-design.md](docs/account-design.md)                           | アカウント・権限・URL体系・RLS方針(Supabase設計)                                                                                                                                                                                                                                                                                                                                                                                  |
| [docs/data-model.md](docs/data-model.md)                                   | **稼働構造の正本(V2・現在形)**: Organization → Brand → Work → Take → Render → Artifact → Publication、BrandKnowledge(主張+採用値)、素材の3スコープ、canonical スロット、ロゴとプレゼンTakeの関係。**「今どうなっているか」はまずここ**                                                                                                                                                                                              |
| [docs/logo-entity-lab-integration.md](docs/logo-entity-lab-integration.md) | Labs↔ロゴ正本エンティティ統合の現行仕様・残課題・ランタイムassetの暫定手動運用                                                                                                                                                                                                                                                                                                                                                    |
| [docs/launch-plan.md](docs/launch-plan.md)                                 | ベータローンチ準備のマイルストーン(セキュリティ・会員・法務・課金・品質・運用)と進捗チェックリスト                                                                                                                                                                                                                                                                                                                                |
| [docs/costs.md](docs/costs.md)                                             | **運営コストの正本**: API・動画レンダリング・ライセンス・保存/配信費の単価、実測、試算、未調査項目                                                                                                                                                                                                                                                                                                                                |
| [labs/README.md](labs/README.md)                                           | **研究所群の入り口**: モード分類(保証/探索/統合)・体験レイヤー=課金の階段・ラボ一覧と現在地・ラボ追加手順                                                                                                                                                                                                                                                                                                                         |
| [labs/motion/README.md](labs/motion/README.md)                             | Motion Lab: 16実験カタログ・美的原則・使用技術とLottie比較                                                                                                                                                                                                                                                                                                                                                                        |
| [AGENTS.md](AGENTS.md)                                                     | AIエージェント向けの開発上の注意(CLAUDE.md はこれを参照するだけ)                                                                                                                                                                                                                                                                                                                                                                  |

このほか `.claude/skills/` はClaude Code用のツール定義であり、ドキュメントではない。

## ページ構成

| パス                           | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | **トップ=すべての入口(旧 `/campaigns` を統合)**。ソース(URL・PDF・画像・テキスト)を渡すとブランド・LP・動画を生成する導線。**アップロードしたものの種別で遷移先が分岐する**: 画像(SVG/PNG/JPEG等)はロゴとして扱い、**SVGは管理側のプレゼン編集 `/logos/[id]/presentation` へ**、raster画像はロゴ認識するが専用プレゼンは準備中(「準備中」表示)。URL/PDFは確認ダイアログを挟まず生成を開始し、既存のBrand Kit生成LLMが `corporate / business / service / product / media / event` とBrand/Workの配置を同時判定する。ヒーローは画面高100%・透明ヘッダー・ヒーロー全域D&D対応。下部にブランドカタログとサンプル。管理サイドバーは付かない(管理は `/brands`) |
| `/p/[id]`                      | ロゴプレゼンテーションの閲覧用URL。編集操作は出さず、ロゴの`visibility`とRLSで閲覧可否を決める。将来の明示的なPublication/live URLやユーザー指定URLとは分離できる境界にしている。`/p/sample` はサンプル                                                                                                                                                                                                                                                                                                                                                                          |
| `/brand`                       | **管理ワークスペース**。メンバー、権限、所有、公開ハンドル、在庫・発注を管理する。現実世界のOrganizationとBrandは`/brands`で扱い、管理主体とブランド主体を混同しない                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/assets`                      | アセットライブラリ。自分/所属組織が管理するロゴアセットを一覧し、各アセット詳細へ入る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/assets/[id]`                 | アセット詳細ページ。現時点ではロゴ正本の編集(正式名称・主体entity・ロゴ形式・役割・親子関係・公開範囲・公開スラッグ・コンタクト表示・タグ・制作クレジット・商標情報・マスターファイル差し替え・**組織への所有移管**・作業履歴)。あわせて**このロゴで現在どのプレゼン asset が採用されているか**、candidate配下のlockup / colorway階層も確認できる。旧 `/brand/logos/[id]` は同じ画面を指す互換URL                                                                                                                                                                                                                                   |
| `/logos/[id]`                  | 管理ワークスペース内のロゴ正本詳細・編集。`/assets/[id]`はここへ転送する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/logos/[id]/presentation`     | 所有者・編集権限者向けのプレゼン編集。保存後の閲覧確認は`/p/[id]`で行う                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/campaigns`                   | 旧CM Maker入口。現在は **`/` へリダイレクト**(トップに統合済み)。生成処理中・旧リンク向けの詳細は `/campaigns/[id]` に残る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/brands`                      | **ブランド管理の主要画面**。共通の左ペインにOrganization→Brand→ロゴ／LP／動画を表示し、右ペインだけをURL単位で切り替える。旧`/businesses`は互換リダイレクト                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/brands/[id]`                 | 企業・事業・対象別で共通のブランド詳細。概要、プロフィール、継承、ロゴ、生成アセットを管理する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/brands/[id]/lp/[jobId]`      | Brand配下のLP詳細。v2では末尾にTake IDを使い、private Artifactの短期署名preview、Publicationによる公開・公開終了・履歴を管理する。旧job ID URLは従来画面へフォールバックする                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/brands/[id]/video`           | **動画ポータル**。このブランドが持つ動画の一覧と「＋動画を追加」。1件目は全ブランド共通の既定アセット=製品紹介動画で、未生成・未公開でも常に並ぶ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/brands/[id]/video/[videoId]` | Brand配下の動画詳細。v2では末尾にTake IDを使い、Product CM / event-promoともprivate MP4の再生・再生成とPublicationを管理する。Product CMの音声未生成時と旧動画アセットID・campaign job IDは互換画面へフォールバックする                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/campaigns/[id]`              | 生成処理中および旧リンク向けの互換詳細。完成したLP・動画の正規管理導線はBrand配下のURLを使う                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/c/[id]`                      | 生成されたセールスページの正規URL(`/p/[id]` と対称の opaque ID・所有者を含まない)。LPは `kit.theme` の**デザインテーマ(7種・業種からLLMが自動選択、正本は [lib/campaign/themes.ts](lib/campaign/themes.ts))**で描画される。各テーマは**4つのLPテンプレート**のどれかに割り当てられ、テンプレートは互いにスキンではなく別デザイン(下記「LPテンプレート」参照)。テーマはkitに保存されるため後から変更・再レンダリングできる。`/c/sample` はサンプル。新規URL生成はv2のTake IDを正規URLに使い、サーバーが`publications.status='live'`を判定してprivate R2のHTML Artifactを返す。v2テーブルはanonへ開かない |
| `/v/[id]`                      | 公開動画の恒久URL。Take IDだけを含み、`publications.status='live'`のcanonical Publicationとready MP4が揃う場合だけprivate R2 ArtifactをRange対応で配信する                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/settings`                    | Accountページ。ユーザー情報表示・プロフィール編集枠・登録アカウントの退会導線。退会時は個人所有データとR2成果物を削除し、共同組織の資産は残す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/[handle]/[slug]`             | バニティURL。組織ハンドル+ロゴスラッグを正規パーマリンク `/p/[id]` に解決(公開ロゴのみ)。将来はキャンペーン(`/c/[id]`)も同じ共有名前空間で解決する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/labs`                        | **研究所インデックス**(noindex)。表現R&Dを保証/探索/統合モードで分類する。稼働中は [Motion Lab](labs/motion/README.md)、[Workflow Lab](labs/workflow/README.md)、[Generative Lab](labs/generative/README.md)。[Campaign Lab](labs/campaign/README.md) は CM Maker(トップ `/`)へ卒業済み。全体像は [labs/README.md](labs/README.md)。旧 `/lab` → `/labs/motion`、旧 `/labs/image` → `/labs/workflow`、旧 `/labs/campaign` → `/`(旧 `/campaigns` も `/` へ)リダイレクト                                                                                                                                                               |

URL体系の設計意図(所有者を含まない壊れないパーマリンク等)は [docs/account-design.md](docs/account-design.md) を参照。

ヘッダーのハンバーガーメニューは、未登録ユーザーには`Home`だけを表示する。本登録ユーザーには`Brand Manager`も表示し、`platform_admin`または`labs_member`を持つ場合だけ`Labs`を追加する。生成導線(CM Maker)はトップ`/`=`Home`そのものなので、独立した`Campaigns`項目は持たない。トップ全域が透明ヘッダーでヒーローに馴染み、ヘッダーは非stickyでスクロールとともに退く。アバターメニューはメールアドレス、`Account`、`Sign out`だけを表示し、プロダクト内ナビゲーションと分離する。

## プレゼン構成モデル

このプロダクトでは、プレゼンテーション本編を**固定実装の寄せ集め**としてではなく、**presentation asset catalog から組み立てるドキュメント**として扱う。

- 各 motion / mockup / generated asset はLabs共通カタログに入り、提供側の成熟度 `draft / production` と「どの presentation placement に入れられるか」を持つ
- `draft` はLabだけ、`production` はLabと利用者向けプレゼン編集UIに表示する
- 各ロゴはproduction assetについて「その placement に何を表示するか」という **per-logo の layout**(`enabled / order / params`)を持つ
- ラボは未完成・完成済みを含む全assetを置き、productionへ昇格できる品質かを判断する場である
- 将来的には利用者自身がこの catalog から構成を選び、プレゼンを後編集できる。現行実装もその前提で設計している

現時点での presentation placement は `splash.hero` / `web.device` / `social.primary` / `onsite.primary` / `merch.primary` / `generated.tile`。`web.device` はWorkflow LabのPC・モバイル端末モックアップ用で、現在はDraftとして手動作成を検証中。特にラボとの接続が強いのは後半の mockup / generated 系 section で、Production assetは **07 Social / 08 On-site / 09 Merchandise / 10 Generated** が asset catalog から描画する。Webの端末モックアップは品質判定と出力アダプター接続後に本編へ昇格する。

## 生成されるプレゼンテーション(`/p/[id]`)

**トップ `/` でSVGロゴをアップロードする**(ヒーロー全域へのドラッグ&ドロップ、またはカードから選択)と、以下が1本のガイドラインドキュメントとして生成され、この画面へ遷移する。アップロード受理からプレゼンが開くまではローディングバーで橋渡しする。冒頭に Splash(オープニングアニメーション)と Contents(目次)、続いて番号付きの10シーンが並ぶ。(PNG/JPEG等のraster画像もロゴとして認識するが、raster向けプレゼンは準備中。)

| #   | シーン              | 内容                                                                                                                                                                                                                                                                          |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | Splash              | 巨大タイポ + ロゴマークのオープニング演出(スクロールキュー・リプレイ/一時停止)                                                                                                                                                                                                |
| —   | Contents            | 全シーンへ飛べる目次ナビ                                                                                                                                                                                                                                                      |
| 01  | The mark (Identity) | ロゴの意味・最小サイズ・余白などアイデンティティの基本                                                                                                                                                                                                                        |
| 02  | Construction        | ベジェのアンカー/ハンドルを実データから抽出して可視化                                                                                                                                                                                                                         |
| 03  | Color               | 面積加重で色を自動抽出し、HEX/RGB/CMYK付きカラーバンドに展開                                                                                                                                                                                                                  |
| 04  | Logo usage          | 配色パターングリッド(白地/ブランドカラー地/黒地/白抜き)                                                                                                                                                                                                                       |
| 05  | App icon            | iOS風アイコンと配色バリエーション                                                                                                                                                                                                                                             |
| 06  | Web                 | ブラウザクローム内ファビコン + 48/32/16pxサイズランプ                                                                                                                                                                                                                         |
| 07  | Social              | Social placement に採用された asset 群。既定では認証バッジ付きプロフィールカードのモックアップ                                                                                                                                                                                |
| 08  | On-site             | On-site placement に採用された asset 群。既定ではラニヤード付き社員証モックアップ                                                                                                                                                                                             |
| 09  | Merchandise         | Merchandise placement に採用された asset 群。既定ではTシャツへのmultiply合成(コードベースの精密配置)。Workflow Lab で作った名刺・トート等もここへ採用可能                                                                                                                     |
| 10  | Generated           | Generated placement に採用された asset 群。既定では Gemini API(Nano Banana)によるマグカップ/トート/キャップの写実モックアップ生成。**手動生成**——各タイルの「生成」ボタンで1枚ずつ(APIコストが発生するため自動生成はしない)。生成済みはロゴ単位でキャッシュされ再生成されない |

ロゴが手元になくても、`/p/sample` でサンプルプレゼンを確認できる。

### プレゼン編集

所有者とロゴ単位で共有された`manager`/`editor`は、管理側の`/logos/[id]/presentation`から以下の2層を編集できる。変更は編集中にステージされ、「Save」でまとめて保存される。`/p/[id]`は閲覧専用で、管理操作を表示しない。

- **文言層**: キャッチコピー・ストーリー・各シーンのリード文
- **構成層**: 各 presentation placement にどの asset を採用するか、またその表示順

アセット詳細ページ `/assets/[id]` では、このロゴの**現在の採用 asset 一覧**を確認でき、そこから本編編集へ移動できる。

## 多言語対応

UIコピーは [lib/i18n/](lib/i18n/) の辞書で **en / ja / ko / zh-Hant / zh-Hans の5言語**に対応。ヘッダーの `LanguageSwitcher` で切り替え、選択は永続化され `<html lang>` にも反映される。英語を正本の型([lib/i18n/dictionaries.ts](lib/i18n/dictionaries.ts) の `Dict`)とし、全ロケールが完全な辞書を持つ(実行時フォールバックの穴を作らない)。

## 管理ワークスペース(`/brand`)

白ベースのビジネスSaaS風ダッシュボード。KPI、管理ワークスペース情報、**メンバーの招待・ロール管理(オーナー/管理者/編集者/購買担当/閲覧のみ)**、**公開URLハンドルの設定**、登録アセット、在庫・発注を表示する。ここでいう`public.organizations`はアクセス管理主体であり、現実世界の会社・個人事業体を表す`public.brand_organizations`とは別物。メール招待は相手がそのメールで登録した瞬間に自動でメンバー化される(SMTP不要)。

各アセットの詳細(`/assets/[id]`、旧 `/brand/logos/[id]`)では、正本編集だけでなく**そのロゴのプレゼン構成の現在値**も確認する。つまり Brand Manager は「ロゴファイルを持つ場所」だけでなく、**そのロゴがどんなブランドドキュメントとして出力されるか**を見るハブでもある。

## CM Maker(トップ `/`)

最小限のソース(URL・PDF・テキスト)から、サービス紹介の**セールスページ(LP)と30秒CM動画(Phase 0b予定)**を自動生成するプロダクト面で、**トップページ `/` そのもの**(旧 `/campaigns` を統合)。旧 Campaign Lab の卒業先で、**詳細な引き継ぎ資料・パイプライン解説の正本は [labs/campaign/README.md](labs/campaign/README.md)**。2026-07-20時点の骨子:

- **入力の種別で分岐する**: URL/PDF はキャンペーン生成(このセクション)へ。**画像をアップロードした場合はロゴ**として扱い、SVGはブランドプレゼン `/p/[id]`、raster画像は準備中の別モードへ回す(生成パイプラインには入れない)

- **Service Brand Kit が核**: ソースから「サービス分析+ブランド(証拠ベースで抽出したパレット・実ロゴ・デザイントークン)+LP全文コピー+CMナレーション」の中間表現を1回生成し、全レンダラー(LP・動画・バナー)がこれを消費する
- **デザインテーマ7種**([lib/campaign/themes.ts](lib/campaign/themes.ts) が正本): tech-glass / minimal-light / corporate-trust / care-warm / friendly-pop / food-casual / luxury-serif。各テーマは対象業種・**どのLPテンプレートで描くか(`lp.variant`)**・**全レンダラー共通のトーン&マナー指示文(`direction`)**を持つ。生成時にLLMが業種からenumで自動選択し、`kit.theme` として保存されるため**後から変更して再レンダリングできる**。キャンバスが暗いテーマかどうかは `isDarkTheme()` が唯一の判定で、管理プレビュー枠とCM動画のパレットがこれに従う(呼び出し側で再計算しない)
- **LPは背景写真に頼らない**: 旧テンプレートは各テーマにストック写真を固定割当していたが、現行の3テンプレート(noir / lumen / editorial)は自前のキャンバスで完結する。[public/campaigns/bg/](public/campaigns/bg/) を使うのは旧 flat/glass に残るテーマだけ
- **UI**: トップ `/` は画面高100%のヒーロー(青いガラス質背景+ソース入力のグラスカード)+透明ヘッダー。**ヒーロー全域がドラッグ&ドロップ対応**で、ドラッグ中は50%白の半透明ヴェールと「ここにドロップ」を表示する。管理UI(詳細 `/campaigns/[id]`)はロゴス本体と同じ白いツールUI(管理サイドバー付き)。生成は非同期ジョブで、ページを閉じても継続する
- **30秒CM動画(Product CM v2)**: ナレーションは5シーン構造(`cm_script`)で生成され、シーンごとのTTS(Gemini)→タイミングJSON→**Remotion**で組み立てる。TTS後はWAVをTakeスコープのMaterial、タイミングとBrand Kitを`product-cm@2` briefへ固定し、MP4をprivate R2 Artifactとして保存する。以後の再生成はローカルjobファイルに依存しない。管理画面のPlayerは署名付きprivate配信、明示公開後は`/v/<takeId>`がRange対応で同じArtifactを返す。Chromiumが動かないホスト(Vercelのサーバーレス)ではMP4を作成できないため、クラウド化はRemotion Lambda(AWS)採用予定。`CAMPAIGN_TTS_MOCK=1`でAPIキーなし開発可

## LPテンプレート(4種・デザイン優先)

生成LPの見た目の正本は [lib/campaign/render-lp.ts](lib/campaign/render-lp.ts)(エントリとテンプレート選択)と各テンプレートファイル。**テーマは「どのテンプレートで描くか」を決めるだけで、テンプレート同士はスキンの差ではなく別デザイン**——独自のタイポグラフィ体系とセクション構造を持つ。

| テンプレート  | 実装                                                         | 割り当てテーマ                              | 狙い                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **noir**      | [lib/campaign/lp-noir.ts](lib/campaign/lp-noir.ts)           | tech-glass                                  | 米国のAI・ロボティクス製品ページ。漆黒キャンバスにオーロラ状の発光とフィルムグレイン、巨大なグラデーション見出し、英字モノのマイクロラベル、bentoグリッド、ロゴマーキー           |
| **lumen**     | [lib/campaign/lp-lumen.ts](lib/campaign/lp-lumen.ts)         | minimal-light / corporate-trust / care-warm | 明るいプレミアムSaaS。白キャンバス+ヘアライン、左寄せ非対称ヒーロー、反転した黒帯のクロージング。信頼を先に立てる業種(業務ツール・金融・医療)向け                                 |
| **editorial** | [lib/campaign/lp-editorial.ts](lib/campaign/lp-editorial.ts) | luxury-serif                                | 作品集の佇まい。墨の紙面にアクセント1色を金として差し、Cormorant/しっぽり明朝を大きく細く組む。角丸・発光を一切使わず罫線と余白で構成。アート・ラグジュアリー・ホスピタリティ向け |
| **classic**   | [lib/campaign/render-lp.ts](lib/campaign/render-lp.ts) 内    | friendly-pop / food-casual                  | 従来の明るいSaaSレイアウト(`flat`)とそのダーク版(`glass`)。取得したデザイントークン(フォント・角丸・余白)を実際に適用する唯一のテンプレート                                       |

- **共通部品は [lib/campaign/lp-kit.ts](lib/campaign/lp-kit.ts) が正本**: デバイスモックアップ、クライアントロゴウォール、実績数値の桁分割、セクション有無の判定、サンプル注記。テンプレートが再実装してはいけないものはここに置く
- **全テンプレートが守る不変条件**(テストは [lib/campaign/render-lp.test.ts](lib/campaign/render-lp.test.ts)):
  - **`<script>` を出さない**。管理画面のサムネイルは同じHTMLを `sandbox=""` の iframe で描くため、スクリプト依存の演出は2つの面で違うものが表示され、片方しかテストされない。マーキーもスクロール演出もCSSだけで組む
  - **ヒーローのキービジュアルは共通のデバイスモックアップ**([lib/campaign/lp-kit.ts](lib/campaign/lp-kit.ts))
  - **動画スロットのマーカーを残す**。`/c/[id]` が配信時にMP4を差し込む/撤去するため
- **デザイントークンは新テンプレートでは意図的に無視する**: ブランドから引き継ぐのは色(primary/accent)だけで、取得した14pxの本文フォントや角丸は継承しない。1顧客ごとに変わるべきなのは色であって組版ではないため
- **クライアントロゴウォールは幾何マーク+書体の作り分け**: LLMが出す架空のクライアント名を素の文字列で並べると「ロゴの列」ではなく「単語の列」に見えるため、8種のマークと6種のワードマーク書体を名前ごとに割り当てる(画像は一切持たない)

## 動画は一等アセット(テンプレート制)

動画の正本は**`takes` → `take_renders` → `render_artifacts`**であり、1ブランドが複数の動画Takeを持てる。テンプレート台帳の正本は [lib/templates/catalog.ts](lib/templates/catalog.ts)、Product CM briefの契約は [lib/templates/brief-schemas.ts](lib/templates/brief-schemas.ts)。旧`brand_assets`系テーブルと互換読み取りはmigration 0042で廃止済み。

- **テンプレートは作成時に決まり、あとから変更できない**。シーン構成と素材スロットが変わり、将来の構造化プロンプトも変わるため(slide-factoryが物件の`deliverable`を固定するのと同じ契約)。現在は `product-cm`(製品紹介動画・課題解決型30秒CM)と `event-promo`(イベント動画・30秒PV)
- **画面に見える動画は必ずTake**。Product CMも追加またはTTS開始時に冪等作成され、実体のないプレースホルダーやjob IDを動画IDとして扱う経路はない。パブリッシュは任意で、既定は未公開
- **Takeの`brief`と固定済み`take_inputs`が作成後の正本**。`event-promo`は`EventBrief`、`product-cm@2`はBrand Kit・ナレーションタイミング・WAV Material参照を持つ。バンドル済みeventブリーフ([remotion/event/briefs/](remotion/event/briefs/))はseedであり、作成時に複製される
- `videoId` は常にTake ID。Product CMが参照するローカル生成job IDは`brief.campaignJobId`に閉じ込め、エンティティIDと混同しない
- **書き出したMP4の正本はR2**(`brands/<brandId>/takes/<takeId>/renders/<renderId>/...mp4`)。ローカルフォールバックを持たない。キー設計は [lib/video/storage.ts](lib/video/storage.ts)、共通レンダー採用処理は [lib/takes/render.ts](lib/takes/render.ts)
- 配信は `GET /api/brands/[id]/takes/[takeId]/renders/[renderId]/output`。`<video>` はAuthorizationヘッダーを送れないため、オブジェクトキーまで束縛した**署名付き同一オリジンURL**を発行し、Range要求にも対応する。本番では `LABS_OUTPUT_URL_SECRET` が必須
- レンダーは `POST .../render` で非同期。進捗は`take_renders.status`、採用成果物は`latest_artifact_id`が指す不変`render_artifacts`行で追跡する

## イベントPVテンプレート(event promo)

CM Makerが**製品・サービス軸**の課題解決型CMを作るのに対し、こちらは**イベント・セミナー軸**のプロモーション動画テンプレート。ナレーションを持たず、BGMとタイポグラフィで成立させる(SNSのミュート再生が主戦場のため)。1本目の実案件は「世界が恋する日本酒」(レオパレス21 × WealthPark Lab)。

- **データ契約は [remotion/event/types.ts](remotion/event/types.ts) の `EventBrief`**。文言・日時・ゲスト・プログラム・ロゴ・写真スロットを持つ構造化データで、現時点では手書き(Slackの雑文+フライヤーから起こす)。将来は抽出・構造化パイプラインが生成する
- **設計原則: スタイルは決めつけ、事実は捏造しない**。アートディレクション(和モダン・ラグジュアリー=墨黒×金×明朝)、配色、モーション、コピーの圧縮は勝手に決めて**作りきる**。一方で日時・会場・料金・人名は捏造せず、未定なら**ダミー枠ではなくデザインされた省略**として扱う(`schedule.venue: null` は画面から消える)
- **すべての素材スロットに設計済みフォールバックがある**。ロゴなし→明朝のクレジット表記、人物写真なし→姓一文字の金縁モノグラム、写真なし→墨背景+金粒子。**素材ゼロでも完成した動画が出る**のがこのテンプレートの要件
- **素材の整形は [labs/event/scripts/prepare-assets.mjs](labs/event/scripts/prepare-assets.mjs)** が決定論で行う(LLM不使用)。巨大ストックフォトの縮小、landscape人物写真の焦点指定、そして**暗背景用のロゴ正規化**——不透明な白地JPEGの`knockout`、白プレートから抜かれたロゴの`alphaInvert`、単色SVGの実行時`invert`。パートナーサイトから取得するロゴは取得元URLをこのスクリプトに記録して出自を残す
- 尺は固定タイムライン([remotion/event/palette.ts](remotion/event/palette.ts) の `EVENT_SCENES`)で6シーン30秒。**15秒版はシーン尺の再配分で派生**させる
- **正規の置き場所はBrand配下の `/brands/[id]/video/[videoId]`**。ポータルから「＋動画を追加 → イベント動画」で作る。画面はゴール(動画)を常時表示し、その下に**素材スロットの現在地**——各スロットが素材で描かれているか設計フォールバックで成立しているか——を並べる([components/video/EventVideoWorkspace.tsx](components/video/EventVideoWorkspace.tsx))。スロット導出は [remotion/event/slots.ts](remotion/event/slots.ts) で、これは**充足率スコアではない**(フォールバックは欠陥ではないため)
- `/labs/event` はバンドル済みブリーフの検証台として残る(動画アセットを作らずコンポジションを詰めるため)。**同じワークスペースコンポーネントを描くので二重実装にならない**
- 素材投入→抽出→構造化をドロワーで開く編集体験は次段。現状ブリーフ編集・再レンダー・公開切り替えはTake APIに統一済み

```bash
npm run event:render   # var/event-lab/sake-2026.mp4 へ書き出し
npm run event:studio   # Remotion Studio でシーン単位に確認・調整

# 素材ドロップフォルダ → public/event/<slug>/ へ整形
node labs/event/scripts/prepare-assets.mjs --src <dir> --slug sake-2026
```

**素材はリポジトリに入っていない**(`.gitignore` 参照)。ライセンス写真・実在人物のポートレート・支給BGMをgit履歴へ載せると後から取り消せないため、`public/event/*/photos/` `art/` `bgm.mp3` は除外し、**パートナーロゴ(`logos/`)だけコミットしている**。新しい環境では先に `prepare-assets.mjs` を実行する。sake-2026のブリーフはこれらのファイル名を指しているため、未実行のまま `event:render` すると失敗する(Remotionは画像の欠落でレンダーを止める。「素材が無い」と「ブリーフが null」を区別したいので、この挙動が正しい)。

## Platform Admin / Labs権限

サービス運営権限は組織ロールから独立している。`org_members.admin` はその企業のBrand Managerを管理する権限であり、Labsや将来のサービス運営ダッシュボードには入れない。

- `platform_admin`: Logosサービス運営者。Labsと将来の運営ダッシュボードへアクセス
- `labs_member`: Labsのみアクセス
- `support`: 将来のサポート担当。現時点ではLabsアクセスなし

Labsのページ、生成・集計・テンプレートAPIは `platform_admin` または `labs_member` を要求する。CM Maker(トップ `/`)の生成・ジョブAPI(`/api/labs/campaign/*`)も当面同じゲート下にある(そのためトップでURL/PDFから生成できるのは `platform_admin` / `labs_member`。SVGロゴ→プレゼンは登録ユーザー全員が利用できる)。公開プレゼンが利用する `/api/labs/workflow/compose` と `/api/labs/workflow/runs`、および公開サンプル `/c/sample` はこのゲートの対象外。

## アーキテクチャ

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- アニメーションは **motion**(scroll-in reveal 等)と **gsap**(Splashの演出)
- ロゴの構造・色・パス解析は**クライアントサイド**で完結する。保存時は正規化済みSVGをSupabaseへ保存し、利用者が写実モックアップ生成を明示実行した場合だけ、ラスタライズ画像をサーバー経由で生成AIへ送る
  - [lib/svg.ts](lib/svg.ts) — SVG正規化・計算済みスタイルの属性焼き込み・色抽出・単色変換・アウトライン化
  - [lib/paths.ts](lib/paths.ts) — path `d` 属性のパーサ(ベジェ骨格抽出)
  - [lib/color.ts](lib/color.ts) — HEX/RGB/CMYK変換・輝度判定
  - [lib/raster.ts](lib/raster.ts) — SVG→PNGラスタライズ(生成AIへの入力用)
- UIコピーは [lib/i18n/](lib/i18n/) で5言語対応(en/ja/ko/zh-Hant/zh-Hans)
- シーンは [components/scenes/](components/scenes/) にプラグイン式で追加できる([Reveal](components/scenes/Reveal.tsx) / [shared](components/scenes/shared.tsx) を共通部品として利用)
- プレゼン後半の mockup / generated 系 section は **presentation asset catalog** から解決して描画する。各assetはplacement互換性とdefault mappingを持ち、ロゴごとの採用状態はcanonicalな`logo-presentation` Takeの`brief.presentation.layout`に保存される
- 写実モックアップ生成は [app/api/generate/route.ts](app/api/generate/route.ts) が Gemini API を呼び出すサーバーサイドルート(APIキーを隠すため)
- データ永続化は [lib/store/](lib/store/) の `BrandRepo` インターフェースで抽象化。Supabase環境変数があればRLS付き実DB、なければ [localStorage実装](lib/store/local.ts)へ切り替わる。Labsのロゴピッカーも同じ正本repoを使う

### presentation asset catalog の現時点の実装

- **概念上の正本**: `presentation_asset_definitions`(全assetの`draft / production`とversion) + `logo-presentation` Takeの`brief.presentation.layout`(利用者ごとのオン/オフ・順序・設定値) + `logo_asset_runs`(candidateごとの処理状態)
- **現時点の定義ソース**: built-in asset のコード定義 + Workflow Lab の `template.json`
- **取得API**: `/api/presentation-assets`

`0006_presentation_assets.sql` が定義とlayoutの基礎、`0007_asset_lifecycle.sql` が成熟度・不変version・実行状態を追加する。`0008_asset_registry.sql` はアセット詳細領域の基礎として、ロゴが表す実世界のブランド主体、lockup / colorway 階層、将来の移管・購入問い合わせを追加する。global asset definition の管理UI/同期はまだこれからで、現段階では **ロゴごとのlayoutとruntime成果物はDB、asset definition自体はcode/template側から供給**される。

### ランタイムBlender assetの暫定手動運用

永続ワーカーを作る前は、Workflow Labの依頼情報を**新しいローカルエージェントセッションへ貼り付けて手動実行する**。新しいセッションは、最初に [Labs↔ロゴ正本エンティティ統合](docs/logo-entity-lab-integration.md#4-ランタイムassetの暫定手動運用)を読むこと。

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

詳細な事前確認、`--run-id`、低サンプル検証用`--no-publish`、合格条件は [暫定手動運用の正本](docs/logo-entity-lab-integration.md#4-ランタイムassetの暫定手動運用)を参照。

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

生成AIモックアップ(シーン10)を試すには `.env.local` に以下を設定して再起動する(生成は各タイルの手動ボタンで実行):

```
GEMINI_API_KEY=（Google AI Studioで発行したキー、課金有効なプロジェクトのもの）
```

同じキーを **CM Makerの30秒CM音声(Gemini TTS)** も使用する。キーなしで動画パイプラインを開発する場合は `CAMPAIGN_TTS_MOCK=1` を設定するとプレースホルダー音声で全フローが動く。サンプルCM音声の再生成は `npm run campaign:sample-voice`、MP4書き出しは `npm run campaign:render -- --job <id> | --sample`(初回はChrome Headless Shellを自動ダウンロード)。

生成APIは**登録ユーザー(非匿名)専用**で、ユーザーごとに直近24時間の回数上限がある(既定20回、`GENERATION_DAILY_LIMIT` で変更可)。クォータは `0010_generation_quota.sql` の `generation_events` に記録されるため、[Supabase設定](#supabase)が前提。localStorageモードでは生成は使えない。

Generative Lab(`/labs/generative`)の実エンジンを使うには `TOGETHER_API_KEY` / `RECRAFT_API_KEY` も設定する(未設定ならモックで全フローが動く)。詳細は [labs/generative/README.md](labs/generative/README.md)。

Cloudflare R2 を使う場合は `.env.local` に以下も設定する。現時点では **Generative Lab の生成画像保存先** と **シーン10 モックアップ(R2 + `logo_mockups`)** がこの設定を使い、Generative Lab のみ未設定時は `var/generative-lab/outputs/` へフォールバックする:

```
R2_ACCOUNT_ID=（Cloudflare Account ID）
R2_ACCESS_KEY_ID=（R2 API token の Access Key ID）
R2_SECRET_ACCESS_KEY=（R2 API token の Secret Access Key）
R2_BUCKET_NAME=logos-assets
MOCKUP_URL_SECRET=（ランダム文字列。openssl rand -base64 32 等で生成）
```

`MOCKUP_URL_SECRET` はモックアップ画像URLの署名鍵。**非公開ロゴ**のモックアップ画像は、認証済みAPIが発行する期限付き署名URL経由でのみ取得できる(`<img>` がAuthorizationヘッダーを送れないため)。未設定の場合、公開/unlistedロゴの画像は従来どおり表示されるが、非公開ロゴのモックアップ画像は404になる。

R2バケットはpublic access(`r2.dev`と公開custom domain)を無効にする。ブラウザはR2へ直接アクセスせず同一オリジンのAPI経由で画像を取得するため、現行構成ではR2 CORSルールは不要(空)でよい。

### Supabase

スキーマの正本は [supabase/migrations/](supabase/migrations/) の連番migration。現行のリモートプロジェクトには`0046_create_logo_for_existing_brand`まで適用済み。`0023`〜`0045`でV2基盤・データ移行・旧契約削除・保全データ修復を完了し、`0046`で既存Brandへのロゴ追加とcanonicalロゴプレゼンTake生成を原子的に統一した。新規URL生成は旧Profile/Generation Run/Assetへ二重書きせず、Knowledge claims + Take Run + Takeを正本にする。移行記録は [docs/schema-v2.md](docs/schema-v2.md)、現在の契約は [docs/data-model.md](docs/data-model.md)。新規環境のセットアップ手順:

1. Supabase の SQL Editor で `supabase/migrations/` 内のSQLを番号順に実行(0001→0046)
2. Authentication → Sign In / Providers で **Anonymous sign-ins を有効化**(公開ページ閲覧時のセッション初期化用。アップロードは本登録ユーザーのみ)
3. `.env.local` に以下を追加:

```
NEXT_PUBLIC_SUPABASE_URL=（プロジェクトURL）
NEXT_PUBLIC_SUPABASE_ANON_KEY=（anon / publishable キー）
```

退会APIを使う場合は、サーバー専用のservice roleキーも設定する。これは`NEXT_PUBLIC_`を付けず、チャット・ログ・クライアントコードへ貼らない。Vercelにも同名で設定する。

```
SUPABASE_SERVICE_ROLE_KEY=（Project Settings → API Keys の service_role）
```

本番でLabsを有効化する場合は、ページ/APIの有効化フラグと生成画像URLの署名鍵も設定する。署名鍵は十分に長いランダム値にし、`NEXT_PUBLIC_`を付けない。

```
LABS_ENABLED=1
LABS_OUTPUT_URL_SECRET=（ランダムな署名鍵）
```

初回のプラットフォーム管理者は、`0014_platform_roles.sql` 適用後にSupabase SQL Editorから付与する。

```sql
insert into public.platform_role_assignments (user_id, role)
select user_id, 'platform_admin'::public.platform_role
from public.users
where lower(contact_email) = lower('admin@example.com')
on conflict (user_id, role) do nothing;
```

logosプロジェクト専用のSupabase MCPは [.mcp.json](.mcp.json) に設定済みで、読み書きに対応する。環境変数`SUPABASE_ACCESS_TOKEN_LOGOS`を設定すると次回セッションから利用できる。接続先は必ずproject ref `xhbdfzceyfrxsmaixkne`と照合し、リモート書き込み前にはSQLをレビューして明示的な承認を得る。

#### 認証(サインアップ)

未ログインの利用者がアップロード操作を始めると、ファイルの保存前にサインアップ画面を開く。本登録後にアップロードできる。UIは Google → Apple → Figma → メール の順(ヘッダー右の「Sign in」から)。有効化に必要な設定:

- **メール+パスワード**: 既定で利用可。ただし **Confirm email が ON** だと確認メール後に本登録完了(UIは「確認メールを送信しました」を表示)。PoCで即時サインアップにしたい場合は Authentication → Providers → Email で **Confirm email を OFF** にする(組み込みSMTPは送信レート制限が厳しい点にも注意)
- **Google**: Supabase/Google Cloud設定とlocalhost実機ログインを確認済み
- **Apple / Figma**: ボタンは配線済み。各プロバイダを Authentication → Providers で有効化し、OAuthクライアント情報を登録すると利用可能になる
- **Adobe**: Supabaseに組み込みプロバイダが無いため未対応。デザイナー向けには Figma を採用している

Vercelにデプロイする場合は同じ環境変数を Settings → Environment Variables に追加する。

## 制約(PoC段階)

- トップ `/` でロゴをアップロードしてプレゼンまで生成できるのは**SVGのみ**。PNG/JPEG等のraster画像もロゴとして認識するが、専用プレゼンは準備中(現状は「準備中」表示のみで、`/p/[id]` は生成しない)。将来はraster用の別モードを用意する。CM MakerのURL解析で得たPNG/JPEG/WebPは`provisional`な仮ロゴとしてR2へ登録し、後から正式SVGへ差し替える
- 発注ボタンはlocalStorageに記録するのみで、実際の物品発注には連携していない
- Supabase未設定時は会社・ユーザーごとの分離やログインがない(localStorageモード)

## 残タスク・既知の課題

- **作業履歴の集約**: アセット詳細ページは変更ごとに「情報更新」を記録するため、一定時間内の同種更新をまとめる仕組みが必要
- **プレゼン編集に保存後のUndoがない**: 編集中の変更は「Save」までステージされるが、保存済み内容の版管理・復元は未実装
- **OAuth(Apple/Figma)は要プロバイダ設定**: Googleは設定・実機確認済み。Apple/FigmaはSupabase側のProvider設定が未完
- **図鑑の検索・タグ絞り込みは未実装**: 公開ロゴは新着順48件のグリッド表示のみ。タグはデータとして保存済み
- **個人ハンドルは未対応**: バニティURLのハンドルは組織のみ(設計上は共有名前空間で個人も可能)。`/[handle]` 単体のプロフィールページも未実装
- **ロゴ単位共有の付与UIが未実装**: `logo_access_grants`とメール招待用`logo_access_invites`はリモートDBへ適用済みだが、招待・付与・解除UIが未完
- **raster画像ロゴのプレゼンが未実装**: トップでPNG/JPEG等をアップロードするとロゴ認識はするが「準備中」モーダルを出すのみ。専用アニメーション/データ経路(`LogoData`はSVG前提)を用意し、実プレゼンへ差し替える follow-up が残る

## デプロイ

Vercelにリポジトリを接続(プリセット: Next.js)。将来のCDN配信は Cloudflare R2 + Workers を想定。
