# Campaign Lab — 統合表現研究所（引き継ぎ資料）

最終更新: 2026-07-19

最小限のソース（URL・PDF・画像・テキスト）から、サービス紹介の**LP（ペラ1）と30秒CM動画**を自動生成するラボ。旧・独立プロジェクト「cm-maker」（`~/projects/cm-maker`、クローズ済み）を合流させたもので、**パイプラインの正本はこのリポジトリだけ**にある。

## 1. いま何ができるか（現在地）

**「ソース → Service Brand Kit → LP」の縦貫通が動いている。動画はまだ。**

UIフロー（`/labs/campaign`、Labsロール必須）:

1. **ソース追加カード**: URL入力（サンプルチップ: Anthropic/Apple/Google）、PDF・画像のドラッグ&ドロップ（5個・各4.5MBまで）、テキスト貼り付け。NotebookLMの「ソースを追加」を踏襲した設計
2. 「LPと動画素材を生成」ボタン → 生成中の段階演出（「サービスを理解しています…」等）。**1〜2分かかる**（Claude opusの構造化生成）
3. 結果は2パネル:
   - **左 = Service Brand Kit パネル**: サービス名・タグライン、カラーパレット5色、ジャンル/ターゲット、**30秒CMナレーション原稿**（これが将来の動画レンダラーの入力）、ダウンロードボタン（LP HTML / brandkit.json）
   - **右 = LPライブプレビュー**: 生成されたペラ1をiframeで即時表示。「新しいタブで開く」可。LP内には動画埋め込みスロットを確保済み（今は「生成中」表示のプレースホルダ）

CLIでも同じパイプラインを実行できる（Web UI・ログイン不要、検証・開発用）:

```bash
npm run campaign -- https://example.com
npm run campaign -- --name "MyApp" --desc "説明" --shots ./materials  # PDFや画像のフォルダ
# 出力: var/campaign/<slug>/{brandkit.json, index.html, narration.txt}
```

必要な環境変数: `.env.local` の `ANTHROPIC_API_KEY`。秘密値はリポジトリへコミットしない。

## 2. アーキテクチャの核: Service Brand Kit

動画でもLPでもなく、**「サービス理解+ブランド」の中間表現（Brand Kit）がプロダクトの核**。zodスキーマは `lib/campaign/schema.ts`。

```
ソース（URL / PDF / 画像 / テキスト）
   ▼ Stage 1: ingest（スクレイピング・ブランドカラー抽出・og:image取得）
   ▼ Stage 2: creative（Claude claude-opus-4-8 + structured outputs）
Service Brand Kit（service / brand(palette) / copy(LP全文) / narration(CM原稿)）
   ├→ LPレンダラー ……………… 実装済み（render-lp.ts）
   ├→ 動画レンダラー（Remotion） … 次フェーズ（Phase 0b）
   └→ SNS素材・OGP・バナー ……… 将来
```

設計原則: **LLMには閉じたスキーマのJSONだけを出力させ、見た目の品質はテンプレート側で担保する**。雑な入力でも壊れない。ロゴス本体の思想でいえば、Brand Kitのコピー/パレット生成は「探索」、レンダラーは「保証」に相当する。

## 3. ファイル構成

```
lib/campaign/            # パイプライン本体（API routeとCLIの両方から使う唯一の実装）
├── schema.ts            #   Service Brand Kit の zod スキーマ
├── ingest.ts            #   URL → テキスト・メタ・カラーヒント・og:image
├── creative.ts          #   Claude structured outputs → Brand Kit（PDF/画像/テキスト対応）
└── render-lp.ts         #   Brand Kit → 自己完結HTML（外部依存ゼロ・CSS変数テーマ）

app/labs/campaign/       # 入口UX
├── page.tsx             #   ラボページ（LabHeader + noindex）
└── CampaignStudio.tsx   #   ソース追加UI・生成・結果2パネル表示

app/api/labs/campaign/generate/route.ts  # 生成API（guardLabsRequestで保護、maxDuration 300）

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

### Phase 0a+: パレット精度の改善（最優先・着手前）
現行のカラー抽出はHTML静的解析のみで、外部CSSのサイト（例: wealth-park.com）では**証拠ゼロ→AIが色を発明する**破綻が実証済み。Playwrightスクショ + computed styleヒストグラム + VLM裁定 + 自己検証ループの「最強プラン」を設計済み。**詳細・実測診断・受け入れ基準: [docs/palette-accuracy.md](docs/palette-accuracy.md)**。初回品質＝アハ体験なので動画より先にやる。

### Phase 0b: 動画レンダラー（次にやること）
`narration.txt`（Brand Kitに含まれる）を起点に:
1. **voice**: TTS（`audio/tts-lib/tts.mjs` のプロバイダ抽象を土台に。Gemini TTSは動く。字幕同期精度を上げるならElevenLabsのcharacter timestampsを追加）→ タイミングJSON → BGMダッキングミックス（`audio.mjs`）
2. **video**: Remotionコンポジション。Brand Kit + タイミングJSONをpropsに、テンプレート駆動で組み立て。WKFL（`~/projects/WKFL/video/src/`）の `calculateMetadata`（音声実尺→フレーム数）、`captions.ts buildCaptions()`（文字数按分字幕）、`TopicScene`（ケンバーンズ）が実装の参照元
3. プレビューは `@remotion/player` でブラウザ内即時再生（MP4レンダリング不要 = アハ体験の核）。MP4書き出しはローカルCLI→将来Remotion Lambda

**動画テンプレートは2種に固定**（出力の予測可能性 = 期待値を揃える）:
- 課題解決型: 「〇〇について説明します」→「こんなお悩みありませんか?」(3つ) →「全部これで解決」→ 機能3つ → 活用例 → CTA
- チュートリアル型: 「今日は使ってみました」

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
