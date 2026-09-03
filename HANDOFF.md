# HANDOFF

最終更新: 2026-09-03

## この文書の役割

現在の状態と次の作業だけを持つ。1週間後に古くならないことは [README.md](README.md) に書く。

- 40行を超えない
- 追記せず上書きする
- 作業ログを書かない

## 現在の状態

- **v3の実装は途中。ブランチ `v3-entity-model` にフェーズ2a（生成経路）まで**。migration `0056_v3_entity_model.sql` は**未適用**。mainは v2 のまま動く
- **v3エンティティモデルを決定・正本化した（2026-09-03）**: Organization=ワークスペース（brand_organizations廃止）、Brand単一エンティティの自由ツリー、Work廃止、同一性はIDのみ・更新は「再取り込み」で明示、生成=スイッチ/公開=明示。**正本は docs/deliverable-architecture.md §19**。実装は未着手。実験データは全消しでよい（依頼者合意）
- URL→ロゴ取得は再設計済み（同日）: 表示バグ修正+Stage 1c（候補列挙+VLM裁定、Chromium無しでも動く）。best24.co.jpで両経路実証済み。依頼者がUIでロゴ表示を確認済み
- イベント紹介動画(event-cm): `sumi` は承認済み。`standard` は**静止画しか確認していない**

## 次の作業

1. **v3の残り = MarketOrganization画面の作り替え**（判断待ち。下記）。これが終わるまで migration は適用しない
2. 決まったら: ブランチ `v3-entity-model` で残りを実装 → migration適用（明示承認）→ 動作確認 → mainへ
3. `standard` を1本通しで焼いて、映像の良し悪しを見る。`npm run event-cm:walkthrough`（LLM と TTS を呼ぶので課金あり）

## 判断待ち

| 件 | 内容 |
| --- | --- |
| 効果音を git に入れるか | 配布元が再配布を禁じており、リポジトリが PUBLIC(`matsumotokaya/logos`)。**非公開に切り替えれば解決**。現状は本番で効果音が鳴らない |
| README の書き直し | 現行は 172KB・35節で経緯が大半。`docs/old/` へ退避して短く書き直すか |
| 2026-08-30 の3コミット | メッセージが散文形式。書き換えるか、そのまま残して以後を Conventional Commits にするか |
| **v3: Organization画面をどうするか** | `/organizations/[id]`（約2000行）は実世界の会社=MarketOrganizationを編集する画面で、v3ではその実体が無い。ワークスペース設定（名前・メンバー・中のブランド一覧）に作り替えるか、`/brand` の管理画面に寄せて廃止するか。**UXの決定なので確認してから実装する** |
