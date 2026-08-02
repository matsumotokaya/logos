# ベータローンチ準備計画(マイルストーン正本)

最終更新: 2026-07-19

このドキュメントは**ベータ公開を妨げる未完了作業の正本**。完了済み作業の履歴は並べず、現在の基盤状態と残作業だけを管理する。機能ロードマップは各機能の正本に従う。

## 現在の基盤

| 領域 | 現在地 |
|---|---|
| プロダクト | SVGアップロード、10シーンのプレゼン、編集・保存、Brand Manager、正本編集、組織、公開ギャラリー、Labsが動作 |
| アカウント | アップロード前に本登録必須。メール認証UI、組織招待、所有移管、退会UI/APIを実装 |
| 権限 | 組織ロール、プラットフォームロール、ロゴ単位共有を分離。RLSとAPIゲートを実装 |
| データ | Supabase migration `0001`〜`0020`をリモートへ適用済み。生成画像はprivateなR2と署名URLで配信 |
| セキュリティ | 生成クォータ、API認可、SVGサニタイズ、visibility強制、Security Advisor対応を実装・確認済み |
| 未整備 | 法務、課金、テスト/CI、監視、分析、ベータ運用設定 |

## M0 — 公開条件

- [x] 無料・招待またはウェイトリスト制のクローズドベータとする
- [x] ロゴアップロードと有料AI生成は登録ユーザーだけに許可する
- [x] Labsは組織管理者ではなく`platform_admin`/`labs_member`だけに公開する
- [ ] 発注UIを「Coming soon」化するか、ベータでは非表示にする
- [ ] サービス名とドメインを確定する
- [ ] 招待制またはウェイトリストの実装方式を確定する

## M1 — セキュリティと本番設定

- [ ] Vercel WAFまたは分散ストアを使った本番レート制限を導入する。現行のWorkflow compose制限はプロセス内のみ
- [ ] APIリクエストボディの型・サイズ検証を共通化する。base64画像とSVGを優先する
- [ ] Cloudflare DashboardでR2の`r2.dev`/公開custom domainが無効、CORSが空であることを確認する
- [ ] Supabase DashboardでLeaked Password Protectionを有効化する
- [ ] 本番環境に`MOCKUP_URL_SECRET`、`LABS_OUTPUT_URL_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`などserver-only環境変数を設定し、クライアントbundleへ露出しないことを確認する
- [ ] Next.js更新時に`npm audit`を再実行する。現状のmoderate 1件は同梱PostCSS由来で上流修正待ち

## M2 — 会員ライフサイクル

- [ ] 退会の破壊的E2Eをテスト用アカウントで実施する。個人ロゴ、R2成果物、単独組織、共同組織、最後のowner拒否を確認する
- [ ] R2削除失敗時の`private.r2_deletion_queue`再処理手順を用意する
- [ ] Confirm email方針、パスワードリセット、カスタムSMTPを設定・確認する
- [ ] `/settings`のプロフィール編集を実装する
- [ ] 登録済み/未登録メールからロゴ共有権限への自動変換をE2Eで検証する
- [ ] ロゴ単位共有の招待・付与・解除UIを実装する
- [ ] Brand Managerで組織を明示作成・選択できるようにし、最初の所属組織への暗黙固定を廃止する
- [ ] アップロードを持たない匿名セッション行を掃除する保持期間と定期処理を決める

## M3 — 法務と信頼

- [ ] `/privacy`を作成する。メール、ロゴ、生成物とGoogle Gemini、Together/Recraft、Cloudflare、Supabase、Vercelへのデータ送信を明示する
- [ ] `/terms`を作成する。アップロード権利、商標、公開図鑑、ベータ無保証を定める
- [ ] LPの「ブラウザ内で完結」を構造解析に限定し、生成AI実行時の外部送信を明示する
- [ ] フッターから法務ページへリンクする。日本語・英語を先行してよい
- [ ] 公開ロゴのテイクダウン窓口を設ける
- [ ] Cookie/アナリティクス方針を決める
- [ ] 課金開始までに特商法表記を用意する

## M4 — 課金(正式版向け)

- [ ] Free / Proのロゴ数、生成回数、組織人数、CDN、公開ページ機能を決める
- [ ] entitlementと既存`generation_events`クォータを統合する
- [ ] Stripe Checkout、Customer Portal、Webhookを実装する
- [ ] Brand Managerへプラン表示とアップグレード導線を追加する
- [ ] Stripe test modeで契約・変更・解約・失敗を通し確認する

課金はクローズドベータ公開のブロッカーにしない。

## M5 — 品質とCI

- [ ] Vitest等のテスト基盤を導入し、`lib/svg.ts`、`lib/paths.ts`、`lib/color.ts`、権限判定からカバーする
- [ ] GitHub Actionsでlint、typecheck、test、buildをPR必須にする
- [ ] APIの認証、エラー応答、入力検証を共通化する
- [ ] `lib/store/supabase.ts`をlogo、org、presentation、registryへ分割する
- [ ] 旧ルート`/lab`、`/labs/image`、`/brand/logos/[id]`の維持期限を決める

## M6 — 運用

- [ ] Sentry等でフロントとAPIのエラーを監視する
- [ ] プライバシー方針に沿った分析基盤と主要ファネルを実装する
- [ ] Vercelのpreview/production分離、独自ドメイン、環境変数を整備する
- [ ] Supabaseバックアップ/PITRとR2ライフサイクルを確認する
- [ ] OGP、`robots.txt`、Labs noindex、404/エラーページを整備する
- [ ] 生成AIの使用量と費用アラートを設定する

## M7 — 公開前通し確認

- [ ] SVGのみ対応であることをUIに明記する
- [ ] 初回サインアップ→アップロード→プレゼン→編集→共有を通し確認する
- [ ] サンプルプレゼン`/p/sample`を最終確認する
- [ ] 5言語とモバイル表示を全主要ページで確認する
- [ ] フィードバック導線を設ける
- [ ] 本番で匿名ユーザーがアップロードできず、未権限ユーザーがLabsを見られないことを確認する

## ポストベータ

PNG/AI入力、実発注、汎用ロゴCDN、Apple/Figma OAuth、個人ハンドル、図鑑検索、ランタイムassetの永続ワーカー化はベータ公開後に扱う。ランタイムassetは [logo-entity-lab-integration.md](logo-entity-lab-integration.md) を参照。
