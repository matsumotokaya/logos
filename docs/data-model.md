# ロゴデータモデルとコンテンツ構造

最終更新: 2026-07-18
ステータス: **主要スキーマ・正本編集・プレゼン編集を実装済み。候補比較UIと汎用CDNは未実装**
前提: アカウント・権限・URL設計は [account-design.md](account-design.md) を正本とする。本書はその上に載る**ロゴそのもののデータ設計**を定める。

## 位置づけ: 権威ある正本(canonical record)

このサービスは単なるプレゼン生成ではなく、**本格的なロゴ資産管理ツール**を目指す。「ここに登録されている情報がそのロゴの正本」と言える状態を作るため、事実情報(マスターデータ・制作クレジット・商標情報・作業履歴)をすべて構造化して登録可能にする。

---

## 1. ロゴデータの3層分離

1つの「ロゴ」は性質の違う3種類のデータを持つ。編集する場所も編集する人の意図も違うため、スキーマ上も分離する。

| 層 | 中身 | 性質 | 編集する場所 |
|---|---|---|---|
| **A. 正式情報(正本)** | マスターファイル(候補A/B/C)、主体entity、正式名称、ロゴ形式、役割、親子関係、バリエーション、制作クレジット、商標情報、公開範囲 | 正誤のある「事実」。CDN配信と正本性の源泉 | **アセット詳細ページ** |
| **B. プレゼンテーション** | ストーリー、キャッチコピー、シーンごとの文言 | 語り・表現。**ブログ的コンテンツ** | **プレゼンページの編集モード** |
| **C. 発見メタデータ** | タグ、ブックマーク | 探す・集める体験のための情報 | タグ=アセット詳細ページ / ブックマーク=閲覧者が各自 |

- アップロード直後は A に仮の名前(例: "Black logo" — ファイル名由来)だけが入った状態。投稿者はまずプレゼン(B)を眺め、気に入ったら B を編集し、正式情報は A で整える
- プレゼン(B)を消しても・書き換えても、正本(A)は影響を受けない。逆も同じ
- ブックマークのスキーマとRLSは登録ユーザー向けに用意済み。閲覧・一覧UIは未実装

## 2. ロゴの構造化

### 2.1 上書き更新と候補(A/B/C)

ロゴは**同じロゴとして頻繁に上書き更新される**。バージョン履歴は保存しない。一方で、複数案を並置して比較したいニーズがある。これを「**候補(candidate)**」で表現する:

```
logo(アイデンティティ: 名前・商標・クレジット・プレゼンは1つ)
 └── candidates: A / B / C …(それぞれがマスターSVGを持つ。1つが primary)
```

- アップロード時に候補が1つ(primary)自動作成される。**上書き更新 = primary候補のファイル置換**(行は増えない、履歴も残さない)
- 比較したいときだけ候補B・Cを追加。プレゼンページに**タブUI**が現れ、切り替えて閲覧・比較できる
- 名前・商標・クレジット・プレゼン(層B)はロゴ本体に1つ。候補はあくまで「同じロゴの案違い」
- 単色派生(variants)と生成モックアップ(mockups)は候補ごとに持つ(デザインが違えば派生も違うため)
- **ファイル置換時は該当候補の derived variants を再生成し、生成モックアップのキャッシュを無効化**する
- 採用が決まったら候補を primary に切り替え、他を削除(または残して比較記録に)

現行UIはアップロード時のprimary候補作成と、そのprimaryファイルの差し替えまで対応する。候補B/Cの追加、primary切替、比較タブは設計済みだが未実装。

### 2.2 ロゴ間の関係(コーポレート / ブランド / サービス / 子会社)

「シリーズもので一部パーツだけ違う」「グループ企業のロゴ群」を構造化するため、ロゴは**自己参照ツリー**を組める:

```
ACME Holdings(corporate)
 ├── ACME(brand)
 │    ├── ACME Cloud(service)     ← シリーズ: パーツ違いの兄弟
 │    └── ACME Analytics(service) ←
 └── ACME Logistics(subsidiary)
```

- `logos.parent_logo_id`(自己FK)+ `role` で表現。role の語彙を拡張: `brand / corporate / service / subsidiary / other`
- シリーズ(一部パーツ違いの一群)= 同じ親を持つ兄弟として表現。専用の関係タイプが必要になったら関係テーブルを後付け(未決定事項)
- 管理画面のロゴ一覧はこのツリーで構造化表示できる

## 3. 制作者・更新者・作業履歴

投稿者=制作者とは限らない(制作社に発注したロゴを担当者がアップする等)。また「この制作社にコンタクトしたい」ニーズがあるため、クレジットは**サービス外の人・会社も登録できる**独立テーブルにする。

- **logo_credits**: 制作者情報。role(designer / studio / art_director …)+ 名前 + 連絡先。サービス内ユーザーなら user_id で紐づけ(Behance的コンタクトの宛先候補)。現行アップロードでは自動登録せず、アセット詳細で正しい制作者を入力する
- **logo_activities**: 作業履歴(append-only)。作成・ファイル更新・情報編集・公開範囲変更・候補追加・移管などを「誰が・いつ・何を」で記録。「制作者と更新者がわかる」の実体。UI上は「最終更新: ○○さん」+履歴一覧
- `logos.created_by`(投稿者・不変)は account-design.md の設計のまま。表示用に `updated_by` を持つ

## 4. 商標情報(オプション)

正本性の柱。1つのロゴに複数の登録(国・区分ごと)がありうるため 1:N。

- ステータス: 登録済み / 出願中 / 未登録
- 商標タイプ: 文字商標 / 図形商標 / 結合商標 / 立体 など
- 登録番号・出願先(JP / US / EU / WIPO …)・**区分(ニース国際分類 1〜45)**・指定商品・役務(テキスト)・登録日・存続期間満了日
- すべてオプション入力。入力されているほど「正本」としての信頼度が上がる(将来: 公開プレゼンに ® 表記や商標情報セクションを自動表示)

## 5. 編集サーフェス(どこで何を編集するか)

| 画面 | モード | 編集できるもの | 権限 |
|---|---|---|---|
| `/p/[id]` プレゼンページ | 閲覧モード(デフォルト) | —(候補があればタブで比較閲覧) | visibility に従う |
| `/p/[id]` プレゼンページ | **編集モード**(編集権限者にトグル表示) | キャッチコピー、ストーリー、シーン文言、採用assetと順序(層B) | 所有者、組織editor以上、共有`manager`/`editor` |
| `/assets/[id]` アセット詳細ページ | — | 正式名称、主体entity、ロゴ形式、役割、親子関係、primaryファイル置換、lockup / colorway、制作クレジット、商標情報、タグ(層A・C) | 所有者、組織editor以上、共有`manager`。公開範囲・移管・削除・再共有は所有主体側admin以上 |

プレゼン編集は「その場で書き換えるブログ」体験にする(別画面のフォームに飛ばさない)。

## 6. スキーマ構造

この節のSQLは構造を説明するための要約であり、適用スキーマの正本は [../supabase/migrations/](../supabase/migrations/) とする。

### 6.1 エンティティ図

```
presentation_asset_definitions(Labsにある全asset。draft / productionと不変versionを持つ)
public.logos(アイデンティティ)── parent_logo_id で自己参照ツリー
  ├── logo_candidates(A/B/C案。1つが primary。マスターSVGはここ)
  │     ├── logo_variants(mono_black 等の派生・追加バリエーション)
  │     ├── logo_asset_runs(asset定義versionごとの実行状態・履歴)
  │     └── logo_mockups(成功した現在成果物の索引。定義・runを参照)
  ├── logo_presentations(層B: キャッチコピー・ストーリー)
  ├── logo_credits(制作クレジット)
  ├── logo_trademarks(商標情報)
  ├── logo_activities(作業履歴)
  ├── logo_access_grants(所有権を移さない外部ユーザー/組織への共有アクセス)
  ├── logo_access_invites(未登録ユーザーへの期限付きメール共有)
  ├── logo_tags ── tags(層C)
  └── bookmarks(層C)
```

### 6.2 logos

[account-design.md §7](account-design.md) の `logos` から **`svg` / `analysis` を logo_candidates へ移動**し、以下を追加:

```sql
alter table public.logos
  add column logo_type      text,  -- 'symbol' | 'logotype' | 'combination' | 'emblem' など
  add column parent_logo_id text references public.logos(id) on delete set null,
  add column updated_by     uuid references public.users(user_id);
-- role の語彙: 'brand' | 'corporate' | 'service' | 'subsidiary' | 'other'
```

### 6.3 logo_candidates

```sql
create table public.logo_candidates (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  label      text not null default 'A',        -- 'A' | 'B' | 'C' | 任意名
  is_primary boolean not null default false,
  svg        text not null,                    -- マスターSVG。現行はDBに直持ち
  analysis   jsonb,                            -- 色・パス解析結果(LogoData相当)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- primary はロゴごとに必ず1つ
create unique index logo_candidates_primary_uq
  on public.logo_candidates (logo_id) where is_primary;
```

### 6.4 logo_variants / logo_mockups — 候補配下に変更

ここで1つ見直しが必要になった。`logo_mockups` は「ロゴごとの生成結果キャッシュ」には向いているが、
**どの mockup が Workflow / Generative / Motion 由来で、どのプレゼン section に採用されているか**
という「定義」までは持てない。今後の正しいプロセスは:

1. ラボで mockup を作る
2. その mockup 定義に `allowed_placements` と `default_mappings` を与える
3. プレゼン本編は「global asset catalog + per-logo layout override」を解決して表示する
4. `logo_mockups` は必要な定義について、ロゴ候補ごとの生成結果だけを持つ

つまり **definition catalog と asset cache を分ける** 必要がある。

#### 6.4.1 presentation_asset_definitions — Labsを正本とする全assetカタログ

**Labsにあるものとpresentation assetは別集合ではない。** すべて同じ定義カタログに入り、提供側が決める成熟度で表示先を分ける。

- `draft`: Labには表示する。未完成・検証中であり、利用者向けプレゼン編集UIの選択肢には出さない
- `production`: Labにも表示し、プレゼン編集UIの選択肢にも出す

この成熟度は、利用者が決める表示オン/オフとは別物。productionになったassetについて、利用者はロゴごと・placementごとに `logo_presentations.layout.mappings[].enabled / order / params` を変更する。

```sql
create table public.presentation_asset_definitions (
  id                   text primary key,           -- versionを特定する不変ID
  family_id            text not null,              -- versionを束ねる安定キー
  definition_version   integer not null default 1,
  release_stage        text not null default 'draft', -- 'draft' | 'production'
  asset_kind           text not null,             -- 'motion' | 'mockup' | 'generated'
  source_lab           text not null,             -- 'workflow' | 'generative' | 'motion'
  renderer_kind        text not null,             -- 'builtin' | 'template' | 'generated' | ...
  title                text not null,
  note                 text,
  allowed_placements   jsonb not null default '[]'::jsonb,
  default_mappings     jsonb not null default '[]'::jsonb,
  config               jsonb not null default '{}'::jsonb,
  released_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (family_id, definition_version)
);
```

- ここがLabの全成果物と、そのうちどれを本編候補に出せるかの正本
- `release_stage` は運営・制作者側のリリース判定。presentation resolverは必ず `production` だけを受け付け、draft IDがlayoutに残っていても表示しない
- `id` は定義versionを特定する。新しい版は同じ `family_id` と増加した `definition_version` を持つ別行にし、既存プレゼンが暗黙に新しい挙動へ変わるのを防ぐ
- `allowed_placements` が「productionになった場合にどのプレゼン配置へ差し込めるか」、`default_mappings` が「初期状態ではどこに何番で有効にするか」を表す。draftも昇格前にplacement互換性を検証できる
- `config.parameters` はassetが提供する設定項目と既定値を持つ。黒/白、素材、比率など利用者が選んだ値はlayout mappingの `params` に保存する
- 現在は一部の定義をコード/`template.json`から供給している。DBカタログとの同期経路は未実装
- Workflow Lab の file template は `template.json` の `presentation.allowedPlacements` / `presentation.defaultMappings` を正本にし、旧 `presentationScene` / `presentationAdopted` / `presentationOrder` は後方互換フィールドとして残す
- 現行プレゼンにハードコードされていた `Social` / `Badge` / `T-shirt` も、この定義カタログ上では通常の asset と同列に扱う

ネオンは新しい「expression」テーブルには分けず、`asset_kind='mockup' / renderer_kind='runtime-blender' / release_stage='draft'` のasset定義とする。つまりデータ上は将来のpresentation assetそのものだが、productionへ昇格するまでは利用者の選択肢に入らない。

#### 6.4.2 logo_mockups — 役割の見直し

```sql
alter table public.logo_mockups
  add column mockup_definition_id text references public.presentation_asset_definitions(id);
```

- `slot` は現状 `"mug" / "tote" / "cap"` のような簡易キーだが、将来は `mockup_definition_id` を正本にして、`slot` は後方互換用または廃止対象と考える
- これで「この画像はどの mockup 定義の生成結果か」を候補ごとに辿れる
- 決定論的な Workflow template は毎回再合成可能なので必ずしも `logo_mockups` に保存しない。一方、**有料生成(APIコスト発生)** の結果は引き続きここへキャッシュする

```sql
create table public.logo_variants (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.logo_candidates(id) on delete cascade,
  kind         text not null,                  -- 'mono_black' | 'mono_white' | 'symbol' | 'horizontal' | ...
  source       text not null default 'derived',-- 'derived'(自動) | 'uploaded'(投稿者が追加)
  svg          text not null,
  created_at   timestamptz not null default now(),
  unique (candidate_id, kind)
);

create table public.logo_mockups (
  candidate_id uuid not null references public.logo_candidates(id) on delete cascade,
  slot         text not null,                  -- "mug" / "tote" / "cap" ...
  mockup_definition_id text references public.presentation_asset_definitions(id),
  asset_run_id uuid references public.logo_asset_runs(id),
  image_path   text not null,
  params       jsonb not null default '{}',    -- この成果物に解決済みの色・素材等
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (candidate_id, slot)
);
```

#### 6.4.3 logo_asset_runs — candidate × asset versionの処理状態

`logo_mockups` の行の有無だけでは、未処理・待機中・実行中・失敗・再実行を区別できない。実行プロセスを独立エンティティとして記録する。

```sql
create table public.logo_asset_runs (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references public.logo_candidates(id) on delete cascade,
  asset_definition_id text not null references public.presentation_asset_definitions(id),
  status              text not null default 'queued',
  params              jsonb not null default '{}',
  output_path         text,
  error_message       text,
  triggered_by        uuid references public.users(user_id),
  queued_at           timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
```

- 未実行: 該当candidate × definitionのrunがない
- 処理中: 最新runが `queued / running`
- 処理済み: 最新runが `succeeded`。成功時にR2へ保存し、`logo_mockups`を現在成果物としてupsertする
- 失敗: 最新runが `failed`。過去の成功成果物は消さず、再実行可能
- versionが変われば別definition IDなので、新版は同じロゴでも未処理から始まる

#### 生成画像の保存

**`logo_mockups` はシーン10で配線済み**。現行の生成画像の保存先は次のとおり:

| 生成物 | 現状の保存先 | キー | アカウント/ロゴ行との紐付け |
|---|---|---|---|
| シーン10 モックアップ(Gemini) | **Cloudflare R2**(`logos/<logoId>/candidates/<candidateId>/mockups/<slot>.png`)。ブラウザは `/api/mockups/<logoId>/<candidateId>/<slot>` 経由で参照し、索引は `logo_mockups` | `candidate_id + slot` (将来は `candidate_id + mockup_definition_id`) | **あり**。`logo_mockups` が `logo_candidates` にぶら下がり、そこから `logos` / 組織 / アカウントへ到達する |
| Generative Lab 生成物(FLUX.2/Recraft) | **Cloudflare R2**(`labs/generative/outputs/<name>`)。R2未設定の開発環境のみローカルディスク `var/generative-lab/outputs/*.png` へフォールバック。配信URLは引き続き `/api/labs/generative/outputs/[name]` | ランダムファイル名。ジョブログに `logoHash`(ペイロードのSHA-256)を記録 | **なし**。まだ `logo_mockups` / `logos` / 組織には紐付いていない |

つまり生成画像は今のところ**コンテンツアドレス方式のキャッシュ**であって、リレーショナルな正本レコードではない(同じロゴ内容なら誰がアップしても同じキャッシュを引く)。

シーン10の生成画像は`logo_mockups`(候補→ロゴ→組織/アカウント)に配線され、所有者・公開範囲・課金主体が明確になっている。一方、Generative Labはまだ`logoHash`ベースの独立資産で、`logos`/`logo_candidates`とのリレーションは未配線。

### 6.5 logo_presentations(層B)

```sql
create table public.logo_presentations (
  logo_id     text primary key references public.logos(id) on delete cascade,
  catchphrase text,                            -- キャッチコピー(Splash等に表示)
  story       text,                            -- ストーリー(Markdown想定)
  scene_texts jsonb not null default '{}',     -- シーンごとの文言オーバーライド
  layout      jsonb not null default '{"version":1,"mappings":[]}', -- 資産配置の上書き
  updated_at  timestamptz not null default now()
);
```

- ロゴと 1:1(候補とは独立 — 案が違っても語りは1つ)。未編集でも自動生成コピーでプレゼンが成立する
- `layout` は **asset definition catalog に対する per-logo の mapping override**。ここに「このロゴは splash に motion A、merch に黒Tシャツ、generated に mug+tote を使う」といった選択状態を持つ
- `layout.mappings` は `assetId + placementId` ごとの override。つまり同じ asset が将来複数 placement に対応しても、配置ごとに有効/無効・順序を別々に持てる
- layoutが参照できるのは `release_stage='production'` の具体的なdefinition versionだけ。draftはLabに存在してもプレゼンには解決されない
- `layout.mappings[].params` に表示ごとの設定値を持つ。例: `{ "colorMode": "mono-black" }`。許可される項目・既定値はasset定義の `config.parameters` が正本
- 初期状態では `layout.mappings = []` とし、グローバル定義カタログ側の `default_mappings` がそのまま効く。利用者が順序変更・無効化・差し替えを行った asset だけをここへ保存する
- 公開範囲はロゴ本体の `visibility` に従う

### 6.6 logo_credits

```sql
create table public.logo_credits (
  id      uuid primary key default gen_random_uuid(),
  logo_id text not null references public.logos(id) on delete cascade,
  role    text not null default 'designer',    -- 'designer' | 'studio' | 'art_director' | ...
  name    text not null,                       -- 個人名・制作社名(サービス外も登録可)
  user_id uuid references public.users(user_id) on delete set null,  -- サービス内ユーザーなら紐づけ
  contact text,                                -- email / URL
  note    text,
  created_at timestamptz not null default now()
);
```

### 6.7 logo_trademarks

```sql
create table public.logo_trademarks (
  id              uuid primary key default gen_random_uuid(),
  logo_id         text not null references public.logos(id) on delete cascade,
  status          text not null default 'unregistered', -- 'registered' | 'pending' | 'unregistered'
  jurisdiction    text,                        -- 'JP' | 'US' | 'EU' | 'WIPO' ...
  registration_no text,
  trademark_type  text,                        -- 'word' | 'device' | 'combined' | '3d' ...
  nice_classes    integer[],                   -- ニース国際分類(1〜45)
  goods_services  text,                        -- 指定商品・役務
  registered_at   date,
  expires_at      date,
  note            text,
  created_at      timestamptz not null default now()
);
```

### 6.8 logo_activities

```sql
create table public.logo_activities (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  user_id    uuid references public.users(user_id),
  action     text not null,  -- 'created' | 'file_updated' | 'info_updated' | 'candidate_added'
                             -- | 'visibility_changed' | 'transferred' | ...
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

append-only(UPDATE/DELETE不可のRLS)。書き込みはアプリ操作に伴い自動。

### 6.9 tags / logo_tags / bookmarks(層C)

```sql
create table public.tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique                    -- 正規化(小文字・トリム)して保存
);

create table public.logo_tags (
  logo_id text not null references public.logos(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (logo_id, tag_id)
);

create table public.bookmarks (
  user_id    uuid not null references public.users(user_id) on delete cascade,
  logo_id    text not null references public.logos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, logo_id)
);
```

- タグ付与は editor 以上。将来は解析結果からの自動タグ(業種・色系統)も同居
- ブックマークのRLSは本人のみ全操作可。非公開化されたロゴのブックマーク行は残し、一覧表示時に閲覧権限でフィルタ

### 6.10 RLSの原則(子テーブル共通)

logo_* の子テーブルは「SELECTは親ロゴの閲覧権限に準ずる」を基本とする。書き込みは操作別に分け、正本は所有者・組織editor以上・共有`manager`、プレゼンはそれに共有`editor`を加える。visibility・移管・削除・再共有は所有主体側admin以上に限定する。例外はbookmarks(本人のみ)とlogo_activities(append-only)。

## 7. ロゴの正規参照URL(CDN、未実装)

### URL体系

パーマリンク(`/p/[id]`)と同じ原則 — **所有者を含まない、壊れないURL**:

```
/l/[id]/[variant].[ext]           例: /l/Ab3xK9mQpR2f/primary.svg
/l/[id]/[variant].png?size=512    ラスタライズはクエリで指定(オンデマンド変換)
```

- `[variant]` は `primary`(=primary候補のマスター)または logo_variants.kind(`mono_black` / ...)
- **CDNが配信するのは常に primary 候補**。非primary候補の外部参照は当面提供しない(比較は閲覧UIの用途)
- 利用者はこのURLを `<img src>` やアプリアイコンのビルドパイプラインから直接参照できる = **ロゴCDN**(PRODUCT.md フェーズ2の実体)
- 上書き更新してもURLは同じ(参照側は常に最新の正本を得る — これがCDNの価値)
- 将来の層2バニティ(`/[handle]/[slug]/logo.svg`)は内部でこのURLに解決するエイリアス

以下は実装予定の契約であり、現時点で`/l/[id]/...` Route Handlerは存在しない。

### 段階実装(CORS等の問題を吸収する後追い方針)

| 段階 | 配信 | 備考 |
|---|---|---|
| Step A | **Next.js の Route Handler**(`/l/[id]/...`)が Supabase Storage から読んで返す | 自前ドメインなので CORS は自分で `Access-Control-Allow-Origin: *` を付けるだけ。キャッシュは `Cache-Control` + Vercel CDN |
| Step B | **Cloudflare R2 + Workers**(resvg-wasm でPNGオンデマンド変換)へ移行 | パス体系を維持したまま `cdn.` サブドメインへ。アプリ側は URL 生成関数を1箇所差し替え |

- URLパス体系を最初から確定させておくことで、裏側(Storage→R2)を差し替えても参照者のURLは壊れない
- 配信対象は `visibility in ('unlisted','public')` のロゴのみ(private のロゴはCDNに出さない)
- 上書き更新時はCDNキャッシュをパージ(Step A: revalidate / Step B: Workers KV or Cache API)

## 8. アセットの保存先

**2026-07-14 実装判断(R2移行時)**: SVGは数KB程度と小さいため、**マスターSVG・バリエーションはDBに直持ち**(`logo_candidates.svg` / `logo_variants.svg`)を維持し、**生成モックアップ画像(大きい)は Cloudflare R2**(`logo_mockups.image_path`)へ置く。CDN/配信ルート(§7)はDBの `image_path` とアプリの中継URL(`/api/mockups/...`)で解決する。

- 将来、SVG自体もR2オブジェクト化するかは、その時点のCDN要件で判断する(スキーマ上は svg カラム→パス参照への変更のみ)
- 適用済みスキーマの正本は [../supabase/migrations/](../supabase/migrations/)

## 9. サイト構造(ここまでの全設計の統合)

```
/                     入口。登録後のロゴ投稿UI+公開ギャラリー
                      (カード表示は実装済み。タグ絞込・検索・ブックマークは未実装)
/p/[id]               プレゼンテーション。閲覧/編集モード
/l/[id]/[variant]     ロゴアセットの正規参照URL(CDN層。未実装)
/brand                管理コンソール(組織スコープ: KPI・会社情報・在庫・発注、ロゴのツリー表示)
/assets               アセットライブラリ(自分/所属組織の管理アセット一覧)
/assets/[id]          アセット詳細ページ(正本の編集: 名称・形式・関係・候補・バリエーション・
                      クレジット・商標・タグ・公開範囲・作業履歴の閲覧)
/brand/logos/[id]     互換URL。同じアセット詳細画面を表示
/settings             ユーザー情報表示と退会。プロフィール編集は未実装
/[handle]/[slug]      組織の公開ロゴ用バニティURL(実装済み)
```

## 10. 未決定事項

- 候補タブUIの詳細(タブ切替か、並置比較レイアウトか)
- 親子ツリーの制約(循環禁止・深さ制限)と、シリーズ専用の関係タイプが必要かどうか
- 非primary候補のCDN参照を提供するか(当面しない)
- 商標区分の入力支援(ニース分類マスタを持つか、自由入力か)
- ストーリー(story)の形式: Markdown か、ブロックエディタ形式(jsonb)か
- scene_texts のキー設計(シーンslugと上書き可能フィールドの粒度)
- variant kind の語彙の確定(mono_black / mono_white / symbol / horizontal / ... の正式リスト)
- ブックマークの一覧UI(専用ページ `/bookmarks` か、ユーザーメニュー内か)
- Contactボタンの宛先優先順位(所有組織の窓口 → logo_credits の制作者、の順でよいか)
