# Labs ↔ ロゴ正本エンティティ統合 — 要件と次セッション引き継ぎ

最終更新: 2026-07-16
ステータス: **要件確定 / 設計・実装は次セッション**
前提正本: [data-model.md](data-model.md)(ロゴ正本の3層分離・candidate・logo_mockups・asset定義カタログ)/ [account-design.md](account-design.md)(アカウント・組織・RLS)/ [labs/workflow/README.md](../labs/workflow/README.md)(保証モード・ランタイムBlender candidate)

> **この文書の役割**: 2026-07-16 のネオンサイン確定作業で露呈した「ロゴがバラバラに扱われている」問題の**要件を確定**し、次セッションで設計・実装に入るための引き継ぎ。データのパラダイムに触れる可能性があるため、実装前にここで要件だけ固める。

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

## 3. 現行スキーマとのギャップ(何が足りないか)

data-model.md の既存設計でほぼ表現できる。**新パラダイムというより「Labs を既存 entity 体系に接続する配線」**が主。

- **処理状態**は既存の枠でほぼ表現可能: `presentation_asset_definitions` に "neon" 相当の定義を置き、`logo_mockups`(`candidate_id` + `mockup_definition_id` + `image_path`)に結果を持てば、**行の有無 = 処理済み/未処理**。
- 欠けている配線:
  1. **Labs のロゴ取得を entity 化**(`--svg` ファイル → candidate の master SVG を取得するピッカー/API)
  2. **ネオンを asset definition として登録**(下記 4 の論点あり)
  3. **ランタイムBlender実行のトリガ/ワーカー**(現状は手動CLI)
  4. **実行結果を candidate に R2 保存 + レコード配線**(Gemini mockup の先例に倣う: `logos/<logoId>/candidates/<candidateId>/…`)
  5. **Labs UI に処理状態表示**と「未処理を回す」導線
  6. **Generative Lab の logoHash → logos 配線**(同じ統合の一部。data-model.md §6.4.1 の宿題)

## 4. パラダイム変更リスク・論点(次セッションで決める)

- **ネオンは既存 asset 体系(motion / mockup / generated)に収まるか、別枠が要るか**。data-model.md は「asset は presentation placement に載る」前提。ネオンを `presentation_asset_definitions` に `asset_kind='render'` / `renderer_kind='runtime-blender'` で足すのが自然だが、ネオンは**プレゼン本編に載せる asset なのか、単体の表現検証なのか**が分岐点。ここがパラダイムに触れる可能性のある一番の論点。
- **「表現(expression)」という新しい第一級概念が要るか**。処理状態 R3 を asset 定義で代用するか、ロゴ×表現の独立テーブル(`logo_renders` 等)を設けるか。
- **ランタイム基盤**: PoC段階では「手動CLI + 結果を entity に登録するアップロード導線」だけでも R1〜R5 は満たせる。本番ワーカー(R6)は後追いで良いか。
- **BrandRepo の実体**: 現状 localStorage 実装。Labs が見るロゴを localStorage entity にするか、Supabase 移行を先行させるか。
- **スコープ/RLS**: どのアカウントのロゴがどの Lab に出るか(admin=自組織)。

## 5. 次セッションの進め方

1. **§4 の論点を決める**(特にネオン=asset か表現かの分岐)。data-model.md を正本に更新する。
2. **最小骨格を実装**: (a) Labs のロゴピッカーを entity 化 (b) ネオンを定義として登録 (c) 実行 → R2 → `logo_mockups` 配線 (d) 処理状態表示。
3. **その上に ① を乗せる**: ネオンの内部メモサンプル(サンプル画像 + 再現手順)を、独立ファイルではなく **entity 参照**で `/labs/workflow` に出す。

## 6. この作業と切り離して「完了済み」なもの

- **ネオンのレシピ自体は確定・コミット済み**([labs/workflow/scripts/blender/neon_sign.py](../labs/workflow/scripts/blender/neon_sign.py))。本統合は**レシピではなく「ロゴ実体との配線」**が対象。再現は `Blender -b -P neon_sign.py -- --svg <SVG> --out <PNG>`(MCP/GUI不要)。
