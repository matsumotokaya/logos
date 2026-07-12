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
| 2.5 | 非生成AIの高品質合成(2Dテンプレート合成は**Image Lab**で稼働、Blender/PhotoshopはWorkflow Lab) | **Image Lab** / Workflow Lab | 低〜中(無料体験の画像セットはここで変動費ゼロ成立) |
| 3 | 生成AIハーネス(舞台だけAI生成、ロゴは決定論的合成) | **Image Lab** | 中 |
| 4 | ショートビデオ 5〜10秒(Seedance/Veo/Higgsfield等) | **Video Lab** | 高(無料キャンペーンは原価計算前提) |
| 5 | 30秒プロモビデオ(蓄積素材のテンプレート合成) | **Video Lab** | 最重課金 |

## 現在地と次の一手

- ✅ **Motion Lab**: 全16実験が実装済み(2026-07-12時点)。残タスクは採用判断(星評価・研究ノートの記入)と、採用実験の本体プレゼンへの移植、組み合わせ検証(v2)
- ✅ **Image Lab**: ディープリサーチ完了 → 開発要件書として確定(正本: [image/README.md](image/README.md))。**Phase 1(2Dテンプレートフォーマット+決定論的合成エンジン+テンプレート3種+原価計測)が稼働中**(2026-07-12)。大原則は「舞台はAIで生成し、ロゴは決定論的に合成する」。次はテンプレート拡充と採用判断、その先に Phase 2(QAゲート+Blenderワーカー)/ Phase 3(Recraft統合)
- その後: Video Lab(ショートビデオAPI実測=課金設計の数字の根拠づくり)、Workflow Lab(プロツール連携。ヘッドレスBlenderは Image Lab Phase 2 と合流)

## 研究所一覧

| ラボ | URL | 状態 | テーマ |
|---|---|---|---|
| [Motion Lab](motion/README.md) | `/labs/motion` | ✅ 稼働中(16実験) | SVG・CSS・Canvas・Three.js・Lottie によるアルゴリズム表現 |
| [Image Lab](image/README.md) | `/labs/image` | ✅ 稼働中(Phase 1) | ブランドビジュアル生成パイプライン(テンプレート+決定論的合成、Phase 3で舞台生成AI) |
| Video Lab | `/labs/video` | 準備中 | ショートビデオAPI比較+30秒プロモの組み立てパイプライン(Remotion等) |
| Workflow Lab | `/labs/workflow` | 準備中 | Figma・ヘッドレスBlender・Photoshop API連携のモックアップ自動合成 |

準備中ラボの研究対象・調査モジュール(ディープリサーチ計画)は各ページ(`/labs/<slug>`)と [directory.ts](directory.ts) に記載。

## ディレクトリ構成

```
labs/
  README.md          # このファイル(研究所群の全体像)
  directory.ts       # 研究所カタログの正本(名前・状態・研究範囲・調査モジュール)
  motion/            # Motion Lab 本体(core / experiments / components)
  image/             # Image Lab 本体(core / engine / templates / components)
  <slug>/            # 新しいラボはここに独立したディレクトリを作る
app/labs/page.tsx        # 研究所インデックス
app/labs/motion/page.tsx # 稼働中ラボの薄いルート(image も同様)
app/labs/[slug]/page.tsx # 準備中ラボのプレースホルダーページ
app/lab/page.tsx         # 旧URL → /labs/motion リダイレクト
app/api/labs/image/*     # Image Lab の合成API(templates / compose / jobs)
```

ロゴレジストリ(選択ロゴ・アップロード)と研究ノート(星評価)は Motion Lab の `core/logo-store.ts` / `core/notes-store.ts` を全ラボの共有インフラとして使う(選んだロゴがラボ間で引き継がれるのは仕様)。

新しいラボを稼働させる手順: `labs/<slug>/` にコードを置き、`app/labs/<slug>/page.tsx` の薄いルートを追加(静的ルートがプレースホルダーより優先される)、[directory.ts](directory.ts) の `status` を `"active"` に変える。

## 導線

ヘッダーのアカウントメニュー(アバター)から **管理コンソール(/admin)** と **Labs(/labs)** に入れる(本登録ユーザーのみ表示)。
