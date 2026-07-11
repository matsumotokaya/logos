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

## 実験一覧

| # | 名前 | カテゴリ | 技術 | 状態 |
|---|------|---------|------|------|
| 001 | Classic Reveal(基準器) | Reveal | gsap, svg | ✅ 実装済み |
| 002 | Mask Wipe | Reveal | gsap, css | ✅ 実装済み |
| 003 | Blur Focus | Reveal | gsap, css | ✅ 実装済み |
| 004 | Path Stagger | Reveal | gsap, svg | 予定 |
| 005 | Particle Assemble | Reveal | canvas | 予定 |
| 006 | Gradient Sweep | 質感 | gsap, svg | 予定 |
| 007 | Emboss / Long Shadow | 質感 | svg, css | 予定 |
| 008 | Breathing | 常駐ループ | gsap | 予定 |
| 009 | Ambient Background | 常駐ループ | css, canvas | 予定 |
| 010 | Guideline Reveal | プレゼンテーション | gsap, svg | 予定 |
| 011 | Lockup Variations | プレゼンテーション | gsap, svg | 予定 |
| 012 | Extrude Turntable | 3D | three | 予定 |
| 013 | Material Study | 3D | three | 予定 |
| 014 | Gallery Space | 3D | three | 予定 |
| 015 | Lottie 往復検証 | 書き出し検証 | lottie | 予定 |
| 016 | 動画書き出しフック | 書き出し検証 | canvas | 予定(インターフェースのみ) |

実験を追加したらこの表を更新すること。001が基準器であり、以後の実験はすべて001と見比べて評価する。

## 組み合わせ検証(v2)

シーケンス再生(実験A→B)と合成(背景系+ロゴ系の重ね)は v2 で実装予定。
