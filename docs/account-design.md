# アカウント・権限・URL設計

最終更新: 2026-07-10
ステータス: **設計合意フェーズ**(このドキュメントの合意後、Supabase移行を実装する)

localStorage PoC から Supabase への移行にあたり、**最初から法人利用に耐えるアカウント設計**にしておくための設計書。個人が軽い気持ちでアップロードするところから始まり、企業への買取・組織運用・退職引き継ぎまで、所有権が何度移っても壊れないことをゴールとする。

---

## 1. 設計原則

1. **パーマリンクに所有者を含めない** — 所有権はあとから何度でも変わる。URLに owner を埋め込むと移管のたびにリンクが壊れる。よって正規URLは opaque ID のみで構成する
2. **ロゴの所有者は「ユーザー」または「組織」のどちらか1つ**(ポリモーフィック所有、GitHubリポジトリと同じ)。移管 = 所有者フィールドの付け替えであり、ロゴのIDもURLも変わらない
3. **作成者(created_by)と所有者(owner)を分離する** — 作成者は不変のクレジット情報。所有者は移り変わる権利情報。「デザイナーが作り、企業が買い取り、デザイナーは抜ける」を自然に表現できる
4. **権限は組織ロールで与える**(ユーザー個人に都度付与しない)。退職 = メンバーシップ削除だけで済み、組織の資産は影響を受けない
5. **guest でも即アップロードできる** — Supabase Anonymous Sign-in を使う。匿名ユーザーも実在の user_id を持つため、「所有者なしデータ」という特殊状態を作らない。本登録は同じ user_id への昇格なのでデータ移行不要

## 2. URL体系(2層)

### 層1: 正規パーマリンク(常に発行・絶対に壊れない)

```
/p/[id]        id = 推測不能な短い opaque ID(nanoid 12文字程度)
```

- guest でも投稿の瞬間に発行される
- 所有者情報を含まないため、guest→個人→組織と所有が移っても**URL不変**
- `unlisted`(限定公開)の共有リンクとしてそのまま機能する(IDが推測不能なので capability URL になる)

### 層2: バニティURL(公開・所有確定後のエイリアス)

```
/[handle]              handle = 組織とユーザーの共有名前空間(GitHub方式)
/[handle]/[slug]       例: /acme/primary-mark
```

- 組織に属さない個人は個人 handle を、組織はブランド handle を使う
- 内部で層1の canonical ID に解決する(層1が常に正)
- guest・非公開ロゴには付与しない
- **実装は組織・公開機能が入るフェーズまで先送り**(スキーマ上は handles テーブルだけ先に確保)

## 3. エンティティモデル

```
auth.users (Supabase認証。直接参照しない)
    │ トリガーで同期
    ▼
public.users ────────────┐
    │                    │ created_by(不変クレジット)
    │ 所属               │
    ▼                    ▼
public.org_members    public.logos ◄── owner_user_id または owner_org_id(どちらか1つ)
    │                    │
    ▼                    ├── public.logo_mockups(生成モックアップのキャッシュ)
public.organizations ◄──┘
    │
    ├── public.inventory_items(在庫 — 組織スコープ)
    └── public.orders(発注 — 組織スコープ)

public.handles(ユーザー/組織の共有名前空間 — 層2 URL用)
```

## 4. ロールと権限マトリクス

組織ロールは5種類。`purchaser` を独立させるのは「PR・購買担当がグッズ発注のためだけに使う」ユースケースのため(ブランド編集権を渡さずに発注業務ができる)。

| 操作 | owner | admin | editor | purchaser | viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| 非公開ロゴ・プレゼンの閲覧 | ✓ | ✓ | ✓ | ✓ | ✓ |
| ロゴのアップロード・編集・削除 | ✓ | ✓ | ✓ | – | – |
| 表示情報(タイトル・役割・会社情報)の編集 | ✓ | ✓ | ✓ | – | – |
| 公開範囲(visibility)の変更 | ✓ | ✓ | – | – | – |
| 在庫管理・グッズ発注 | ✓ | ✓ | – | ✓ | – |
| メンバー招待・ロール変更 | ✓ | ✓ | – | – | – |
| ロゴの移管(受入れ・送出) | ✓ | ✓ | – | – | – |
| 組織の設定変更・削除・課金 | ✓ | – | – | – | – |

- **owner** は複数人可(退職・不在に備え、最後の1人は削除不可)
- 個人所有ロゴの権限は本人のみ(= 実質 owner)

## 5. 公開範囲(visibility)

| 値 | 誰が見えるか | 用途 |
|---|---|---|
| `draft` | 所有者(組織メンバー)のみ | アップ直後の初期値 |
| `private` | 所有者(組織メンバー)のみ | クローズド運用。公開前のステータス管理 |
| `unlisted` | URLを知っている人 | パートナー・クライアントへの限定共有(「1本のURLを渡す」の実体) |
| `public` | 全員。TOPギャラリー・ロゴ図鑑に掲載 | 公開ガイドライン・認知獲得 |

- `draft` と `private` はアクセス制御としては同一。ワークフロー上の区別(未整備/意図的クローズ)のために分ける
- ギャラリー・検索は **0件を正常系として扱う**(空状態UIを用意、シードデータは投入しない)

## 6. ユースケース走査

設計が全ユースケースを通ることの確認。

| # | シナリオ | この設計での挙動 |
|---|---|---|
| 1 | デザイナーが超軽い気持ちでアップ | 匿名サインイン(自動・無操作)→ 即 `/p/[id]` 発行。visibility=draft |
| 2 | 気に入ったので保存・編集したい → サインアップ | 匿名ユーザーをメール登録に昇格。**user_id不変なのでロゴはそのまま自分のもの**(claimフロー不要) |
| 3 | プレゼンを企業が買取り、企業アカウントへ | 個人所有 → 組織所有へ移管(owner付け替え)。`/p/[id]` は不変。created_by はデザイナーのまま残る(クレジット) |
| 4 | 最初に作った人が抜ける | 組織所有なので影響なし。メンバーシップを削除するだけ |
| 5 | ブランドマネージャーが運用 | editor ロールで招待。ロゴ・表示情報を編集できるが公開範囲・メンバー管理は不可 |
| 6 | PR・購買担当がグッズを発注管理 | purchaser ロールで招待。在庫・発注のみ操作可、ブランド編集は不可 |
| 7 | 閲覧だけのアカウント | viewer ロール。非公開状態のプレゼンも閲覧できるが一切変更不可 |
| 8 | 公開前のクローズド運用・公開範囲管理 | visibility を admin 以上が制御(private→unlisted→public) |
| 9 | 退職者から別の担当者へ引き継ぎ | 組織所有: 何もしなくてよい(ロール付与のみ)。個人所有: 移管機能で新しい所有者へ |
| 10 | クリエイターにコンタクト(Behance的) | 公開プレゼンに「Contact」ボタン。宛先は所有者優先(組織所有→組織の窓口、個人所有→created_byのプロフィール)。opt-inフラグで制御 |
| 11 | (将来)ロゴの売買・契約 | プレゼンページを商談ルーム化する構想。移管機構(#3)がそのまま「売買成立=所有権移転」の実行部になる。まずは#10のコンタクトボタンから |

## 7. Supabaseスキーマ案

> 実装時は必ず実際のデータベースに問い合わせて現状確認してから適用する。
> `auth.users` は直接参照しない(トリガーで `public.users` に同期し、FKはすべて `public.users(user_id)` へ張る)。

```sql
-- 認証ミラー(auth.users の INSERT トリガーで自動作成)
create table public.users (
  user_id      uuid primary key,              -- = auth.uid()
  display_name text,
  contact_email text,
  is_anonymous boolean not null default true, -- 本登録で false に
  created_at   timestamptz not null default now()
);

create table public.organizations (
  org_id     uuid primary key default gen_random_uuid(),
  name       text not null,
  website    text,
  industry   text,
  location   text,
  created_by uuid not null references public.users(user_id),
  created_at timestamptz not null default now()
);

create type public.org_role as enum ('owner','admin','editor','purchaser','viewer');

create table public.org_members (
  org_id  uuid not null references public.organizations(org_id) on delete cascade,
  user_id uuid not null references public.users(user_id) on delete cascade,
  role    public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- 層2 URL用の共有名前空間(ユーザー/組織のどちらか1つに紐づく)
create table public.handles (
  handle  text primary key,                   -- 小文字英数とハイフンに正規化
  user_id uuid unique references public.users(user_id) on delete cascade,
  org_id  uuid unique references public.organizations(org_id) on delete cascade,
  check (num_nonnulls(user_id, org_id) = 1)
);

create type public.logo_visibility as enum ('draft','private','unlisted','public');

create table public.logos (
  id            text primary key,             -- nanoid(12)。/p/[id] のパーマリンク
  owner_user_id uuid references public.users(user_id),
  owner_org_id  uuid references public.organizations(org_id),
  check (num_nonnulls(owner_user_id, owner_org_id) = 1),
  created_by    uuid not null references public.users(user_id), -- 不変クレジット
  title         text not null,
  role          text not null default 'other', -- brand / corporate / service / other
  visibility    public.logo_visibility not null default 'draft',
  allow_contact boolean not null default false,
  slug          text,                          -- 層2 URL用(公開時に設定)
  svg           text not null,                 -- マスターSVG
  analysis      jsonb,                         -- 抽出済みの色・パス解析(LogoData相当)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 生成モックアップのキャッシュ(画像本体は Supabase Storage、ここはパス)
create table public.logo_mockups (
  logo_id    text not null references public.logos(id) on delete cascade,
  slot       text not null,                   -- "mug" / "tote" / "cap" ...
  image_path text not null,
  created_at timestamptz not null default now(),
  primary key (logo_id, slot)
);

-- 在庫・発注は組織スコープ(フェーズ3の物販)
create table public.inventory_items (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(org_id) on delete cascade,
  name       text not null,
  spec       text,
  category   text,
  unit       text,
  unit_price integer not null default 0,
  stock      integer not null default 0,
  par_level  integer not null default 0,
  pending_qty integer not null default 0,
  last_ordered_at timestamptz
);

create table public.orders (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(org_id) on delete cascade,
  item_id    uuid not null references public.inventory_items(id),
  qty        integer not null,
  amount     integer not null,
  status     text not null default 'ordered', -- ordered / delivered
  ordered_by uuid not null references public.users(user_id),
  ordered_at timestamptz not null default now()
);
```

## 8. RLS方針

すべてのテーブルで RLS を有効化。判定は `auth.uid()` と `public.org_members` の突合で行う。

```sql
-- ヘルパー: 自分が組織で指定ロール以上か
create function public.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid() and role = any(p_roles)
  );
$$;
```

| テーブル | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| logos | `visibility in ('unlisted','public')` または 個人所有者本人 または 所有組織メンバー | 編集: editor以上 / visibility変更・削除・移管: admin以上(個人所有は本人) |
| logo_mockups | 親ロゴのSELECT権限に準ずる | 親ロゴの編集権限に準ずる |
| inventory_items / orders | 組織メンバー | owner / admin / purchaser |
| organizations / org_members | 組織メンバー | メンバー管理: admin以上、組織設定: owner |
| users | 本人 + 公開プロフィール項目 | 本人のみ |

注意点:

- `unlisted` はRLS上「誰でもSELECT可」。ID列挙は不可能(nanoid)なので、一覧系クエリで `public` のみに絞ればcapability URLとして成立する
- ギャラリー・図鑑のTOP掲載は `visibility = 'public'` のみを列挙する

## 9. 移行手順(段階実装)

**フロントの `BrandRepo` インターフェースは維持**し、`lib/store/local.ts` と並ぶ `lib/store/supabase.ts` を実装して差し替える(PoCの設計意図どおり)。

| Step | 内容 | 備考 |
|---|---|---|
| 1 | サイト構造分離: `/`(投稿UI+公開ギャラリー)、`/p/[id]`(プレゼン) | localStorage のままでも先行実装可能 |
| 2 | Supabaseプロジェクト作成 + 上記スキーマ適用 + Anonymous Sign-in 有効化 | ユーザー作業: プロジェクト作成 |
| 3 | `SupabaseRepo` 実装(logos / mockups / company→organizations) + Storage(SVG・モックアップ画像) | RLSは最初から有効 |
| 4 | 匿名→本登録の昇格フロー(サインアップUI) | user_id不変でデータ移行不要 |
| 5 | 組織・メンバー招待・ロールUI、移管機能 | `/admin` を組織スコープに |
| 6 | visibility制御UI + 公開ギャラリー・Contactボタン | ロゴ図鑑の入口 |
| 7 | 層2バニティURL(`/[handle]/[slug]`) | handle予約は Step 2 のスキーマで確保済み |

## 10. 将来構想(このドキュメントのスコープ外、方向性のみ)

- **売買・契約**: プレゼンページを商談ルーム化し、成約 = 所有権移転(§6 #11)。移管機構が実行部になるため追加のデータモデル変更は小さい
- **移管の承認フロー**: 現段階は「移管先組織のadmin以上である本人」が実行できる自己完結型。第三者への移管はリクエスト→承認制を将来追加
- **監査ログ**: 所有権移転・公開範囲変更の履歴テーブル(法人利用で要望が出た時点で追加)
- **ロゴ図鑑**: `visibility = 'public'` の集合がそのままコンテンツになる

## 11. 未決定事項

- 組織の課金モデルとプラン境界(SaaS課金の単位 = 組織で確定してよいか)
- Contactボタンの実装形態(mailto / フォーム / 通知)
- handle の予約語・命名規則の詳細(`/admin` `/p` 等との衝突回避)
- 匿名ユーザーの保持期間(未登録のままのロゴをいつまで残すか)
