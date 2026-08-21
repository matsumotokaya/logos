# migration 移行記録(0023〜0055)

**これは記録であって、現在のスキーマではない。** 稼働構造の現在形は [../data-model.md](../data-model.md)、スキーマの正本は [../../supabase/migrations/](../../supabase/migrations/) の連番SQLそのもの。リモートに何が適用済みかは**推測せず** Supabase MCP の `list_migrations` で確認する。

ここに残したのは**各 migration がなぜ在るのか**。ルートREADMEの Supabase セットアップ節に、手順と同じ段落として1行4,000字で埋まっていたものを切り出した(2026-08-21)——セットアップ手順を読みに来た人が変更履歴を読まされる形になっていたため。v2移行そのものの履歴と判断記録は [schema-v2.md](schema-v2.md) が持つ。

以下、当時の記述のまま(相対リンクの深さと改行だけ直してある)。

---

`0054`は event-cm の brief キー `scenario` を `narration` へ改名した——`0051` が直したのは名前の**向き**(派生物ではなく主を指す)で、**語そのもの**は残っていた。「シナリオ」は映画の企画に読めるが、実体は各シーンが**言う言葉**であり、ユーザーが絵コンテで打ち込んでいるものそのものなので、「シナリオが書き直されていません」という警告が誰の話か伝わらなかった。あわせて `lib/narration/`(TTS)を `lib/voice/` へ移し、**`narration` がこのリポジトリで1つの意味しか持たない**状態にした。`brief.narrator` は product-cm と共有のため据え置き。

`0052`は`brand_materials`に`opaque` / `luminance`を足し、**素材が何であるかを取り込み時に1回測って行に残す**([docs/asset-normalization.md](../asset-normalization.md) §6・§14-1)。**バックフィルはしない**——測るには本体が要り、本体はR2にあるので、それはmigrationの仕事ではなくスクリプト(`npm run materials:measure`。既定dry-run・`--apply`で保存)の仕事。**測定済みかどうかは行ごとに違う**——`null`は「測っていない」であって「透過していない」ではない。**件数はここに書かない**(素材が増えるたびに古くなる)。現況は `select count(*), count(ink_ratio) from public.brand_materials` で見る。

`0053`は`category` / `category_source`を足し、**構造化LLMの分類を実行記録ではなく素材の行に残す**(§5)。`category_source='user'`の行は実行が二度と上書きしない。

`0055`は`ink_ratio` / `trim_width` / `trim_height`を足し、**絵柄がフレームのどこまでで、その箱の中がどれだけインクか**を残す([docs/asset-normalization.md §11.1](../asset-normalization.md))。ここから**余白の割合**(提案を出すか)と**光学的な重さ**(マークを並べたときの大きさ)の両方が出る。**`aspect`は列にしない**——`trim_width / trim_height`そのものなので、計算元の隣に結果を置くと後で食い違う。バックフィルは`0052`と同じ`npm run materials:measure --apply`が担う(未測定の判定に`ink_ratio is null`を加えたので、0052で測った行も測り直す)。

`0048`は読み上げ音声をどの動画テンプレートからでも固定できるようRPCを一般化し、

`0049`は`take_runs.stage`に`map`を足してマッピング段が自分の実行を記録できるようにした。

`0050`は`takes`に`baked_brief` / `baked_at`を足し、**編集が溜まる作業中のブリーフと、実行が固定した映像を分けた**(上記「絵コンテは作業場、プレイヤーは成果」。既存 event-cm Take は `baked_brief = brief` でバックフィル済みなので、適用しても今日の見え方は変わらない)。

`0051`は event-cm の brief キー `script` を `scenario` へ改名した(その `scenario` は `0054` で `narration` になった)——**`brief` と `baked_brief` の両方に同じ式を当てる**(片方だけだと既存の動画が「ナレーション空」として想定尺へ落ち、0050 が終わらせたはずの不整合が戻る)。**読み取り側の両対応コードは書いていない**。顧客ゼロ・3行の今しか許されない形だが、両対応にすると旧名が型に残り続けるため(語彙の割り方は上記 event-cm 節)。

`0023`〜`0045`でV2基盤・データ移行・旧契約削除・保全データ修復を完了し、`0046`で既存Brandへのロゴ追加とcanonicalロゴプレゼンTake生成を原子的に統一、`0047`で既存 event-promo Take からブリーフ+`take_inputs` を持ち運んで新規Takeを作るRPC `clone_event_promo_take` を追加した。新規URL生成は旧Profile/Generation Run/Assetへ二重書きせず、Knowledge claims + Take Run + Takeを正本にする。
