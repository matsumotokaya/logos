# Logos data model

更新日: 2026-08-13
ステータス: **V2稼働構造の正本**

V2の設計・移行判断の履歴は [schema-v2.md](old/schema-v2.md)、アカウントとRLSの原則は [account-design.md](account-design.md)、成果物アーキテクチャの背景は [deliverable-architecture.md](deliverable-architecture.md) を参照する。本書はmigration 0046適用後の現在形だけを記す。

既存Brandへロゴを追加するときは`create_brand_logo_with_presentation`を使い、Logo・primary Candidate・`logo-presentation@1` Take・HTML Render・`logo_presentation` canonical slotを同一transactionで作る。単独ロゴ取り込み用の`create_logo_with_presentation`だけが未所属用Brandを補完する。

ロゴ正本の管理は`/logos/[id]`、プレゼン編集は`/logos/[id]/presentation`、閲覧は`/p/[id]`に分ける。`/p/[id]`は現時点ではLogo visibility + RLSに従う閲覧面であり、将来の明示的なPublication/live URLやユーザー指定URLを管理画面へ混ぜない。

## 1. 中心モデル

```text
Organization
  └── Brand
        ├── BrandKnowledge claims / adopted values
        ├── BrandVariant
        ├── Logo → Candidate / Lockup / Variant / Mockup
        ├── Work
        │     ├── BrandMaterial
        │     └── Take
        └── Take
              ├── pinned TakeInput → BrandMaterial
              ├── TakeRun
              ├── TakeRender → immutable RenderArtifact
              └── Publication

TemplateVersion ← Take
CanonicalSlot → Take
```

- `brand_organizations`は会社・個人・非営利など、実世界の所有コンテナ。
- `brand_entities`は市場に向けて一貫した名前・ロゴ・表現を持つBrand。全行に`brand_kind`と`brand_organization_id`が必須。
- `works`はイベントや施策など、複数成果物が同じ素材を共有する仕事単位。
- `takes`はLP・動画・ロゴプレゼンなど、編集可能な成果物の版固定された実体。
- `take_renders`は出力条件、`render_artifacts`はR2に置かれた不変成果物。採用中の成果物だけを`latest_artifact_id`で指す。

旧`brand_profiles`、`brand_generation_runs`、`brand_assets`、`campaigns`系、`logo_presentations`は存在しない。互換読み・二重書きも行わない。

## 2. OrganizationとBrand

`brand_organizations`は現実世界の所有コンテナ(会社・個人・非営利など)で、**メタ情報(name / website / industry / location / description / status / kind)の純粋な入れ物**として扱う。Organization自体にはロゴ・配色・タイポなどのBrand資産を持たない。

- **任意に親Organizationを持てる**(`parent_organization_id`)。ホールディングス配下のグループ会社をN階層で表現可能
- アクセス権は親子関係から継承しない。各行の`linked_org_id`をRLSが直接評価する
- Organization一覧ページ(`/organizations/[id]`)はメタ情報と**子Organizations / Brandsの一覧**を表示するだけで、Brand Profile(palette / design tokens / logos)を混在させない

`brand_entities.brand_kind`は次の6種。

- `corporate`
- `business`
- `service`
- `product`
- `media`
- `event`

Brandの親子関係は`parent_brand_id`で表し、同じOrganization内に限定する。企業Brandは親を持たず、`is_primary_brand`は企業Brandだけが使える。対象顧客別の差分は別Brandを乱造せず`brand_variants`に置く。

ロゴ、Knowledge、Work、Take、MaterialはすべてBrandへ属する。Organizationを成果物の直接所有者にしない。

### 2.1 ブランドトップ(`/brands/[id]`)

`/brands/[id]` は3セクションから成る。

1. ブランド基本情報(`brand_entities` から name / kind / description / industry / location / website)
2. 採用済みデザインルール(`brand_knowledge_values` から palette / typography / voice のうち known field のみ)
3. 3タイル(動画 / LP / ロゴ) — 各 `/brands/[id]/{videos,lps,logos}` へのエントリ

Organization詳細ページにはロゴ・パレット・タイポ等のBrand Profileを表示しない。Brand Profileは `/logos/[id]` 配下のLogoInfoPageでロゴ単位に表示する。

## 3. BrandKnowledge

抽出や生成で得た情報は`brand_knowledge_claims`へ追記し、利用者が採用した現在値を`brand_knowledge_values`へ置く。生成処理は採用済み値を上書きしない。

代表的な`field_path`は`identity.*`、`visual.*`、`voice.*`、`audience.*`、`offer.*`、`evidence.*`。Takeのbriefは必要なKnowledgeだけを作成時に投影し、その後は独立して編集できる。

## 4. Work、Material、Take

MaterialのscopeはBrand、Work、Takeのいずれか。R2オブジェクトのchecksumとサイズを保存し、`take_inputs`がroleとchecksumを固定する。レンダー時に「現在のBrand素材」を再解決せず、Takeが固定した入力だけを使う。

Takeは以下を必須とする。

- `tool_kind`
- `template_id` / `template_version`
- `brief_schema_version`
- schema検証済み`brief`
- `status`

作成は原子的RPCを使い、Take・既定Render・必要なRun/Slotを途中状態なしで作る。再試行可能な処理は`idempotency_key`と`request_hash`で同一要求を判定する。

### 4.1 作業中のbriefと、固定したbrief(`baked_brief`)

`takes`は**2つのブリーフを持てる**(migration 0050)。

| 列 | 意味 | 読む側 |
| --- | --- | --- |
| `brief` | 編集がそのまま溜まる**作業中**の値。すべての書き込み経路はここだけを書く | 絵コンテ、FactList、パイプラインの各段 |
| `baked_brief` / `baked_at` | **実行が固定した成果**。null = 一度も実行していない | プレイヤー、MP4レンダー([../lib/takes/render.ts](../lib/takes/render.ts))、公開URL |

**焼き付けを持つのは現時点で`event-cm`だけ**。他のテンプレートは`baked_brief`がnullのままで、レンダーは従来どおり`brief`を読む(`baked_brief ?? brief`)。書き込むのは`POST /api/brands/[id]/videos/[videoId]/bake`だけで、一括実行の最終段だけが呼ぶ。

分けた理由は、**編集が即座に成果物へ届いてしまう**状態を無くすため——シナリオを1行保存すると、その場でプレイヤーの尺と字幕が変わっていた。「作業場と成果は違っていてよい。違いは画面が言う」が現在の契約で、差分判定の正本は [../lib/event-cm/bake.ts](../lib/event-cm/bake.ts)(設計の経緯は [event-cm-refactor-plan.md §9.5 / §11.1](old/event-cm-refactor-plan.md)・アーカイブ)。**差分の見せ方(フィールド単位のマニフェスト・琥珀/緑/赤の3色)は [video-state-model.md](video-state-model.md) が仕様**(2026-08-15確定・実装前)。

**2つある列は、briefのキーを改名するときも2つある**。migration 0051(`script` → `scenario`)は同じ式を`brief`と`baked_brief`の両方に当てている。片方だけ改名すると既存の動画が「シナリオ空」として想定尺へ落ちるので、以後 brief のキーを変える migration はこの2列を必ずセットで扱う。

### 4.2 event-cm briefの語彙(`scenario` / 字幕 / `voice`)

`event-cm`の`brief`が持つ主要フィールドは3語に割れている(migration 0051 で改名。経緯は [event-cm-refactor-plan.md §9.1](old/event-cm-refactor-plan.md))。

| フィールド | 実体 | 型 |
| --- | --- | --- |
| `brief.scenario` | 各シーンの**主文**。字幕・尺・シーン構成を規定する**主**(旧 `brief.script`) | `EventCmScenario`([../remotion/event-cm/types.ts](../remotion/event-cm/types.ts)) |
| — (導出) | 字幕。`scenario`を28字カードへ割った表示単位で、DBには持たない | [../remotion/event-cm/captions.ts](../remotion/event-cm/captions.ts) |
| `brief.voice` | **読み上げ**。`scenario`を声にした派生物で、BGMと同じくオフにできる(オフは`provenance.voice`のsuppressionとして記録) | `{ track, audio: "material:<uuid>" }` |

`brief.scenario`は**必須**(zodスキーマ [../remotion/event-cm/brief-schema.ts](../remotion/event-cm/brief-schema.ts) で non-optional)。読み手が`scenario?.`と防御しないのはこのため——例外は`eventCmFilm()`の1箇所だけで、そこは「常に答える導出」であることを守るために欠損を空シナリオとして扱う。

**`EventCmBrief`は`EventBrief`(event-promo)を継承しない**。共有するのは値の型(`EventPhoto` / `EventLogo` / `EventGuest` / `EventProgram` / `EventSchedule`)だけで、フィールドの一覧は別。継承していた頃は`sideCopy` / `visuals.inkArt` / `visuals.texture`という**どのシーンも描かない3つ**を持ち、それが goal と fact list に並んでいた。以後の規則: **ブリーフに足したフィールドは、どこかのシーンが読むこと**。

**briefのキーを消すときは migration が要らないことが多い**。zod 4 の `z.object()` は未知キーを strip し、書き込み経路はすべて `validateBrief` の**出力**を保存するので、次に保存された時点で消える。**キーを増やす/改名するときは焼き替えが必要**(strip では足せない)——その場合は上記のとおり`brief`と`baked_brief`の両方に当てる。

**`product-cm`はまだ`cm_script`のまま**。同じ「各シーンの主文」構造だが、共通語彙にするかは未決定([event-cm-refactor-plan.md §9.10](old/event-cm-refactor-plan.md))。共有コードの [../lib/narration/voice.ts](../lib/narration/voice.ts) はどちらの綴りも知らない。

## 5. Templateと成果物

テンプレート定義のコード正本は [../lib/templates/catalog.ts](../lib/templates/catalog.ts)、production台帳は`template_versions`。production版のdefinition hashがコードと異なる状態では新規Takeを作らない。

現在の主なテンプレートは次の通り。

- `campaign-lp@2`
- `product-cm@2`
- `event-promo@1`
- `logo-presentation@1`

HTML/MP4はR2が正本で、ローカルファイルを配信フォールバックにしない。ブラウザ配信は署名付き同一オリジンURLを使い、動画はHTTP Rangeに対応する。

### 5.1 event-promo テンプレート経路

event-promo は **Take と `take_inputs` がペアで作成される**設計になっているが、R2 / DB に実際の material が無い状態で `brief` の `event/<slug>/...` 相対パスだけを持っていると、レンダラーは画像を読み込めず失敗する。完成済み「世界が恋する日本酒」Take は R2 に 13件の material と最新MP4 artifact が揃っている。

`/brands/[id]/video` の「＋動画を追加」で **同じブランドの既存 event-promo Take** を選ぶと、新規Takeは RPC `clone_event_promo_take(p_source_take_id, p_new_take_id, p_created_by, p_work_id)`(migration 0047)で以下を引き継ぐ。

- `brief` をソースJSONそのまま上書き(`material:` URI はすでにDB参照形式になっている)
- `take_inputs`(role / material_id / checksum)を1件ずつ insert、`on conflict (take_id, material_id, role) do update` で material を再利用
- 任意の `work_id` を新Takeに付け替え

POST `/api/brands/{id}/videos` の `templateTakeId` パラメータがこの経路を駆動する。`briefSlug`(bundled seed ブリーフ)は互換のため残し、サブセレクト「下敷きにする動画」で brand_organizations 配下の既存 event-promo Takeが選べる。

### 5.2 動画パイプライン(動画詳細の4ステージ)

`/brands/[id]/video/[videoId]` ページ上部に、Slide-Factory 流のステージを表示する(`lib/pipeline/video.ts` + `components/pipeline/VideoPipelinePanel.tsx`)。**入力と抽出は1段**(2026-08-13統合)。

- **input(入力・抽出)** — pinされた素材と、その読み取り実行。素材があって未読み取りなら `stale`。テキストは決定論で読み、PDF・画像は「次の段で直接見る」と印をつけて運ぶだけ(`lib/event-cm/extract.ts`)。分けていたときは「読み取り成功」で止まった利用者が、反映されない動画を見ることになった
- **structure** — テンプレートのブリーフスキーマに対する充足率(EventBriefは title / kind / startsAt / venue / headline / ctaLabel 必須)
- **map** — テンプレートの選択状況(event-promo / product-cm)
- **output** — `take_renders.status` と `render_artifacts.created_at`(timestamp差分で `stale` 判定)

各ステージのステータス(`empty` / `ready` / `stale`)は読み取り専用で、実際の操作(ブリーフ編集・テンプレート切替・再生成)は下部の各workspace / button が担当する。

## 6. Publicationとcanonical slot

`publications`はRenderを公開面へ結び、公開終了時も履歴を保持する。`/c/<id>`や`/v/<id>`はTake/Render/Artifactを解決する。

`canonical_slots`は「このBrandまたはLogoで代表として使うTake」を一意に指す。ロゴプレゼンは`logos.id → canonical_slots(slot='logo_presentation') → Take`で解決し、編集状態は`Take.brief.presentation`に保存する。旧テーブルへのフォールバックはない。

## 7. Logoとpresentation asset

ロゴのmasterは`logos`とprimary `logo_candidates`。Lockup、colorway、生成モックアップは用途別テーブルへ分離する。Logo作成時はpresentation Takeとcanonical slotも同一RPC内で作られ、削除時もまとめて除去される。

`presentation_asset_definitions`は利用可能なassetの版と`draft / production`を管理する。ロゴごとの表示順・有効状態・パラメータは`logo-presentation` Takeの`brief.presentation.layout.mappings`、実行履歴は`logo_asset_runs`、現在の生成画像は`logo_mockups`が担う。

## 8. 削除と複製

削除の可否はスキーマが決めている。`on delete restrict` が置かれているのは「これがあると親を消せない」という宣言であり、UIはそれを言い直すだけで、独自の閾値を持たない。

| 対象 | 削除を止めるもの | 一緒に消えるもの |
| --- | --- | --- |
| `brand_organizations` | 子Organization、配下の`brand_entities` | (行のみ。DELETE `/api/brands/[id]` が自分のprimary corporate Brandだけを同時に消す) |
| `brand_entities` | `takes` / `works` / `brand_materials`。加えて`logos.subject_entity_id`と`brand_entities.parent_brand_id`は`set null`なので、**APIが先に数えて拒否する**(でないと到達不能な行が残る) | Knowledge claims/values、`brand_variants`、`brand_access_grants`、`canonical_slots` |
| `takes` | 参照している`canonical_slots`、`live`な`publications` | `take_renders` → `render_artifacts`、`take_inputs`、`take_runs`、take scopeの`brand_materials` |
| `logos` | — | `logo_candidates`、tags/credits/trademarks、`logo_activities`、`canonical_slots`、プレゼンTake |

- **Takeの削除は`delete_take(p_take_id, p_material_disposition)`が唯一の経路**(`takes`にDELETEポリシーは無い)。`require_decision`(既定)は、そのTakeだけが持つ`upload` / `url_fetch` / `ai_generated`素材があると`TAKE_DELETE_NEEDS_MATERIAL_DECISION`で止まり、DETAILに対象一覧を入れる。`promote`はscopeをbrand/workへ上げて残し、`discard`はR2ごと消す。参照数が0になったキーだけが`private.r2_deletion_queue`へ入る
- HTTP面は `DELETE /api/brands/[id]/videos/[videoId]`、`DELETE /api/brands/[id]/lps/[takeId]`(`?materials=promote|discard`)、`DELETE /api/brands/businesses/[id]`、`DELETE /api/brands/[id]`。実装は [../lib/takes/delete.ts](../lib/takes/delete.ts) がRPCの例外をHTTPステータスへ写す
- **ロゴの削除は`delete_logo_with_presentation`**。Logo・candidate・プレゼンTake・canonical slotを1トランザクションで消す。呼び出しはブラウザrepo(`repo.deleteLogo`)で、mockupのR2削除を先に済ませる
- **複製はTake(動画・LP)だけ**。[../lib/takes/duplicate.ts](../lib/takes/duplicate.ts) が`brief`・`baked_brief`・`take_inputs`(material_id + checksum)を写し、`createTake`で**現行のproduction版**に固定する。R2オブジェクトは共有され、`take_renders`は空から始まる。**複製に無いのはMP4であって映像ではない**ので、固定済みブリーフは引き継ぐ(引き継がないと、音声まで揃ったTakeの複製が「未実行」と名乗って不要なTTS課金が走る)。複製が元Takeのtake scope素材を指すため、元を`discard`で消すと複製が素材を失う——`promote`がその場合の正解であり、`delete_take`が選択を要求する理由でもある
- Organization / Brand / Logoに複製は無い。器のコピーは中身を持たず、ロゴの複製は別途master SVGの複写を要する

## 9. RLSと所有権

- 閲覧: Brand Organizationを閲覧できる利用者、Brand共有を受けた利用者、対象Logoを閲覧できる利用者。
- 編集: Organizationのowner/admin、またはBrand/Logoに明示された編集権限。
- Runの入力URL、コスト、エラーは編集者以上に限定する。
- 公開Artifactは署名・公開ルートから配信し、R2自体は非公開。

Supabase作業では必ずproject ref `xhbdfzceyfrxsmaixkne`を照合する。DB書き込みはSQLと影響範囲をレビューし、明示承認を得てから行う。

## 10. 現在の保全データ

V2切替時にダミーデータを削除し、次の閉包だけを保全した。

- Organization: WealthPark
- Primary Brand: WealthPark (`corporate`)
- Brand: WealthPark Lab (`business`)
- Work / Take: 世界が恋する日本酒
- pinned Material: 13点
- ready MP4 Artifact: 1点

整合性確認は`npm run v2:audit`、R2の不要オブジェクト確認は`npm run v2:prune-r2`で行う。後者は既定でdry-run。
