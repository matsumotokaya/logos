# Logos data model

更新日: 2026-08-08
ステータス: **V2稼働構造の正本**

V2の設計・移行判断の履歴は [schema-v2.md](schema-v2.md)、アカウントとRLSの原則は [account-design.md](account-design.md)、成果物アーキテクチャの背景は [deliverable-architecture.md](deliverable-architecture.md) を参照する。本書はmigration 0046適用後の現在形だけを記す。

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

`brand_organizations`は任意に親Organizationを持てるが、アクセス権は親子関係から継承しない。各行の`linked_org_id`をRLSが直接評価する。

`brand_entities.brand_kind`は次の6種。

- `corporate`
- `business`
- `service`
- `product`
- `media`
- `event`

Brandの親子関係は`parent_brand_id`で表し、同じOrganization内に限定する。企業Brandは親を持たず、`is_primary_brand`は企業Brandだけが使える。対象顧客別の差分は別Brandを乱造せず`brand_variants`に置く。

ロゴ、Knowledge、Work、Take、MaterialはすべてBrandへ属する。Organizationを成果物の直接所有者にしない。

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

## 5. Templateと成果物

テンプレート定義のコード正本は [../lib/templates/catalog.ts](../lib/templates/catalog.ts)、production台帳は`template_versions`。production版のdefinition hashがコードと異なる状態では新規Takeを作らない。

現在の主なテンプレートは次の通り。

- `campaign-lp@2`
- `product-cm@2`
- `event-promo@1`
- `logo-presentation@1`

HTML/MP4はR2が正本で、ローカルファイルを配信フォールバックにしない。ブラウザ配信は署名付き同一オリジンURLを使い、動画はHTTP Rangeに対応する。

## 6. Publicationとcanonical slot

`publications`はRenderを公開面へ結び、公開終了時も履歴を保持する。`/c/<id>`や`/v/<id>`はTake/Render/Artifactを解決する。

`canonical_slots`は「このBrandまたはLogoで代表として使うTake」を一意に指す。ロゴプレゼンは`logos.id → canonical_slots(slot='logo_presentation') → Take`で解決し、編集状態は`Take.brief.presentation`に保存する。旧テーブルへのフォールバックはない。

## 7. Logoとpresentation asset

ロゴのmasterは`logos`とprimary `logo_candidates`。Lockup、colorway、生成モックアップは用途別テーブルへ分離する。Logo作成時はpresentation Takeとcanonical slotも同一RPC内で作られ、削除時もまとめて除去される。

`presentation_asset_definitions`は利用可能なassetの版と`draft / production`を管理する。ロゴごとの表示順・有効状態・パラメータは`logo-presentation` Takeの`brief.presentation.layout.mappings`、実行履歴は`logo_asset_runs`、現在の生成画像は`logo_mockups`が担う。

## 8. RLSと所有権

- 閲覧: Brand Organizationを閲覧できる利用者、Brand共有を受けた利用者、対象Logoを閲覧できる利用者。
- 編集: Organizationのowner/admin、またはBrand/Logoに明示された編集権限。
- Runの入力URL、コスト、エラーは編集者以上に限定する。
- 公開Artifactは署名・公開ルートから配信し、R2自体は非公開。

Supabase作業では必ずproject ref `xhbdfzceyfrxsmaixkne`を照合する。DB書き込みはSQLと影響範囲をレビューし、明示承認を得てから行う。

## 9. 現在の保全データ

V2切替時にダミーデータを削除し、次の閉包だけを保全した。

- Organization: WealthPark
- Primary Brand: WealthPark (`corporate`)
- Brand: WealthPark Lab (`business`)
- Work / Take: 世界が恋する日本酒
- pinned Material: 13点
- ready MP4 Artifact: 1点

整合性確認は`npm run v2:audit`、R2の不要オブジェクト確認は`npm run v2:prune-r2`で行う。後者は既定でdry-run。
