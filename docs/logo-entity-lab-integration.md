# Labs ↔ ロゴ正本エンティティ統合 — 要件と次セッション引き継ぎ

最終更新: 2026-07-16
ステータス: **要件・データ境界・最小骨格確定 / 暫定手動運用中**
前提正本: [data-model.md](data-model.md)(ロゴ正本の3層分離・candidate・logo_mockups・asset定義カタログ)/ [account-design.md](account-design.md)(アカウント・組織・RLS)/ [labs/workflow/README.md](../labs/workflow/README.md)(保証モード・ランタイムBlender candidate)

> **この文書の役割**: 2026-07-16 のネオンサイン確定作業で露呈した「ロゴがバラバラに扱われている」問題について、確定した要件・データ境界・現在の実装・暫定手動運用を次セッションへ引き継ぐ。

---

## 1. 背景 — なぜ今これが問題か

ネオンサイン(ランタイムBlender第1スパイク)を確定版にした際、**入力ロゴに `~/Desktop/assets-logos/logo/logo-black.svg` という独立ファイルを直接渡した**。これは「ロゴは1ピクセルも崩さない正本」を掲げるプロダクトの思想と噛み合わない。

一方 [data-model.md](data-model.md) では既に**ロゴ=アカウント紐づきの正本エンティティ**が設計されている(`logos` → `logo_candidates.file_path`(マスターSVG)→ `logo_variants` / `logo_mockups`)。**問題はデータモデルの不足ではなく、Labs がこの体系の外にいること**:

| Lab | 現状のロゴの扱い | entity 配線 |
|---|---|---|
| Workflow(ネオン) | CLI `--svg <ファイルパス>`。Desktop等の独立SVG | **なし**(完全にDB外) |
| Generative | `logoHash`(ペイロードSHA-256)ベースのR2キャッシュ | **なし**(data-model.md §6.4.1 の通り `logos` 未配線) |
| Workflow(シーン10 Gemini mockup) | `logo_mockups`(candidate→ロゴ→組織) | **あり**(唯一配線済みの先例) |

つまり「Gemini mockup は正本にぶら下がる/ネオン・Generativeはぶら下がらない」という**成り行きの分裂**が起きている。これが根本課題。

## 2. 要件要求(2026-07-16 確定)

- **R1. ロゴは全レイヤー共通の単一エンティティ**: homepage アップロード / Brand Manager・自分のプロパティ / Labs / Blenderパイプライン が、すべて同一の `logos`(→ primary candidate のマスターSVG)を参照する。**Labs の独立ファイル読み(Desktop直読み・Generativeの logoHash)を廃止**し、entity から取得する。
- **R2. 双方向の可視性**: homepage で追加したロゴが Labs に現れる。Labs で使ったロゴが管理画面(`/brand`)・自分のプロパティに**自分のロゴとして**現れる。アカウント(admin なら自分の組織)をスコープにする。
- **R3. 処理状態(processed / unprocessed)**: 各ロゴ(候補)が「どの**表現(expression)**で処理済みか/未処理か」を持つ。ネオンはその表現の1つ。UI で未処理ロゴが識別できる。
- **R4. 裏側実行 → 登録 → 表示の導線**: 未処理ロゴを選んで、裏でパイプライン(例: ネオンBlenderレンダー)を実行し、結果を **R2 + レコード**に登録して表示できる。「このロゴでもう一回走らせて」に応えられる。
- **R5. Lab = 採用判断の検証場**: ある表現プロセスを**正式採用するか**を、多数のロゴで検証して決める場。ランタイムスパイク(ネオン)は「生成ボタン」ではなく**製作者向け内部メモ(サンプル + 再現手順)**として並ぶが、参照するロゴは entity。同じ表現のバージョン違いも並ぶ。
- **R6. ランタイムBlenderワーカー**: ネオンは実行ごとレンダー(分単位)。同期レスポンス不要の**キュー/バッチ**で良い。トリガ・キュー・結果保存(R2 + `logo_mockups` 的レコード)を設計する。現状は手動CLI(`Blender -b -P neon_sign.py -- --svg …`)。

## 3. 当初のスキーマギャップと現在地

data-model.md の既存設計でほぼ表現できる。**新パラダイムというより「Labs を既存 entity 体系に接続する配線」**が主。

- **処理状態**は既存の枠でほぼ表現可能: `presentation_asset_definitions` に "neon" 相当の定義を置き、`logo_mockups`(`candidate_id` + `mockup_definition_id` + `image_path`)に結果を持てば、**行の有無 = 処理済み/未処理**。
- 配線の現在地:
  1. **Labs のロゴ取得を entity 化**: 完了。Lab専用upload registryを廃止し、canonical candidateを選ぶ
  2. **ネオンをasset definitionとして登録**: 完了。`workflow-neon-sign-v1`をdraft runtime assetとして登録
  3. **ランタイムBlender実行**: 暫定手動運用。queue・実行ロジックはあるが、永続ワーカーは未配備
  4. **R2保存 + `logo_mockups`配線**: 実行ロジックと表示を実装済み。実データでの運用はmigration適用後に開始する
  5. **Labs UIの処理状態と依頼handoff**: 完了。IDコピーと任意のRun作成に対応
  6. **Generative LabのlogoHash → logos配線**: 未完。同じ統合の残タスク(data-model.md §6.4.1)

## 4. データ境界の決定(2026-07-16)

- **ネオンを含むLab成果物は、すべてpresentation asset定義カタログに置く**。ただし定義は提供側の成熟度 `draft / production` を持ち、draftはLabにだけ表示し、productionだけを利用者向けプレゼン編集UIへ出す。ネオンは `asset_kind='mockup' / renderer_kind='runtime-blender' / release_stage='draft'`。
- **「表現(expression)」は独立した第一級概念にしない**。motion / mockup / generated、実行方式、表示先の違いはasset定義で表現する。処理状態だけは定義や成果物キャッシュに混ぜず、candidate × asset definition versionの `logo_asset_runs` として分離する。
- **提供側の成熟度と利用者の選択は別レイヤー**。`release_stage` は運営・制作者が決める。production assetに対するロゴごとの表示オン/オフ、順序、色・素材等の値は `logo_presentations.layout.mappings[].enabled / order / params` に保存する。
- **定義はversion固定**。同じ表現の改良版は同じ `family_id` の新しい `definition_version` として並び、既存プレゼンと処理状態は具体的なdefinition IDを参照する。
- **ランタイム基盤**: PoC段階では「手動CLI + 結果を entity に登録する導線」で R1〜R5 を満たす。本番ワーカー(R6)は後追いとする。
- **BrandRepo の実体**: Labsもhomepage/Brand Managerと同じrepoを使う。Supabase設定時は正本DB、未設定時のみ同一のlocalStorage正本へフォールバックする。Lab専用upload registryは廃止。
- **スコープ/RLS**: どのアカウントのロゴがどの Lab に出るか(admin=自組織)。

## 5. ランタイムassetの暫定手動運用

### 目的と入口

永続ワーカーとagentic workflowが完成するまでは、利用者がLab詳細から依頼情報をコピーし、**同じworkspaceを操作できる新しいエージェントセッション**へ貼り付ける。ネオンv1の入口は `/labs/workflow/workflow-neon-sign-v1`、レシピは `labs/workflow/scripts/blender/neon_sign.py`。

新しいセッションは次の順に読む:

1. この文書
2. [Workflow Lab README](../labs/workflow/README.md)
3. コピーされた依頼の`Page`と、該当asset定義・実行スクリプト

### 受け渡す情報

| 項目 | 役割 | 手動期間 |
|---|---|---|
| `Logo ID` | `logos.id`。対象ロゴをグローバルに一意に特定する | **必須** |
| `Candidate ID` | `logo_candidates.id`。今回使うmaster SVGを固定する | **必須** |
| `Asset Definition ID` | 実行するasset定義を特定する | **必須** |
| `Asset Family` / `Version` | 同じ表現の世代を固定し、取り違えを検出する | **必須** |
| `Run ID` | `logo_asset_runs.id`。実行状態を追跡する | 任意。履歴を残す場合だけ作成 |
| ロゴ名 / params / Page | 人間の確認と実行設定 | コピーに含める |

Logo IDから所有アカウント/組織はリレーションで解決できるため、依頼時にアカウントIDを別途伝える必要はない。Candidate IDも渡すのは、primary candidateが後で差し替わっても今回の入力SVGを曖昧にしないため。

### エージェント側の作業

1. IDから`logos`と指定された`logo_candidates`を解決し、CandidateがLogoに所属することを確認する
2. trustedなローカル接続経由で`logo_candidates.svg`を取得し、作業用`master.svg`へ書き出す
3. asset定義のスクリプトをヘッドレス実行する。ネオンv1は `Blender -b -P labs/workflow/scripts/blender/neon_sign.py -- --svg <master.svg> --out <render.png>`
4. 成果物を [runtime-worker.ts](../labs/workflow/engine/runtime-worker.ts) と [mockups.ts](../lib/mockups.ts) の規約に従ってR2へ保存し、`logo_mockups`を指定Candidateとasset定義へupsertする
5. Run IDがある場合は`logo_asset_runs`を`running`から`succeeded`または`failed`へ更新する。Run IDがない場合は成果物登録だけでよい
6. Lab詳細を再表示し、対象ロゴに成果物と処理状態が表示されることを確認する

### IDと認証の境界

- **IDは対象の特定、認証はアクセス権の証明**。Logo IDだけで「どのロゴか」は特定できるが、privateなSVGを読んだりR2/DBへ書いたりするには、そのworkspaceで許可済みの接続が必要
- 暫定手動運用では、エージェントが既存のローカル接続設定・ログイン済みセッション・許可済みツールを使う。自動ワーカー用のservice roleやworker secretはまだ設けない
- コピーする依頼情報にSupabase JWT/service role、R2 access key、`.env.local`の内容を含めない。エージェントも秘密情報をチャットへ貼るよう求めない
- 読み書き可能な接続がない場合は、その事実と必要な権限だけを報告する。IDが不足している問題と認証が不足している問題を混同しない

## 6. 次セッションの進め方

1. ~~assetかexpressionかを決め、data-model.mdを更新する~~ **完了**。
2. **最小骨格**: (a) Labs のロゴピッカーentity化 **完了** (b) ネオンのdraft定義登録 **完了** (c) 開発用実行 → R2 → `logo_mockups` 配線 **完了** (d) `logo_asset_runs` の処理状態表示 **完了**。本番の永続Blenderワーカー配備は未完。
3. **その上に内部メモを載せる**: ネオンのサンプル画像 + 再現手順を、独立ファイルではなく **entity 参照**で `/labs/workflow` に出す。

## 7. この作業と切り離して「完了済み」なもの

- **ネオンのレシピ自体は確定・コミット済み**([labs/workflow/scripts/blender/neon_sign.py](../labs/workflow/scripts/blender/neon_sign.py))。本統合は**レシピではなく「ロゴ実体との配線」**が対象。再現は `Blender -b -P neon_sign.py -- --svg <SVG> --out <PNG>`(MCP/GUI不要)。
