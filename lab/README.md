# Logo Motion Lab

ロゴのモーション表現・視覚表現の**研究開発ラボ**。プロダクション機能ではなくサンドボックス。`/lab` で開く(noindex)。

## 判断基準(最重要)

探しているのは「動いていてすごい」ではない。**「ロゴが立派に見える」「ロゴデザインの価値がプレゼンテーションされる」動き**である。派手なエフェクトでロゴが埋もれる表現は失敗。静かでもロゴの造形が際立つ表現が成功。すべての実装判断はこの基準に従う。

## 使い方

- 上部のロゴレールでロゴを切り替えると**全実験に即時反映**される(ここが核心機能)
- ダミーロゴ3種(シンボル型 Halo / ワードマーク型 MONO / 複合型 Kite)同梱。SVG/PNGのアップロード可(localStorageに保存、外部送信なし)
- カードはホバーで再生、クリックで全画面プレビュー(再生/一時停止/リプレイ)
- 全画面プレビューの「研究ノート」に星評価とメモを記録できる(localStorage)。採用判断のログとして使う

## アーキテクチャ

```
lab/
  core/
    experiment-api.ts   # 実験の共通インターフェース(ExperimentProps / ExperimentMeta)
    svg-utils.ts        # 前処理(本体 lib/svg.ts の analyzeSvg を再利用)+ マウント/計測ヘルパ
    dummy-logos.ts      # 同梱テストロゴ3種
    logo-store.ts       # ロゴの登録・選択(localStorage、アップロードは再解析される)
    notes-store.ts      # 星評価・メモ(localStorage)
  experiments/
    registry.ts         # カタログ(実装済みは遅延ロード、未実装はメタのみ)
    001-classic-reveal/
      index.tsx         # 実験本体(1ファイル完結が原則)
      meta.ts
  components/           # カタログUI(LabApp / LogoRail / Card / Modal)
app/lab/page.tsx        # 薄いルート(本体への影響はこの1ファイルの追加のみ)
```

- 実験は `ExperimentProps`(前処理済みロゴ + `playing` + `replayNonce`)を受け取る1コンポーネント。**コア実装は1ファイル完結**を原則とし、本体へそのまま移植できる形を保つ
- SVG前処理は本体の `lib/svg.ts`(`analyzeSvg`)を読み取り専用で再利用。本番と同じ前処理を通ることが移植性の担保
- 重い依存(three / lottie-web)は該当実験の実装時に追加し、実験単位で遅延ロードする

## 美的原則(実装ガードレール)

1. **ロゴを歪めない**(スケールは常に等比)
2. **イージングが品質の8割**(linear禁止。カスタムcubic-bezierを調整し `meta.easing` に記録)
3. **色はロゴ抽出パレット+無彩色のみ**
4. **クリアスペースを侵さない**(キャンバス内62%ボックスが基準)
5. 尺: 出現系 1.5〜3秒、常駐ループ 10秒以上

## 使用技術と選定理由

このラボの表現は大きく「**プログラマティック(コードで実行時生成)**」と「**プリレンダー(制作物を再生)**」の2系統に分かれる。ラボの要件は「任意にアップロードされたロゴへ自動適用する」ことなので、**主軸はプログラマティック**(gsap / three / Canvas / CSS)。Lottieはその外側の互換性検証という位置づけ。

| 技術 | パッケージ | ラボでの用途 | 使っている実験 |
|---|---|---|---|
| **GSAP** | `gsap` | タイムライン制御・カスタムイージング・stagger・yoyoループ。ラボの主軸。 | 001-004, 006-011 |
| **Canvas 2D** | (標準API) | ピクセル単位の描画(粒子・ラスタライズ)。GSAPでは扱えない大量要素向け。 | 005 |
| **CSS** | (標準) | mask / filter / gradient など GPU 合成で軽いエフェクト。GSAPが値を駆動。 | 002, 003, 006, 007, 009 |
| **Three.js (R3F)** | `three` + `@react-three/fiber` + `@react-three/drei` | 3D(押し出し・マテリアル・空間)。SVGパスを `ExtrudeGeometry` で立体化。 | 012-014 |
| **Lottie** | `lottie-web`(015で導入予定) | **書き出し互換の検証のみ**(下記)。 | 015 |

### Framer Motion(`motion`)について

**本体アプリでは使用している**(`components/Landing.tsx` と `components/scenes/Reveal.tsx` の scroll-in reveal)。ただし**このラボの実験では一切使っていない**。理由は、ラボの表現が「タイムラインを厳密に組み、カスタムイージングで"止まりの余韻"まで作り込む」ものであり、複雑なシーケンス制御・stagger・SVGのstroke描画・3Dとの併用は **GSAP の方が適している**ため。Framer Motion は「Reactコンポーネントの状態遷移・スクロール連動」に強く、本体UIではそちらが最適。役割で使い分けている。

### Lottie との違い(なぜ主軸にしないか)

- **GSAP / Three.js / CSS = プログラマティック**。実行時にロゴのデータ(抽出パレット、パス数、viewBox、ベジェ骨格)を読み取って**動的にパラメータを生成**する。だから「どんなロゴが来ても自動で成立する」。このサービスの根幹要件に一致する。
- **Lottie = プリレンダー**。After Effects 等で作った固定アニメを JSON 化して `lottie-web` で再生する。デザイナーが作り込んだ**特定の**演出を忠実・軽量に再生できるが、**任意のロゴへ動的適用するのは不得手**(ロゴごとに制作が要る)。
- したがってラボは**プログラマティックを主軸**とし、Lottie は「代表的な実験を Lottie 形式に書き出して、他環境(Web/アプリ/計測タグ等)で忠実に再生できるか」を確かめる**互換性検証**(実験015)に限定する。動画(MP4/GIF)書き出しは実験016でインターフェースだけ用意する。

## 実験一覧

| # | 名前 | カテゴリ | 技術 | 状態 |
|---|------|---------|------|------|
| 001 | Classic Reveal(基準器) | Reveal | gsap, svg | ✅ 実装済み |
| 002 | Mask Wipe | Reveal | gsap, css | ✅ 実装済み |
| 003 | Blur Focus | Reveal | gsap, css | ✅ 実装済み |
| 004 | Path Stagger | Reveal | gsap, svg | ✅ 実装済み |
| 005 | Particle Assemble | Reveal | canvas | ✅ 実装済み |
| 006 | Gradient Sweep | 質感 | gsap, css | ✅ 実装済み |
| 007 | Emboss / Long Shadow | 質感 | gsap, css | ✅ 実装済み |
| 008 | Breathing | 常駐ループ | gsap | ✅ 実装済み |
| 009 | Ambient Background | 常駐ループ | gsap, css | ✅ 実装済み |
| 010 | Guideline Reveal | プレゼンテーション | gsap, svg | ✅ 実装済み |
| 011 | Lockup Variations | プレゼンテーション | gsap | ✅ 実装済み |
| 012 | Extrude Turntable | 3D | three | 予定 |
| 013 | Material Study | 3D | three | ✅ 実装済み |
| 014 | Gallery Space | 3D | three | ✅ 実装済み |
| 015 | Lottie 往復検証 | 書き出し検証 | lottie | 予定 |
| 016 | 動画書き出しフック | 書き出し検証 | canvas | 予定(インターフェースのみ) |

実験を追加したらこの表を更新すること。001が基準器であり、以後の実験はすべて001と見比べて評価する。

## 組み合わせ検証(v2)

シーケンス再生(実験A→B)と合成(背景系+ロゴ系の重ね)は v2 で実装予定。
