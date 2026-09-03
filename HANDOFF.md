# HANDOFF

最終更新: 2026-09-03

## この文書の役割

現在の状態と次の作業だけを持つ。1週間後に古くならないことは [README.md](README.md) に書く。

- 40行を超えない
- 追記せず上書きする
- 作業ログを書かない

## 現在の状態

- **v3のコードは完成。ブランチ `v3-entity-model`**(生成経路の載せ替え + MarketOrganization画面の廃止)。ビルド・テスト419件・lint 通過。**migration `0056_v3_entity_model.sql` は未適用**——適用が自動モードの安全判定でブロックされた(`truncate` / `drop table` を含むため)。**mainは v2 のまま動く**
- v3の決定の正本は [docs/deliverable-architecture.md](docs/deliverable-architecture.md) §19、稼働構造は [docs/data-model.md](docs/data-model.md)(v3として更新済み)
- 納品済みの日本酒イベントは [labs/event/sake-2026/](labs/event/sake-2026/README.md) にJSONで保全済み。バイナリ47点は `var/archive/sake-2026/`(gitignore、このMacのみ)
- URL→ロゴ取得は再設計済み: 表示バグ修正 + Stage 1c(候補列挙+VLM裁定、Chromium無しでも動く)。依頼者がUIで確認済み
- イベント紹介動画(event-cm): `sumi` は承認済み。`standard` は**静止画しか確認していない**

## 次の作業

1. **migration 0056 を適用する**。SupabaseのSQLエディタで `supabase/migrations/0056_v3_entity_model.sql` を実行するか、エージェントに実行権限を与える。**ブランド世界は全消しになる**(合意済み)。適用しない限り `v3-entity-model` は動かない
2. 適用後の確認: `npm run dev` → `/` にURLを投入して**ブランドが1つ立つ**こと、`/brands` のツリーとロゴ表示、LPが**公開されずに**作られること。確認できたら main へマージ
3. v3の残り(§19.6 フェーズ2以降): 入口の「このURLは登録済みです」ダイアログ、`/brands` のD&Dツリー、Brand詳細の「再取り込み」ボタン、生成スイッチのUI
4. `standard` を1本通しで焼いて、映像の良し悪しを見る。`npm run event-cm:walkthrough`(LLM と TTS を呼ぶので課金あり)

## 判断待ち

| 件 | 内容 |
| --- | --- |
| 効果音を git に入れるか | 配布元が再配布を禁じており、リポジトリが PUBLIC(`matsumotokaya/logos`)。**非公開に切り替えれば解決**。現状は本番で効果音が鳴らない |
| README の書き直し | 現行は 172KB・35節で経緯が大半。`docs/old/` へ退避して短く書き直すか |
| 2026-08-30 の3コミット | メッセージが散文形式。書き換えるか、そのまま残して以後を Conventional Commits にするか |
