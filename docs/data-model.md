# ブランド階層・ロゴ・キャンペーンのデータモデル

最終更新: 2026-07-22
ステータス: **Organization → Brand → Assetsモデルへの段階移行中。migration 0019/0020は旧構造として稼働中**
前提: アカウント・権限・URL設計は [account-design.md](account-design.md) を正本とする。本書はその上に載る**現実世界のOrganization、ブランド、ブランドプロフィール、ロゴ、生成アセット**のデータ設計を定める。

## 位置づけ: 権威ある正本(canonical record)

このサービスはロゴ単体ではなく、会社・事業の情報を手軽に埋めながら、そこからLP・動画・モックアップ・ブランド資産を作る**ブランドアセット管理・生成基盤**を目指す。ロゴ正本は重要な構成要素だが、最上位の単位ではない。

## 0. Organization → Brand → Assets

### 0.1 2種類の「組織」を混同しない

- `public.organizations`: Logos内のメンバー、権限、所有、課金を管理する内部ワークスペース
- `public.brand_organizations`: 現実世界の会社、個人事業体、非営利組織、企業グループを束ねるコンテナ
- `public.brand_entities`: 市場に見せるブランド主体。企業・事業・対象別は`brand_kind`の違いであり、同じ機能を持つ

管理ワークスペースと現実世界のOrganizationは`brand_organizations.linked_org_id`で任意に接続する。URLから気軽に始めた個人ユーザーは、現実組織を`created_by`で仮登録でき、後から管理ワークスペースへ接続できる。

### 0.2 現実世界側のツリー

```text
brand_organization（会社・個人・企業グループを表すコンテナ）
├── brand(kind=corporate) 企業ブランド
│   ├── brand_profile / corporate logo / guideline
│   └── assets(LP / video / banner / mockup ...)
├── brand(kind=business) 事業・サービスブランド
│   ├── brand_profile / service logo / guideline
│   └── assets
└── brand(kind=audience) 対象別ブランド
    ├── Personal / Business / Enterprise等の差分profile / logo
    └── assets
```

Organizationは所属・会社構造・管理情報をまとめる箱に専念し、`brand_profile`、ロゴ、ガイドライン、LP、動画などを直接所有しない。企業ブランドと事業ブランドは本質的に同じ`brand_entities`であり、詳細ページと所有できるアセットも共通とする。

各Brandは`parent_brand_id`を任意に持つ。`inherits_parent=true`なら親Brandのカラー、フォント、トーン、デザインルールを継承し、子側に値があるフィールドだけ上書きする。一事業しかなく企業とサービスのアイデンティティが同一でも、レコードは分離し、値の重複コピーではなく継承で一対一相当を表す。

ロゴは`logos.subject_entity_id`、生成アセットは`brand_assets.brand_id`で必ずBrandに属する。Organizationをこれらの参照先にはしない。別OrganizationのBrandからプロフィールやロゴを継承・選択することも禁止する。

### 0.3 Campaignを必須階層にしない

公式LP、事業紹介動画、バナー、モックアップはBrandが恒常的に持つアセットであり、Campaignを必須の親にしない。入力、処理ログ、モデル、コスト、生成日時は`brand_generation_runs`へ保存し、その出力を`brand_assets`として登録する。

将来Campaignが必要になった場合は、期間・目的・対象・オファーを持つ任意のアセットコレクションとして追加する。通常アセットとCampaignの二択にはせず、Campaign、商品ローンチ、SNS運用、地域・年度などを同じ汎用Collection機構で整理できるようにする。

### 0.3.1 動画は一等アセットであり、テンプレートを持つ(2026-08-04)

**動画は `brand_assets` の `asset_kind='video'` の行**である。1つのBrandは動画を複数持てる。

それ以前は動画がエンティティとして存在せず、LPキャンペーンごとに「ローカルにCM音声トラックが在るか」を見て派生させていた。そのため1ブランドが持てる動画は1本だけで、必ず製品CMにしかならず、作り直しの概念も無かった。この節はその置き換えを正本として記録する。

- **テンプレートは作成時に決まり、以後変更しない**。シーン構成・素材スロット・将来の構造化プロンプトがテンプレートで決まるため、後から変えると入力済みの内容が無効になる。テンプレート定義の正本はコード側 [lib/video/templates.ts](../lib/video/templates.ts)(現在 `product-cm` / `event-promo`)
- **`metadata` が作成後の正本**。契約は [lib/video/asset.ts](../lib/video/asset.ts) の `VideoAssetMetadata`:
  - `template`: テンプレートID
  - `published`: 既定 `false`。既定アセットを「用意はするが公開は強制しない」ために必要
  - `brief`: `event-promo` の `EventBrief`。バンドル済みブリーフは**seedであり作成時に複製される**ので、以後の編集がリポジトリのコードに影響しない
  - `campaignJobId`: `product-cm` が参照するキャンペーンジョブ。Brand Kit・ナレーション・MP4はキャンペーン側の実装を唯一の実装として残すため、コピーせずリンクする
- **既定の製品紹介動画は行を作らない**。全Brandに1本提供されるが、未生成のプレースホルダー行でテーブルを埋めないため、動画ポータルが常に1件目として合成して表示する。実体が要るのは生成物が発生してからでよい
- **URLの`videoId`は動画アセットIDでもキャンペーンジョブIDでもよい**。両方UUIDで形では区別できないため、判別は `/api/brands/[id]/videos/[videoId]` の1箇所に置き、UIでは推測しない
- 生成物の元になったキャンペーンジョブIDの解決順(`brand_generation_runs.external_job_id` → `brand_assets.legacy_campaign_id` → 公開パス `/c/<id>`)は [lib/video/job-id.ts](../lib/video/job-id.ts) が正本。**取り違えても「未作成」に見えるだけで無症状**なので、実装を複数箇所に分散させない

### 0.4 どこから始めても同じ構造へ収斂する

- 企業URL起点: Organizationと企業Brandを同時に作り、ブランド情報と生成物は企業Brandへ登録する
- 事業URL起点: Organization、未確認の企業Brand、事業Brandを作る。取得情報を事業Brandへ登録し、企業Brandへ誤ってコピーしない
- 企業と事業が一体のURL: Organization、企業Brand、主事業Brandを作り、主事業Brandは企業Brandを継承する
- ロゴ起点: Organizationと「未整理のブランドアセット」Brandを自動作成して一時収容し、あとから正式なBrandへ移す
- 既存Brand起点: Brandを選んでLP・動画などを生成し、既存プロフィールとロゴを再利用する

自動抽出・AI推定は確度が高くても`inferred`であり、ユーザーが明示的に確認して初めて`confirmed`になる。各フィールドは`provenance`に由来と確度を持つ。

URLから新規生成するときは、生成開始前にそのページを「企業・組織」「事業・サービス」「企業と事業の両方」から選ぶ。これは取得した情報を企業Brand、事業Brand、または両方のどこへ登録するかを決める`registrationScope`である。

- `business`: カラー、デザイントークン、仮ロゴ、生成物を事業Brandへ登録する
- `organization`: 同じ情報を自動作成した企業Brandへ登録する
- `both`: 企業Brandと主事業Brandを分け、主事業Brandは企業Brandを継承する

既存Brandを選んで生成する場合はこの確認を省略し、選択済みBrandへアセットと生成履歴を追加する。確認済み`brand_profile`はURL由来の推定値で自動上書きしない。

直接アップロードなどで主体情報がまだないロゴも未所属にはしない。同じ所有者または管理ワークスペースごとに「名称未設定のOrganization → 未整理のブランドアセットBrand」を作り、そこへ一時収容する。後から正式なBrandを設定したときにロゴの`subject_entity_id`を移す。

migration 0019/0020で作成済みのOrganization直下プロフィール・ロゴは、各Organizationへ自動作成する企業Brandへ移す。既存business/audienceは同じIDのBrandとして保持し、既存Campaignの入力・実行履歴・成果物は`brand_generation_runs`と`brand_assets`へ移してから旧台帳を縮退させる。

Organization詳細は法人種別、法的名称、所在地、公式URL、所属Brandなどのコンテナ情報を扱う。市場向けの説明、カラー、フォント、ロゴ、ガイドラインは企業Brand詳細で扱う。URLから再取得した値はその場で保存せず、現在値との差分を表示してユーザー確認後に保存する。

Brandはカテゴリーにかかわらず同じ詳細画面で名称、種別、URL、業種、説明、プロフィール、ロゴ、生成アセットを編集する。別Organizationへ移す場合もBrand IDと配下アセットは保持し、継承元Brandだけを移動先Organization内から選び直す。重複Brandのマージは所属先変更とは別工程とする。

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
 └── candidates: A / B / C …(正式SVGまたは仮ラスターを持つ。1つが primary)
```

- アップロード時に候補が1つ(primary)自動作成される。**上書き更新 = primary候補のファイル置換**(行は増えない、履歴も残さない)
- 比較したいときだけ候補B・Cを追加。プレゼンページに**タブUI**が現れ、切り替えて閲覧・比較できる
- 名前・商標・クレジット・プレゼン(層B)はロゴ本体に1つ。候補はあくまで「同じロゴの案違い」
- 単色派生(variants)と生成モックアップ(mockups)は候補ごとに持つ(デザインが違えば派生も違うため)
- **ファイル置換時は該当候補の derived variants を再生成し、生成モックアップのキャッシュを無効化**する
- 採用が決まったら候補を primary に切り替え、他を削除(または残して比較記録に)

現行UIはアップロード時のprimary候補作成と、そのprimaryファイルの差し替えまで対応する。候補B/Cの追加、primary切替、比較タブは設計済みだが未実装。

### 2.2 ロゴ間の関係とブランド階層を分ける

会社→事業→対象別ブランドの関係は`brand_entities.parent_entity_id`が正本であり、ロゴの親子関係で会社構造を表現しない。各階層のロゴは`logos.subject_entity_id`で所属する。

`logos.parent_logo_id`は「同じアイデンティティ系列の一部パーツ違い」「旧ロゴと派生ロゴ」など、純粋なロゴ系列が必要な場合だけ使う:

```
ACME Service primary logo
 ├── ACME Service Personal variant
 └── ACME Service Business variant
```

- コーポレート／サービスという用途は`logos.role`で示す
- どの会社・事業に属するかは`subject_entity_id`で示す
- 組織のコーポレートロゴは子事業から継承候補として参照できるため、同じファイルを事業ごとに複製しない

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
public.organizations(管理ワークスペース。現実の会社とは別)
public.brand_organizations(現実世界の会社・グループを表すコンテナ)
  └── public.brand_entities(すべてBrand。kind = corporate / business / audience)
        ├── parent_brand_id(同じOrganization内の任意の継承元)
        ├── brand_profiles(親Brandから継承可能なブランドルール+provenance)
        ├── public.logos(Brandのロゴ正本)
        ├── brand_generation_runs(入力・生成履歴・コスト・エラー)
        └── brand_assets(LP / narration / audio / video / banner / mockup / document)
presentation_asset_definitions(Labsにある全asset。draft / productionと不変versionを持つ)
public.logos(アイデンティティ)── parent_logo_id で自己参照ツリー
  ├── logo_candidates(A/B/C案。1つが primary。正式SVGまたはR2上の仮ラスター)
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
  svg        text,                             -- 正式SVGはDBに直持ち
  media_type text not null,
  file_path  text,                             -- 仮PNG/JPEG/WebP等のR2キー
  asset_status text not null,                  -- provisional | official | generated
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
- 端末モックアップは`web.device`を使用する。LP・動画・バナー・ガイドラインなどプレゼン本編以外も含む出力互換性は、当面`config.supportedOutputs`（`lp / video / banner / guideline`）に持たせ、各出力アダプターが同じasset definitionと画面素材を解決する
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

**2026-07-21 実装判断(R2移行時)**: 正式SVGは数KB程度と小さいため、**マスターSVG・バリエーションはDBに直持ち**(`logo_candidates.svg` / `logo_variants.svg`)を維持する。URL解析で得た仮PNG/JPEG/WebPと生成モックアップ画像はCloudflare R2へ置き、前者は`logo_candidates.file_path`、後者は`logo_mockups.image_path`で参照する。

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
