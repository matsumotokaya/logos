# Labs — 表現R&Dの研究所群

このプロダクトの勝負どころは**最初の体験**——アップロードされたロゴが立派に見えること——にある。「AIがあれば何でもできる」時代に、動くだけでは驚きにならない。**自分の作ったロゴの価値がプレゼンテーションされる**という実用価値こそが差別化であり、それを作るための研究開発を、独立したラボ群として運用する。

`/labs` で研究所インデックスを開く(noindex)。カタログの正本は [directory.ts](directory.ts)。

## 共通の判断基準

**「ロゴが立派に見えるか」**。派手なエフェクトでロゴが埋もれる表現は失敗。静かでもロゴの造形が際立つ表現が成功。全ラボ・全実験がこの基準に従う。

## 体験のレイヤー = コストと課金の階段

技術の階層は、そのままコスト・希少性・課金の階段になっている。下層は限界費用ゼロで全員に配り、上層は重課金で提供する。

| レイヤー | 内容 | 担当ラボ | 課金 |
|---|---|---|---|
| 1 | 静的: 高品質ガイドラインテンプレートへのロゴ配置 | 本体プレゼン + Motion Lab(010) | 無料 |
| 2 | SVG/3Dモーション(輪郭線ドロー等、アルゴリズムで実行) | **Motion Lab** | 無料 |
| 2.5 | 非生成AIの高品質合成(Blender/Photoshopをサーバーで回す) | **Workflow Lab** | 低〜中 |
| 3 | 生成AIハーネス(看板・プロダクトへのロゴ配置画像) | **Image Lab** | 中 |
| 4 | ショートビデオ 5〜10秒(Seedance/Veo/Higgsfield等) | **Video Lab** | 高(無料キャンペーンは原価計算前提) |
| 5 | 30秒プロモビデオ(蓄積素材のテンプレート合成) | **Video Lab** | 最重課金 |

## 研究所一覧

| ラボ | URL | 状態 | テーマ |
|---|---|---|---|
| [Motion Lab](motion/README.md) | `/labs/motion` | ✅ 稼働中(16実験) | SVG・CSS・Canvas・Three.js・Lottie によるアルゴリズム表現 |
| Image Lab | `/labs/image` | 準備中 | ロゴを崩さないハーネス付き画像生成(Ideogram/Recraft/Flux ControlNet/後段レイヤー合成) |
| Video Lab | `/labs/video` | 準備中 | ショートビデオAPI比較+30秒プロモの組み立てパイプライン(Remotion等) |
| Workflow Lab | `/labs/workflow` | 準備中 | Figma・ヘッドレスBlender・Photoshop API連携のモックアップ自動合成 |

準備中ラボの研究対象・調査モジュール(ディープリサーチ計画)は各ページ(`/labs/<slug>`)と [directory.ts](directory.ts) に記載。

## ディレクトリ構成

```
labs/
  README.md          # このファイル(研究所群の全体像)
  directory.ts       # 研究所カタログの正本(名前・状態・研究範囲・調査モジュール)
  motion/            # Motion Lab 本体(core / experiments / components)
  <slug>/            # 新しいラボはここに独立したディレクトリを作る
app/labs/page.tsx        # 研究所インデックス
app/labs/motion/page.tsx # 稼働中ラボの薄いルート
app/labs/[slug]/page.tsx # 準備中ラボのプレースホルダーページ
app/lab/page.tsx         # 旧URL → /labs/motion リダイレクト
```

新しいラボを稼働させる手順: `labs/<slug>/` にコードを置き、`app/labs/<slug>/page.tsx` の薄いルートを追加(静的ルートがプレースホルダーより優先される)、[directory.ts](directory.ts) の `status` を `"active"` に変える。

## 導線

ヘッダーのアカウントメニュー(アバター)から **管理コンソール(/admin)** と **Labs(/labs)** に入れる(本登録ユーザーのみ表示)。
