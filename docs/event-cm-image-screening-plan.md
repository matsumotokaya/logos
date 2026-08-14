# Event CM 画像の自動選定と背景写真(計画)

最終更新: 2026-08-14

## 1. この文書の範囲

イベント紹介動画(`event-cm`)に画像を入れたとき、**利用者がスロットを指定しなくても、
その画像が映像と絵コンテに現れる**までの設計。正本として扱うのは次の4つ。

1. 画像の意味を誰が判定し、どこに記録するか
2. 判定結果をどの規則で `takes.brief` の画像スロットへ入れるか
3. そのために `event-cm` のテンプレートへ加える変更(**背景写真**)
4. 実装の順序と受入条件

出発点は同じ親ディレクトリの `slide-factory` にある画像スクリーニング設計
(`docs/image-screening-plan.md`、`packages/structurer/src/image-screening.ts`)だが、
**そのままは移植しない**。理由は §14 に書く。原則は借り、工程は借りない。

## 2. 決定(この計画の骨子)

- **画像スクリーニングを独立ステージにしない。** 構造化の1回の呼び出しで、事実と画像を
  いっしょに読む。画像はすでに構造化LLMへ渡っている——足りないのは識別子と出力欄だけ
- **分類はLLM、配置は決定論。** どの画像が誰の顔か・何の情景かはモデルが答え、どのスロットへ
  入れるかはコードが決める
- **由来4値(`brand` / `extracted` / `inferred` / `user`)を唯一の真実にする。** 低確度の採用は
  `inferred` + 理由で表す。`needsReview` という第2の台帳を作らない
- **候補テーブルを作らない。** この動画に固定された素材一覧(`take_inputs`)がそのまま候補一覧
  である。「未使用の画像」は消えずにそこに居るので、差し替えは選び直すこと
- **スロットは映像が実際に描くものだけ。** 採用したのに画面に出ない状態は、反映されないという
  今回の不具合と同じ症状
- **テンプレートは背景写真を持つ。** 情景写真があれば地として使い、無ければ設計された墨の地で
  成立させる(素材ゼロでも完成した動画が出るという要件は変えない)
- **顔だけで人物を同定しない。** 氏名の根拠(画像内キャプション・資料本文・ファイル名・ユーザー
  指定)と人物性が揃ったときだけ結びつける

## 3. 現在の状態(コードで確認した事実)

| 事実 | 場所 |
| --- | --- |
| 画像は passthrough として運ばれ、構造化で `image_url` パーツとしてモデルへ渡っている | [lib/event-cm/extract.ts](../lib/event-cm/extract.ts), [lib/event-cm/structure.ts](../lib/event-cm/structure.ts) |
| ただし**画像に識別ラベルが付いていない**。`【label】` はテキスト素材だけ | [lib/event-cm/structure.ts](../lib/event-cm/structure.ts) |
| **モデルへ送る画像に上限が無い**。原寸base64をそのまま渡す(1素材12MBまで受理) | [structure.ts](../lib/event-cm/structure.ts) / [materials/route.ts](../app/api/brands/[id]/videos/[videoId]/materials/route.ts) |
| checksum・同一画像の統合は**素材登録時に実装済み** | [materials/route.ts](../app/api/brands/[id]/videos/[videoId]/materials/route.ts) |
| `event-cm` が実際に描く画像は **`logos[0]` / `visuals.value` / `guests[n].photo` の3つだけ** | [remotion/kit/scenes/event-cm.ts](../remotion/kit/scenes/event-cm.ts) |
| `visuals.programs` / `visuals.closing` は型にあるが `event-cm` は読まない(event-promo由来) | [remotion/event/types.ts](../remotion/event/types.ts) |
| マッピングは登壇者配列を丸ごと置き換え、**毎回 `photo: null` を書く** | [lib/event-cm/map.ts](../lib/event-cm/map.ts) |
| `material:<uuid>` の解決(preview署名URL / render時のステージング)は完成している | [lib/takes/materials.ts](../lib/takes/materials.ts) |
| 画像縮小に使える `sharp` は依存に入っている | package.json |
| OCRエンジン・PDFテキストパーサは**無い** | [lib/event-cm/extract.ts](../lib/event-cm/extract.ts) |

構造化→マッピングの連続実行(入力画面の「構造化して反映する」)は完了済み。したがって
残っている行き止まりは「画像だけが `brief` に届かない」ことに絞られている。

## 4. 先に直す2つの欠陥(この計画の前提条件)

**1. 再マッピングが登壇者の写真を消す。**
[lib/event-cm/map.ts](../lib/event-cm/map.ts) は `facts.guests` を採るとき配列を作り直し、
`photo: null` を入れる。写真を自動配置しても、資料を読み直した瞬間に消える。氏名で正規化
照合してマージする(空白・全角半角・姓名の区切りを無視して比較し、残った人の `photo` を
引き継ぐ)。**写真は登壇者の属性であって、登壇者リストの版ではない。**

**2. モデルへ送る画像量に上限が無い。**
写真を数枚入れた時点で、画像が反映されないどころか構造化そのものが落ちる。送信前に `sharp`
で長辺1024・JPEG品質70へ縮小し、**1回あたり最大12枚・合計8MB**を上限とする。上限で送らな
かった画像は実行ログに「送らなかった」と理由付きで残す(黙って捨てない)。

この2つは画像自動選定の一部ではなく、**それが無いと自動選定が成立しない土台**なので先に入れる。

## 5. 日本酒の映画から持ってくる技術

手で組んだ「世界が恋する日本酒」([remotion/event/EventComposition.tsx](../remotion/event/EventComposition.tsx))は、
背景写真の扱いをすでに解いている。新しく発明せず、これを部品語彙(`remotion/kit/`)へ移す。

| 技術 | 実装 | どう移すか |
| --- | --- | --- |
| `SceneBackdrop`: 全面写真 + ゆっくり寄る(scale 1.04→1.13) + 放射スクリム | `EventComposition.tsx` | `Stage` が敷く地にする(§9) |
| **シーンごとの減光**(value 0.5 / programs 0.22 / closing 0.24) | 同 | 文字量で決まる値なのでテーマが持つ。シーンは `hero` / `support` の意図だけを言う |
| `focus: {x, y}` → `object-position` | `focusPosition()` | すでに `KitComponent` にある。判定を自動化するだけ |
| 円形に切り出すポートレート + `zoom` | `EventComposition.tsx` の portrait | `people` コンポーネントが継承済み |
| ロゴの `knockout` / `invert` 正規化 | [labs/event/scripts/prepare-assets.mjs](../labs/event/scripts/prepare-assets.mjs) | 輝度判定をサーバー側の決定論へ(§8の規則5) |
| 実ブリーフの focus 値(0.45 / 0.68 / 0.5) | [remotion/event/briefs/sake-2026.ts](../remotion/event/briefs/sake-2026.ts) | 粗い列挙で足りることの根拠(§7) |

**この映画が受入基準**である点は変えない。[lib/kit/event-cm-scenes.test.ts](../lib/kit/event-cm-scenes.test.ts) が
実ブリーフで検証しているので、背景写真を追加したらここに `visuals.programs` / `closing` を
持つブリーフを通す。

## 6. 目標パイプライン

```text
入力(資料・画像・テキスト)
  ↓
抽出(決定論)
  ├─ text / passthrough の判定(現行のまま)
  ├─ 画像を長辺1024へ縮小、送信上限を適用
  └─ 画像の輝度・縦横比を sharp で測る
       ↓
構造化(LLM・1回)
  ├─ イベントの事実(現行のまま)
  └─ 画像ごとの読み取り(役割・キャプション・写っている文字・氏名の根拠・焦点)
       ↓
マッピング(決定論)
  ├─ 事実を brief へ(現行のまま)
  ├─ 氏名一致した顔写真 → guests[n].photo
  ├─ キービジュアル → visuals.value
  ├─ 情景写真 → visuals.programs / visuals.closing
  ├─ ロゴ → logos(輝度から treatment を決める)
  └─ 採用しなかった画像は「未使用 + 理由」として実行ログへ
       ↓
台本 → 音声 → 絵コンテ／プレビュー → MP4
```

分けないことが設計判断である。**キャプションと顔を結びつける手がかりは、チラシの本文と
写真が同じコンテキストに居ること**なので、画像を別呼び出しへ出すと根拠を後から再結合する
工程が増えるだけになる。画像枚数が上限に張り付くようになったら、そのときに事前の軽量判定を
足す(そのための上限記録を §「先に直す2つの欠陥」で残している)。

## 7. データ契約

構造化の返り値(`FactsSchema`)に `images` を足す。独立した artifact も新テーブルも作らない。

```ts
const ImageReadingSchema = z.object({
  /** 渡したときのラベル。materialId をそのまま返させる */
  ref: z.string(),
  role: z.enum([
    "speaker-portrait", // 人物の顔が主役
    "key-visual",       // イベントの主役・雰囲気
    "scene-photo",      // 実演・展示・会場内の活動
    "venue",            // 会場・空間
    "logo",             // 主催・協賛のマーク
    "document",         // 文字中心のチラシ・企画書ページ
    "texture",          // 背景・質感・装飾
    "unreadable",       // 判定不能
  ]),
  caption: z.string(),
  /** 画像内で読めた文字。OCRの代わりにモデルが読む */
  visibleText: z.array(z.string()),
  /** 画像から読める氏名。根拠が無ければ null */
  personName: z.string().nullable(),
  personEvidence: z.enum(["image-caption", "document-text", "filename"]).nullable(),
  /** 主役の位置。座標を推定させず粗い列挙で受け取る */
  focusX: z.enum(["left", "centre", "right"]),
  focusY: z.enum(["top", "upper", "centre", "lower", "bottom"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
});
```

- **`focus` を列挙で受ける**のは、モデルの座標推定が当たらないため。実ブリーフの手作業値
  (y = 0.45 / 0.68 / 0.5)は5段で表せるので、`upper→0.4 / centre→0.5 / lower→0.6` のように
  決定論で変換する
- **輝度はモデルに聞かない。** `sharp` で不透明ピクセルの平均輝度を測る。規則で届くものは
  規則で届かせる(deliverable-architecture §17.2)
- `unreadable` と `document` も結果に残す。**画像を静かに捨てない**

## 8. 配置規則(決定論)

上から順に適用する。既存のマッピングと同じ `settle()` / provenance の仕組みに乗せ、判断の
記録先を増やさない。

1. **`origin: "user"` と抑制済み(`__suppressed__`)のスロットは触らない。** 差し替えた人・
   外した人の決定が再構造化で戻らないこと
2. **`speaker-portrait` かつ `personName` が `guests[n].name` と正規化一致 → `guests[n].photo`。**
   一致しなければ配置しない。顔写真が1枚で登壇者が1人でも、名前の根拠が無ければ結びつけない
3. **`key-visual` の最上位1枚 → `visuals.value`**(空のときだけ)。同点は資料の登場順
4. **`scene-photo` → `visuals.programs`、次点 → `visuals.closing`。** `venue` は情景写真が
   足りないときだけ繰り上げる。`confidence: "low"` は自動配置しない
5. **`logo` → `logos`。** `logos[0]`(ブランドのマーク)は動かさない。追加分は末尾へ。
   `treatment` は測った輝度で決める——暗いマークは `knockout`、すでに明るいマークは無変換
   (`invert` は明るいマークを壊すので既定にしない)
6. **同じ画像を2つのスロットへ入れない。**
7. **採用は1スロット1枚。** 2位以下は `brief` へ書かず、実行ログに「未使用 + 理由」で残す。
   利用者が選び直すときの候補は素材一覧そのもの
8. **由来を必ず書く。** 根拠一致で入った写真は `extracted`、規則で選んだだけの写真は
   `inferred`。理由文(`reason`)を `provenance[path].note` に残す

`brief` へ書くのは `material:<uuid>`。preview と render の解決は
[lib/takes/materials.ts](../lib/takes/materials.ts) が既に持っているので、新しい配信経路は要らない。

## 9. テンプレート: 背景写真を持たせる

**方針は「あれば使う、無ければ設計された地」。** `event-cm` の `program` と `cta` は
`numbered-stack` / `corner-credit` で描かれ、全面領域を持たない。だから写真をコンポーネント
として置くのではなく、**シーンの地**として持たせる。

```ts
// remotion/kit/layout.ts
export interface Scene {
  layout: SceneLayout;
  components: SceneComponent[];
  card?: string;
  /** 敷く写真。無ければテーマの地がそのまま出る(それが設計された状態) */
  backdrop?: { photo: EventPhoto; weight: "hero" | "support" };
}
```

- **`Stage` が領域より先に敷く。** 寄り(Ken Burns)とスクリムはテーマが持つ——モーションが
  シーンに宿るとテーマを差し替えられない(README「モーションはテーマが持つ」)
- **減光は `weight` からテーマが決める。** `hero` は写真が主役(0.5前後)、`support` は文字が
  主役(0.22前後)。日本酒の映画が手で置いた値をテーマの語彙に翻訳したもの
- **字幕帯は聖域のまま。** `captionSafeBottom()` の下限は背景写真の影響を受けない
- **`value` シーンも `backdrop` に寄せる。** 全面写真は「配置されるもの」ではなく地なので、
  `image` コンポーネント(スロットに置く図版)と役割を分ける。同じことを2つの方法でできる
  状態を残さない
- **どのシーンが背景を受け取るか**: `value`(hero) / `program`(support) / `cta`(support)。
  `logoIn` / `logoOut` は受け取らない——提供のマークだけを見せる無音の2枚に写真を敷くと、
  それは誰の動画なのかを言う画面ではなくなる
- `EVENT_CM_GOAL` に `visuals.programs` / `visuals.closing` を **`required: false`** で加える。
  フォールバックは欠陥ではないので、必須にはしない

## 10. 絵コンテとFactListの表示

- **絵コンテのコマは背景写真を実画像で薄く敷く。** 絵コンテが約束しないのは動き・粒子・
  タイポの質感で、**何が乗るか**は答える側にある。写真が入っているコマと墨の地のコマが
  同じに見えるのは、絵コンテとしての失敗
- コマの隅に素材名・由来バッジ・焦点位置のマーカーを出す
- **コマを開いた `FactList` に写真スロットの行を出す**: 現在の画像・由来・選ばれた理由・
  [差し替え][外す]。差し替え先はこの動画に固定された素材から選ぶ(=候補一覧)
- 実行結果カードには **総画像数 / 送信数 / 判定数 / 採用数 / 未使用数**と、未使用の理由を出す。
  「氏名の根拠が無いので登壇者写真として使わなかった」が読めること

## 11. 実装の順序と現在地

フェーズ番号ではなく順序。**各段で画面に変化が出る**ように切っている。
**A〜E は 2026-08-14 に実装済み**(テスト186件green)。

| 順 | やること | 実装 |
| --- | --- | --- |
| A | 前提の2欠陥を直す(氏名マージ・送信上限と縮小) | [names.ts](../lib/event-cm/names.ts) / [map.ts](../lib/event-cm/map.ts) / [extract.ts](../lib/event-cm/extract.ts) |
| B | 画像に `【画像 ラベル / ID: …】` を付け、`ImageReadingSchema` を構造化に足す | [structure.ts](../lib/event-cm/structure.ts) |
| C | 配置規則(§8)をマッピングに実装。由来と理由を記録 | [place-images.ts](../lib/event-cm/place-images.ts) / [run/[stage]/route.ts](../app/api/brands/[id]/videos/[videoId]/run/[stage]/route.ts) |
| D | `Scene.backdrop` とテーマの減光・スクリム・寄り。`value` / `program` / `cta` へ配線 | [layout.ts](../remotion/kit/layout.ts) / [theme.ts](../remotion/kit/theme.ts) / [Stage.tsx](../remotion/kit/render/Stage.tsx) / [scenes/event-cm.ts](../remotion/kit/scenes/event-cm.ts) |
| E | 絵コンテの背景描画、FactListの写真行(差し替え・外す)、実行ログの件数と理由 | [storyboard/event-cm.ts](../lib/storyboard/event-cm.ts) / [Storyboard.tsx](../components/video/Storyboard.tsx) / [FactList.tsx](../components/video/FactList.tsx) / [facts.ts](../lib/event-cm/facts.ts) |

実装で確定した設計判断:

- **写真は `factsUpdatedAt` を進めない。** 写真は読み上げないので、台本を古くしない
- **`guests[n].photo` は動的なフィールド行**(`factFieldsFor(brief)`)。登壇者の人数で増減するのでリストは定数にできない
- **差し替えは既存の asset 選択経路に乗る**(`applyAssetChoice` + facts API)。素材がこのTakeに固定されているかはサーバーが再確認する
- **写真の差し替えは既存の focus を保つ。** 新しい画像には焦点情報が無く、そのスロットに選ばれていた寄せの方が構図に合っている

## 12. 受入条件

- 氏名キャプション付きの顔写真を入れて構造化すると、`guests[n].photo` に入り、絵コンテと
  プレイヤーが同じ `brief` から更新される
- 氏名の根拠が無い顔写真は**配置されず**、「未使用(理由: 氏名の根拠なし)」として読める
- 雰囲気写真が `visuals.value` に入る
- 2枚目以降の情景写真が `visuals.programs` / `visuals.closing` に入り、**画面に出る**
- 情景写真が無いイベントでも、墨の地で完成した動画が出る(素材ゼロの要件を壊さない)
- 同じ画像が2つのスロットへ入らない
- 利用者が差し替えた・外した写真は、再構造化で戻らない
- 登壇者名の再マッピングで既存の写真が消えない
- 画像12枚を入れても構造化が落ちず、送らなかった画像が理由付きで残る
- 画像の判定が失敗しても、素材と既存の動画成果物を失わない
- 実行ログに 総画像数 / 送信数 / 判定数 / 採用数 / 未使用数 と理由が残る
- [lib/kit/event-cm-scenes.test.ts](../lib/kit/event-cm-scenes.test.ts) が背景写真を持つ実ブリーフで通る

## 13. 今回やらないこと(と、その理由)

- **深掘り分析(不足課題の再探索)**: `event-cm` の画像スロットは実質3種(主役1枚 + 登壇者N +
  ロゴ)。「登壇者Aの写真が無い」は課題化ではなく**画面にそう出す**だけで終わる。候補順位・
  競合解決・重複実行の抑止は、実物が動いてから必要性を測る
- **独立した画像スクリーニングLLM呼び出し**: 同じ画像を2回送ることになる。枚数が上限に
  張り付くようになったら足す
- **OCRエンジン・PDFテキストパーサ**: 持っていない部品。画像内の文字は視覚モデルが読む
  (`visibleText`)。PDFは現行どおりモデルへ渡す
- **コンタクトシート(一覧画像)**: 十数枚の規模では、1枚ずつラベル付きで送るほうが
  「どの画像の話か」が曖昧にならない。格子の位置で参照させる設計は取り違えの温床
- **候補テーブル・`needsReview` の台帳**: 由来4値と素材一覧で表せる。仮の値の正本を2つに
  しない
- **顔認識による人物同定**: 根拠のある氏名だけを結びつける。ここは品質ではなく線引きの問題

## 14. slide-factory との違い

移植元は物件資料を相手に、10種の画像役割 × 4オーナー × 多数のスライドを裁く。だから
**目録 → 軽量スクリーニング → 専門家への配分 → 深掘り**という工程が意味を持つ。

`event-cm` が答えるべき問いは3つしかない——**誰の顔か / 主役の1枚はどれか / ロゴはどれか**。
借りるのは原則(全画像を目録化する・低確度を勝手に採用しない・根拠なしで同定しない・
決定論で守れるところは決定論で守る)であって、工程の数ではない。工程を先に立てると、
画像が絵コンテへ届くまでの距離が伸びる。今回の不具合はまさにその距離である。
