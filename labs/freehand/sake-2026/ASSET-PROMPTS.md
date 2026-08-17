# 写真の生成プロンプト(英語)

商用利用可の生成AIで作る前提。**この映像の要件から逆算した仕様**なので、プロンプト本文より先に下の3つを守ってほしい。

## 全カット共通の要件

1. **16:9・横位置・最低1920×1080**(できれば2560×1440以上。寄り引きのカメラムーブで最大1.7倍まで拡大するため)
2. **片側3〜4割を「何も起きていない暗部」にする**。文字がそこに乗る。プロンプト末尾の `negative space on the left/right` は削らないこと
3. **文字・ロゴ・透かしを画面に入れない**。日本語の看板や品名ラベルも不可(架空の銘柄が写ると事実になってしまう)

**顔は入れない**(登壇者2名の実写があるため)。背景に人が要る場合は `hands only` `back of head, out of focus` のように顔を避ける。v1で登壇者写真を背景に流用して失敗した理由がこれで、**人物が写った写真は背景スロットに使えない**。

共通ネガティブ:

```
text, letters, watermark, logo, signage, label, caption, cartoon, illustration,
3d render, plastic look, oversaturated, harsh flash, cluttered background,
faces, portrait, people looking at camera, extra fingers, deformed hands
```

---

## 1. タイトル / 冒頭のヒーロー(最優先)

用途: タイトルシーンの地。縦書きタイトルが右3割に乗るので、**右側を暗く**。

```
Cinematic close-up of clear sake being poured from a ceramic tokkuri into a
crystal glass set inside a pale hinoki masu box, overflowing slightly onto a
black lacquer tray. Shot on 85mm at f/1.8, shallow depth of field, single warm
key light from the left, deep shadow filling the right third of the frame,
dark charcoal background, subtle warm amber highlights in the liquid, fine
condensation on the glass, moody Japanese ryotei atmosphere, photorealistic,
16:9, negative space on the right
```

## 2. テーマ(価値)のヒーロー

用途: 3行のコピーが左半分に乗る。**左を暗く**。

```
Overhead three-quarter view of a hinoki masu box filled to the brim with sake,
a single drop falling and forming concentric ripples on the surface, indigo
shibori textile underneath, black lacquer tray, warm low-key lighting from the
upper right, deep shadows on the left half of the frame, macro detail on the
wood grain and the meniscus, photorealistic still life, 16:9, negative space
on the left
```

## 3. アジェンダ壱 — テイスティング(5種)

用途: 「蔵出しの特別な日本酒5種類」を絵で言う。今は同じ注ぎの写真の使い回しなので、**ここが最も効く1枚**。

```
A row of five identical tasting glasses on a dark wooden counter, each holding
a different shade of sake from pale straw to deep amber, lit from behind so the
liquid glows, small white ceramic sake cups beside them, shallow depth of field
with the nearest glass sharp and the row falling out of focus, warm tungsten
light, near-black background, editorial food photography, 16:9, negative space
on the left
```

## 4. アジェンダ弐 — トークセッション(酒蔵)

用途: 蔵の空気。**人物は入れない**(登壇者は別シーンで顔を出す)。

```
Interior of a traditional Japanese sake brewery at dusk, tall cedar fermentation
tanks receding into darkness, a single shaft of light from a high window
catching dust in the air, worn wooden beams and rope, indigo noren curtain
hanging still in the foreground right, no people, deep shadows, warm amber
highlights, cinematic wide shot, photorealistic, 16:9, negative space on the
right
```

## 5. アジェンダ参 — ワークショップ(手元)

用途: 学ぶ場面。**手だけ**。

```
Close-up of two pairs of hands at a tasting table, one holding a small ceramic
ochoko up to the light, the other writing on a tasting sheet with a pencil,
five glasses of sake blurred in the background, warm low-key lighting, dark
walnut table, no faces visible, shallow depth of field, documentary style,
photorealistic, 16:9, negative space on the left
```

## 6. CTA / 会場(中野坂上のボードルーム)

用途: 締め。日時・申込が左に乗る。現在は「男性が枡の香りを確かめる」写真で、意味は合っているが会場は伝わらない。

```
An intimate private tasting room prepared for a small evening event, a long
dark table set with rows of tasting glasses and white ceramic cups, warm
pendant lights above, floor-to-ceiling window with a blurred Tokyo cityscape at
blue hour beyond, empty chairs, no people, calm and expensive, deep shadows in
the left third, cinematic interior photography, 16:9, negative space on the left
```

## 7. 秋(10月開催)

用途: 季節を1カットだけ差す。冒頭かCTAの地。

```
Japanese autumn still life at night: a few crimson momiji maple leaves resting
on a wet black stone surface beside a ceramic sake flask, backlit by a warm
paper lantern far out of focus, drops of water on the leaves, deep black
background, moody and restrained, macro photography, photorealistic, 16:9,
negative space on the right
```

## 8. オープニング/エンドカードの地(任意)

用途: 今は墨の無地+金の粒子。テクスチャが欲しければ。

```
Abstract macro of black sumi ink diffusing slowly into clear water, faint gold
particles suspended, pure black background, no objects, high contrast,
minimal, cinematic, photorealistic, 16:9
```

---

# 動画の生成プロンプト(英語)

写真と同じ番号・同じ用途で並べてある。**同じスロットに写真と動画の両方が揃ったら動画を採る。**

## 動画だけの追加要件(写真の3つに加えて)

4. **カメラをほとんど止める。** この映像は静止画にもゆっくりした寄り引き(最大1.7倍)を自分でかけている。素材側でも同じことをすると**二重に動いて酔う**。プロンプトには `locked-off camera` か、動かすとしても `almost imperceptible slow push in` までにする。パン・チルト・ドリー・ハンドヘルドは指定しない
5. **動くのは被写体だけ。** 液体、湯気、埃、揺れる暖簾、光のゆらぎ。「何かが起きて終わる」のではなく「ずっと起きている」状態を頼む——シーンは13秒あり、素材は5〜10秒なので**ループさせる**
6. **尺5〜10秒・24fps以上・1080p以上**(可能なら4K。寄りで使う)
7. **音声は捨てる。** Veo 3のように音の付く生成AIでも使わない(BGMとナレーションとSFXで設計済み)。生成時にオフにできるならオフに
8. **ループ前提のものは `seamless loop, first and last frame identical` を付ける**(効くAIと効かないAIがあるが、効かなくてもクロスフェードでこちらが繋ぐ)

動画共通ネガティブ:

```
text, letters, watermark, logo, subtitles, camera shake, handheld, fast cut,
zoom, whip pan, morphing objects, warping hands, faces, people looking at
camera, cartoon, 3d render, oversaturated, strobing, flickering
```

---

## V1. タイトル / 冒頭のヒーロー(最優先)

**これが1本目に作るべき素材。** 冒頭の注ぎが実際に動くだけで、映像全体の格が変わる。

```
Slow motion macro shot, locked-off camera. Clear sake pours in a thin steady
stream from a ceramic tokkuri into a crystal glass seated in a pale hinoki masu
box, the liquid rising and beginning to overflow onto a black lacquer tray.
Bubbles rise and burst on the surface. Single warm key light from the left, the
right third of the frame falling into deep shadow, dark charcoal background.
Shot at 120fps, shallow depth of field, 85mm lens look, photorealistic,
cinematic, no camera movement, negative space on the right
```

## V2. テーマ(価値)

```
Extreme close-up, locked-off camera. A single drop of sake falls onto the still
surface of a hinoki masu box filled to the brim, sending slow concentric ripples
outward, then another drop, endlessly. Indigo shibori textile and black lacquer
tray beneath. Warm low-key light from the upper right, deep shadow across the
left half. Slow motion, macro, photorealistic, no camera movement, seamless
loop, first and last frame identical, negative space on the left
```

## V3. アジェンダ壱 — テイスティング(5種)

**素材の効き目は写真版より大きい**(「5種類」を動きで見せられる)。手だけ。

```
Locked-off camera. Five identical tasting glasses stand in a row on a dark
wooden counter, each holding a different shade of sake from pale straw to deep
amber, backlit so the liquid glows. A hand enters from the right and sets down
the fifth glass, then withdraws. The liquid settles. Warm tungsten light,
near-black background, shallow depth of field, no faces, photorealistic,
cinematic, no camera movement, negative space on the left
```

## V4. アジェンダ弐 — 酒蔵

**人を入れない。** 動くのは埃と暖簾だけ。

```
Locked-off wide shot. Interior of a traditional Japanese sake brewery at dusk.
Tall cedar fermentation tanks recede into darkness. A single shaft of light
falls from a high window, dust motes drifting slowly through it. An indigo noren
curtain in the right foreground sways very slightly in a draught. No people.
Deep shadows, warm amber highlights, cinematic, photorealistic, no camera
movement, seamless loop, negative space on the right
```

## V5. アジェンダ参 — ワークショップ(手元)

```
Locked-off close-up. Two pairs of hands at a tasting table: one lifts a small
ceramic ochoko toward the light and turns it slowly to look at the sake, the
other writes on a tasting sheet with a pencil. Five glasses blurred in the
background. Warm low-key light, dark walnut table, no faces visible, shallow
depth of field, documentary style, photorealistic, no camera movement, negative
space on the left
```

## V6. CTA / 会場

```
Locked-off interior shot. An intimate private tasting room prepared for a small
evening event: a long dark table set with rows of tasting glasses, warm pendant
lights above swaying almost imperceptibly, a floor-to-ceiling window with a
blurred Tokyo cityscape at blue hour where distant lights twinkle. Empty chairs,
no people. Deep shadow across the left third. Cinematic interior cinematography,
photorealistic, no camera movement, negative space on the left
```

## V7. 秋(10月開催)

```
Locked-off macro shot at night. A few crimson momiji maple leaves rest on wet
black stone beside a ceramic sake flask. Water drips slowly onto the stone,
beading and running. A warm paper lantern flickers far out of focus behind.
Deep black background, moody and restrained, slow motion, photorealistic, no
camera movement, seamless loop, negative space on the right
```

## V8. オープニング/エンドカードの地

**ループ必須。** 冒頭4秒と末尾4秒の両方に使い、金の粒子と重ねる。

```
Abstract macro. Black sumi ink diffuses slowly through clear water in soft
tendrils, faint gold particles suspended and drifting upward. Pure black
background, no objects, no hands. High contrast, minimal, slow motion,
photorealistic, locked-off camera, seamless loop, first and last frame identical
```

---

## 作ったあとの受け渡し

`labs/freehand/sake-2026/public/assets/video/` へ **V番号の名前**(`v1-pour.mp4` 等)で置いてもらえれば、こちらで尺合わせ・ループ点の処理・減光を入れて組み込む。**元ファイルは無加工のまま**渡してほしい(トリミングや色調整はこちらの層でやるので、二重にかかると戻せない)。
