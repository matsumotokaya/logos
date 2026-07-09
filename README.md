# logos(仮称)

SVGロゴを1つアップロードすると、Behance品質のブランドプレゼンテーションがゼロタッチで生成されるサービスのPoC。

サービス名は仮。[lib/config.ts](lib/config.ts) の `SERVICE_NAME` を変更すれば全体に反映される。

## 生成されるシーン

| # | シーン | 内容 |
|---|--------|------|
| — | Hero | 巨大タイポ + ロゴマーク + メタ行 |
| 01 | Construction | ベジェのアンカー/ハンドルを実データから抽出して可視化 |
| 02 | Color | 面積加重で色を自動抽出し、HEX/RGB/CMYK付きカラーバンドに展開 |
| 03 | Logo usage | 配色パターングリッド(白地/ブランドカラー地/黒地/白抜き) |
| 04 | App icon | iOS風アイコンと配色バリエーション |
| 05 | Web | ブラウザクローム内ファビコン + 48/32/16pxサイズランプ |
| 06 | Social | 認証バッジ付きプロフィールカードのモックアップ |
| 07 | On-site | ラニヤード付き社員証モックアップ |

## アーキテクチャ

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- ロゴ解析は**全てクライアントサイド**(サーバー・DB不要)。アップロードされたSVGは外部送信されない
  - [lib/svg.ts](lib/svg.ts) — SVG正規化・計算済みスタイルの属性焼き込み・色抽出・単色変換・アウトライン化
  - [lib/paths.ts](lib/paths.ts) — path `d` 属性のパーサ(ベジェ骨格抽出)
  - [lib/color.ts](lib/color.ts) — HEX/RGB/CMYK変換・輝度判定
- シーンは [components/scenes/](components/scenes/) にプラグイン式で追加できる

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

ロゴが手元になくても、ランディングの「View the sample presentation」でサンプルを確認できる。

## 制約(PoC段階)

- 入力はSVGのみ。PNG/AI対応はロードマップ上(一般普及には必須)
- フォトリアル系モックアップ(看板・ラニヤード実写等)は次フェーズで生成AIを利用予定
- データの永続化なし(リロードで消える)

## デプロイ

Vercelにリポジトリを接続(プリセット: Next.js、環境変数なし)。将来のCDN配信は Cloudflare R2 + Workers を想定。
