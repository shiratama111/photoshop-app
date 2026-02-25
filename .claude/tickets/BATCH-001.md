# BATCH-001: AI画像生成統合・バッチ生成

## 目的
ComfyUI/Stable Diffusion APIとの連携による背景画像自動生成と、
同じ内容で複数バリエーションのサムネイルを一括生成する機能を実装する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/batch-001-ai-image-gen`

## 依存チケット
- PIPE-001（E2Eパイプライン — パイプラインのバッチ実行に拡張）

## 編集可能ファイル
- `packages/app/src/renderer/ai/image-gen-client.ts` — **新規作成**（ComfyUI/SD API連携）
- `packages/app/src/renderer/ai/image-gen-client.test.ts` — **新規作成**
- `packages/app/src/renderer/ai/batch-generator.ts` — **新規作成**（バッチ生成オーケストレーター）
- `packages/app/src/renderer/ai/batch-generator.test.ts` — **新規作成**

## 編集禁止ファイル
- `packages/app/src/renderer/ai/pipeline.ts`（PIPE-001の担当）
- `packages/app/src/renderer/ai/style-transfer.ts`（TRANSFER-001の担当）
- `packages/app/src/renderer/store.ts`
- `packages/ai/` 配下（ANALYZE-001の担当）

## 実装要件（Must）
1. **AI画像生成クライアント**（`image-gen-client.ts`）
   - ComfyUI API連携（ローカルサーバー `http://localhost:8188`）
   - テーマに合った背景画像の生成プロンプト自動構築
   - 生成画像のダウンロード→レイヤーとして配置
   - 接続エラー時のgraceful degradation（画像生成なしで続行）

2. **人物切り抜き合成**
   - 既存のMobile SAM（`packages/ai`）を利用して人物を切り抜き
   - AI生成背景と合成
   - 切り抜きマスクのエッジ調整

3. **バッチ生成**（`batch-generator.ts`）
   - 同じ指示で複数バリエーション生成（デフォルト3パターン）
   - スタイルバリエーション: 「ニュース風」「ポップ風」「ミニマル風」等
   - 色バリエーション: 同じレイアウトで異なるカラーパレット
   - 出力: フォルダにPNG一括出力 + サムネイル一覧

4. **バリエーション選択UI**
   - 生成された複数バリエーションをグリッド表示
   - ユーザーが気に入ったものをクリック→エディタで開く
   - 選択したスタイルの「お気に入り」保存

## 実装要件（Should）
1. A/Bテスト用のメタデータ出力（どのバリエーションが選ばれたか記録）
2. ユーザーの選択履歴からの傾向分析（好みのスタイル学習）

## 受け入れ基準
1. ComfyUI APIに接続して背景画像が生成される
2. 生成画像がレイヤーとしてエディタに配置される
3. 3パターン以上のバリエーションが一括生成される
4. ComfyUI未接続時でもバリエーション生成（スタイル/色の変更のみ）が動作する

## 必須テスト
- ComfyUI APIクライアントのテスト（モック使用）
- バッチ生成のテスト（3バリエーション出力）
- 画像配置テスト
- エラーハンドリングテスト（API接続失敗時）

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
