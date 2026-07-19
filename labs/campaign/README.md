# Campaign Lab — 統合表現研究所（引き継ぎ資料）

最終更新: 2026-07-19

最小限のソース（URL・PDF・画像・テキスト）から、サービス紹介の**LP（ペラ1）と30秒CM動画**を自動生成するラボ。旧・独立プロジェクト「cm-maker」（`~/projects/cm-maker`、クローズ済み）を合流させたもので、**パイプラインの正本はこのリポジトリだけ**にある。

## 1. いま何ができるか（現在地）

**「ソース → Service Brand Kit → LP」の縦貫通が動いている。パレットはTier S（実画面レンダリング証拠 + VLM裁定 + 自己検証）で抽出される。動画はまだ。**

UIフロー（`/labs/campaign`、Labsロール必須）:

1. **ソース追加カード**: URL入力（サンプルチップ: Anthropic/Apple/Google）、PDF・画像のドラッグ&ドロップ（5個・各4.5MBまで）、テキスト貼り付け。NotebookLMの「ソースを追加」を踏襲した設計
2. **結果レイアウトは最初からプレースホルダーで表示**（何が生成されるかを実行前から予測できる）。「LPと動画素材を生成」ボタン → **サーバー側のジョブとして生成が走る**（`var/campaign-lab/jobs/` に永続化、UIは2.5秒ポーリングで追従）。**ページを閉じても・回線が切れても生成は継続**し、次に開いたとき最新ジョブ（ログ+結果）が復元される。**2〜4分かかる**
3. **処理ログ**: 実行中は**画面右下のポップアップ**としてパイプラインの実イベントが流れる（engine→ingest→capture→palette→adjudicate→creative→verify→cost）。完了するとポップアップは自動で消え、プレースホルダーが実データに置き換わり、**ログはマーケティングアセットの下に参考情報として移動**する。captureが実行されたかスキップされたか（⚠表示）が利用者にも開発者にも見える。**LLM呼び出しは使用エンジン（OpenAI API / gpt-5.6-terra・Chat Completions + structured outputs）・実トークン数・概算USDコストをログに明示**し、最後に合計を出す（単価は `creative.ts` の `PRICE_PER_MTOK`: terra 入力$2.50/出力$15 per 1Mトークン）
4. 結果画面は2層:
   - **サービスヘッダー（分析結果）**: サービス名・タグライン・業種・事業タイプ・提供価値・ターゲット・概要。全アセットの一段上に置く
   - **マーケティングアセット**:
     - **Service Brand Kit（デザイン基盤）**: 取得した実ロゴ、パレット5色+出所バッジ、CSSから推定したデザイントークン（フォント・ボタン角丸/余白・セクション余白・コンテンツ幅）、brandkit.jsonダウンロード
     - **セールスページ（LP）**: Heroセクションだけのダイジェストプレビュー。クリックで**本物のLP**（署名付きURL `/api/labs/campaign/lp/[id]`）が新しいタブで開く。LPヘッダーには取得した実ロゴを使用
     - **紹介動画（30秒CM）**: Phase 0bで生成されるスロット。動画レンダラーの入力となる**ナレーション原稿はこのセクションの下**に表示

CLIでも同じパイプラインを実行できる（Web UI・ログイン不要、検証・開発用）:

```bash
npm run campaign -- https://example.com
npm run campaign -- --name "MyApp" --desc "説明" --shots ./materials  # PDFや画像のフォルダ
# 出力: var/campaign/<slug>/{brandkit.json, index.html, narration.txt}
```

必要な環境変数: `.env.local` の `OPENAI_API_KEY`（LLMはOpenAIをメイン利用。モデルは `lib/campaign/creative.ts` の `MODEL`、現在 `gpt-5.6-terra`）。秘密値はリポジトリへコミットしない。インフラは他ラボと共有する方針（Labs認証・署名URL・R2等。campaign専用インフラは作らない）。

パレット抽出（Tier S capture）はローカルにChromiumが必要: `npx playwright install chromium`（`playwright` はdependencies導入済み）。無いホストではcaptureが自動でスキップされ、`palette_source: "generated"` のAI提案パレットに落ちる。

## 2. アーキテクチャの核: Service Brand Kit

動画でもLPでもなく、**「サービス理解+ブランド」の中間表現（Brand Kit）がプロダクトの核**。zodスキーマは `lib/campaign/schema.ts`。

```
ソース（URL / PDF / 画像 / テキスト）
   ▼ Stage 1: ingest（スクレイピング・og:image） + capture（Playwrightで実画面レンダリング・証拠収集・ロゴ画像・デザイントークン）
   ▼ Stage 2: palette（CIELABクラスタリング → 証拠付きパレット候補）
   ▼ Stage 3: creative（VLM裁定=候補からの選択のみ + OpenAI gpt-5.6-terra structured outputs）
Service Brand Kit
  = service（名前/タグライン/概要 + 分析: 業種/事業タイプ/提供価値/ターゲット）
  + brand（palette + palette_source / font_style）
  + copy（LP全文） + narration（CM原稿）
  + assets（実ロゴPNG・favicon/og:image URL）+ design_tokens（CSS推定: フォント/角丸/余白/幅）
   ├→ LPレンダラー ……………… 実装済み（render-lp.ts、実ロゴをヘッダーに使用）
   ▼ Stage 4: verify（生成LPと元サイトのスクショ比較 → 不一致なら1回だけ再生成）
   ├→ 動画レンダラー（Remotion） … 次フェーズ（Phase 0b）
   └→ SNS素材・OGP・バナー ……… 将来
```

assets / design_tokens はLLM出力ではなく、パイプラインが決定論的にマージする（`CampaignBrandKit`型）。Brand Kitのフィールドセット自体の妥当性検証は [docs/deep-research-prompts.md](docs/deep-research-prompts.md) §7 のリサーチプロンプトを参照。

設計原則: **LLMには閉じたスキーマのJSONだけを出力させ、見た目の品質はテンプレート側で担保する**。雑な入力でも壊れない。ロゴス本体の思想でいえば、Brand Kitのコピー/パレット生成は「探索」、レンダラーは「保証」に相当する。

## 3. ファイル構成

```
lib/campaign/            # パイプライン本体（API routeとCLIの両方から使う唯一の実装）
├── pipeline.ts          #   オーケストレーション（capture→palette→裁定→creative→LP→verify）
├── schema.ts            #   Service Brand Kit の zod スキーマ + CampaignBrandKit（assets/design_tokens）
├── ingest.ts            #   URL → テキスト・メタ・カラーヒント・og:image
├── capture.ts           #   Playwrightで実画面レンダリング→スクショ・ヒストグラム・ロゴ画像・デザイントークン
├── palette.ts           #   CIELABクラスタリング→証拠付きパレット候補
├── creative.ts          #   VLM裁定 + Brand Kit生成 + LP照合判定（Claude structured outputs）
├── jobs.ts              #   ジョブ永続化（var/campaign-lab/jobs/、リロード復元の裏側）
└── render-lp.ts         #   Brand Kit → 自己完結HTML（外部依存ゼロ・CSS変数テーマ）

app/labs/campaign/       # 入口UX
├── page.tsx             #   ラボページ（LabHeader + noindex）
└── CampaignStudio.tsx   #   ソース追加UI・生成・結果2パネル表示

app/api/labs/campaign/generate/route.ts  # 生成API（guardLabsRequestで保護、maxDuration 300、NDJSONストリーミング: progress/ping/result/error）

labs/campaign/
├── README.md            # この資料
├── docs/deep-research-prompts.md  # 技術選定リサーチ用プロンプト6本（別軸で実施）
├── scripts/generate.ts  # CLI（npm run campaign）
└── audio/               # WKFLプロジェクト由来の音声資産（動画フェーズで使用）
    ├── tts-lib/tts.mjs      #   TTSプロバイダ抽象化（PROVIDERS辞書、Gemini TTS実装済み、モックモード付き）
    ├── tts-lib/audio.mjs    #   PCM処理・BGMダッキングミックス・無音挿入・WAVエンコード
    ├── tts-lib/timing.mjs   #   文字数按分による文単位タイムスタンプJSON生成
    ├── tts-lib/split.mjs    #   台本のTTS上限内セクション分割
    ├── tts-lib/pipeline.mjs #   上記を繋ぐWKFLのエピソード生成パイプライン（参考）
    └── prepare.mjs          #   素材集約・タイミングJSON正規化・WAV尺算出（参考）
```

`labs/directory.ts` のCampaign Labエントリは`active`で、研究所インデックスから稼働中ラボとして導線を出す。

## 4. ロードマップ

### Phase 0a+: パレット精度の改善（✅ Tier S 実装済み 2026-07-19）
Playwrightスクショ + computed styleヒストグラム + VLM裁定（候補からの選択のみ・発明禁止）+ 自己検証ループのTier Sを実装し、受け入れ基準を実測で確認済み（wealth-parkで白/黒/青が返り緑は消滅、anthropic.comは劣化なし）。**設計・実装対応表・実測結果: [docs/palette-accuracy.md](docs/palette-accuracy.md)**。Vercel本番ではChromiumが動かないためcaptureは自動でスキップされ`palette_source: "generated"`のAI提案パレットに落ちる（マネージドブラウザへの差し替えはプロダクト化時）。

### Phase 0b: 動画レンダラー（次にやること）
`narration.txt`（Brand Kitに含まれる）を起点に:
1. **voice**: TTS（`audio/tts-lib/tts.mjs` のプロバイダ抽象を土台に。Gemini TTSは動く。字幕同期精度を上げるならElevenLabsのcharacter timestampsを追加）→ タイミングJSON → BGMダッキングミックス（`audio.mjs`）
2. **video**: Remotionコンポジション。Brand Kit + タイミングJSONをpropsに、テンプレート駆動で組み立て。WKFL（`~/projects/WKFL/video/src/`）の `calculateMetadata`（音声実尺→フレーム数）、`captions.ts buildCaptions()`（文字数按分字幕）、`TopicScene`（ケンバーンズ）が実装の参照元
3. プレビューは `@remotion/player` でブラウザ内即時再生（MP4レンダリング不要 = アハ体験の核）。MP4書き出しはローカルCLI→将来Remotion Lambda

**動画テンプレートは2種に固定**（出力の予測可能性 = 期待値を揃える）:
- 課題解決型: 「〇〇について説明します」→「こんなお悩みありませんか?」(3つ) →「全部これで解決」→ 機能3つ → 活用例 → CTA
- チュートリアル型: 「今日は使ってみました」

### ロゴスへのマージ方針（意思決定メモ・検討中 2026-07-19）

このラボが最終的にロゴス本体へどうマージされるかについての、ファウンダーの方針メモ。実装はまだ着手しない。

**単位の再定義: ロゴ/ブランド → 事業・会社。** ロゴスは元々「ロゴ」を正本単位に設計してきたが、本来の集大成アウトプットは「アップロードしたロゴのレギュレーションに基づいてLP・動画・キービジュアル・モックアップ等の複雑なマーケティングツールが作られてくる」こと。サービス自体を**会社・事業という単位で捉え直す**時期に来ている。このラボが取得するブランド情報・事業情報は、独立したBrand Kitではなく、**調査したアカウントが所有する会社情報（正本）へ流れ込む**べきもの。

**スクレーピング由来は「仮情報」= 入力補完ツールの振る舞い。** 会社情報には (a) ユーザーが登録済みのもの、(b) 存在するが未入力のもの、があり、スクレーピングで得た情報は自分で入力したものより確度の低い**仮の情報**としてフィールドを埋める。つまりこのラボの本質は入力補完: 初回利用でURLやチラシを入れると、各種情報が出てきてLPも作られ、会社情報も仮で埋まっていく。ユーザーがそこを強化するほど、実際にマーケティングに使える正確なツールになる。→ 会社情報のフィールドは **provenance（ユーザー入力 / スクレーピング推定）と確度**を持つ必要がある。

**2つの起点は同一エンティティに収斂する。** ロゴ起点のユーザーは「ロゴ正本 → それを紐づける会社情報」の順、URL起点（このラボ）のユーザーは「会社/サービス正本 → スクレーピングした仮ロゴが当てはまる」の順。**別物ではない**。スクレーピングで取れるロゴは低解像度でロゴアセットとしては弱いが、明示的なアップロードが無い場合は**仮ロゴとして正本に採用し、そこからガイドライン・ロゴアセットの自動生成まで走らせてよい**（後で正式ロゴに差し替えられる前提）。

**位置づけ: ロゴスに欠けていた「セールスを作る」機能 = 入り口。** ロゴ管理はアップサイドではなく管理効率・マーケ効率の話で、ビジネスチャンスとしては弱かった。このCMメーカーはその弱点を埋める。ブランド管理サービスの一部でありながら、**マーケティング的にはこの機能が入り口**となり、新規事業・マーケティングにこれから取り組むフェーズの会社にアピールする。打ち出し方（独立プロダクト風の見せ方にするか等）は検討中。

### Phase 1: プロダクト化（ラボ卒業後）
- 保存: `campaigns` テーブル（Brand Kit / 生成物のR2キー）。マイグレーション設計から
- 公開: `handles` の仕組みを使った自分のURL（STUDIO型「自分のLP・動画サーバー」）。動画はR2+署名URL→将来CDN
- 入口の公開ファネル化: Labsゲートの外に出し、サンプル事前生成（自社・Apple等をキャッシュしてボタン一発）、匿名→登録の導線（ロゴス本体と同じ）
- エクスポート/ホスティングの月額課金がビジネスモデル候補

### Phase 2以降
- SNSキット（縦型9:16・広告静止画・投稿文）、生成動画AIによるリッチカット挿入
- エンタープライズ: 企業のブランドガイドライン（ロゴス本体のロゴ正本・ガイドライン）をBrand Kitに注入するハーネス。**ここでロゴス本体と合流する**

## 5. 設計判断メモ

- プレビュー（Player・無料）とレンダリング（MP4・課金）を分離し、コストと課金ポイントを一致させる
- 仮ロゴはタイポグラフィのワードマークに留める（AIロゴ生成は外すと体験全体が安っぽくなる）。既存ロゴはfavicon/OGPから
- スクレイピング失敗時も名前+説明+ファイルだけで成立するフローを維持（実装済み）
- 要調査（プロンプト集にあり）: **Remotion商用ライセンス（SaaS組み込みの条件）**、TTS選定、動画生成AI API、BGMライセンス、競合分析

## 6. 出自

- cm-maker（`~/projects/cm-maker`）: Phase 0のCLI実証。2026-07-19にこのラボへ全資産を移管しクローズ
- WKFL（`~/projects/WKFL`）: ニュース動画自動生成プロジェクト。音声パイプラインの出自。Remotionコンポジションの実装参照元として現役
