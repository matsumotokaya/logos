# Labs ↔ ロゴ正本エンティティ統合

最終更新: 2026-07-18
ステータス: **Workflow連携は実装済み・ランタイムBlenderは暫定手動運用。Generative連携と永続ワーカーは未完**

前提正本: [data-model.md](data-model.md)、[account-design.md](account-design.md)、[Workflow Lab README](../labs/workflow/README.md)

## 1. 統合原則

- homepage、Brand Manager、プレゼン、Labs、Blenderは同じ`logos`とprimary `logo_candidates`を参照する
- ロゴIDは対象を特定する情報であり、認証情報ではない。privateなSVGの取得やR2/DB書き込みには別途権限が必要
- Lab成果物は`presentation_asset_definitions`へ登録し、`draft`はLabsだけ、`production`はプレゼン編集の候補にも出す
- 利用者の採用状態は`logo-presentation` Takeの`brief.presentation.layout`、candidate×asset versionの実行状態は`logo_asset_runs`、現在の成功成果物は`logo_mockups`に分離する
- 同じ表現の改良版は、同じ`family_id`と新しい`definition_version`を持つ不変IDとして追加する

## 2. 現在地

| 領域 | 状態 |
|---|---|
| Labsのロゴ選択 | `BrandRepo`から閲覧可能な正本ロゴとprimary candidateを取得。Lab専用upload registryは廃止済み |
| Workflow asset定義 | `workflow-neon-sign-v1`をdraftのruntime Blender assetとして登録済み |
| Workflow実行状態 | `logo_asset_runs`でqueued/running/succeeded/failedを管理し、Labs UIへ表示 |
| Workflow成果物 | R2へ保存し、`logo_mockups`からcandidate・logo・所有主体へ関連づける |
| プレゼン採用 | production assetだけをplacement候補として解決し、ロゴごとのlayoutへ保存 |
| Generative Lab | 出力はR2へ保存するが、現在も`logoHash`ベースで`logos`/`logo_candidates`未連携 |
| Blender実行 | operator CLIは実装済み。本番の永続キュー/ワーカーは未配備 |

Labsページ/APIへ入れるのは`platform_admin`または`labs_member`だけ。ただしプラットフォームロールは全ロゴの閲覧権限を自動付与しない。Labsのロゴピッカーに出るのは、所有・組織所属・`logo_access_grants`・公開範囲によってその利用者が閲覧できるロゴだけ。

## 3. データ境界

| データ | 正本 |
|---|---|
| ロゴとmaster SVG | `logos` → `logo_candidates.svg` |
| assetの提供可否・version・placement互換性 | `presentation_asset_definitions`または同期元のcode/`template.json` |
| ロゴごとの表示オン/オフ・順序・設定 | `logo-presentation` Takeの`brief.presentation.layout.mappings[]` |
| 実行キュー・状態・失敗 | `logo_asset_runs` |
| 成功した現在成果物 | private R2 object + `logo_mockups` |

「expression」は独立エンティティにしない。motion/mockup/generated、実行方式、表示先の違いはasset定義で表現する。処理状態だけをasset定義や成果物キャッシュへ混ぜず、runとして分離する。

## 4. ランタイムassetの暫定手動運用

永続ワーカー完成までは、Workflow Lab詳細から依頼情報をコピーし、同じworkspaceを操作できるエージェントセッションでoperator CLIを実行する。ネオンv1の入口は`/labs/workflow/workflow-neon-sign-v1`。

### 必要な識別子

| 項目 | 用途 | 必須 |
|---|---|:-:|
| `Logo ID` | 対象の`logos.id` | ✓ |
| `Candidate ID` | 今回使うmaster SVGを固定 | ✓ |
| `Asset Definition ID` | 実行レシピを固定 | ✓ |
| `Asset Family` / `Version` | 世代の取り違えを検出 | ✓ |
| `Run ID` | `logo_asset_runs`の処理履歴 | 任意 |

Logo IDから所有者を解決できるため、アカウントIDを依頼文へ含めない。Candidate IDは、将来primaryが差し替わっても今回の入力を曖昧にしないために必須とする。

### 標準コマンド

個別のSQL・R2操作を手入力せず、[run-runtime-asset.mjs](../labs/workflow/scripts/run-runtime-asset.mjs)を使う。

```bash
node --env-file=.env.local labs/workflow/scripts/run-runtime-asset.mjs \
  --logo-id <Logo ID> \
  --candidate-id <Candidate ID> \
  --asset-id workflow-neon-sign-v1 \
  [--run-id <Run ID>] \
  [--color-mode <logo|warm-white>]
```

operator CLIは次を実行する。

1. `.env.local`のSupabase project refと必要スキーマ・asset定義を確認する
2. LogoとCandidateの所属関係を検証し、許可済み接続でmaster SVGを取得する
3. Blenderを1600×1200・150 samplesでヘッドレス実行する
4. 4:3と、明るいアートワーク中心が画面中心からX/Y各6%以内であることを検査する
5. 合格画像をR2へ保存し、読み戻しSHA-256を照合する
6. `logo_mockups`をupsertし、Run IDがあれば`logo_asset_runs`を更新する
7. Lab詳細で成果物と`processed`状態を確認する

低サンプルのフレーミング確認では`--samples 1 --no-publish`を使う。`--no-publish`はpreviewファイルだけを作り、R2/DBと正式な`render.png`を変更しない。低サンプル成果物は公開しない。

### 完了条件と安全条件

- Blenderプロセスの終了だけでは完了にしない。4:3、中央配置、目視、R2読み戻しchecksum、DB行、Lab表示まで確認する
- 依頼情報へSupabase JWT/service role、R2 access key、`.env.local`の内容を含めない
- Supabase操作前にproject refがLogosの`xhbdfzceyfrxsmaixkne`であることを確認する
- リモート書き込みは実行内容をレビューし、明示的な承認を得てから行う
- 読み書き可能な接続がない場合は必要な接続・権限だけを報告し、秘密情報をチャットへ貼るよう求めない

## 5. 残作業

- Generative Labのjob/outputを`logo_id`と`candidate_id`へ関連づけ、所有・公開範囲・課金主体を正本から解決する
- runtime Blender用の永続キュー/ワーカーを配備し、手動セッション受け渡しを廃止する
- asset definitionのcode/`template.json`とDBカタログを同期する運営経路を作る
- platform roleを持つ運営者が、権限を持たないロゴで検証する場合の明示的な共有・監査フローを設計する
- Workflow成果物の再実行、キャンセル、失敗再試行を運営UIから操作できるようにする
