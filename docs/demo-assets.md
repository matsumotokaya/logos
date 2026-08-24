# デモ素材の正本(生成AIで作る・再配布可)

**このサービスのデモに出る素材は、すべて「誰が使っても権利上問題がないもの」でなければならない。**

**この文書が持つのは、権利・置き場所・そして既定プールのプロンプト**(題材=「日本文化を学ぶ」)。

> **映像としての要件の正本は [labs/freehand/sake-2026/ASSET-PROMPTS.md](../labs/freehand/sake-2026/ASSET-PROMPTS.md)** ——実案件で納品水準に達した映像から逆算した仕様で、[labs/freehand/README.md](../labs/freehand/README.md) の持ち帰り計画 **C10**(「不足素材の生成プロンプトをテンプレートが吐く」)がそこを指している。
>
> **分担: あちらが「どう撮るか」、こちらが「何を撮るか」。** あちらの要件を書き写さず、§2「要件は継ぐ。題材は継がない」で継ぐものだけを名指しする。2箇所に同じことを書くと必ず片方が古くなる。

## 1. なぜ作り直すのか

現在デモに出ている素材は、**このリポジトリに置けないものに依存している**。

| 場所 | 中身 | 置けない理由 |
| --- | --- | --- |
| `public/event/sake-2026/photos/*.jpg` | 京都の紅葉・枡・蔵人・提灯 | ライセンスストックフォト(AdobeStock) |
| 同上 `miyao / onishi / kato` | 登壇者のポートレート | **実在人物**。本人の許諾はこの案件限り |
| `public/event/sake-2026/art/*.png` | 筆致・漢字アート | 支給素材 |
| `public/event/sake-2026/bgm.mp3` | BGM | 支給素材 |
| `public/event/sake-2026/logos/*` | leopalace21 / miss-sake / 〆張鶴 / wealthpark-lab | **実在企業のマーク**。クライアントがこの案件について許諾したもので、既定素材にはできない |

だから新しい環境では `prepare-assets.mjs` を実行しないと `event:render` が失敗する。**素材が無いのではなく、配れない素材を指している**のがこの状態の正体。

**解き方は既に1つ通っている。** 既定BGM2曲は Suno AI(商用利用可プラン)で生成したもので、プレビューでもMP4でもそのまま鳴り、公開できる([lib/assets/defaults.ts](../lib/assets/defaults.ts))。同じことを画像でやる——**商用利用可の契約下にある Midjourney で新規生成し、生成物なので再配布できる**。

これは持ち帰り計画の答えとも一致する。sake-2026 v8 の評価は「**動画素材が無くても十分な画像があれば**(動かす・タイルに並べる・連作でカットする)リッチな映像体験が作れる——つまり画像をどんどん用意することが解になる」だった。

## 2. どのアートディレクションに合わせるか — `sumi` に合わせる

**素材は `sumi`(モダンジャパニーズ)の要件に従って作る。`standard` に合わせて薄めない。**

| | `sumi` | `standard` |
| --- | --- | --- |
| 成立 | freehand v8 で納品水準の評価、v11 まで依頼主フィードバック3巡 | 2026-08-21 追加 |
| 役目 | **実案件の納品物** | 1つ目がハードコードだったことを暴く診断役(commit `e3a185f`) |
| 状態 | **検証済み・先行** | **未完成** |

READMEの「`standard` が正式版で `sumi` は派生」は**将来の位置づけ**の宣言であって、成熟度の話ではない。再利用の機会は standard の方が多いが、**映像として成立することが確かめられているのは sumi だけ**。

だから素材の仕様は ASSET-PROMPTS.md の**暗部前提**(`dark charcoal background` / `near-black background` / 片側3〜4割の暗部)をそのまま使う。

### 要件は継ぐ。題材は継がない(2026-08-23 決定)

**モダンジャパニーズ = 日本酒ではない。** アートディレクション(墨黒×金×明朝)と題材は別物で、ASSET-PROMPTS.md はその2つを1つの文書に持っている——**実案件のために書かれたのだから当然**だが、既定プールへ持ち込むときは分ける。

| ASSET-PROMPTS.md の中身 | 継ぐか |
| --- | --- |
| 16:9・最低2560px・片側3〜4割の暗部・文字なし・顔なし・セット内で照明句を固定・カメラを止める(動画)・連作はループではなくカット | **継ぐ**(art direction と映像の要件) |
| 徳利・枡・蛇の目の利き猪口・「日本酒は無色透明」・紅葉・酒蔵 | **継がない**(日本酒という題材の語彙) |

**日本酒はニッチすぎて同種のイベントは二度と作られない。** 既定プールの題材は**普遍的なもの**にする——日本文化・和食・茶・日本史あたりの「学ぶイベント」。題材が具体的であることは問題ではなく、**後で差し替えられることが要件**。

やることは「テンプレートを1本、完成と言える水準まで作りきる」であって、日本酒の映像を再現することではない。

**この判断を一度間違えた(2026-08-23)。** 両テーマで生き残るように「中間トーンの写真」を要求しかけた——`sumi` は `rgba(8,6,4)` を strength 0.74 でかぶせて落とし、`standard` は `rgba(247,249,252)` を 0.84 でかぶせて持ち上げるので、暗い写真は標準で、明るい写真は墨で平坦になる、という理屈だった。**理屈は合っているが、優先順位が逆。** 検証済みの art direction のための素材を、未完成の art direction に合わせて捨てることになる。

**`standard` が素材を持てないのは、素材の問題ではなくテーマの問題。** 暗部前提の写真が白地のテーマで平坦に見えるなら、直すのは写真ではなく `standard` の側(明るい地に写真をどう置くかがまだ設計されていない)。`standard` 用の素材を別に作るのは、そのテーマが納品水準になってから。

## 3. バイトはコミットする(BGM・SFXとは逆)

`public/defaults/` の既存2つとは扱いが**逆**になる。混ぜないこと。

| プール | バイト | 理由 |
| --- | --- | --- |
| `bgm/` `sfx/` | **gitに入れない** | 効果音ラボは音素材そのものの再配布を禁じている。復元は [scripts/fetch-default-sfx.mjs](../scripts/fetch-default-sfx.mjs) =レシピが担う |
| `stills/` `portraits/` `marks/` `devices/` | **gitに入れる** | 自分が生成した、再配布できる素材 |

**生成物はレシピでは復元できない**(同じプロンプトでも同じ絵にならない)。だからバイトを持つ方が正しい。SFX と逆の結論になるのは、禁じられているのが「再配布」なのか「復元不能」なのかが違うから。

## 4. 置き場所

```
public/defaults/
  stills/      背景写真(シーンの地)          .jpg  ← §6 プロンプト
  portraits/   架空の人物                     .jpg  ← §7 プロンプト
  marks/       ダミーロゴ                     .svg  ← §8 生成AIでは作らない(コード)
  devices/     デバイス・画面が写った実景写真  .jpg  ← §8
```

カタログは [lib/assets/defaults.ts](../lib/assets/defaults.ts) の `DEFAULT_ASSETS`。`ASSET_KINDS` は既に `still` を宣言していて、**エントリがまだ1件も無い**。ここを埋めるとテンプレートが `defaultVisuals` で名指しできる([lib/templates/catalog.ts](../lib/templates/catalog.ts))——これも宣言済みで誰も使っていない。

**既定値の梯子は4段**(ブランド → テンプレート → システム → 設計代替)なので、このプールは3段目。埋めなくても完成した動画は出る(墨の地・金縁モノグラム)。埋めると全テンプレートの既定が一斉に良くなる。

| ファイル | カタログ id |
| --- | --- |
| `stills/tearoom-01.jpg` | `still-tearoom-01` |
| `portraits/speaker-01.jpg` | `portrait-speaker-01` |
| `marks/geometric-01.svg` | `mark-geometric-01` |

## 5. 題材と共通仕様 — 「日本文化を学ぶ」

**既定プールの題材はこれで確定**(2026-08-24)。特定の流派・地域・銘柄を名指ししない「学ぶイベント」なので、和食・茶・歴史・工芸のどれに差し替えても土台が使える。

### スロットは3つ。コピーは全部左側にある

| スロット | 使うシーン | コピーの位置 | 被写体を置く場所 |
| --- | --- | --- | --- |
| `visuals.programs` | シーン2 タイトル(中央)+ シーン4-6 アジェンダ(左) | 中央と左 | **中央〜右。左1/3を空ける** |
| `visuals.value` | シーン3 テーマ(左) | 左 | **右。左1/3を空ける** |
| `visuals.closing` | シーン8 CTA(左下) | 左下 | **上〜右。左下を空ける** |

`visuals.programs` は**1枚を2通りに使う**(タイトルで全presence、アジェンダで減光)ので最も要求が厳しく、**中央〜右**が唯一両立する置き場所。

### 照明句は全カット同一(変えない)

```
single warm key light from the upper right, dark charcoal background,
deep shadow filling the left third
```

**この3行はどのプロンプトからも省略・言い換えしない。** 揃っていないとカットした瞬間に「別の日に撮った写真」になる(ASSET-PROMPTS.md 連作ルール1)。右上から当てるのは、**被写体側が光り、コピー側が自然に落ちる**ため——照明族と必要な暗部が同じ一句で成立する。

### 共通末尾

```
--ar 16:9 --style raw --stylize 150 --no text, letters, calligraphy characters,
kanji, watermark, logo, signage, label, caption, faces, people looking at camera,
cartoon, illustration, 3d render, oversaturated
```

**`calligraphy characters` / `kanji` を外さないこと。** 書や掛軸は「日本文化を学ぶ」の題材として真ん中を突いているが、**書かれた文字は文字**で、生成AIでは崩れる。道具(硯・筆・墨)は撮ってよく、書かれたものは撮らない。

**最低2560px(Upscale必須)。** Midjourney の素の16:9は約1456pxで、Ken Burnsが寄ると甘くなる。

以下 `[共通]` はこの末尾、`[照明]` は上の照明句を指す。**各スロット2枚**——今のテンプレートは1スロット1枚なので今日使うのは片方だが、照明族が揃っているので**連作(Phase C9)が入ったらそのままカットで繋がる**。

## 6. 背景写真(`stills/`)

### 6.1 `visuals.programs` — 茶室(最重要・2シーンで使われる)

```
still-tearoom-01
A quiet tea room interior, a black raku chawan bowl and a bamboo chasen whisk
set on a tatami mat slightly right of centre, faint steam rising from an iron
kettle behind them, worn wooden pillar and paper shoji beyond, [照明],
shallow depth of field, no people, photorealistic, cinematic still life,
negative space on the left [共通]
```

```
still-tearoom-02
The same tea room a step further back, the tatami floor receding to the right
toward an iron kettle on a sunken hearth, a low lacquer tray with a bamboo
ladle beside it, paper shoji glowing softly behind, [照明], shallow depth of
field, no people, photorealistic, cinematic interior, negative space on the
left [共通]
```

### 6.2 `visuals.value` — 光と道具(hero)

```
still-shoji-light-01
Morning light passing through a paper shoji screen on the right of the frame,
casting a soft lattice of shadows across a tatami mat, a single ceramic vessel
standing in the light, the left third of the frame quiet and empty, [照明],
macro detail on the paper grain and the woven tatami, no people, photorealistic,
negative space on the left [共通]
```

```
still-inkstone-01
A stone suzuri inkstone with a pool of black ink, a bamboo-handled brush
resting across it and a stick of sumi ink beside, arranged on the right of the
frame on dark washi paper, nothing written anywhere, [照明], extreme close-up,
shallow depth of field, photorealistic still life, negative space on the left
[共通]
```

### 6.3 `visuals.closing` — 会場(左下を空ける)

```
still-venue-evening-01
A traditional Japanese room prepared for a small evening lecture, low lacquer
tables and flat cushions arranged in rows receding to the upper right, warm
paper lanterns glowing above, the lower left of the frame open tatami floor in
even shadow, [照明], no people, calm and composed, photorealistic, cinematic
interior, negative space in the lower left [共通]
```

```
still-entrance-evening-01
The entrance of a traditional Japanese building at dusk, a dark tiled roof and
a warm-lit lattice door in the upper right, wet stone paving stretching across
the lower left in even shadow, one stone lantern faintly lit, no curtains or
banners of any kind, [照明], no people, photorealistic, cinematic architectural
photography, negative space in the lower left [共通]
```

## 7. 架空の人物(`portraits/`)

**ASSET-PROMPTS.md が「顔は入れない(登壇者2名の実写があるため)」と書いているその実写が、いま置き換える対象。** だから顔だけはここで扱う。**背景に顔を入れない規則はそのまま生きている**(人物が写った写真は背景スロットに使えない)——顔が入るのは `guests[n].photo` だけ。

同じ1枚が2通りに使われる:

- **円形メダリオン** — `focus` 点が円の中心。顔は中央〜やや上
- **全画面分割パネル**(`presentation: "panels"`)— 2人なら **960×1080** の縦長。上半身のみ

だから **`--ar 4:5`**(両方にクロップできる)。**照明句は背景と同じ**——分割パネルで隣同士に並ぶので揃えないと2枚が喧嘩する。

```
共通末尾:
--ar 4:5 --style raw --stylize 120 --no text, letters, logos, watermark,
name tags, lanyards, cartoon, illustration, 3d render
```

```
portrait-speaker-01
Editorial headshot of a Japanese man in his fifties in a dark navy suit without
a tie, calm confident expression, looking directly at the camera, upper body,
single warm key light from the upper right, dark charcoal background falling
into shadow, shallow depth of field, natural skin texture, photorealistic [共通]
```

```
portrait-speaker-02
Editorial headshot of a Japanese woman in her forties in a charcoal blazer,
composed warm expression, looking directly at the camera, upper body, single
warm key light from the upper right, dark charcoal background falling into
shadow, shallow depth of field, natural skin texture, photorealistic [共通]
```

```
portrait-speaker-03
Editorial headshot of a Japanese man in his thirties in a white open-collar
shirt, relaxed attentive expression, looking directly at the camera, upper
body, single warm key light from the upper right, dark charcoal background
falling into shadow, shallow depth of field, natural skin texture,
photorealistic [共通]
```

```
portrait-speaker-04
Editorial headshot of a Japanese woman in her sixties in a deep indigo jacket,
dignified calm expression, looking directly at the camera, upper body, single
warm key light from the upper right, dark charcoal background falling into
shadow, shallow depth of field, natural skin texture, photorealistic [共通]
```

**同じ人物の別カットが必要になったら `--cref <画像URL> --cw 100`。** 年齢・性別・服装をばらすのは意図的——4枚が同じ見た目だと、登壇者一覧が「同じ人が4回出ている」ように見える。

### 名前は付けない

生成した顔に**氏名を付けてはいけない。** [seed.ts](../lib/event-cm/seed.ts) の方針(「人名は発明しない・役割を提案する」)がここでも効く。デモでも**役割ラベル**(「ゲストスピーカー」「モデレーター」)のままにする。架空の顔に架空の氏名を添えると「存在しない人物のプロフィール」になり、[place-images.ts](../lib/event-cm/place-images.ts) が氏名の根拠で写真を割り当てる規則の意味も消える。

> **観測(2026-08-23)**: 役割ラベルのままだと、写真が無いときのモノグラムが `ゲストスピーカー` の頭一文字で **「ゲ」** になる。設計は「姓一文字の金縁モノグラム」なので、役割が入ると単語の切れ端に見える。実写真が入れば隠れるが、**素材ゼロの状態は残る**ので別途の判断が要る(残タスク)。

### 受け渡し

| プロンプト名 | 置き場所 |
| --- | --- |
| `still-*` | `public/defaults/stills/<name>.jpg` |
| `portrait-*` | `public/defaults/portraits/<name>.jpg` |

**無加工で置いてほしい。** トリミング・色調整・減光はテンプレート側の層(`ThemeBackdrop`)がやるので、二重にかかると戻せない。

## 8. 生成AIで作らないもの

**文字が要るものは生成AIで作らない。** Midjourney の文字は崩れ、崩れた文字は「デザインが荒い」ではなく**「読めない偽物」**に見える。

| 欲しいもの | 作り方 | 理由 |
| --- | --- | --- |
| **ダミーロゴ・マーク** | **コードでSVG** | 透過・鋭いエッジ・単色が要る。`treatment`(knockout/invert)は**測った輝度**で決まるのでラスタでは測れない。前例が2つある——LPのクライアントロゴウォール(8種のマーク+6種のワードマーク書体を名前ごとに割り当て、**画像を1枚も持たない**)と [public/defaults/marks/](../public/defaults/marks/gate.svg)（4種・2026-08-24 追加）。**インク面積スケール**([docs/asset-normalization.md §11.1](asset-normalization.md))も揃える必要がある |
| **架空のダッシュボード** | **コードでHTML/SVG** | 数値・ラベル・凡例が読めないと「ダッシュボード」に見えない |
| **架空の銀行口座画面** | **コードでHTML** | 金額と日付が読めることが全て。崩れた数字は不気味に見える |
| **デバイスモックアップ(サービスを映したもの)** | **既存の `deviceMockupHtml()`** | 「このサービスをPCとスマホに映したものを描く実装は1つだけ」という既存の規則([docs/device-mockup-fixes.md](device-mockup-fixes.md))。ここに写真を足すと2つ目の実装になる |

**Midjourney で作れるのは「デバイスが写っている実景写真」**。画面の中身は写さない(消灯・反射・角度で見せない)。b-roll としては有効で、要件は §5 の共通仕様に従う。

```
device-desk-laptop-01
An open laptop on a dark wooden desk seen from a low three-quarter angle, the
screen switched off and reflecting a warm window, a notebook and a ceramic cup
beside it, single warm key light from the left, dark charcoal background, deep
shadow filling the right third, shallow depth of field, no people, no visible
screen content, photorealistic, 16:9, negative space on the right
```

```
device-handheld-phone-01
A hand holding a smartphone at chest height, the screen switched off and
catching one warm reflection, a blurred dark interior behind, face out of
frame, single warm key light from the left, dark charcoal background, deep
shadow filling the left third, shallow depth of field, no visible screen
content, photorealistic, 16:9, negative space on the left
```

## 9. 受け入れ確認

**目視ではなく実物で確認する。**

```bash
npm run themes:compare   # → var/theme-compare/<themeId>-<scene>.png
```

合格の条件(`sumi` で判定する。§2):

1. **`sumi` で写真が写真に見える**(平坦な黒板になっていない)
2. **文字が写真の細部を横切っていない**(コピー側の暗部が効いている)
3. **Ken Burns の終端で重要なものが切れていない**
4. **生成物に文字・看板・ロゴが写っていない**(架空の銘柄が写ると事実になる)
5. **背景写真に顔が入っていない**
6. **ポートレートが円形メダリオンと縦長パネルの両方で成立する**
7. **セット内で照明が揃っている**(連作にする場合)

`standard` の見え方は**この段階では合否に使わない**——テーマ側が未完成なので、素材で埋め合わせるとどちらが原因か分からなくなる。

## 10. 残っていること

- **カタログへの登録**。ファイルが揃ってから `DEFAULT_ASSETS` に `still` / `portrait` エントリを足し、`defaultVisuals` で event-cm が名指しする。**先に登録すると、実体の無いファイルを指した瞬間に Remotion がレンダーを止める**(これは正しい挙動)
- **`portrait` / `mark` / `device` は `ASSET_KINDS` にまだ無い**。`still` は既にある
- **`marks/` と `devices/`(UI)のコード実装**(§6)。ディレクトリだけ作ってある
- **`standard` を納品水準にする**。素材を作っても standard は埋まらない(§2)。テーマ側の作業
- **sake-2026 のブリーフをデモ素材に向け替えるか**は別判断。実案件3本が乗っているので、既定プールを埋めることと実案件のブリーフを書き換えることは分けて考える
