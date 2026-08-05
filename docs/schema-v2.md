# v2スキーマ概念設計(マーケティングツール生成)

最終更新: 2026-08-05
ステータス: **migration 0023〜0031 適用済み。event-promo が新構造だけで1本通った(§17-2)。画面の読み書きはまだ1行も移していない**

要件の正本は [deliverable-architecture.md](deliverable-architecture.md)。本書はその §10-2「新スキーマ概念設計」の成果物であり、**テーブル・列・不変条件・RLS・移行段の正本**である。現行(v1)の稼働構造は [data-model.md](data-model.md)、アカウント・URL・RLSの原則は [account-design.md](account-design.md) が正本のまま。切り替え完了後、本書の内容は data-model.md へ統合して本書を廃止する。

適用済みSQLの正本は常に [../supabase/migrations/](../supabase/migrations/) であり、本書のDDLは**設計の記述**である(コピー元ではなく、書くべきものの定義)。

---

## 1. 設計の前提として確定した4点(2026-08-04)

| 論点 | 決定 | 帰結 |
|---|---|---|
| Organization / Brand の実体 | **既存 `brand_organizations` / `brand_entities` を v2 の Org / Brand として継承**し、不足分を追加列で足す | ID が変わらないので `/p/[id]`・`/c/[id]`・`logos.subject_entity_id`・`brand_assets.brand_id` の参照が壊れない。並行追加は**本当に新しいエンティティに限る** |
| Brand 種別の語彙(§11-1) | **閉じた enum を拡張**: `corporate / business / service / product / media / event` | 要件 §2.3 の判定表と1対1。「Brandを増やしすぎない」判断をDB制約が支える |
| audience の置き場所(§11-1) | **1Brand内のバリアント**(`brand_variants`)。独立Brandにしない | 実DBに `brand_kind='audience'` の行は**0件**なので、畳み込みコストはゼロ |
| Work の属性(§11-2) | **薄いコレクション**(id / brand / 名前 / 状態 / 任意の期間のみ) | 目的・オファー・KPIは持たせない。継続運用は期間nullのWork1本。必要になれば列を足す |

テーブル名 `brand_entities` は **改名しない**。実体はBrandだが、読み手・書き手が多く、改名の利得はコメント1行分しかない。コード側の型名は `Brand` を使う(現行 `BrandSummary` がすでにそうなっている)。

## 2. 実DBの現在地(2026-08-04 実測)

project ref `xhbdfzceyfrxsmaixkne`。移行設計は**この実測値**を前提にする。

| テーブル | 行数 | 内訳・注意 |
|---|---|---|
| `brand_organizations` | 17 | うち11が `system_key='unassigned_logo_organization'`(ロゴ単体投入で自動生成された「名称未設定のOrganization」)。`parent_organization_id` はまだ無い |
| `brand_entities` | 53 | **legacy Organization行 16 が同居**(`brand_kind is null`、`entity_type='organization'`)。Brandは corporate 17 / business 20。`brand_kind='audience'` は**0** |
| `brand_profiles` | 14 | jsonbのキーは `palette` / `theme` / `service` / `design_tokens` / `organization` の5系統。これが BrandKnowledge の field_path の出発点 |
| `logos` | 25 | 多くが placeholder Brand(`未整理のブランドアセット`)配下。public 2件、unlisted 1件 |
| `brand_assets` | 12 | LP 11件 + `event-promo` 動画1件(`世界が恋する日本酒`)。`asset_kind='video'` はこの1件だけ |
| `brand_generation_runs` | LP生成分 | `legacy_campaign_id` / `external_job_id` 経由で `var/campaign-lab/jobs/*.json` に依存 |
| `campaigns` / `campaign_*` | **0** | 0021 で移行済み。**縮退の対象で、移すデータは無い** |
| `logo_presentations` | 0 | プレゼン編集の保存実績なし。Take化の実データ移行は不要 |

読み取れること:

- **データ量は移行の制約ではない。** 制約は「動いている導線を止めないこと」だけ(要件 §8)。冪等ポートの対象は実質 LP 11件 + 動画1件
- **`brand_entities` の legacy Organization行が最大のゴミ。** contract 段でこの16行を削除するまで、`brand_kind is null` を「Brandではない」と読み分ける分岐がコード全体に残る
- **`campaigns` 系は空**なので、縮退は「readerを外して drop」だけで済む
- placeholder Organization/Brand が11組ある。v2でも同じ導線(ロゴ1枚から始める)を保つため、この仕組みは残す

## 3. エンティティ → テーブル対応

```text
Workspace              public.organizations              継承(変更なし)
MarketOrganization     public.brand_organizations        継承 + parent_organization_id
└ Brand                public.brand_entities             継承 + brand_kind拡張
  ├ variant            public.brand_variants             新規
  ├ BrandKnowledge     public.brand_knowledge_claims     新規(append-only)
  │                    public.brand_knowledge_values     新規(確定値)
  ├ BrandMaterial      public.brand_materials            新規(scope='brand')
  ├ Work?              public.works                      新規
  │ └ WorkMaterial     public.brand_materials            同一表(scope='work')
  └ Take               public.takes                      新規
    ├ TakeMaterial     public.brand_materials            同一表(scope='take')
    ├ 入力の版固定     public.take_inputs                新規
    ├ Run              public.take_runs                  新規
    ├ Render           public.take_renders               新規
    │ └ Artifact       public.render_artifacts           新規
    └ Publication      public.publications               新規
canonicalスロット      public.canonical_slots            新規
Template版台帳         public.template_versions          新規(定義の正本はコード)
明示的な参照許可       public.brand_access_grants        新規(logo_access_grants の一般化)
```

ロゴ(`logos` / `logo_candidates` / `logo_lockups` / `logo_variants` / `logo_credits` / `logo_trademarks` / `logo_access_grants` / `logo_activities`)は**そのまま維持**する。ロゴは素材の一種だが、ブランドアセット系統の中核として特別扱いする(要件 §3.1)。素材表はロゴのバイト列を複製せず、`logo_candidate_id` で参照する。

廃止(contract段):`brand_assets` / `brand_generation_runs` / `campaigns` / `campaign_sources` / `campaign_runs` / `campaign_artifacts`、および `brand_entities` の legacy Organization行と `entity_type` / `parent_entity_id` / `organization_kind` 列。

## 4. 共通規約

- 主キーは `uuid default gen_random_uuid()`。例外は `logos.id`(nanoid・公開URLの一部)と `template_versions`(自然キー)
- すべてのテーブルで RLS 有効。`SECURITY DEFINER` 補助関数は `private` スキーマ、`set search_path = ''`、`revoke all from public` + 必要ロールにだけ `grant execute`(0012の規約)
- 管理系テーブルは `to authenticated` + `private.is_registered_user()`。**公開配信はテーブルの可視性ではなく専用ルート(署名URL)で行う**(0022の規約)
- 親への参照は、消えると成果物が孤児になるものは `on delete restrict`、純粋な子は `cascade`、記録用の人参照は `set null`
- `variant_id` を持つ表は `(brand_id, variant_id)` の複合FKで整合を強制する(`logo_variants → logo_lockups(id, candidate_id)` と同じ手)
- 状態を持つ列は `text` + `check`(既存と揃える。新しい enum 型は作らない。値の追加が migration 1本で済む)
- 各migrationの末尾に**契約チェック**(`do $$ ... raise exception`)と検証 `select` を置く(0021の規約)

## 5. Organization: ネストする純粋コンテナ

```sql
alter table public.brand_organizations
  add column parent_organization_id uuid
    references public.brand_organizations(id) on delete restrict;
```

- **循環と深さをトリガーで禁じる**(自己参照 / 祖先ループ / 深さ8超)。祖先を辿るクエリの上限を保証するため
- 祖先判定は `private.organization_is_ancestor(p_ancestor, p_descendant)`(`brand_entity_is_ancestor` と同型)
- **権限は判定時に祖先を辿らない。** `private.can_view_brand_organization` / `can_manage_brand_organization` は自行の `linked_org_id` だけを見る(2026-08-04決定、§11-6を解決)
- **代わりに作成時にコピーする。** 子Organizationを作るとき、`linked_org_id` が未指定なら親の値をトリガーで書き写す。これで「URL投入で自動生成された子Orgが、親のWorkspaceメンバーから見えない」落とし穴を防ぎつつ、**子会社を売却して親子関係を切っても保存済みの権限が黙って変わらない**。要件 §2.4「継承はOrganization構造から導出しない」と同じ思想を権限にも適用する
- 判定で祖先を辿らないので、RLSヘルパーに再帰CTEが入らない(全SELECTのコストが一定に保たれる)
- ネストが使われるのは2箇所だけ:
  1. 左ペインのツリー表示
  2. **継承元Brandの既定候補の探索**(要件 §2.4: 同Org の corporate → 祖先Org の corporate → なし)。これは候補提示であり、権限判定に使わない

## 6. Brand: 種別の拡張と variant

```sql
alter table public.brand_entities
  drop constraint brand_entities_brand_kind_check,
  add  constraint brand_entities_brand_kind_check
    check (brand_kind is null or brand_kind in
      ('corporate','business','service','product','media','event'));
```

- `audience` を許可値から外す(実データ0件)。`business` の既存15行はそのまま
- `brand_kind is null` は **legacy Organization行だけ**を意味する暫定状態。contract段で行ごと消え、列は `not null` になる
- `parent_brand_id` が**継承の正本**。Organization構造から導出しない(要件 §2.4)。既存の `enforce_brand_membership` トリガーが「Orgをまたぐ継承の禁止」を既に守っているので、種別ペアの制約だけ緩める: corporate は親を持てない / それ以外は任意のBrandを親にできる(business→corporate 限定をやめる。service が business を継承する形が普通に起きる)
- `is_primary_brand` は Org ごとに1つの corporate を指す既存の仕組みを維持

```sql
create table public.brand_variants (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_entities(id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9][a-z0-9-]{0,30}$'),
  label       text not null default '',
  sort_order  integer not null default 0 check (sort_order >= 0),
  is_default  boolean not null default false,
  created_by  uuid references public.users(user_id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand_id, key)
);
create unique index brand_variants_id_brand_uq on public.brand_variants (id, brand_id);
create unique index brand_variants_default_uq
  on public.brand_variants (brand_id) where is_default;
```

- variant は **Personal / Business / Enterprise のような訴求相手の差分**。独自ロゴ・独自配色を継続的に持つならそれは Brand であって variant ではない(要件 §2.3 の判定基準)
- variant は行を作らない状態が既定。作らなければ何も起きない(空の variant 一覧はUIに出さない)
- ロゴの差分が必要になった場合は variant ではなく `logos.parent_logo_id` の系列で表す(data-model §2.2 の既存方針)

## 7. BrandKnowledge: 主張 + 確定値

生成は**主張を足すだけ**で確定値を上書きしない(要件 §4.1)。ここが v1 の `brand_profiles`(可変1レコードの profile jsonb + provenance jsonb)を置き換える。

### 7.1 主張(append-only)

```sql
create table public.brand_knowledge_claims (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brand_entities(id) on delete cascade,
  variant_id   uuid,
  field_path   text not null check (field_path ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+){0,3}$'),
  layer        text not null check (layer in ('fact','expression')),
  value        jsonb not null,
  confidence   text not null,
  source_kind  text not null check (source_kind in
                 ('user_input','url_extraction','file_extraction',
                  'llm_structuring','llm_generation','derived','render_output')),
  source_ref   jsonb not null default '{}'::jsonb,
  observed_at  timestamptz not null default now(),
  recorded_by  uuid references public.users(user_id) on delete set null,
  run_id       uuid references public.take_runs(id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (brand_id, variant_id)
    references public.brand_variants(brand_id, id),   -- variant_id null は許容
  constraint claims_confidence_matches_layer check (
    (layer = 'fact' and confidence in ('confirmed','evidenced','inferred','unknown'))
    or (layer = 'expression' and confidence in ('suggested','adopted'))
  ),
  constraint claims_no_fiction_as_fact check (
    layer <> 'fact' or source_kind <> 'llm_generation'
  )
);
```

- **`claims_no_fiction_as_fact` が要件 §4.1「架空の内容を事実として保存しない」のDB上の実体。** 現行LPパイプラインは架空の証言・架空の取引先名・架空の実績数値を意図的に生成する([../lib/campaign/schema.ts](../lib/campaign/schema.ts))。それらは `layer='expression'`(テイク内の表現)としてしか入らず、事実フィールドへの経路が構造的に無い。アプリのうっかりミスがデータ汚染にならない
- **UPDATE / DELETE ポリシーを作らない。** `logo_activities` と同じ append-only。矛盾は「同じ field_path に異なる value の主張が複数ある」状態として**残す**(消して整合させない)
- `variant_id is null` = ブランド共通の主張
- index: `(brand_id, field_path, observed_at desc)` / `(run_id)`
- RLS: select/insert とも `private.can_manage_brand_entity(brand_id)` かつ `to authenticated`。出典URL・実行コストを含むため公開ロゴから読めてはならない(0022と同じ理由)

### 7.2 確定値

```sql
create table public.brand_knowledge_values (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brand_entities(id) on delete cascade,
  variant_id       uuid,
  field_path       text not null,
  layer            text not null check (layer in ('fact','expression')),
  value            jsonb not null,
  confidence       text not null,
  adopted_claim_id uuid references public.brand_knowledge_claims(id) on delete set null,
  decided_by       uuid references public.users(user_id) on delete set null,
  decided_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (brand_id, variant_id)
    references public.brand_variants(brand_id, id)
);
create unique index brand_knowledge_values_brand_field_uq
  on public.brand_knowledge_values (brand_id, field_path)
  where variant_id is null;
create unique index brand_knowledge_values_variant_field_uq
  on public.brand_knowledge_values (brand_id, variant_id, field_path)
  where variant_id is not null;
```

- 変わるのは**明示操作のときだけ**。書き込み経路を `lib/brand/knowledge.ts` の `adoptClaim()` 1本に限り、生成パイプラインには主張追加API(`recordClaims()`)しか渡さない(型で分離する。DB制約では「誰が呼んだか」を表せないため、経路の単一化で担保する)
- `confidence` は fact なら `confirmed | evidenced | inferred`、expression なら `adopted`。`unknown` は確定値にならない

### 7.3 field_path の語彙(初版)

実DBの `brand_profiles` にある5系統を出発点に、**事実と表現を分けて**再配置する。これが §11-3「briefSchemaの共通部分」の答えでもある(共通コアはこの語彙の射影)。

| field_path | layer | 出所(現行) |
|---|---|---|
| `identity.legal_name` / `identity.location` / `identity.founded_on` | fact | profile.organization |
| `contact.website` / `contact.inquiry_url` | fact | profile.organization / brand_entities.website |
| `offering.name` / `offering.tagline` / `offering.description` / `offering.industry` / `offering.business_type` / `offering.audience` | fact | profile.service |
| `palette.primary` / `.accent` / `.background` / `.surface` / `.text` / `palette.source` | expression | profile.palette |
| `typography.font_style` / `typography.body_font` / `typography.heading_font` | expression | profile.design_tokens |
| `tokens.button_radius` / `.section_spacing` / `.container_width` | expression | profile.design_tokens |
| `tone.theme` / `tone.direction` | expression | profile.theme + themes.ts の `direction` |
| `proof.*`(実績・証言・価格) | fact | **現行は架空生成。claimsには入れない**(テイク内の表現に留める) |

- `offering.*` を `service.*` と呼ばないのは、Brand種別が service に限らないため(product / media / event も同じ語彙を使う)
- 継承解決(親Brandの確定値 → 子が上書き)は**アプリ側1モジュール**に置く。現在 [../app/api/brands/route.ts](../app/api/brands/route.ts) の `mergeProfile` / `resolvedProfile` に実装があり、レンダラー(TS)も同じ解決を必要とするため、DB関数に移すと二重実装になる。`lib/brand/knowledge.ts` へ集約し、APIルートはそれを呼ぶだけにする
- プロジェクション(読み取り用の最新ビュー)は**導出物**であり保存しない。必要になったらキャッシュ表を足すが、その時も正本は values + claims

## 8. Template: 定義はコード、版はDBの台帳

```sql
create table public.template_versions (
  template_id          text not null,
  version              integer not null check (version > 0),
  tool_kind            text not null,
  brief_schema_version integer not null check (brief_schema_version > 0),
  renderer_revision    text not null,
  definition_hash      text not null,
  stage                text not null default 'draft' check (stage in ('draft','production')),
  spec                 jsonb not null default '{}'::jsonb,
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  primary key (template_id, version)
);
```

- **定義を書く場所はコード**([../lib/video/templates.ts](../lib/video/templates.ts) を全ツール種別へ一般化した `lib/templates/`)。DBは**版の台帳**であり、権威ある定義の複製ではない
- 台帳が必要な理由: Takeが `(template_id, version)` を参照する以上、その版が実在したことをDBで保証できないと、リファクタ後に**どこも指していないバージョンを指したTake**が生まれる。再レンダー保証の宣言(`spec.rerenderable`)も検証できない
- 同期は起動時/デプロイ時の冪等 upsert。`stage='production'` への昇格だけは運営操作(`presentation_asset_definitions.release_stage` と同じ思想)
- `spec` に入れるもの: `stages`(collect/extract/structure/render/publish の部分集合)、`publishSurfaces`、`costProfile`、`isBrandDefault`、`rerenderable`
- `presentation_asset_definitions`(`family_id` + `definition_version` + 不変 `id`)は**この規約の先行実装**であり、当面併存する。プレゼンAssetカタログをテンプレート台帳へ統合するのは、ロゴプレゼンのTake化(着手順の最後)と同時

## 9. Work と Take

```sql
create table public.works (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brand_entities(id) on delete restrict,
  name       text not null,
  status     text not null default 'active' check (status in ('active','archived')),
  starts_on  date,
  ends_on    date,
  check (starts_on is null or ends_on is null or starts_on <= ends_on),
  created_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Workは最初の1回では絶対に問わない。** 単発生成では作らず、素材を他のテイクと共有したくなった時点の昇格操作が Work を作る(要件 §4.2)。

```sql
create table public.takes (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references public.brand_entities(id) on delete restrict,
  variant_id           uuid,
  work_id              uuid references public.works(id) on delete set null,
  tool_kind            text not null check (tool_kind in
                         ('lp','video','banner','guideline','logo_presentation',
                          'site','merch','document','other')),
  template_id          text not null,
  template_version     integer not null,
  brief_schema_version integer not null,
  brief                jsonb not null default '{}'::jsonb,
  title                text not null,
  status               text not null default 'draft'
                       check (status in ('draft','ready','failed','archived')),
  created_by           uuid references public.users(user_id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (template_id, template_version)
    references public.template_versions(template_id, version) on delete restrict,
  foreign key (brand_id, variant_id)
    references public.brand_variants(brand_id, id)
);
```

- `work_id` は `on delete set null`: **施策を消してもテイクは残す**(成果物は施策より寿命が長い)
- `template_id` / `template_version` / `brief_schema_version` は**更新不可**(トリガーで拒否)。作成時に決まり以後変わらない(要件 §4.3)
- `brief` は briefSchema(zod)で書き込み時に検証する。DBは形を知らない。`EventBrief` と Service Brand Kit がこの形の2実例
- `tool_kind` はテンプレートから決まるが、IA(左ペインの束ね方)と索引のために**非正規化して持つ**。台帳の `tool_kind` と一致することをトリガーで確認する
- ロケール・アスペクト比・テーマは Take ではなく Render(要件 §4.4)

```sql
create table public.take_inputs (
  take_id     uuid not null references public.takes(id) on delete cascade,
  material_id uuid not null references public.brand_materials(id) on delete restrict,
  role        text not null,
  checksum    text not null,
  pinned_at   timestamptz not null default now(),
  primary key (take_id, material_id, role)
);
```

入力素材の**版**を固定する台帳。`on delete restrict` なので、テイクが使っている素材は消せない(要件 §4.2「唯一のコピーを失わない」の実装のひとつ)。

## 10. 素材: 1表・3スコープ・昇格は幅を広げる操作

```sql
create table public.brand_materials (
  id                      uuid primary key default gen_random_uuid(),
  scope                   text not null check (scope in ('brand','work','take')),
  brand_id                uuid not null references public.brand_entities(id) on delete restrict,
  work_id                 uuid references public.works(id) on delete cascade,
  take_id                 uuid references public.takes(id) on delete cascade,
  kind                    text not null check (kind in
                            ('logo','font','photo','keyvisual','illustration',
                             'audio','video','document','other')),
  label                   text not null default '',
  media_type              text,
  r2_key                  text,
  logo_candidate_id       uuid references public.logo_candidates(id) on delete set null,
  bytes                   bigint,
  checksum                text,
  width                   integer,
  height                  integer,
  duration_ms             integer,
  source_kind             text not null check (source_kind in
                            ('upload','url_fetch','ai_generated','derived','render_output')),
  source_url              text,
  derived_from_material_id uuid references public.brand_materials(id) on delete set null,
  origin_artifact_id      uuid references public.render_artifacts(id) on delete set null,
  provenance              jsonb not null default '{}'::jsonb,
  promoted_at             timestamptz,
  promoted_by             uuid references public.users(user_id) on delete set null,
  created_by              uuid references public.users(user_id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint materials_scope_owner check (
    (scope = 'brand' and work_id is null and take_id is null)
    or (scope = 'work' and work_id is not null and take_id is null)
    or (scope = 'take' and take_id is not null and work_id is null)
  ),
  constraint materials_has_body check (
    r2_key is not null or logo_candidate_id is not null
  )
);
```

- **`brand_id` は take スコープでも必ず入れる。** 権限判定を `can_view/manage_brand_entity(brand_id)` の1関数で済ませるため。ブランドライブラリの一覧は `scope='brand'` だけを引く
- **昇格 = 同じ行の `scope` を広げる**(`take → work → brand`)。id も `r2_key` も変わらないので、参照しているテイクが壊れない。トリガーで**縮小を拒否**し、`promoted_at` / `promoted_by` を刻む
- **ロゴのバイト列は複製しない。** `kind='logo'` の素材は `logo_candidate_id` を指すポインタ行(マスターSVGは `logo_candidates.svg` のまま)
- 素材は**不変のファイル + 出自**。フレーミング(寄り・引き)は参照する側が持つ(`EventPhoto.focus` / `zoom` が既にそうなっている)
- `works` / `takes` の DELETE ポリシーは作らない。削除はRPC経由に限り、その中で「唯一のコピーになる素材」を退避または昇格提案する(要件 §4.2)

## 11. Run / Render / Artifact / Publication

```sql
create table public.take_runs (
  id              uuid primary key default gen_random_uuid(),
  take_id         uuid not null references public.takes(id) on delete cascade,
  stage           text not null check (stage in
                    ('collect','extract','structure','render','publish')),
  status          text not null default 'queued' check (status in
                    ('queued','running','succeeded','failed','canceled')),
  input           jsonb not null default '{}'::jsonb,
  steps           jsonb not null default '[]'::jsonb,
  usage           jsonb not null default '{}'::jsonb,
  external_job_id uuid unique,
  error_message   text,
  triggered_by    uuid references public.users(user_id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.take_renders (
  id                 uuid primary key default gen_random_uuid(),
  take_id            uuid not null references public.takes(id) on delete cascade,
  locale             text not null default 'ja',
  aspect_ratio       text not null default '16:9',
  theme              text,
  format             text not null check (format in ('mp4','html','png','pdf','svg','wav')),
  params             jsonb not null default '{}'::jsonb,
  status             text not null default 'pending' check (status in
                       ('pending','running','ready','failed','stale')),
  latest_artifact_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (take_id, locale, aspect_ratio, theme, format)
);

create table public.render_artifacts (
  id          uuid primary key default gen_random_uuid(),
  render_id   uuid not null references public.take_renders(id) on delete cascade,
  run_id      uuid references public.take_runs(id) on delete set null,
  r2_key      text not null,
  media_type  text not null,
  bytes       bigint,
  checksum    text,
  width       integer,
  height      integer,
  duration_ms integer,
  status      text not null default 'ready' check (status in ('ready','failed','archived')),
  created_at  timestamptz not null default now()
);
```

- **`theme` は Render 側**。LPのテーマ7種は Template ではなく1テンプレート内のスタイル選択で、後から変更して再レンダーできる(要件 §4.3)
- 各段は独立して再実行でき、再実行は前の成果を壊さない。`take_renders.status='stale'` は「新しい版が出たが黙って再レンダーしていない」状態を表す(要件 §4.3の「明示同意」)
- **Artifact は自動的に素材一覧へ入らない。** テイク内では `render_artifacts` を直接参照でき、素材として一覧に載るのは `brand_materials`(`origin_artifact_id` を持つ行)を明示昇格で作ったときだけ
- **同じバイト列を二重に持たない。** 昇格した素材は Artifact と同じ `r2_key` を指す。したがって**R2オブジェクトの削除は参照が0になったときだけ**行う(`render_artifacts` と `brand_materials` の両方を数える)。この参照カウントは `private.r2_deletion_queue` へ入れる前の判定として実装する
- R2キー規約: `brands/<brandId>/takes/<takeId>/renders/<renderId>/<name>`。既存の `brands/<brandId>/takes/<takeId>/output/<name>`([../lib/video/storage.ts](../lib/video/storage.ts))はそのまま有効(キーはDBに保存された値が正本であり、移行でオブジェクトを動かさない)

```sql
create table public.publications (
  id                    uuid primary key default gen_random_uuid(),
  render_id             uuid not null references public.take_renders(id) on delete restrict,
  surface               text not null check (surface in
                          ('canonical_url','vanity_url','embed','social','custom_domain')),
  url_path              text,
  status                text not null default 'draft' check (status in
                          ('draft','live','rolled_back','retired')),
  supersedes_id         uuid references public.publications(id) on delete set null,
  published_at          timestamptz,
  published_by          uuid references public.users(user_id) on delete set null,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index publications_live_path_uq
  on public.publications (surface, url_path) where status = 'live';
```

- **公開は Take の boolean ではない**(要件 §4.5)。対象は Render(実際に公開されるのはロケール・比率が確定した出力)
- Template が宣言していない面へは公開できない。`spec.publishSurfaces` との照合はアプリ側で行い、`publications` 挿入時に検証する
- 現行の `VideoAssetMetadata.published`(押しても何も起きないフラグ)はこの表に置き換わる

## 12. canonical スロットと URL 非破壊

```sql
create table public.canonical_slots (
  id         uuid primary key default gen_random_uuid(),
  slot       text not null check (slot in
               ('logo_presentation','brand_guide','default_product_video')),
  brand_id   uuid references public.brand_entities(id) on delete cascade,
  logo_id    text references public.logos(id) on delete cascade,
  take_id    uuid not null references public.takes(id) on delete restrict,
  updated_by uuid references public.users(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(brand_id, logo_id) = 1),
  check ((slot = 'logo_presentation' and logo_id is not null)
      or (slot <> 'logo_presentation' and brand_id is not null))
);
create unique index canonical_slots_brand_uq
  on public.canonical_slots (brand_id, slot) where brand_id is not null;
create unique index canonical_slots_logo_uq
  on public.canonical_slots (logo_id, slot) where logo_id is not null;
```

- canonical は**レジストリが宣言する名前付きスロットに限る**。LP・バナーにはスロットを置かない(どれが主役かは `publications` が答える)(要件 §4.6)
- **`/p/[id]` は壊さない。** 解決順は `logos.id` → `canonical_slots(logo_id, 'logo_presentation')` → Take → Render。スロット行が無い間は現行の `logo_presentations` にフォールバックする。実データは0行なので、この切り替えで失うものは無い
- `/c/[id]` と `/[handle]/[slug]` も同じ考え方(`publications.url_path` に既存パスをそのまま登録し、既存URLを live な Publication として表現する)
- **要件 §8 のとおり、ロゴプレゼンのTake化は着手順の最後**。`logo_presentations` の主キー分離・canonical解決・バニティ解決・URL非破壊の4点が動いてから触る

## 13. 明示的な参照許可(共同ブランド・代理店)

```sql
create table public.brand_access_grants (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brand_entities(id) on delete cascade,
  grantee_user_id uuid references public.users(user_id) on delete cascade,
  grantee_org_id  uuid references public.organizations(org_id) on delete cascade,
  role            public.logo_access_role not null default 'viewer',
  granted_by      uuid references public.users(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(grantee_user_id, grantee_org_id) = 1)
);
```

- `logo_access_grants` / `private.has_logo_grant` の一般化(0015と同型)。**既存 enum `logo_access_role`(manager / editor / viewer)を再利用**し、enumを増やさない
- 各ロールが何をできるかは §14.1 の梯子で定義する。**grantでは公開・削除・再共有はできない**(所有主体側のowner/adminに限る)
- **資本関係のない共同ブランドは継承ではなくこの許可で表す**(要件 §2.4)。`parent_brand_id` を「見せたいから」設定させない
- **Brandを管理できることは、そのBrandのロゴを編集できることを意味しない。** `logos.subject_entity_id` は「何を表すロゴか」であって所有ではない(デザイナーが所有し、企業がBrandを管理する形が成立する)。ロゴの編集権は従来どおり `logos.owner_*` と `logo_access_grants` だけで決まる。Take からロゴを**使う**ことはできる

## 14. 権限とRLS

### 14.1 4段の梯子(2026-08-04決定)

ロールを列挙する代わりに、**4つの述語**で全テーブルを説明する。新規ヘルパーはこの4つと補助関数だけ。

| 述語 | 満たす人 | 何ができるか |
|---|---|---|
| `can_view_brand_entity` | owner / admin / editor / purchaser / viewer、grant の manager / editor / viewer、作成者 | **成果物の閲覧**(Take / Render / Artifact / 素材 / Knowledge確定値) |
| `can_edit_brand_output` | 上記のうち owner / admin / editor、grant の manager / editor | Take・brief・Render の作成と編集、素材の投入、生成の起動 |
| `can_edit_brand_core` | owner / admin / editor、grant の **manager のみ** | Brand正本(名前・種別・継承元)、**Knowledge確定値の採用**、**素材のブランド昇格** |
| `can_admin_brand` | owner / admin、個人所有なら作成者。**grantは含まない** | **Publication(公開)**、Take / Work の削除、共有の付与と解除 |

決定の根拠:

- **公開は owner / admin のみ。** 現行のロゴ `visibility` 変更と同じ線引きに揃える。外向きで不可逆な操作で「作る」と「出す」を分ける
- **成果物の閲覧は viewer / purchaser にも開く。** 現行(0022)は `brand_assets` ごと editor 以上に閉じているため、viewer は自分のブランドの動画一覧すら見えない。閲覧専用ロールの存在意義がそこにあるので開く。ただし `take_runs`(出典URL・LLMコスト・エラー)は閉じたまま
- **Knowledge確定値の採用と素材の昇格は editor 以上。** admin限定にすると「確認待ちの仮情報」が永遠に溜まり、ブランド素材が手作業の重複アップロードで埋まる。採用は `decided_by` / `decided_at` / `adopted_claim_id` に記録され、主張(claims)は消えないので後から辿れる
- **削除は owner / admin、かつ live な Publication があれば拒否。** editor はアーカイブ(`status='archived'`)までできる。削除は素材の唯一のコピーを失い得る不可逆操作
- **運営(platform_admin / support)にRLSの抜け道を作らない。** Labsゲートは「自分のブランドで生成できる」権限であって他人のデータを読む権限ではない。サポートが必要なときは利用者から `brand_access_grants` で招待してもらう。「運営でも覗き見できない」は法人利用で説明しやすい強い特性

### 14.2 テーブル別

| テーブル | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| `brand_organizations` | `can_view_brand_organization` | `can_manage_brand_organization` | 同左 |
| `brand_entities` | `can_view_brand_entity` | `can_edit_brand_core` | `can_admin_brand` |
| `brand_variants` | `can_view_brand_entity` | `can_edit_brand_core` | 同左 |
| `brand_knowledge_claims` | `can_view_brand_entity` | **INSERT のみ**(`can_edit_brand_output`) | **ポリシーなし** |
| `brand_knowledge_values` | `can_view_brand_entity` | `can_edit_brand_core` | 同左 |
| `brand_materials` | `can_view_brand_entity` | `can_edit_brand_output`(scope拡大は `can_edit_brand_core`) | `can_edit_brand_core` |
| `works` / `takes` | `can_view_brand_entity` | `can_edit_brand_output` | **ポリシーなし**(RPC経由・§14.3) |
| `take_renders` / `render_artifacts` | `can_view_brand_entity` | `can_edit_brand_output` | `can_edit_brand_output` |
| `take_runs` | **`can_edit_brand_output`** | 同左 | 同左 |
| `publications` | `can_view_brand_entity` | **`can_admin_brand`** | 同左 |
| `canonical_slots` | `can_view_brand_entity` / ロゴのview権限 | `can_edit_brand_core` / ロゴのadmin権限 | 同左 |
| `template_versions` | authenticated 全員(定義カタログ) | service_role のみ | なし |
| `brand_access_grants` | `can_admin_brand` または被付与者 | `can_admin_brand` | 同左 |

- v2の全テーブルは `to authenticated` + `private.is_registered_user()`。**匿名セッションには1行も見せない**(§14.4)
- 新規ヘルパー: `private.has_brand_grant(uuid, logo_access_role[], org_role[])` / `can_edit_brand_output(uuid)` / `can_edit_brand_core(uuid)` / `can_admin_brand(uuid)` / `take_brand_id(uuid)` / `render_brand_id(uuid)` / `organization_is_ancestor(uuid, uuid)`

### 14.3 削除はRPC経由

`takes` / `works` に DELETE ポリシーを作らない。`public.delete_take(uuid)` / `public.delete_work(uuid)` が1トランザクションで:

1. `can_admin_brand` を確認する
2. **live な Publication があれば拒否する**(先に非公開にする必要がある)
3. 唯一のコピーになる素材を退避(work/brandへ昇格)または削除対象として提示する
4. R2キーを参照カウントし、0になるものだけ `private.r2_deletion_queue` へ入れる

理由: この4つを別々のクエリでやると、途中で失敗したときに「行は消えたがR2に残る」「素材だけ残って親が無い」が起きる。0013 の退会RPCと同じ構造にする。

### 14.4 公開面はRLSで開けない

- **v2の新テーブルは anon に一切開かない。** 公開判定の正本は `publications.status='live'` だけで、RLSに二重化しない(公開を止めたときに直す場所が2つになるのを避ける)
- 公開ページはサーバー側で解決して描画する。LP・動画・モックアップはすでにこの形([../lib/labs-output-sign.ts](../lib/labs-output-sign.ts) / [../lib/mockup-sign.ts](../lib/mockup-sign.ts))
- 現行の `/p/[id]` はクライアントが匿名セッションで `logos` を直読みしている(RLSの `unlisted`/`public` 経路)。**これは壊さず維持**し、ロゴプレゼンのTake化(着手順の最後)でサーバー解決へ移す
- `take_runs` は出典URL・コスト・エラーを含むため、閲覧ロールにも見せない(0022の判断を踏襲)

### 14.5 生成の実行者は当面Labsゲートのまま

コストの発生する操作(`take_runs` の起動)は、現行どおり `platform_admin` / `labs_member` だけが実行できる([../lib/labs-access.ts](../lib/labs-access.ts) の `guardLabsRequest`)。SVGロゴ→プレゼンは全登録ユーザーのまま。

- **課金は当面設計しない(フリー)。** ただし `take_runs.usage` へのコスト記録は最初から行う。将来クレジット制にする場合、残高チェックを差し込む場所は生成起動の1箇所だけで済む
- DBのRLS上は `can_edit_brand_output` があれば書けるので、ゲートはアプリ層の1関数に集約する(RLSに運営ロールを持ち込まない §14.1 の帰結)

## 15. 退会・削除への追随(必須)

`0013_account_deletion.sql` の `account_deletion_preview` / `delete_user_account` は現在 `logo_mockups.image_path` と `logo_asset_runs.output_path` の2経路しかR2キーを集めていない。v2で**必ず**足すもの:

- `brand_materials.r2_key`(`scope` 問わず、対象Brandが削除対象のとき)
- `render_artifacts.r2_key`
- **参照カウント**: 同じ `r2_key` を指す行が他に残っていれば削除キューへ入れない(§11の実体共有の帰結)
- `takes` / `works` / `brand_materials` は `brand_id` が `restrict` なので、Brand削除の前に順序立てて消す必要がある。削除RPCに順序を明記する

この追随を忘れると、退会してもR2に成果物が残る(=無症状の個人データ残留)。migration の契約チェックに「新テーブルのR2キー列がすべて削除プレビューに現れる」ことを入れられないため、**チェックリスト項目として §17 に置く**。

## 16. migration 計画

各段は**既存を壊さない追加のみ**。番号は連番の続き。

**権限の梯子(§14.1)を先に作る。** 後続の全テーブルのポリシーがそれを参照するため。

| # | 内容 | 依存 | 検証 |
|---|---|---|---|
| 0023 | Org ネスト(`parent_organization_id` + 循環/深さトリガー + `linked_org_id` の作成時コピー + 祖先関数)、`brand_kind` 拡張、`brand_variants` | — | 循環INSERTが失敗する / 既存50行が制約を通る |
| 0024 | `brand_access_grants` + 4段の梯子(`has_brand_grant` / `can_edit_brand_output` / `can_edit_brand_core` / `can_admin_brand`)+ `can_view_brand_entity` へのgrant追加 | 0023 | 付与前は他人が読めない / grantでadminにならない |
| 0025 | `template_versions`(`(template_id, version, tool_kind)` の一意索引つき) | — | production 昇格前は `published_at is null` |
| 0026 | `works`、`takes`(+ 版の不変トリガー) | 0024, 0025 | template版を持たないTakeを作れない / tool_kind不一致が失敗する |
| 0027 | `take_runs`、`take_renders`、`render_artifacts` | 0026 | 同一 (take, locale, ratio, theme, format) が2行にならない |
| 0028 | `brand_materials`(3スコープ + 昇格トリガー)、`take_inputs` | 0026, 0027 | scope縮小が失敗する / 実体なし行が作れない |
| 0029 | `brand_knowledge_claims` / `_values` | 0027(run_id) | `layer='fact'` + `source_kind='llm_generation'` が失敗する |
| 0030 | `publications`、`canonical_slots` | 0026 | live な同一パスが2行にならない / 公開はadminのみ |
| 0031 | `delete_take` / `delete_work` RPC(§14.3)+ 退会RPC拡張(§15) | 0028, 0030 | live公開中は削除できない / 新テーブルのキーがプレビューに出る |
| 0032 | **ポート1: event-promo 動画1件**を `takes` + `take_renders` + `render_artifacts` へ複製(冪等) | 上記全部 | 件数1 / R2キー一致 |
| 0033 | **ポート2: LP 11件**を `takes`(template=`campaign-lp`)へ複製。`brand_profiles` 14行を claims + values へ複製(`inferred` として) | 0032 | 件数・`/c/<id>` パス一致 / values が profile のキーを網羅 |
| 0040+ | **contract**: legacy Organization行(16)削除、`entity_type` / `parent_entity_id` / `organization_kind` 列と旧トリガー削除、`brand_kind` を not null 化、`campaigns` / `campaign_*` drop、`brand_assets` / `brand_generation_runs` 縮退 | 読み取り切替の完了後 | `brand_kind is null` が0行 / 旧テーブル参照コードが無い |

0032/0033 はテンプレートID(コード側)が決まってから書く。**0023〜0031 は追加のみで、既存の読み書き経路に一切触らない**ため、適用してもプロダクトの挙動は変わらない。

0032/0033 は**冪等**(再実行可能)にし、`provenance`/`metadata` に `migrated_from` を刻む(0021の規約)。

## 17. 着手順(要件 §10 の具体化)

1. ~~**0023〜0031 を書いて適用**~~ **完了(2026-08-05)**。既存導線は無傷
2. ~~**event-promo を1本、新構造だけで通す**~~ **完了(2026-08-05)**。下記の実測を参照。publication だけは意図的に作っていない(配信ルートが無い状態で `live` 行を作ると「公開したのに開けない」ため)
3. **BrandKnowledge の実体化**: Brand Kit生成を claims 追加へ。`var/campaign-lab/jobs/*.json` 依存の解消はここで直る
4. **LP を通し、Work内で動画と素材を共有できるかを確認**(要件 §9-4 = §4.2 の機能判定)
5. **ポート(0032/0033) → 照合 → 読み取り切替**
6. **退会RPCの追随を確認**(§15。チェックリスト: `brand_materials.r2_key` / `render_artifacts.r2_key` / 参照カウント / 削除順序)
7. **ロゴプレゼンのTake化**(canonicalスロットが動いてから。最後)

### 17.1 event-promo 1本通しの実測(2026-08-05)

`npm run templates:sync` → `npm run takes:event`([../scripts/run-event-take.ts](../scripts/run-event-take.ts))。ハーネスは**既存v1アセットの実briefを読む**ので、合成データでは分からない「スキーマが手持ちのデータと合っているか」も同時に確かめている。

| 段 | 結果 |
|---|---|
| 台帳 | `event-promo@1` / `product-cm@1` / `campaign-lp@1` の3行。コード側カタログのハッシュ付き |
| brief | 実データ(`brand_assets.metadata.brief`)が `EventBriefSchema` を通過。**未充足は `schedule.venue` の1件だけ**で、これは設計上「画面から消える null」 |
| Take | `event-promo@1` / brief schema v1 に版を固定して作成。既定Renderを同時に作成 |
| Render | `ja / 16:9 / sumi / mp4`、`status=ready`、`latest_artifact_id` がArtifactを指す |
| Artifact | 9,308,518 bytes、R2キーは `brands/<brandId>/takes/<takeId>/renders/<renderId>/video-<ts>.mp4` |
| 読み戻し | R2から `HeadObject` でサイズ一致を確認 |
| 同一性 | **sha256 が v1レンダー(`var/event-lab/sake-2026.mp4`)と完全一致**(`e7bb93dc…`)。v2経路が同じ出力を作っている |
| 副作用 | v1の `brand_assets` 行は無傷。`publications` 0件、`brand_materials` 0件 |

**分かった穴**: 素材(`public/event/sake-2026/`)はまだ `staticFile()` 参照のままで `brand_materials` に1行も無い。つまり**3段スコープの素材はまだ1度も使われていない**。§9-4(LP + Work共有の検証)は、この素材の移行と同時にやる必要がある。

## 18. この設計で残る未決定

要件 §11 のうち、本書で潰したのは 1(Brand種別・audience)・2(Work境界)・3(briefSchema共通部分 = §7.3の語彙)・**4(課金)**・**6(ネストと権限)**。残るもの:

- **§11-4 課金**: **当面フリーで運用する**と決定(2026-08-04)。クレジット制は将来の検討事項で、今回は設計しない。コスト記録(`take_runs.usage`)と差し込み地点の一元化(§14.5)だけ用意する
- **§11-7 旧README残タスクとの合流順**: raster画像ロゴのプレゼン / 個人ハンドル / ロゴ単位共有UI
- **placeholder Organization/Brand の整理**: 実DBに11組ある「名称未設定のOrganization → 未整理のブランドアセット」を、v2で利用者にどう畳ませるか(仕組みは残すが、UIの導線は未設計)
- **`presentation_asset_definitions` と `template_versions` の統合時期**: 併存で始め、ロゴプレゼンのTake化と同時に寄せる(§8)
