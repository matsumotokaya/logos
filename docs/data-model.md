# ロゴデータモデルとコンテンツ構造

最終更新: 2026-07-10
ステータス: **設計合意フェーズ**
前提: アカウント・権限・URL設計は [account-design.md](account-design.md)(2層URL、組織ロール、匿名→本登録昇格)。本書はその上に載る**ロゴそのもののデータ設計**を定める。

---

## 1. ロゴデータの3層分離

1つの「ロゴ」は性質の違う3種類のデータを持つ。編集する場所も編集する人の意図も違うため、スキーマ上も分離する。

| 層 | 中身 | 性質 | 編集する場所 |
|---|---|---|---|
| **A. マスターアセット + 正式情報** | SVGマスター、名前、ロゴ形式、バリエーション、役割、公開範囲 | 正誤のある「事実」。CDN配信の源泉 | **ロゴ情報ページ**(管理画面内) |
| **B. プレゼンテーション** | ストーリー、キャッチコピー、シーンごとの文言 | 語り・表現。**ブログ的コンテンツ** | **プレゼンページの編集モード** |
| **C. 発見メタデータ** | タグ、ブックマーク | 探す・集める体験のための情報 | タグ=ロゴ情報ページ / ブックマーク=閲覧者が各自 |

- アップロード直後は A に仮の名前(例: "Black logo" — ファイル名由来)だけが入った状態。投稿者はまずプレゼン(B)を眺め、気に入ったら B を編集し、正式情報は A で整える
- プレゼン(B)を消しても・書き換えても、アセットと正式情報(A)は影響を受けない。逆も同じ
- ブックマークは匿名ユーザーでも可能(匿名でも user_id を持つ設計のため)。本登録に昇格してもブックマークはそのまま残る

## 2. 編集サーフェス(どこで何を編集するか)

| 画面 | モード | 編集できるもの | 権限 |
|---|---|---|---|
| `/p/[id]` プレゼンページ | 閲覧モード(デフォルト) | — | visibility に従う |
| `/p/[id]` プレゼンページ | **編集モード**(編集権限者にトグル表示) | キャッチコピー、ストーリー、シーン文言(層B) | editor 以上 |
| `/admin/logos/[id]` ロゴ情報ページ | — | 正式名称、ロゴ形式、バリエーション、役割、タグ、公開範囲(層A・C) | editor 以上(公開範囲のみ admin 以上) |

プレゼン編集は「その場で書き換えるブログ」体験にする(別画面のフォームに飛ばさない)。

## 3. スキーマ(account-design.md §7 への追加・変更)

### 3.1 logos(層A: 正式情報)— 変更

[account-design.md §7](account-design.md) の `logos` テーブルに対して:

```sql
-- 追加カラム
alter table public.logos add column logo_type text;
  -- 'symbol' | 'logotype' | 'combination' | 'emblem' など。ロゴ形式
-- svg カラムは将来的に Storage/R2 のパス参照に移行(下記 §5)。当面は text のまま
```

`title` はアップロード時にファイル名から仮生成(例: "Black logo")。正式名称への変更はロゴ情報ページで行う。

### 3.2 logo_variants(層A: バリエーション)— 新規

「バリエーション」は論理的な種類(単色黒・単色白・シンボルのみ・横組み等)を1行ずつ持つ。**PNG等のフォーマット・サイズ展開は行として持たない**(CDN側でオンデマンド変換するため。§5)。

```sql
create table public.logo_variants (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  kind       text not null,        -- 'primary' | 'mono_black' | 'mono_white' | 'symbol' | 'horizontal' | ...
  source     text not null default 'derived',  -- 'derived'(自動生成) | 'uploaded'(投稿者が追加)
  file_path  text not null,        -- Storage/R2 のキー
  created_at timestamptz not null default now(),
  unique (logo_id, kind)
);
```

- アップロード時に `primary` と自動派生(`mono_black` / `mono_white`)を作成
- 投稿者はロゴ情報ページから追加バリエーション(横組み・シンボルのみ等)をアップロードできる

### 3.3 logo_presentations(層B: ブログ的コンテンツ)— 新規

```sql
create table public.logo_presentations (
  logo_id     text primary key references public.logos(id) on delete cascade,
  catchphrase text,                -- キャッチコピー(Splashなどに表示)
  story       text,                -- ストーリー(ロゴの背景・意図。Markdown想定)
  scene_texts jsonb not null default '{}',  -- シーンごとの文言オーバーライド { "identity": {...}, ... }
  updated_at  timestamptz not null default now()
);
```

- ロゴと 1:1。アップロード時に空行を作成し、シーンは文言が無ければ既存の自動生成コピーで表示(= 未編集でも現在のプレゼンがそのまま成立する)
- 公開範囲はロゴ本体の `visibility` に従う(プレゼン単独の公開設定は持たない)
- RLS: SELECT は親ロゴに準ずる / UPDATE は editor 以上

### 3.4 tags / logo_tags(層C)— 新規

```sql
create table public.tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique       -- 正規化(小文字・トリム)して保存
);

create table public.logo_tags (
  logo_id text not null references public.logos(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (logo_id, tag_id)
);
```

- 付与は editor 以上(ロゴ情報ページ)。ギャラリー・図鑑の絞り込み軸になる
- 将来: 解析結果からの自動タグ(業種・色系統など)も同じテーブルに載せる

### 3.5 bookmarks(層C)— 新規

```sql
create table public.bookmarks (
  user_id    uuid not null references public.users(user_id) on delete cascade,
  logo_id    text not null references public.logos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, logo_id)
);
```

- RLS: 本人のみ全操作可。ブックマーク対象は SELECT できるロゴに限る
- 非公開化されたロゴのブックマークは残るが、一覧表示時に閲覧権限で自然にフィルタされる(行削除はしない)

## 4. ロゴの正規参照URL(CDN)

### URL体系

パーマリンク(`/p/[id]`)と同じ原則 — **所有者を含まない、壊れないURL**:

```
/l/[id]/[variant].[ext]           例: /l/Ab3xK9mQpR2f/primary.svg
/l/[id]/[variant].png?size=512    ラスタライズはクエリで指定(オンデマンド変換)
```

- `[variant]` は logo_variants.kind(`primary` / `mono_black` / ...)
- 利用者はこのURLを `<img src>` やアプリアイコンのビルドパイプラインから直接参照できる = **ロゴCDN**(PRODUCT.md フェーズ2の実体)
- 将来の層2バニティ(`/[handle]/[slug]/logo.svg`)は内部でこのURLに解決するエイリアス

### 段階実装(CORS等の問題を吸収する後追い方針)

| 段階 | 配信 | 備考 |
|---|---|---|
| Step A | **Next.js の Route Handler**(`/l/[id]/...`)が Supabase Storage から読んで返す | 自前ドメインなので CORS は自分で `Access-Control-Allow-Origin: *` を付けるだけ。キャッシュは `Cache-Control` + Vercel CDN |
| Step B | **Cloudflare R2 + Workers**(resvg-wasm でPNGオンデマンド変換)へ移行 | パス体系を維持したまま `cdn.` サブドメインへ。アプリ側は URL 生成関数を1箇所差し替え |

- URLパス体系を最初から確定させておくことで、裏側(Storage→R2)を差し替えても参照者のURLは壊れない
- 配信対象は `visibility in ('unlisted','public')` のロゴのみ(private のロゴはCDNに出さない)

## 5. アセットの保存先

- 現PoCは SVG テキストを DB(localStorage)に直持ちしている。Supabase移行時は **マスターSVG・バリエーション・生成モックアップ画像をすべて Storage に置き、DBはパス参照**にする(logo_variants.file_path / logo_mockups.image_path)
- R2移行(§4 Step B)の際は Storage→R2 へオブジェクトをコピーするだけで、スキーマ変更は不要

## 6. サイト構造(ここまでの全設計の統合)

```
/                     入口。ロゴ投稿UI(メイン導線)+ 公開ギャラリー
                      (Pinterest的カード、タグ絞込・検索、ブックマーク、0件は正常系)
/p/[id]               プレゼンテーション。閲覧モード/編集モード(層Bを編集)
/l/[id]/[variant]     ロゴアセットの正規参照URL(CDN層)
/admin                管理コンソール(組織スコープ: KPI・会社情報・在庫・発注)
/admin/logos/[id]     ロゴ情報ページ(層A・Cを編集: 正式名称・形式・バリエーション・タグ・公開範囲)
/[handle]/[slug]      バニティURL(層2エイリアス。後日)
```

## 7. 未決定事項

- ストーリー(story)の形式: Markdown か、ブロックエディタ形式(jsonb)か — 編集UI設計時に確定
- scene_texts のキー設計(シーンslugと上書き可能フィールドの粒度)
- variant kind の語彙の確定(primary / mono_black / mono_white / symbol / horizontal / ... の正式リスト)
- 自動タグ付けの実装時期と語彙(業種・色系統)
- ブックマークの一覧UI(専用ページ `/bookmarks` か、ユーザーメニュー内か)
