# Event CM リファクタリング計画(次セッションの出発点)

最終更新: 2026-08-15(**§11.1 baked_brief = シナリオ中心への転換を実装**。migration 0050 適用済み。次は §11.2 の改名)

前版: 2026-08-14(§4 の構造を確定し A〜D を実装。§9.5=案B・§9.9=案1 を確定。§11 にエンジニア引き継ぎパケットを追加)

## 0. この文書の位置づけ

2026-08-14 の1セッションで、Event CM(`event-cm`)に**仕様が一気に固まった**。画像の自動配置、背景写真、ナレーションの声選択とオン/オフ、絵コンテからの台本編集、コマの削除、プログラム1つ=1コマ。**動くところまでは行ったが、成り行きで積んだ**ので、同じ導出を各所で手組みしている状態になっている。

**この文書は「何を捨てて何を守るか」の正本**。次のセッションはここから始める。

- 仕様(何を作るか)の正本は [README.md](../README.md) の「イベント紹介動画(event-cm)」節と [docs/deliverable-architecture.md](deliverable-architecture.md)
- 画像自動選定の設計正本は [docs/event-cm-image-screening-plan.md](event-cm-image-screening-plan.md)
- **本書はリファクタリング(どう作り直すか)だけを扱う。仕様変更は含まない**

## 1. なぜやるか — 1セッションで出たバグの一覧

すべて**同じ形**をしている。「映像が何であるか」を各消費者が別々に導出していて、片方だけが更新された。

| 症状 | 直接原因 | 直した場所 |
| --- | --- | --- |
| 絵コンテの文字サイズ・部品が映像と違う | 絵コンテがフィッター(`fitScene`)を通していなかった | storyboard |
| 「消す」した項目が絵コンテに残り、尺の合計も違う | 絵コンテが `applySuppression` を通していなかった | storyboard |
| 消した登壇者のために台本の行と音声セクションが余分に作られる | 台本APIと音声APIが `applySuppression` を通していなかった | 2つのAPI |
| 3プログラムに割ったら、その3コマが無音扱いになりナレーション欄も消えた | 「喋るか」を台本の内容から判定していた(映像の形ではなく) | storyboard |
| 6コマ目を削除したら7コマ目のモーダルに変わり、下書きが持ち越された | パネルのReact keyが**位置**(`panel.no`)だった | Storyboard.tsx |
| 1行だけ保存すると400 | 台本APIが「全コマ揃っていること」を保存の条件にしていた | script route |
| 保存失敗で画面全体がエラーページに差し替わる | 読み込み失敗と操作失敗が同じ `error` state | BrandVideoDetail |
| ロゴが白い箱になる | 輝度だけで判定し、透過の有無を見ていなかった | place-images |
| 11枚送って10枚判定、1枚が消える | 結果(モデルの返り)から数えていた(素材からではなく) | place-images |
| 絵コンテの金枠が「過去のデザイン案」に見えた | 絵コンテが独自の装飾を発明し、アクセント色を使っていた | Storyboard.tsx |
| 台本を書き直して読み上げても「書き直されていません」が消えない | **`scriptIsStale` が保存されたブリーフから期待値を計算**していた(映像は suppression 済みブリーフで描かれるので、消した登壇者の行を1つ多く期待し続けた)。同じ理由で `eventCmTimeline` を生ブリーフに渡していた画面は実測尺を使えていなかった | types.ts(`eventCmScenePlan` が suppression を自分で読む)|

**個別に直したが、原因は共通**。次に機能を足せば、同じ形のバグがまた出る。

## 2. 症状の共通原因(3つ)

### 2.1 「映像とは何か」の導出が手組みで、消費者ごとに複製されている

映像を得るには6つの手順を**この順で**踏む必要がある。

```text
brief
 → applySuppression      画面から外した項目を空にする
 → eventCmScenePlan      どのコマが何枚あるか(プログラムの数、登壇者の有無)
 → eventCmTimeline       各コマの尺(想定 → 台本の字数 → 音声の実測)
 → sceneForRole          コマごとの部品(role + index)
 → fitScene              入る大きさへ落とす／入らない部品を落とす
 → captionsFor           字幕(コマ内に閉じる)
 + themeForBrand         テーマ(色・書体・モーション・地の減光)
```

この並びを**2箇所が手で書いている**([remotion/event-cm/EventCmComposition.tsx](../remotion/event-cm/EventCmComposition.tsx) と [lib/storyboard/event-cm.ts](../lib/storyboard/event-cm.ts))。さらに台本API・音声APIが**その一部だけ**(`applySuppression` + plan)を踏む。**どれか1つを忘れると、映像と説明が食い違う**——上の表の半分がこれ。

**部分的な先行対応(2026-08-14)**: `eventCmScenePlan` が suppression を自分で読むようにした(`EVENT_CM_SUPPRESSED_NOTE` を data contract へ移し、`facts.ts` / `pipeline/event-cm.ts` はそれを再輸出)。**「映像の形」に関する限り呼び出し側が `applySuppression` を忘れても正しくなった**。値(文言)については依然として呼び出し側の責任なので、§4.2 の型分けは必要。

### 2.2 ブリーフに2つの形があるのに、型が同じ

`brief`(保存されている値)と `applySuppression(brief)`(映像が描く値)は別物なのに、どちらも `EventCmBrief`。**呼び出し側が覚えているかどうかだけが保証**になっている。

### 2.3 同じ定数・同じ判定式が複数箇所にある

実測(2026-08-14):

| 重複しているもの | 箇所 |
| --- | --- |
| シーンキーの書式 `${role}#${index}` | **6箇所**(types.ts の `eventCmSceneKey` 以外に brief-schema / script route / Storyboard×2 / EventCmWorkspace) |
| `TREATMENT_FILTER`(ロゴの描き方) | 3箇所(KitComponent / EventComposition / Storyboard) |
| `focusPosition`(写真の焦点→object-position) | 3箇所(同上) |
| コマの予算 | 2系統(`EVENT_CM_SCENE_BUDGET` by role と `eventCmSceneBudget(step)`。timeline は前者を使っている) |
| ナレーション行の集合を返す関数 | 2つ(`eventCmNarratedRoles` / `eventCmNarratedSteps`。前者は数えるためだけに残っている) |
| TTSの1セクション上限 | 2箇所(`lib/narration/limits.ts` と `tts.mjs` の `MAX_SECTION_CHARS`) |
| ダイアログの殻(ドット付きトリガー・×・左に解除/右に実行・完了→自動で閉じる) | 2箇所(NarrationDialog / BgmDialog)＋PanelDelete が3つ目の変種 |
| 「何ができて、できないときは何と言うか」 | 2モジュール([lib/brand-tree-actions.ts](../lib/brand-tree-actions.ts) / [lib/event-cm/panel-actions.ts](../lib/event-cm/panel-actions.ts))。**これは良いパターンなので統一して残す** |

## 3. 変えてはいけないもの(決定済みの契約)

**リファクタリングで「合理化」してはいけない**。すべて理由があって今の形になっている。README とコード内コメントに理由が書いてあるので、迷ったらそこを読む。

**構成**
- 構成は固定・両端は無音のロゴ(各4秒)。ナレーションはタイトルコールから始まる
- 1コマ=1シーン=1メッセージ=ナレーション1行。**だから字幕がカットをまたがない**
- 登壇者が居なければそのコマは消える。プログラムが複数なら**その数だけコマになる**(1つなら1コマ・index無し=既存Take互換)
- 章のあいだに0.9秒。**同じ値をTTSのセクション間にも渡す**(推定と実測が同じリズムを指すため)
- 尺は「想定 → 台本の字数 → 実測」と段階的に精度が上がる。**30秒は要件ではない**

**事実の扱い**
- 由来4値(`brand` / `extracted` / `inferred` / `user`)。決めつけて埋め、正直に「仮に入れた値」と言う
- `user` は再実行で上書きしない。`null` は「新しい情報が無い」であって「空にせよ」ではない
- 「消す」は非表示の**決定**であり削除ではない(値は残る)
- **読み上げないもの(BGM・写真・ロゴ)は `factsUpdatedAt` を進めない**
- 顔だけで人物を同定しない。氏名の根拠(キャプション・本文・ファイル名)が要る
- 画像を静かに捨てない。採用しなかった画像は理由付きで残す
- `script.source === "human"` は自動では書き直さない(`force` だけが上書きできる)
- **書きかけの台本は正常な状態**(1行だけ保存できる。読み上げだけが全コマを要求する)

**表現**
- 素材ゼロでも完成した映像が出る(欠落は設計された代替で描く)
- 背景写真は「あれば使う」。減光・スクリム・寄りは**テーマが持つ**(シーンが持つとテーマを差し替えられない)
- 絵コンテは**映像と同じ部品・同じ大きさ・同じ尺・同じ字幕**を言う。動き・粒子・地の質感は約束しない
- **絵コンテが勝手に描く要素にアクセント色(金)を使わない**。素材があるものは実画像を描く
- 字幕は必須・1枚28字まで
- 書き出しに乗せない仮素材(`licensed: false`)はその場で明示する

**操作**
- 「まとめて実行」は未処理が無くても押せる(LLM相手に「全部済んでいる」と「もう一度頼みたいことが無い」は別)
- 削除は**その不在が映像の取り得る形であるコマだけ**。できないコマは理由を出す
- **操作の失敗で画面を奪わない**。破壊的な操作は結果を残る面で言う
- 時間のかかる処理は画面上端にバーと文言。**割合は出さない**

## 4. 確定した構造(2026-08-14改訂)

### 4.1 `eventCmFilm(brief)` — 映像の唯一の導出(最重要・実装済み)

**§2.1 の6手順を1つの関数に閉じ込め、レンダラーと絵コンテと各APIが同じ戻り値を読む。** 実装は [remotion/event-cm/film.ts](../remotion/event-cm/film.ts)。

```ts
// remotion/event-cm/film.ts（Reactに依存しない）
export interface FilmScene {
  key: string;                    // eventCmSceneKey。文字列連結はしない
  role: EventCmSceneRole;
  index?: number;
  narrated: boolean;              // 映像の形が決める（台本の有無ではない）
  fromMs: number;
  durationMs: number;
  scene: Scene;                   // kitのシーン(layout・components・backdrop)。Stageが描く単位
  placed: SceneFit["placed"];     // フィッター適用後(emphasis・steppedDown付き)
  dropped: SceneComponent[];      // フィッターが落とした分 + capacity超過
  regions: FilmRegion[];          // distribute() 済み。絵コンテの領域描画はこれを読む
  budget: { min: number; max: number } | null; // 台本の字数予算(narratedのみ)
  narration: string;              // 無ければ ""
  captions: Caption[];            // このコマに閉じる
}

export interface EventCmFilm {
  /** suppression適用済みのブリーフ。**保存してはいけない**(名前がそれを言う) */
  drawn: EventCmBrief;
  theme: Theme;
  scenes: FilmScene[];
  captions: Caption[];            // 全編(CaptionBand用)
  totalMs: number;
  timingSource: TimingSource;
  narrationStartMs: number;
  narrationEndMs: number;
  /** 台本にあるが、どのコマも要求していない行 */
  orphanLines: EventCmScene[];
  /** 喋るのに行が無いコマ(key) */
  missingLines: string[];
  staleness: ScriptStaleness;
  hasVoice: boolean;
}

export function eventCmFilm(raw: EventCmBrief): EventCmFilm;
```

設計上の決定:

- **`applySuppression` を呼ぶのは film() だけ**(§4.2)。suppression の解釈は「形」= `eventCmScenePlan`(types.ts が自前で読む・先行対応済み)と「値」= film の2箇所に閉じる
- **Stage([remotion/kit/render/Stage.tsx](../remotion/kit/render/Stage.tsx))は描画時に自分で `fitScene` を回す。これは変えない**——同じ純関数に同じ入力なので結果は一致し、kit部品としての自己完結(「同じシーンは常に同じ舞台になる」)が保たれる。絵コンテが読む `placed` / `regions` は film が**同じ関数で**計算したもの
- **`EventCmComposition` は `film.scenes` を `Sequence` に並べるだけ**になる(手組みの `applySuppression`/timeline/sceneForRole が消える)
- **`eventCmStoryboard` は `film` を人間向けに言い換えるだけ**になる(ラベル・由来バッジ・編集可否だけを足す)
- 台本API・音声APIは `film.missingLines` / `film.scenes.filter(s => s.narrated)` を読む
- **絵コンテと映像の一致テストは「同じ関数を読んでいる」ことの確認に格下げされる**

### 4.2 ブランド型(StoredBrief / DrawnBrief)は**やらない**(2026-08-14改訂)

前版はブリーフの2形をブランド型で分ける案だったが、**廃止**。film() が `applySuppression` の唯一の呼び出し元になった時点で、「複数の呼び出し側が正しく呼ぶこと」という型で守るべき対象そのものが消える。型より強い保証を2つで代替する:

1. `applySuppression` を `lib/event-cm/facts.ts` の公開APIから外し、film だけが使う(**呼べないものは間違えられない**)
2. film が返すブリーフは `drawn` という名前で持つ。`saveBrief(film.drawn)` は読んだ瞬間に間違いだと分かる(suppression済みを保存すると値が消える)

### 4.3 シーンキーを型にする

`eventCmSceneKey` は既にあるので、**文字列連結を全滅させる**(6箇所→1箇所)。React key、brief-schema の refine、PATCH の突き合わせ、絵コンテのラベルは全部これを通す。可能なら `type SceneKey = string & { __sceneKey: true }`。

### 4.4 描画の定数を1箇所へ

`TREATMENT_FILTER`(実測: KitComponent / Storyboard の2コピー)と `focusPosition`(2定義 + Stage / Storyboard の3インライン展開)を [remotion/kit/paint.ts](../remotion/kit/paint.ts) へ出し、KitComponent・Stage・Storyboard が読む。**絵コンテが映像と同じ見え方をする根拠はここ**。テーマの導出式 `brief.theme ? themeForBrand(SUMI_THEME, brief.theme) : SUMI_THEME` も3実装あった(`themeOf` / `storyboardTheme` / Storyboard.tsx 内)——**film() の `theme` に一本化**。

[remotion/event/EventComposition.tsx](../remotion/event/EventComposition.tsx)(event-promo・手組み)にも treatment 変換の第3実装(knockout を扱わない)があるが、event-promo は素材整形段で正規化する別契約なので**触らない**(§8 の「kit への載せ替えは別プロジェクト」と同じ判断)。

### 4.5 ダイアログの殻を共通化

NarrationDialog / BgmDialog / PanelDelete に共通する挙動:「ドット付きトリガー」「×だけの閉じる」「左に解除・右に実行」「成功→`role="status"`で言う→自動で閉じる」「失敗→中に`role="alert"`」。**1つの `<ActionDialog>` に抜き、中身(選択肢と実行)だけを渡す**。フォーカスの戻し先の扱いも1箇所になる(消える面から実行したときの扱いは今バラバラ)。

### 4.6 ページを分解する

[BrandVideoDetail.tsx](<../app/(management)/brands/[id]/video/[videoId]/BrandVideoDetail.tsx>) は **1200行**で、読み込み・ポーリング・パイプライン実行・素材・ダイアログ・削除・台本編集・公開・レンダー・タイトル提案を全部持っている。

- `useVideoTake(brandId, videoId)` — 読み込み・再読み込み・render ポーリング
- `useTakeRuns` / `useStageRunner` — Run の実行とログ行(`appendLine` のカード生成)
- `useTakeActions` — editFact / editNarration / deletePanel / writeScript / speakScript / publish
- 画面は上記フックを組むだけ

**状態の分離も同時に**: 読み込み失敗(`pageError`)と操作失敗(`problem`)は別state。今は「`resolved` があるかどうか」で描き分ける後付けになっている。

### 4.7 予算とナレーション行の集合を1系統に

- `EVENT_CM_SCENE_BUDGET`(by role)は `eventCmSceneBudget(step)` の**内部データ**にして、timeline も storyboard も script prompt も後者だけを読む
- `eventCmNarratedRoles` を廃止し `eventCmNarratedSteps` に統一(数えるだけの用途は `.length`)

## 5. 作業順序(2026-08-14改訂・各段でテストがgreenを保つ)

| 順 | 内容 | 担当 | 終わりの合図 |
| --- | --- | --- | --- |
| 0 | §9.5=案B・§9.9=案1 を確定 | 依頼者+AIセッション | **済** |
| A | `eventCmSceneKey` へ統一(5実装→1)・`paint.ts` 新設・`eventCmNarratedRoles` 廃止・予算を1系統へ(timeline の index 補正漏れも直る) | AIセッション | 全件green、文字列連結の重複0 |
| B | `eventCmFilm()` を新設し、**まず絵コンテだけ**を載せ替える(テーマ導出の一本化もここ) | AIセッション | 絵コンテ↔映像の一致テストが「同じ関数」で通る |
| C | `EventCmComposition` を `film` 消費へ載せ替える | AIセッション | Player と CLI レンダーが同じ尺・同じ字幕 |
| D | 台本API・音声API・画面の尺/staleness表示を `film` 消費へ・`applySuppression` 非公開化 | AIセッション | 生ブリーフから尺・字幕・行数を導出する箇所0 |
| E | (廃止 — §4.2。film が唯一の呼び出し元になった時点で守る対象が消えた) | — | — |
| H | `baked_brief`(§9.5 案B・§9.9 案1)の実装 | エンジニア | §11.1 の受入条件 |
| I | `script` → `scenario` 改名(DB焼き替え含む) | エンジニア | §11.2 |
| J | `EventCmBrief` を `EventBrief` から分離 | エンジニア | §11.3 |
| F | `<ActionDialog>` 抽出(Narration / BGM / PanelDelete) | エンジニア | 3つの完了・失敗・フォーカスの挙動が同一 |
| G | `BrandVideoDetail` をフックへ分解 | エンジニア | 1ファイル400行以下、状態の責務が名前で分かる |

**A〜Dでバグの再発が構造的に止まる**(このセッションの範囲)。**Hがシナリオ中心への転換の本体**で、次のエンジニアセッションの主題。I・Jは今が一番安い破壊的整理(顧客ゼロ・本番Take数件)。F・Gは読みやすさで、次の実動画制作で触るファイルからで良い。

## 6. テストという資産(206件)

| ファイル | 件数 | 何を守っているか |
| --- | --- | --- |
| [lib/storyboard/event-cm.test.ts](../lib/storyboard/event-cm.test.ts) | 24 | **絵コンテ↔映像の一致**(部品・大きさ・消した項目・喋るコマ・使われていない行)。リファクタリングの安全網の中心 |
| [lib/kit/event-cm-scenes.test.ts](../lib/kit/event-cm-scenes.test.ts) | 16 | 日本酒の実ブリーフで組めること・プログラム分割・地の減光・素材ゼロ |
| [lib/event-cm/seed.test.ts](../lib/event-cm/seed.test.ts) | 14 | シードの妥当性とスキーマが拒む範囲 |
| [lib/event-cm/place-images.test.ts](../lib/event-cm/place-images.test.ts) | 12 | 画像配置の全規則(氏名の根拠・重複・輝度と透過・判定漏れ) |
| [lib/event-cm/timeline.test.ts](../lib/event-cm/timeline.test.ts) | 12 | 尺の3段階・間・実測の上書き |
| [lib/event-cm/map.test.ts](../lib/event-cm/map.test.ts) | 11 | 上書きしない契約・写真の引き継ぎ・1行保存 |
| [lib/event-cm/captions.test.ts](../lib/event-cm/captions.test.ts) | 10 | 字幕がコマに閉じること・28字・分割 |
| [lib/event-cm/facts.test.ts](../lib/event-cm/facts.test.ts) | 10 | 編集・非表示・読み上げないものは台本を古くしない |
| [lib/kit/fit.test.ts](../lib/kit/fit.test.ts) | 10 | 黙って溢れさせない |
| その他 | 26 | sanitize / title / panel-actions / layout / pipeline |

**テストの書き方の注意**: 現在いくつかのテストは「ロールごとに1行」を前提に書かれていた名残があり、`eventCmNarratedSteps` から組むよう直してある。**フィクスチャは必ず plan/steps から作る**(位置や役割の決め打ちは、次に構成が変わったときに同じ修正を強いる)。

## 7. 触るとリスクが高い箇所

- **`take_inputs` と `material:<uuid>`**: ブリーフは private R2キーを持たない。preview は署名URL、render はステージング。[lib/takes/materials.ts](../lib/takes/materials.ts) の2つの解決を壊すと、プレビューは動くのに書き出しが落ちる(逆も)
- **`attach_take_narration` RPC**: WAVのR2登録・material登録・take_inputs pin・brief更新を1トランザクションで行う。ここを分解しない
- **`validateBrief`**: 保存の関門。スキーマの refine(シーンの並びと重複)は**プログラム分割で一度書き換えた**ので、次に触るときは [seed.test.ts](../lib/event-cm/seed.test.ts) の該当テストを先に読む
- **Remotion の Player と CLI レンダー**: 同じコンポジションを2経路で描く。`Sequence` の key と尺の計算(`msToFrame` / `msToFrames` の使い分け)は既にバグを出している場所
- **DBの既存データ**: 本番Takeが3件以上ある(`b979e000-…` が主戦場)。`script.scenes` に index 無しの `program` 行が残っているTakeがある。**移行スクリプトは書かない**方針(古い形は `orphanLines` として画面に出て、書き直しで解消する)

## 8. 残っている小さな負債(リファクタリング中に片付ける候補)

- `image` コンポーネントは event-cm では未使用になった(背景写真が地になったため)。他テンプレート用に語彙としては残す
- ~~`sideCopy` / `visuals.texture` / `visuals.inkArt` は event-cm のどのシーンも読んでいない~~ ✅ **2026-08-15 解消**(§11.3)。`EventCmBrief` は `extends EventBrief` をやめて自立し、3フィールドは型・zod・goal・facts から消えた。**DB焼き替えは不要**(zod が strip する・3件とも値は null)
- `panelDeletion` はクライアント判定のみ。[lib/brand-tree-actions.ts](../lib/brand-tree-actions.ts) と同じく**サーバーがもう一度数える**形に揃える。※ドロワーのボタン判定は §11.3b で [lib/pipeline/stage-actions.ts](../lib/pipeline/stage-actions.ts) へ出した(こちらは押せるかどうかだけなので、サーバーの再確認は各エンドポイントが既に持っている)
- `VIDEO_STATE_LABEL` の状態導出がAPIルートにテンプレート分岐で書かれている(`product-cm` / event系)。テンプレートの関心はテンプレート側へ
- 絵コンテの `no`(通し番号)はラベル用途。**識別には使わない**ことを型で示せると良い(削除時のバグの原因)
- `lib/narration/voices.ts` の男女ラベルは未検証(Geminiは性別を公開していない)。耳で確認して直す
- `remotion/event/EventComposition.tsx`(event-promo・手組み)と kit の二重実装は当面残す。event-promo を kit へ載せ替えるのは別プロジェクト

## 9. シナリオ中心への再定義(次セッションの主題)

2026-08-14 の対話で、**この製品の中心が言語化された**。§4 の `eventCmFilm()` より上位の話なので、次セッションはここから設計する。

### 9.1 用語がひっくり返っている(**2026-08-15 解消** → §11.2)

> ナレーションと呼んでいる部分は本質的には**字幕(サブタイトル)の部分**であり、この字幕が動画の絵コンテの中の各シーンに入っていて、**これが物語の一番メインのシナリオ**になります。これは別の製品(サイト等)においても全部そうです。

いまのコードは逆向きに命名されている。

| いまの名前 | 実体 | 本来の呼び方 |
| --- | --- | --- |
| `EventCmScript` / `script.scenes[].text` | そのコマで語られる言葉 | **シナリオ**(このコマの主文) |
| `captionsFor()` の返り値 | 上を28字カードへ割ったもの | 字幕の**表示単位** |
| `voice.track` | シナリオを読み上げた音 | **読み上げ**(派生物) |

**実装は既にこの向きに近い**——字幕は音声からではなく**シナリオの文から**作られ、音声は尺の精度を上げるだけ(`captionsFor` は `scene.text` を割り、`eventCmTimeline` が実測を使う)。**ずれているのは名前と説明**であって、データの流れではない。だから改名は安全に効く:

- `EventCmScript` → `EventCmScenario`、`script` → `scenario`(brief のキー名変更 = DB移行が必要)。**実際にやったときは両対応にしなかった**——顧客ゼロ・3行なので一度きりで焼き替えた。両対応にすると旧名が型に残り続け、この改名の目的そのものが達成できない(§11.2)
- 画面の文言も「ナレーション」を**シナリオ(本文)**と**読み上げ(音声)**に割る。いまはどちらも「ナレーション」で、右上のボタンだけが音声を意味している → **画面から「ナレーション」という語を消した**(ボタンは「読み上げ」)
- **この再定義は event-cm 固有ではない**。product-cm も、将来のサイト生成も「各シーンの主文が成果物を規定する」構造なので、`lib/scenario/` のような共通語彙になる可能性がある(§9.10)

### 9.2 編集は溜まる。焼き付けはユーザーのタイミング(**2026-08-15 実装済み**)

> ユーザーが自分でナレーションを再度アップデートして初めて動画の尺に影響を与えるような変更が行われる。ユーザーがナレーションを書いただけだと、まだ何も行われない。変更はある時点まで、納得いくまで変更した時に初めてレンダリングして成果を得る。**リアルタイムじゃない。**

**現行の実装はこれに反している**: シナリオを1行保存すると `delete next.voice` で**音声を即削除**する(script route の POST / PATCH 両方)。編集の途中で映像が無音に戻るのは「まだ何も行われない」ではない。

- **変更**: シナリオ編集で音声を消さない。古い音声は**正常な状態**として残す
- そのとき画面は「この映像は前のシナリオを読み上げています」と**言う**(消すのではなく言う)
- 音声を消していたのは「古い言葉を喋る映像は嘘だ」という判断だった。**その判断を、消すことから言うことへ移す**

### 9.3 階層 — シナリオは主、音声とBGMは付属

> シナリオとナレーションは別です。ナレーションはあってもなくてもいいオプションで、付けたからといってオフにしたらまた消えます。BGMも元に戻ります。**そういう意味ではBGMと同じ階層の存在**です。

```text
シナリオ（各コマの主文＝字幕）   ← 主。素材と構成を規定する
  ├─ 読み上げ音声              ← 付属。付けても外せる（BGMと同じ）
  └─ BGM                       ← 付属。付けても外せる
```

- 音声のオン/オフは**すでに実装済み**([components/video/NarrationDialog.tsx](../components/video/NarrationDialog.tsx))。外しても録音は残り、戻せる
- **シナリオを編集しても音声は消さない**(§9.2)。付属物が主の編集で勝手に消えるのは階層が逆
- **MP4と公開はこの木に属さない**(§9.4)

### 9.4 MP4と公開は直列の最後ではなく、木の外(決定・**2026-08-15 実装済み**)

> MP4は全く関係なくて、最後の最後にもし希望があれば書き出すもので、書き出さない限りMP4は存在しない。公開もそう。MP4さえ手に入れば最後まで使わない人もいる。**直列の最後までのシナリオではなくてオプション**です。

**「動画」= プレイヤーで見られる映像であって、MP4ではない。** これは既存の設計思想(「動画を追加した瞬間に完成した映像が再生される」)と完全に一致するが、パイプラインバーは `出力(MP4)` を第4段として直列に置いている——**この配置が「MP4まで行かないと未完成」という誤読を生む**。

```text
【実行が更新するもの】             【要望があれば、別に】
資料 → 読み取り → 事実 → シナリオ → 音声      ┆   MP4 → 公開
                                              ┆   （書き出さなければ存在しない）
```

- **「すべて実行」が巻き取るのは音声まで**(Q2の回答どおり)。MP4は含めない
- バーの4段目を「出力」として直列に見せるのをやめ、**MP4と公開は別の場所(ヘッダーのボタン群)に置く**。差分は⚠で言う(「書き出したMP4は今のシナリオより古い」)
- **尺が確定するのは音声を焼いた時点**なので、MP4を「音声より後」に置く依存は残る(§9.9)

### 9.5 プレイヤーが見せるのは「焼き付けた版」(決定: **案Bで確定**・**2026-08-15 実装済み** → §11.1)

> **絵コンテというのは作業場**なので、絵コンテを変えただけでは何も起こらないです。それを焼き付けしないと反映しない。**動画が変わるのは右上のすべて実行を押したとき、あるいはパイプラインから一つずつ実行していったときのみ**です。

**現行はこの逆**。絵コンテもプレイヤーも `takes.brief` を直接描くので、シナリオを1行保存した瞬間に**プレイヤーの尺と字幕も変わる**。事実を1つ直しても同じ。「実行」は事実の反映と音声の生成しかしていない。

| | 現行 | あるべき姿 |
| --- | --- | --- |
| 絵コンテ | ブリーフを即時描画 | **作業場**。編集が即時反映される(同じ) |
| プレイヤー | ブリーフを即時描画 | **成果**。最後に実行した版を再生する |
| 実行 | 事実の反映・音声の生成 | **作業場の内容を成果へ焼き付ける** |

これは**データ設計の変更**を要求する。候補:

- **案B(推奨)**: `takes.brief` は今のまま**作業中**の値。実行時にその写しを `takes.baked_brief`(仮)へ固定し、**プレイヤーとMP4書き出しは `baked_brief` を読む**。既存の書き込み経路(FactList・絵コンテ編集・画像配置)は全部 `brief` のままでよく、**読み手を2つに分けるだけ**で済む
- 案A: `brief` を焼き付け済みとし、編集は `draft_brief` へ書く。書き込み経路を全部変えるので影響が大きい
- どちらでも「まだ焼いていない差分があるか」は `brief` と `baked_brief` の比較で出る → **これが「まとめて実行」の件数とプレイヤーの⚠の唯一の根拠になる**(§9.7)

**副作用として気持ちよくなる点**: 「絵コンテと動画が一致しない」という今日の疑いは、**一致していないことが正常**になり、画面がそう言う。⚠は「絵コンテに、まだ焼いていない変更が3件あります」になる。

### 9.6 一括ボタンの形

> 処理は一つのボタンです。同じ処理をします。つまり**動画と音声を一気に書き出す**ということです。そしてまず音声ができると思います。そしたらその尺とかがわかると思います。

**1つのボタンが通す順序(決定)**:

```text
[ボタン] → 資料の読み取り → 事実の反映 → シナリオ → 音声 → 焼き付け（=プレイヤーが見る版）
                                                                    ┆
                                                        MP4 → 公開（別・要望があれば）
```

- **古いものだけを走らせる**。既に新しい段は飛ばす
- **手で書いたシナリオの段は飛ばす**(上書きしない)。事実が変わっていても件数には入れない(§9.8)
- **音声は必ず通る**。ここで尺が確定し、確定した尺で画が組まれる(§9.9)
- **MP4は含めない**。含めると声を試すたびに数分のレンダリングが走る

**2026-08-15 実装済み**。ボタンは**「動画を作り直す」**。ドロワー内の段ごとの実行ボタンは残した(読み取り・構造化・反映)。

**残っていた問いも解消済み**(→ §11.3b)。シナリオ・読み上げ・焼き付けに**個別のボタンは足さなかった**——`pendingFilmSteps` の判定を2箇所に置くとバッジと食い違うため。代わりに `ADVANCE` に `map → film` を足し、マッピングのドロワーから映像段へ進めるようにした。判定は [lib/pipeline/stage-actions.ts](../lib/pipeline/stage-actions.ts) が正本。

### 9.7 差分(stale)の定義と、それを読む3箇所

§2.1 の依存グラフに**シナリオと読み上げをノードとして入れる**。各ノードは「自分の入力より古い／形が合わない」だけで stale を判定し、**1つの結果を3箇所が読む**。

```text
【1つのボタンが追いつかせる範囲】                        【別・オプション】
①資料 → ②読み取り → ③事実 → ④シナリオ → ⑤音声 → ⑥焼き付け ┆ ⑦MP4 → ⑧公開
                                    ↘ ⑨素材の不足を言う      ┆
```

| 読む場所 | 出すもの |
| --- | --- |
| パイプラインバー | 段ごとの点(ready / stale / empty) |
| 「まとめて実行」 | **件数バッジ**と、実行する順序。シナリオを書き換えたら**ここに差分が出る**(現行は読み取り3段しか見ないので0件のまま) |
| プレイヤーの左上 | **⚠**: 「音声が前のシナリオのまま」「MP4が古い」「公開版が古い」 |

**2026-08-15 実装済み**。3箇所とも [lib/event-cm/bake.ts](../lib/event-cm/bake.ts) を読む: バーの4段目は `bakeState().changes` の件数、バッジは `pendingRunStages() + pendingFilmSteps()`、プレイヤー直下の注記は同じ `bakeState()`。⑦MP4の「古い」だけは別関数(`renderIsBehind`)で、**書き出したファイルの隣で言う**——再出力は数分かかるのでボタンの件数には入れない。

~~**現行の欠落**(実測): `pendingRunStages` は input / structure / map の3段だけを見る。シナリオ・音声・MP4は1つも見ていない。バーの `output` 段だけは brief の更新時刻と比べて stale になるが、**ボタンとプレイヤーには繋がっていない**。~~

### 9.8 回答済みの決定(2026-08-14)

| 問い | 決定 |
| --- | --- |
| シナリオ編集で音声はどうなるか | **消さない。古い音声は正常な状態として残し、古いと言う**(§9.2) |
| シナリオと音声の関係 | **音声はBGMと同じ付属物**。あってもなくてもよく、外せる(§9.3) |
| MP4・公開の位置 | **直列の外。要望があれば書き出すオプション**。「動画」はプレイヤーで見られる映像を指す(§9.4) |
| 絵コンテとプレイヤーの関係 | **絵コンテは作業場、プレイヤーは焼き付けた版**。動画が変わるのは実行したときだけ(§9.5) |
| 「まとめて実行」の範囲 | **読み取り〜反映＋シナリオ＋読み上げ＋焼き付け**。MP4は含めない(§9.4) |
| 尺の推定を校正するか | **しない。音声を必ずある状態にして実測だけで決める**(§9.9)。予測式は未実行時の暫定表示として残す |
| シーンのカットと音声の同期 | **コマごとに別々に合成して並べているので実測が既知**。予測で合わせているのではない(§9.9) |
| 作成直後の一度目 | **案1を暫定線**——音声なしで作り、最初の実行で必ず音声が付く。**次セッションで §9.5 とセットで確定させる**(§9.9) |
| シナリオが素材を規定する範囲 | **不足を言うまで**。「このコマに合う素材が無い」を課題として出す。自動選定は現行の分類ベースを維持し、文面との照合は別フェーズ |
| 手編集シナリオ＋事実変更 | **件数に入れず、警告だけ**。押しても自動で書き直さない差分はカウントしない |

### 9.9 尺は音声で決まる — だから音声は「必ずある」ものにする(決定)

#### 事実: シーンのカットは実測に従っている(予測ではない)

**TTSは1本の長い音声ではなく、コマごとに別々に合成している**([lib/narration/voice.ts](../lib/narration/voice.ts))。合成したものを、こちらで `EVENT_CM_SCENE_GAP_MS`(0.9秒)を挟んで並べて1本にする。だから**各行の開始と長さは「並べた結果」として既知**で、あとから音声を解析して合わせているのではない。

実測(このTake):

| コマ | 音声の長さ | 次の行の開始 | 関係 |
| --- | ---: | ---: | --- |
| title | 8.48s | 9.38s | 8.48 + 0.90 |
| value | 13.72s | 24.00s | 13.72 + 0.90 |
| program#0 | 5.24s | 30.14s | 5.24 + 0.90 |

**カット = 次の行が始まる瞬間**(自分の音声が終わる瞬間ではない)。声が終わってから0.9秒は前のコマが残り、次の声と同時に画が変わる。**ズレる余地がない**。

**予測(`EVENT_CM_CHARS_PER_SECOND = 7`)が使われるのは「音声がまだ無いあいだ」だけ。** そこだけが不正確で、あとは全部実測。

#### 決定: 校正はしない。音声が常にある状態にする

> キャリブレーションしなきゃいけないということ自体がちょっと無理があって、確かに言葉というのは早くなったり遅くなったりためがあったりとか、ある程度TTSのクリエイティビティというのもあるので、やはり**動画の尺が音声なしに決まらないという事実から逆算して、音声は必ずあるという存在にしましょう**。

定数を実測に寄せる案(前版の§9.9)は**破棄**する。同じ字数でも読み方で変わるものを定数で当てにいくのは筋が悪い。**測らずに、必ず実測がある状態にする**。

- **1つのボタンが、事実の反映 → シナリオ → 音声 → 焼き付け を通す**。音声ができた時点で尺が確定し、その尺で画が組まれる(§9.6)
- 予測の式(`writtenMs`)は**「まだ一度も実行していない状態」専用の暫定表示**として残す。校正しない。画面は `約` を付けて推定であることを言う(既にそうなっている)
- **§9.5(プレイヤーは焼き付けた版)と組み合わさると閉じる**: プレイヤーが見せるのは常に実測の尺・その音声・その字幕なので、**混ざった状態が存在しない**。シナリオを書き換えても動画は動かず、絵コンテだけが変わる

#### 作成直後の一度目 — 案1を暫定線として残す(次セッションで議論)

> ちょっと無駄ですけど最初に適当なダミーですけど音声付きの動画を作成します。

「音声は必ずある」を厳密に守るなら、**Take作成の瞬間に台本(LLM)と音声(TTS)を作る**必要がある。ただし現行の売りは「動画を追加した瞬間に、LLMもレンダリングも無しで完成した映像が再生される」ことで、作成に30〜60秒とAPI課金が乗る。候補:

**案1で確定**(2026-08-14改訂。依頼者がAIの再検討案を承認)。未実行状態の名乗り方は §11.1 で仕様化した——`baked_brief is null` = 未実行、の2状態で足りる。

- **案1(暫定線)**: 作成直後は音声なし(推定尺)のまま。**最初の「実行」で必ず音声が付く**。画面は「実行すると音声が付いて尺が確定します」と案内する(⚠ではなく案内)。1ボタンの原則は守られ、無駄な課金もない。**「音声は必ずある」が破れるのは「一度も実行していない状態」だけ**に限定される
- 案2: 作成時に自動で台本＋音声まで作る。依頼者の言葉(「最初に適当なダミーですけど音声付きの動画を作成します」)に最も忠実だが、作成に30〜60秒かかり、素材を1つも渡していない段階で課金する
- 案3: 作成時にモック音声(`CAMPAIGN_TTS_MOCK` 相当)を付ける。**尺は推定と同じ値になるので意味がない**——却下

**確認済み(2026-08-14改訂)**: 「一度も実行していない状態」= `baked_brief is null`。`未実行` / `実行済み` の2状態で足り、作成直後だけの特別な言い方は作らない。画面は⚠ではなく案内で「実行すると音声が付いて尺が確定します」と言う(§11.1)。

### 9.10 この再定義が波及する範囲

- **product-cm**(製品CM)も5シーンの主文が成果物を規定する構造。`cm_script` と `EventCmScript` は別実装なので、シナリオ語彙を共通化する候補
- **LP・サイト生成**も「各セクションの主文」が同じ役割を持つ。README の「1コマ=1メッセージ」はテンプレート横断の原則として既に書いてある
- ただし**共通化を先にやらない**。event-cm で形が固まってから抜く(先に抽象化すると、まだ知らない差異に合わせた抽象になる)

## 10. 次セッション(エンジニア)の最初の3手

1. **§3(変えてはいけない契約)と §4.1(film の形)を読む**。以後、映像について何かを導出したくなったら、**まず `eventCmFilm()` が既に返していないか見る**——返していなければ film に足す(消費者側で組まない)。これがこのリファクタが守らせたい唯一の習慣。**§11.1 でこれに2つ目の習慣が加わった**: 「作業場と成果のどちらの話か」を先に決める。差分の量を答えるのは [lib/event-cm/bake.ts](../lib/event-cm/bake.ts) 1箇所だけで、画面はそれを言い換える
2. **`npm test` で全件green を確認**してから触り始める(2026-08-15時点で237件)
3. **§11 のパケットは全部終わっている**(11.1 / 11.2 / 11.3 / 11.3b)。残っているのは §11.4 の小さな穴と §8 の負債で、どれも1セッション未満。**この計画書の主題は完了した**ので、次にこのテンプレートを触るときは §3(変えてはいけない契約)と §4.1(film の形)、それに**§11.2 で確定した3語**(シナリオ/字幕/読み上げ)を読んでから始める

**確立した規則(以後これに従う)**:

- 映像について何かを導出したくなったら、**まず `eventCmFilm()` が既に返していないか見る**。返していなければ film に足す(消費者側で組まない)
- 「作業場(`brief`)と成果(`baked_brief`)のどちらの話か」を先に決める。差分の量を答えるのは [lib/event-cm/bake.ts](../lib/event-cm/bake.ts) 1箇所だけ
- **briefのキーを変える migration は `brief` と `baked_brief` の両方に当てる**(§11.2)
- **ブリーフに足したフィールドは、どこかのシーンが読むこと**。読まないフィールドは goal と fact list に並んで、埋めても何も起きない(§11.3)
- **押せる/押せないの判定はデータにしてテストする**。画面に出ない誤りだから(§11.3b、[lib/pipeline/stage-actions.ts](../lib/pipeline/stage-actions.ts))
- リモートDBへ書く前に project ref `xhbdfzceyfrxsmaixkne` を照合し、SQLをレビューしてユーザーの明示承認を得る(AGENTS.md)

## 11. エンジニア引き継ぎパケット

各パケットは独立して1セッションで終わる大きさにしてある。共通の受入条件: `npm test` 全件green、生ブリーフから尺・字幕・シーン数を導出するコードを足さないこと。

### 11.1 baked_brief(§9.5 案B・§9.9 案1) — シナリオ中心への転換の本体 ✅ **2026-08-15 実装済み**

**目的**: 絵コンテ=作業場(`brief` を即時描画)、プレイヤー=成果(最後に実行した版)に分ける。

**判定の正本は [lib/event-cm/bake.ts](../lib/event-cm/bake.ts)**(テスト [bake.test.ts](../lib/event-cm/bake.test.ts))。「何が未反映か」「1つのボタンが何をするか」を答えるのはここだけで、バーの点・件数バッジ・プレイヤーの注記はその言い換え。**deep equal はしない**——素材URLは読み込みのたびに署名し直されるので、毎回「変更あり」になる。比べるのは `factsUpdatedAt` / `script.updatedAt` / `voice.track.generatedAt` の3つだけ。

実装したもの:

- **migration 0050**(適用済み): `takes.baked_brief jsonb` / `takes.baked_at timestamptz`。既存 event-cm Take 3件は `baked_brief = brief, baked_at = updated_at` でバックフィル(`now()` ではなく `updated_at` ——「MP4が映像より古い」を初日から意味あるものにするため)。新規Takeは null で始まる=**未実行**
- **読み手の分岐**(書き込み経路は一切触っていない):
  - プレイヤーは `baked ?? working`。null(未実行)は作業中の値をそのまま再生し、**⚠ではなく案内**で「これは下書きのままの再生です」と言う
  - MP4レンダー([lib/takes/render.ts](../lib/takes/render.ts))は `baked_brief ?? brief`。焼き付けを持たないテンプレート(product-cm / event-promo)は null なので今までどおり
  - `/v/[id]` は成果物(MP4)を配るだけなのでブリーフを読まない=変更なし
  - タイトル横の**尺表示も再生される版から**取る(作業中の版から取ると、プレイヤーが古い映像を流しているのに数字だけ動く)
  - 絵コンテ・FactList・パイプラインドロワーは今までどおり `brief`
- **書き手**: `POST /api/brands/[id]/videos/[videoId]/bake`。ボタンの最終段だけが呼ぶ。ドロワー内の個別段は焼かない
- **1つのボタン**: 「まとめて実行」→**「動画を作り直す」**。順序は 読み取り → 事実 → シナリオ(`source:"human"` は飛ばし件数にも入れない §9.8)→ 読み上げ → 焼き付け。件数バッジは読み取り3段＋film 3段の合計(以前はシナリオを書き換えても0件のままだった)
- **パイプラインバーの4段目を「出力(MP4)」から「動画」へ**(§9.4)。直列の最後がMP4だと「書き出すまで未完成」に読めるため。焼き付けを持たないテンプレートは従来どおりMP4のまま([lib/pipeline/video.ts](../lib/pipeline/video.ts)、テスト [video.test.ts](../lib/pipeline/video.test.ts))
- **§9.2 の実装**: シナリオを保存しても音声を消さない(script route の POST/PATCH、map ステージの3箇所から `delete brief.voice` を撤去)。古い音声は残り、差分として**言う**

**計画に無かったが必要だった判断**:

- **ナレーションのオフを記録する**。§9.9(音声は必ず通る)と §9.3(オフにできる)は、オフが「ポインタを外すだけ」だと衝突する——次の実行が勝手に音声を戻してしまう。**既存の suppression 語彙で `provenance.voice` に記録**し、読み上げを頼んだ時点で解除する。新しいフラグを作らなかったのは、「出さないと決めた」の綴りを2つにしないため
- **複製は `baked_brief` も引き継ぐ**([lib/takes/duplicate.ts](../lib/takes/duplicate.ts))。引き継がないと、音声まで揃ったTakeの複製が「下書きのままの再生です・実行すると音声が付きます」と嘘をつき、要らないTTS課金が走る。複製に無いのはMP4であって映像ではない

**受入条件**(すべて満たしている): シナリオを1行保存してもプレイヤーの尺・字幕が変わらない/実行するとプレイヤーが追いつく/未実行の新規Takeは従来どおり即再生できて案内が出る/MP4書き出しは `baked_brief` を読む。

**未検証**: 実ブラウザでの通し操作。テスト225件green・型・lintはクリア。

### 11.2 `script` → `scenario` 改名(§9.1) ✅ **2026-08-15 実装済み**

**目的**: 名前が逆向きだったのを直す。「script」と呼んでいたものは各コマの主文=**シナリオ**で、読み上げはその派生物。データの流れは既にこの向きだったので(字幕は `scene.text` から切られ、録音からは切られない)、改名は名前と説明だけを動かした。

**語彙は3語に確定**。正本の一覧は [README.md の event-cm 節](../README.md) と [docs/data-model.md §4.2](data-model.md):

| 語 | 実体 | コード |
| --- | --- | --- |
| **シナリオ** | 各コマの主文。字幕・尺・シーン構成を規定する主 | `brief.scenario` / `EventCmScenario` |
| **字幕** | シナリオを28字カードへ割った表示単位(DBに持たない) | `captionsFor()` |
| **読み上げ** | シナリオを声にした派生物。BGMと同じ階層 | `brief.voice` / `lib/narration/` |

実装したもの:

- **migration 0051**(適用済み): `brief` と `baked_brief` の**両方**に同じ式。片方だけだと既存Takeが「シナリオ空」として想定尺へ落ち、0050 が終わらせた不整合が戻る。3件が改名され、行数16のまま(欠落なし)、他テンプレート4件は無変更。**両対応の読み取りコードは書いていない**——書くと旧名が型に残り続ける
- **識別子**: `EventCmScript*` → `EventCmScenario*`、`scriptStaleness` / `ScriptStaleness` / `scriptIsStale` / `scriptText` / `scriptChars` / `scriptBudgetIssues` / `draftEventCmScript` / `eventCmScriptAvailable` → `scenario*`。`TimingSource` と `FilmStep` の `"script"` 値、goal パス `script`、`take_runs` へ書く `sourceRef.script_updated_at` も同様
- **ファイル**: `lib/event-cm/script.ts` → `scenario.ts`、API `.../videos/[videoId]/script/` → `.../scenario/`(レスポンスキーも `{ scenario }`)、`scripts/draft-event-cm-script.ts` → `-scenario.ts`(`npm run event-cm:draft`、`event-cm:seed -- --scenario`)
- **「言葉」を指す `narration` も `scenario` へ**: `FilmScene.narration` / `StoryboardPanel.narration` → `.scenario`、`onEditNarration` → `onEditScenario`、`NarrationLine` → `ScenarioLine`、run API のレスポンス `narrationRewritten` / `narrationKept` → `scenarioRewritten` / `scenarioKept`。**音声を指すものは変えていない**——`narrationStartMs` / `narrationEndMs`(音楽が退く区間)、`narrationIsOff`、`lib/narration/*`、`NarrationDialog`(音声モジュールとしての `narration` は一貫している)
- **UI文言**: 「台本」は全廃。ヘッダーのボタンは**「ナレーション」→「読み上げ」**——ラベルが状態を宣伝しない理由(§11.1)は「読み上げる/読み上げ直す」を出さないことなので、静的な名詞である「読み上げ」はその理由を保ったまま曖昧さを消す。画面から「ナレーション」という語が消えた
- **§11.4 の1つ目も同時に解消**: `brief.scenario?.` の防御を全廃した。型・zodスキーマ・seed のいずれでも必須で、欠損は壊れた行であって正常な状態ではない。**例外は `eventCmFilm()` の1箇所だけ**で、そこは「常に答える唯一の導出」を守るために空シナリオとして扱う(理由をコメントに書いてある)
- **§11.4 の3つ目も**: `lib/narration/voice.ts` の `TTS_MAX_SECTION_CHARS` re-export を削除(消費者は既に `limits.ts` 直import だった)

**計画に無かったが必要だった判断**:

- **§11.1 が残した嘘を1つ見つけて直した**。絵コンテの編集欄は「保存すると音声は外れます。直し終えたらヘッダーの『ナレーション』で読み上げ直してください」と言い続けていた——`delete brief.voice` は §11.1 で撤去済みなので、これは既に起きないこと。「保存しても再生中の動画は変わりません。直し終えたら『動画を作り直す』を押してください」に差し替えた(README の同じ記述も直した)
- **`lib/narration/voice.ts` はテンプレート中立にした**。product-cm が `cm_script` のままなので、共有コードに「シナリオ」語彙を持ち込むと片方だけ正しい名前になる。渡された言葉を読むだけのモジュールだと明記した
- **LLMプロンプト本文は触っていない**([lib/event-cm/scenario.ts](../lib/event-cm/scenario.ts))。「CMナレーション（読み上げ原稿）を書きます」等はモデルへの指示で、文言を変えると出力が変わる。テストが押さえていないので改名の対象から外した——**残タスク**として §11.4 に置く

**検証**: テスト226件green、`tsc --noEmit` / eslint クリア、本番ビルド成功。DBは改名後の3件で `scenario` キー・source(llm/llm/human)・行数16を確認。**未検証**: 実ブラウザでの通し操作。

### 11.3 `EventCmBrief` の自立(§8) ✅ **2026-08-15 実装済み**

**目的**: `extends EventBrief` をやめ、event-cm が実際に読むフィールドだけを持つ。

**再実測(2026-08-15)**: `remotion/kit/scenes/event-cm.ts` が読むのは `presenter` / `seriesLabel` / `title` / `subtitle` / `valueLines` / `valueChip` / `programsHeading` / `programs` / `guestsHeading` / `guests` / `schedule.*` / `cta` / `footnote` / `logos` / `visuals.{value,programs,closing}`、コンポジションが `bgm` / `voice`。**`sideCopy` / `visuals.inkArt` / `visuals.texture` はどのシーンも読まない**(2026-08-14の実測どおり)。

実装したもの:

- **`EventCmBrief` は独立した interface**。共有するのは**値の型**(`EventPhoto` / `EventLogo` / `EventGuest` / `EventProgram` / `EventSchedule`)だけで、**フィールドの一覧は共有しない**。写真は写真、ロゴはロゴという共有は正しい種類の共有だが、相手のフィールド一覧を継承するのはそうではなかった
- **`EventCmVisuals` は3枚**(`value` / `programs` / `closing`)。地を受け取るシーンの数と一致する
- **zod も自立**([remotion/event-cm/brief-schema.ts](../remotion/event-cm/brief-schema.ts))。`EventBriefSchema.extend` をやめ、値のスキーマだけを import する
- **落とした3フィールドは goal / facts / suppression からも消えた**。`visuals.inkArt` は「背景のアート」として一覧に並び、埋めても画面が変わらなかった——**映像に出ないものを管理させない**
- `draftEventCmScenario` の入力型は `EventCmScenarioInput = Omit<EventCmBrief, "scenario" | "voice">`。**出力を入力に要求しない**ためで、副産物として event-promo Take に対しても下書きを試せる状態が保たれた(`scripts/draft-event-cm-scenario.ts` は両テンプレートの実Takeを読む)
- `BrandVideoDetail` の `brief` 型は `EventBrief | EventCmBrief | Record<string, unknown> | null`。2つが別の型になったので、union がそう言う

**DB焼き替えは不要だった**(計画どおり)。zod 4 の `z.object()` は未知キーを strip し、書き込み経路はすべて `validateBrief` の**出力**を保存するので、次に保存された時点で3フィールドは消える。加えて**3件すべてで3フィールドは null**、provenance にも登場しないので、保存を待つあいだも失われる情報が無い。テストで固定した(`seed.test.ts`「古いブリーフを保存すると、死んだフィールドは落ちる」)。

**検証**: テスト228件green(新規2件)、型・lint・本番ビルドクリア。

### 11.3b §9.6 の残り — 映像段への「進む」ボタン ✅ **2026-08-15 実装済み**

§9.6 が残していた問い(シナリオ・読み上げ・焼き付けにドロワー内の実行ボタンが無い)に答えた。**3つのボタンは足していない**——足すと `pendingFilmSteps` が既に下している判定を2箇所で下すことになり、バッジと食い違える。代わりに**既存の「段の外へ出るボタン」パターンをもう1段ぶん延ばした**: `input → structure → map →` **`film`**。マッピングのドロワーが映像段のドロワーを開き、`pendingFilmSteps` が返した工程だけを通す。ラベルもその工程から作る(「読み上げる・動画に反映する →」)ので、残り1工程のときに嘘をつかない。

**判定は [lib/pipeline/stage-actions.ts](../lib/pipeline/stage-actions.ts) へ出した**(テスト [stage-actions.test.ts](../lib/pipeline/stage-actions.test.ts) 9件)。[lib/brand-tree-actions.ts](../lib/brand-tree-actions.ts) / [lib/event-cm/panel-actions.ts](../lib/event-cm/panel-actions.ts) と同じ形で、コンポーネントは描くだけになった。出した理由は**書いている途中で1つ間違いを見つけたから**: `disabled`(=資料が1件も無い)が全ボタンを無効にしていて、そのままだと**資料ゼロのシード済みTakeで映像段が押せない**。資料を読まない工程に資料を要求していたわけで、スクリーンショットには写らない種類の誤りなので、データとして書いてテストで固定した。

`RunnableStage` は広げていない。最後の段は `run/[stage]` の段ではなく3つの別エンドポイントなので、`run: "film"` はページへ処理を返す印であって新しいAPI段ではない。

### 11.4 残っている小さな穴(A〜Dで直したもの以外)

- ~~`brief.script` への optional/非optional アクセスの混在~~ ✅ **2026-08-15 解消**(§11.2)。`brief.scenario?.` を全廃。例外は `eventCmFilm()` の1箇所だけで、そこは「常に答える唯一の導出」を守るための意図的な許容
- ~~[lib/narration/voice.ts](../lib/narration/voice.ts) の `TTS_MAX_SECTION_CHARS` re-export~~ ✅ **2026-08-15 解消**(§11.2)。消費者は既に limits.ts 直importだったので削除した
- `labs/campaign/audio/tts-lib/tts.mjs` の `MAX_SECTION_CHARS = 2000` は [lib/narration/limits.ts](../lib/narration/limits.ts) と値の二重管理。labs は別ランタイムなので許容するが、コメントの相互参照だけ維持する
- **LLMプロンプト本文の語彙が旧いまま**([lib/event-cm/scenario.ts](../lib/event-cm/scenario.ts))。「30秒のCMナレーション（読み上げ原稿）を書きます」「台本を書く前に決めた訴求軸を…」など、モデルへの指示文だけが「ナレーション/台本」を使う。**意図的に触っていない**——プロンプトの文言を変えると出力が変わるのに、それを押さえるテストが無い。直すなら「シナリオへの改名」ではなく「プロンプトの改稿」として、出来上がりを比べながらやる作業
- **`--scenario` フラグの改名は破壊的**(`npm run event-cm:seed -- --scenario`)。旧 `--script` は黙って無視される(フラグが無い扱い=シナリオを書かずに終わる)。開発用スクリプトなので受け入れたが、次に触るときは未知フラグを拒否させる方が親切
