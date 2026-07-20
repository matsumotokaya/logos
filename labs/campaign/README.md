# Campaign Lab — 統合表現研究所（引き継ぎ資料）

最終更新: 2026-07-20

最小限のソース（URL・PDF・画像・テキスト）から、サービス紹介の**セールスページ（LP）と30秒CM動画**を自動生成する。旧・独立プロジェクト「cm-maker」（`~/projects/cm-maker`、クローズ済み）を合流させたもので、**パイプラインの正本はこのリポジトリだけ**にある。

## 0. 🎓 製品面への卒業（2026-07-20）

ラボとしての研究フェーズは終了し、**CM Maker として `/campaigns` へ格上げ**した。以降の開発（Phase 0b 動画以降）は製品面の上で行う。

- **管理UIは2ページ構成**（2026-07-20再編）: `/campaigns`（トップ）= ソース入力+サンプル展開+カード一覧で、**生成開始と同時に `/campaigns/[jobId]` へ遷移**。`/campaigns/[id]`（詳細）= 左カラムにキャンペーン一覧+「＋新しいキャンペーン」、右ペインに選択キャンペーンの展開表示。生成中の追従（プレースホルダー+ログポップアップ+2.5秒ポーリング）は詳細ページが担い、リロード・回線断からもjob IDで復帰する。サンプル = CM Maker自身のセールスページ（`lib/campaign/sample.ts`、全項目が手書きの仮情報）は `/campaigns/sample`。旧 `/labs/campaign` はリダイレクト
- **生成物の正規URL**: `/c/[id]`（`/p/[id]` と対称の opaque ID。所有者・階層を含めない——URL設計の正本は [docs/account-design.md](../../docs/account-design.md) §2）。`/c/sample` はサンプルとして公開。ジョブ由来ページは `campaigns` テーブル導入まで署名URL経由の暫定運用
- **LPテンプレートはSaaS型フル構成（v2）**: nav / hero（プロダクトモックSVG）/ 実績3指標 / クライアント名row / 課題 / 機能（交互レイアウト+イラスト）/ 使い方 / 動画スロット / 利用者の声 / 料金3プラン / FAQ / クロージング。実績・料金・声などソースに無い情報はLLMが**もっともらしい仮情報**として必ず埋め、ページ側で「サンプル・要差し替え」と明示する（入力補完思想 = 仮情報をユーザーが後から確定情報へ差し替える）
- **デザインテーマ7種を導入（2026-07-20）**: 正本は `lib/campaign/themes.ts`。各テーマは対象業種・LLM向け選定基準・**全レンダラー共通のトーン&マナー指示文（`direction`）**・LP描画パラメータ（variant: `glass`=ダークフロストグラス / `flat`=従来のライトSaaS、`heroBackground`=ヒーロー背景写真+スクリム）を持つ。生成時にLLMが業種・事業タイプから `kit.theme` を**enumで選択**（構造的に不正値が出ない）し、kit JSONに保存されるので**後から変更して再レンダリングできる**。`direction` はコピー・ナレーションのトーンに現在反映され、Phase 0b以降の動画・バナー・BGM選定にもそのまま渡す設計。テーマ: tech-glass / minimal-light / corporate-trust / care-warm / friendly-pop / food-casual / luxury-serif（旧kitはminimal-lightへフォールバック）
- **生成LPのヒーローに背景写真（2026-07-20）**: `public/campaigns/bg/` の抽象ガラス写真5枚を**テーマに固定割当**（tech-glass=simon-nilsen / minimal-light=milad-fakurian / corporate-trust=pramod-tiwari / care-warm=hassaan-here / luxury-serif=philip-oroni。friendly-pop / food-casual は専用背景ができるまで写真なし）。ヒーローは減光スクリム+白文字で描画し、本文はテーマ本来のキャンバスを維持する。写真は同一オリジンの `/campaigns/bg/*` を参照（LPを単体ファイルとして持ち出すと画像は外れる——テーマ別専用背景の用意と合わせて今後の課題）
- **Campaigns UI（管理画面）は白のまま**: `/campaigns` のフルスクリーンヒーロー（背景は simon-nilsen 固定+ソース入力のグラスカード）だけが例外で、ヒーロー以下の一覧・ダイジェスト・詳細ページ `/campaigns/[id]` は通常の白いツールUI。背景写真セットは管理UIの装飾ではなく**生成LPのヒーロー用**
- **API・ジョブ基盤は現行のまま**: `/api/labs/campaign/*`（Labsゲート継続。公開ファネル化はPhase 1）、ジョブ永続化は `var/campaign-lab/jobs/`
- ナビ: ハンバーガーの `Campaigns`（Labsロール保持者のみ、Phase 1で一般公開）

## 1. いま何ができるか（現在地）

**「ソース → Service Brand Kit → セールスページ（SaaS型フル構成）+ 30秒CM（ローカル）」の縦貫通が動いている。パレットはTier S（実画面レンダリング証拠 + VLM裁定 + 自己検証）で抽出される。動画はPhase 0bのローカル実装が完了（2026-07-20）: ナレーションは構造化5シーン、TTS→タイミングJSON→Remotionで、ブラウザ内Playerプレビュー+ローカルMP4書き出しまで検証済み。**

2026-07-20 精度パス2（funds.jp事例、正本は [docs/palette-accuracy.md](docs/palette-accuracy.md) §7）:

- **ロゴ検出は候補スコアリング方式**。ベクター取得は2経路（2026-07-20拡張）: ①インラインSVGは計算済みスタイルを焼き込んで取得、②`<img src="*.svg">` は**参照先ファイルそのものを取得**（bakuraku.jpで実証）。`<img>` がPNG/JPEG参照でも原寸ファイルを取得し、要素スクショは最終フォールバック。いずれも `assets.logo_svg` / `assets.logo` としてLP・ダイジェスト・CM動画が消費
- **パレット証拠にグラデーション・画面ピクセル・og:image(KV)を追加**。ヒーローが画像/グラデーションでも色相が候補に入る。accentはprimaryと異なる第2色相を優先
- **デザイントークンをLPに実適用**: 実フォント（既知ファミリーはGoogle Fontsから読込——自己完結HTMLの唯一の外部依存）・CTA角丸・コンテナ幅・セクション余白

UIフロー（`/campaigns`、当面Labsロール必須）:

1. **ソース追加カード**: URL入力（サンプルチップ: Anthropic/Apple/Google）、PDF・画像のドラッグ&ドロップ（5個・各4.5MBまで）、テキスト貼り付け。NotebookLMの「ソースを追加」を踏襲した設計
2. **結果レイアウトは最初からプレースホルダーで表示**（何が生成されるかを実行前から予測できる）。「LPと動画素材を生成」ボタン → **サーバー側のジョブとして生成が走る**（`var/campaign-lab/jobs/` に永続化、UIは2.5秒ポーリングで追従）。**ページを閉じても・回線が切れても生成は継続**し、次に開いたとき最新ジョブ（ログ+結果）が復元される。**2〜4分かかる**
3. **処理ログ**: 実行中は**画面右下のポップアップ**としてパイプラインの実イベントが流れる（engine→ingest→capture→palette→adjudicate→creative→verify→cost）。完了するとポップアップは自動で消え、プレースホルダーが実データに置き換わり、**ログはマーケティングアセットの下に参考情報として移動**する。captureが実行されたかスキップされたか（⚠表示）が利用者にも開発者にも見える。**LLM呼び出しは使用エンジン（OpenAI API / gpt-5.6-terra・Chat Completions + structured outputs）・実トークン数・概算USDコストをログに明示**し、最後に合計を出す（単価は `creative.ts` の `PRICE_PER_MTOK`: terra 入力$2.50/出力$15 per 1Mトークン）
4. 結果画面は2層:
   - **サービスヘッダー（分析結果）**: サービス名・タグライン・業種・事業タイプ・提供価値・ターゲット・概要。全アセットの一段上に置く
   - **マーケティングアセット**:
     - **Service Brand Kit（デザイン基盤）**: 取得した実ロゴ、パレット5色+出所バッジ、CSSから推定したデザイントークン（フォント・ボタン角丸/余白・セクション余白・コンテンツ幅）、brandkit.jsonダウンロード
     - **セールスページ（LP）**: Heroセクションだけのダイジェストプレビュー。クリックで**本物のLP**（署名付きURL `/c/[id]`）が新しいタブで開く。LPヘッダーには取得した実ロゴを使用
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
│                        #   + SaaS型フルLP用の proof / testimonials / pricing / faq（仮情報セクション）
├── sample.ts            #   バンドルサンプル: CM Maker自身のセールスページ（/campaigns初期表示・/c/sample）
├── ingest.ts            #   URL → テキスト・メタ・カラーヒント・og:image
├── capture.ts           #   Playwrightで実画面レンダリング→スクショ・ヒストグラム・ロゴ画像・デザイントークン
├── palette.ts           #   CIELABクラスタリング→証拠付きパレット候補
├── creative.ts          #   VLM裁定 + Brand Kit生成（テーマ選択含む） + LP照合判定（OpenAI structured outputs）
├── themes.ts            #   デザインテーマ7種の正本（LP variant・ヒーロー背景割当 + 全レンダラー共通のトーン&マナー指示文）
├── jobs.ts              #   ジョブ永続化（var/campaign-lab/jobs/、リロード復元・カード一覧の裏側）+ CM成果物
├── render-lp.ts         #   Brand Kit → 自己完結HTML（SaaS型フルテンプレートv2、kit.themeでglass/flatを切替）
├── cm-types.ts          #   CM動画のデータ契約（CmVoiceTrack等、server/client/Remotion共有）
├── voice.ts             #   Stage 5 voice: cm_script → TTS → シーン境界+字幕タイミング+WAV
├── sample-cm-track.json #   サンプルCMのタイミング（campaign:sample-voiceが生成、コミット済み）
└── (sample.ts)          #   sampleCmScript（5シーン手書き）を含む

remotion/                # CM動画コンポジション（Player・CLI共用、"@/"エイリアス不使用）
├── cm/CmComposition.tsx #   課題解決型テンプレート本体（シーン群・字幕・ブランドパレット）
├── Root.tsx / index.ts  #   Remotion CLI/Studio用エントリ（calculateMetadataで音声実尺→フレーム数）
└── (remotion.config.ts) #   リポジトリルート。CLI設定

app/campaigns/CmVideoPlayer.tsx          # @remotion/playerラッパー（dynamic import）
app/api/labs/campaign/voice/route.ts     # POST: CM音声生成（detachedジョブ）
app/api/labs/campaign/audio/[id]/route.ts# GET: 音声WAV（署名URL経由）
labs/campaign/scripts/sample-voice.ts    # サンプルCM音声の再生成（npm run campaign:sample-voice）
labs/campaign/scripts/render-cm.mjs      # ローカルMP4書き出し（npm run campaign:render）

app/campaigns/           # 入口UX（製品面）
├── page.tsx             #   /campaigns（AppHeader + サンプルLPをサーバー側でレンダリングして注入）
├── CampaignsTop.tsx     #   フルスクリーンヒーロー（背景固定+ソース入力のグラスカード）+ カード一覧 + サンプル展開
├── campaign-ui.tsx      #   共有UI（ResultDigest・処理ログ・ジョブAPIヘルパー）
└── [id]/                #   キャンペーン詳細（左: 一覧サイドバー / 右: ダイジェスト+処理ログ、白いツールUI）

app/c/[id]/route.ts      # 生成LPの正規URL（/c/sample は公開、ジョブ由来は署名URL）
next.config.ts           # 旧URL /labs/campaign → /campaigns リダイレクト（静的ページ内redirect()は本番で効かないため）

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

`labs/directory.ts` のCampaign Labエントリは`graduated`で、研究所インデックスには「本体へ卒業」バッジ付きで残り、カードは `/campaigns` へリンクする。

## 4. ロードマップ

### Phase 0a+: パレット精度の改善（✅ Tier S 実装済み 2026-07-19）
Playwrightスクショ + computed styleヒストグラム + VLM裁定（候補からの選択のみ・発明禁止）+ 自己検証ループのTier Sを実装し、受け入れ基準を実測で確認済み（wealth-parkで白/黒/青が返り緑は消滅、anthropic.comは劣化なし）。**設計・実装対応表・実測結果: [docs/palette-accuracy.md](docs/palette-accuracy.md)**。Vercel本番ではChromiumが動かないためcaptureは自動でスキップされ`palette_source: "generated"`のAI提案パレットに落ちる（マネージドブラウザへの差し替えはプロダクト化時）。

### Phase 0b: 動画レンダラー（✅ ローカル実装完了 2026-07-20）

実装済みのパイプライン（1シーン=1TTSセクション=1映像シーケンス、すべて `cm_script` が単一の正本）:

1. **script**: `kit.cm_script` — LLMが5シーン構造（hook → problem → solution → features → cta）でナレーションを出力（`schema.ts CmSceneSchema`）。平文 `kit.narration` はここからの導出値。旧kitは`cm_script`なし=動画不可（再生成を促す）
2. **voice**: `lib/campaign/voice.ts` — シーンごとにGemini TTS（`audio/tts-lib/`のWKFL資産を使用、`CAMPAIGN_TTS_MOCK=1`でキーなし開発可）→ `mixEpisode` でシーン境界が確定 → 文字数按分の文単位字幕。成果物はWAV+`CmVoiceTrack`（`cm-types.ts`）。UIの「製品紹介動画を生成」ボタン→ `POST /api/labs/campaign/voice`（detachedジョブ・**実行中は処理ログポップアップが進捗を表示**）
3. **video**: `remotion/cm/CmComposition.tsx` — 課題解決型テンプレート。Brand Kit（パレット・実ロゴSVG・テーマvariant・LPコピー）+ CmVoiceTrackをpropsに、シーン境界は音声実尺から算出。glass系テーマはダークキャンバス、flat系はブランド背景色
4. **プレビュー**: `@remotion/player`（`app/campaigns/CmVideoPlayer.tsx`、dynamic import）でブラウザ内即時再生。voice完了時点でPlayerが再生可能になり、MP4はその後バックグラウンドで書き出される
5. **MP4（voiceジョブが自動で続けて書き出す）**: voice完了後、同じdetachedジョブが `npm run campaign:render`（Remotion CLI・ローカルChromium）をspawnしてMP4を書き出す。**Vercel serverless上ではレンダリング不可**（Chromium依存が関数サイズ上限を超える）ため、その環境ではwarnログを出してスキップ（Playerプレビューは動作）——captureと同じ縮退方針。クラウド化はRemotion Lambda（AWS）採用予定で、コンポジションとpropsの契約はそのまま使える。CLI単体実行は `npm run campaign:render -- --job <id> | --sample`
6. **LP連動**: LPテンプレートのvideo-slotは `<!--cm-video-slot-->` マーカー付きで保存され、`/c/[id]` が**配信のたびに**MP4の存在を確認して署名URL付き `<video>` に差し替える（保存済みHTMLに署名URLを焼き込まない——期限切れ対策）。サンプルLP（`/c/sample`）は `public/campaigns/sample-cm.mp4`（コミット済み）を直接埋め込む

**成果物の保存場所**（ラボ期・すべてローカル。Phase 1で `campaigns` テーブル+R2へ）:

| ファイル | 内容 |
|---|---|
| `var/campaign-lab/jobs/<id>.json` | ジョブrecord: Brand Kit・処理ログ・`cm`（CmVoiceTrack=シーン/字幕タイミング・mp4フラグ） |
| `var/campaign-lab/jobs/<id>.html` | 生成LP（video-slotマーカー入り） |
| `var/campaign-lab/jobs/<id>.cm.wav` | ナレーション音声（モノラル24kHz） |
| `var/campaign-lab/jobs/<id>.cm.mp4` | 書き出し済みCM動画（1080p30） |
| `public/campaigns/sample-cm.{wav,mp4}` + `lib/campaign/sample-cm-track.json` | サンプルCMの音声/動画/タイミング（コミット済み。再生成: `npm run campaign:sample-voice` → `npm run campaign:render -- --sample --out public/campaigns/sample-cm.mp4`） |

「動画そのもの」はMP4になる前から存在する点が重要: Playerは **kit + track + wav の3点をブラウザ内で合成して再生**しており、MP4はLP埋め込み・配布用の書き出し形態にすぎない。

残タスク:
- **チュートリアル型テンプレート**（2種目）: 「今日は使ってみました」
- **BGM**: ミックス機構（ダッキング）は実装済みだがライセンス未解決（§6リサーチ待ち）のため無効
- 字幕同期の精度向上（ElevenLabs character timestamps をプロバイダ辞書に追加）
- テーマ`direction`のTTSペルソナ/映像演出への反映（現在は固定ペルソナ・声はKore固定）
- MP4のクラウドレンダリング（Remotion Lambda）+ R2保存（課金ポイント。ダウンロードUIはローカル版実装済み）

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
