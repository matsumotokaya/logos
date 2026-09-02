# HANDOFF

最終更新: 2026-09-03

## この文書の役割

現在の状態と次の作業だけを持つ。1週間後に古くならないことは [README.md](README.md) に書く。

- 40行を超えない
- 追記せず上書きする
- 作業ログを書かない

## 現在の状態

- **URL→ロゴ取得を再設計した（2026-09-03）**。原因は取得ではなく表示だった: ロゴ一覧APIが存在しないSupabase Storageバケットに署名していて、R2にあるPNGロゴが常にnullになっていた。共有ヘルパー（lib/brand/logo-preview.ts）へ統一済み。あわせてStage 1c（ロゴ候補の決定論列挙+VLM裁定、lib/campaign/logo-resolve.ts）を追加し、Chromiumが無い本番でもHTML宣言からロゴが取れる。best24.co.jpでcapture有り/無し両経路とも実証済み（詳細は labs/campaign/README.md §2）
- ロゴ詳細ページはラスターマスターを表示できる（/api/logos/[id]/master 新設）。SVG差し替えが正本化の導線
- catalog: 仮ワードマークで作られた既存ロゴは、次の成功した生成で実ロゴに昇格する（upgradeWordmarkFallback）。**この昇格はまだ実運用で未確認**
- イベント紹介動画(event-cm): `sumi` は承認済み。`standard` は**静止画しか確認していない**
- 入っているデータはすべてサンプル。既存 Take の整合やバックフィルは不要

## 次の作業

1. **ロゴ取得の結果をUIで確認する**（依頼主が確認予定）: トップ`/`からbest24.co.jp等を生成→ /brands のロゴ一覧・ロゴ詳細でロゴが表示されること
2. **`standard` を1本通しで焼いて、映像の良し悪しを見る**。`npm run event-cm:walkthrough`（LLM と TTS を呼ぶので課金あり）

## 判断待ち

| 件 | 内容 |
| --- | --- |
| 効果音を git に入れるか | 配布元が再配布を禁じており、リポジトリが PUBLIC(`matsumotokaya/logos`)。**非公開に切り替えれば解決**。現状は本番で効果音が鳴らない |
| README の書き直し | 現行は 172KB・35節で経緯が大半。`docs/old/` へ退避して短く書き直すか |
| 2026-08-30 の3コミット | メッセージが散文形式。書き換えるか、そのまま残して以後を Conventional Commits にするか |
