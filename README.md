# logos(仮称)

SVGロゴを1つアップロードすると、Behance品質のブランドプレゼンテーションがゼロタッチで生成されるサービスのPoC。

サービス名は仮。[lib/config.ts](lib/config.ts) の `SERVICE_NAME` を変更すれば全体に反映される。

事業構想・ビジネスモデルは [PRODUCT.md](PRODUCT.md) を参照。

## 生成されるシーン(`/`)

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
| 08 | Merch | Tシャツへのmultiply合成(コードベースの精密配置) |
| 09 | Generated | Gemini API(Nano Banana)によるマグカップ/トート/キャップの写実モックアップ生成 |

ロゴが手元になくても、ランディングの「View the sample presentation」でサンプルを確認できる。

## 管理コンソール(`/admin`)

白ベースのビジネスSaaS風ダッシュボード。KPI(登録ロゴ数・在庫アイテム数・要発注アイテム数・入荷待ち発注)、会社情報編集、登録ロゴの一覧・役割設定・削除、ロゴアイテムの在庫管理と発注(ダミーデータ)を表示する。ビジネスモデル(フェーズ3の物販事業)を体現する画面。

## アーキテクチャ

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- ロゴ解析は**全てクライアントサイド**(サーバー・DB不要)。アップロードされたSVGは外部送信されない
  - [lib/svg.ts](lib/svg.ts) — SVG正規化・計算済みスタイルの属性焼き込み・色抽出・単色変換・アウトライン化
  - [lib/paths.ts](lib/paths.ts) — path `d` 属性のパーサ(ベジェ骨格抽出)
  - [lib/color.ts](lib/color.ts) — HEX/RGB/CMYK変換・輝度判定
  - [lib/raster.ts](lib/raster.ts) — SVG→PNGラスタライズ(生成AIへの入力用)
- シーンは [components/scenes/](components/scenes/) にプラグイン式で追加できる
- 写実モックアップ生成は [app/api/generate/route.ts](app/api/generate/route.ts) が Gemini API を呼び出すサーバーサイドルート(APIキーを隠すため)
- データ永続化は [lib/store/](lib/store/) の `BrandRepo` インターフェースで抽象化。現在は localStorage 実装([lib/store/local.ts](lib/store/local.ts))だが、実DB(Supabase等)への移行はこのインターフェースを実装するだけで済む

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

生成AIモックアップ(シーン09)を試すには `.env.local` に以下を設定して再起動する:

```
GEMINI_API_KEY=（Google AI Studioで発行したキー、課金有効なプロジェクトのもの）
```

Vercelにデプロイする場合は同じ環境変数を Settings → Environment Variables に追加する。

## 制約(PoC段階)

- 入力はSVGのみ。PNG/AI対応はロードマップ上(一般普及には必須)
- 発注ボタンはlocalStorageに記録するのみで、実際の物品発注には連携していない
- 会社・ユーザーごとのデータ分離やログインはまだない(単一ブラウザのlocalStorageのみ)

## デプロイ

Vercelにリポジトリを接続(プリセット: Next.js)。将来のCDN配信は Cloudflare R2 + Workers を想定。
