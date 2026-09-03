# HANDOFF

最終更新: 2026-09-03

## この文書の役割

現在の状態と次の作業だけを持つ。1週間後に古くならないことは [README.md](README.md) に書く。

- 40行を超えない
- 追記せず上書きする
- 作業ログを書かない

## 現在の状態

- **v3へ切り替え済み**。migration 0056 適用完了、コードは main にマージ済み。廃止テーブル(`brand_organizations` / `works`)は無く、ブランド世界は全消しされた。ワークスペース17・メンバー18・ユーザー136は健在。ビルド・テスト419件・lint 通過、主要ページは200を返す
- 決定の正本は [docs/deliverable-architecture.md](docs/deliverable-architecture.md) §19、稼働構造は [docs/data-model.md](docs/data-model.md)
- **認証後の実経路(URL投入→ブランド生成)はまだ人の目で確認していない**。ログインが要るためエージェントからは踏めていない
- 納品済みの日本酒イベントは [labs/event/sake-2026/](labs/event/sake-2026/README.md) にJSONで保全済み。バイナリ47点は `var/archive/sake-2026/`(gitignore、このMacのみ)
- イベント紹介動画(event-cm): `sumi` は承認済み。`standard` は**静止画しか確認していない**

## 次の作業

1. **v3の実経路を確認する**: `npm run dev` → ログイン → `/` にURLを投入。**ブランドが1つ立つ**こと、`/brands` のツリーとロゴ表示、LPが**公開されずに**作られること(`/brands/[id]/lp/[takeId]` に出て `/c/...` はliveでない)
2. v3の残り(§19.6): 入口の「このURLは登録済みです」ダイアログ、`/brands` のD&Dツリー、Brand詳細の「再取り込み」ボタン、生成スイッチのUI
3. `standard` を1本通しで焼いて、映像の良し悪しを見る。`npm run event-cm:walkthrough`(LLM と TTS を呼ぶので課金あり)

## 判断待ち

| 件 | 内容 |
| --- | --- |
| 名前が空のワークスペースが多数 | `organizations.name` が空文字の行が10件以上あり、左ペインで空行に見える。テスト時の残骸。消すか名前を付けるか |
| R2の孤児オブジェクト | 全消しでDBの行だけが消え、R2の実体は残っている。`npm run v2:prune-r2`(既定dry-run)を流すと**永久に消える**。sake以外は捨ててよいか |
| 効果音を git に入れるか | 配布元が再配布を禁じており、リポジトリが PUBLIC(`matsumotokaya/logos`)。**非公開に切り替えれば解決**。現状は本番で効果音が鳴らない |
| README の書き直し | 現行は 172KB・35節で経緯が大半。`docs/old/` へ退避して短く書き直すか |
