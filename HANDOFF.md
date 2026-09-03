# HANDOFF

最終更新: 2026-09-03

## この文書の役割

現在の状態と次の作業だけを持つ。1週間後に古くならないことは [README.md](README.md) に書く。

- 40行を超えない
- 追記せず上書きする
- 作業ログを書かない

## 現在の状態

- **v3へ切り替え済み**(migration 0056 適用、コードは main)。Organizationはワークスペース、Brandは自由ツリー、Workは廃止、素材スコープは take / brand の2段。決定の正本は [docs/deliverable-architecture.md](docs/deliverable-architecture.md) §19、稼働構造は [docs/data-model.md](docs/data-model.md)
- ブランド世界は全消し済み。R2の孤児52件も削除した(`defaults/` の効果音64件は保護)。**ワークスペース17・メンバー18・ユーザー136は健在**
- **ワークスペースは1つずつ表示する**。左ペインの見出しが現在のワークスペース名で、その「…」から詳細と切り替え。一覧は `/organizations`。選択はlocalStorageに持ち、生成時にサーバーへ送る(サーバーはメンバーシップを検証)
- URL→ロゴ取得はStage 1c(候補の決定論列挙 + VLM裁定)。Chromiumが無い本番でもHTML宣言から取れる
- **アセットは本体と詳細の2面**(2026-09-03)。ツリーのロゴ行はプレゼンテーションを開き、動画・LP・ロゴの文字の頁は行メニュー「詳細」から `…/info` へ。ラスターロゴの本体は画像1枚+「準備中」。Brand未所属のロゴは `/logos/[id]` がそのまま詳細。**依頼者のUI確認はまだ**
- ビルド・テスト・lint 通過。依頼者がUIでv3の挙動(ブランドが1つ立つ)を確認済み
- 納品済みの日本酒イベントは [labs/event/sake-2026/](labs/event/sake-2026/README.md) にJSONで保全。バイナリ47点は `var/archive/sake-2026/`(gitignore、このMacのみ)
- イベント紹介動画(event-cm): `sumi` は承認済み。`standard` は**静止画しか確認していない**

## 次の作業

1. **v3の残り**([§19.6](docs/deliverable-architecture.md)): 入口の「このURLは登録済みです」ダイアログ、`/brands` のD&Dツリー(`parent_brand_id` の付け替え)、Brand詳細の「再取り込み」ボタン、生成スイッチのUI
2. ワークスペース切り替えの実挙動を通しで確認する(切り替えた状態でURL投入 → 狙った世界にブランドが入るか)
3. `standard` を1本通しで焼いて、映像の良し悪しを見る。`npm run event-cm:walkthrough`(LLM と TTS を呼ぶので課金あり)

## 判断待ち

| 件 | 内容 |
| --- | --- |
| 名前が空のワークスペースが多数 | `organizations.name` が空文字の行が10件以上あり、一覧で「名称未設定」と並ぶ。テスト時の残骸。消すか名前を付けるか |
| 効果音を git に入れるか | 配布元が再配布を禁じており、リポジトリが PUBLIC(`matsumotokaya/logos`)。**非公開に切り替えれば解決**。現状R2にはあるが、失うと復元できない |
| README の書き直し | 現行は 172KB・35節で経緯が大半。`docs/old/` へ退避して短く書き直すか |
