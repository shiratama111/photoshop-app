# TRANSFER-001: スタイル転写エンジン

## 目的
参照画像の解析結果を設計図に変換し、新しいテキスト/画像で「同じ雰囲気」のサムネイルを再現する。
「この画像と同じスタイルで、タイトルだけ変えたサムネ」を自動生成する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/transfer-001-style-transfer`

## 依存チケット
- ANALYZE-001（サムネイル解析AI — 解析結果が入力）
- PIPE-001（E2Eパイプライン — 設計図→生成の仕組みを利用）

## 編集可能ファイル
- `packages/app/src/renderer/ai/style-transfer.ts` — **新規作成**
- `packages/app/src/renderer/ai/style-transfer.test.ts` — **新規作成**

## 編集禁止ファイル
- `packages/app/src/renderer/ai/thumbnail-analyzer.ts`（ANALYZE-001の担当）
- `packages/app/src/renderer/ai/pipeline.ts`（PIPE-001の担当）
- `packages/app/src/renderer/ai/thumbnail-architect.ts`（THUMB-001の担当）
- `packages/app/src/renderer/store.ts`

## 実装要件（Must）
1. **解析結果→設計図変換**（`style-transfer.ts`）
   - `ThumbnailAnalysis` → `ThumbnailDesign` への変換
   - テキスト内容の差し替え（レイアウト・スタイルは維持）
   - カラーパレットの保持
   - エフェクト設定の再現

2. **スタイル転写フロー**
   ```
   参照画像 → ANALYZE-001で解析 → ThumbnailAnalysis
     → style-transfer で設計図に変換（テキスト差し替え）
     → PIPE-001で生成 → 新しいサムネイル
   ```

3. **差し替え可能要素**
   - テキスト内容（メインタイトル、サブタイトル）
   - 背景画像（レイアウトは維持して画像だけ差し替え）
   - カラーパレット（オプション: 別の配色に変更）

4. **類似度評価**
   - 元画像と生成画像のスタイル類似度をスコアリング
   - レイアウト一致度、色彩一致度、エフェクト一致度

## 実装要件（Should）
1. 複数の参照画像からスタイルを「ブレンド」
2. 部分転写（レイアウトだけ、色だけ、エフェクトだけ参照）

## 受け入れ基準
1. 参照画像のスタイルで新しいテキストのサムネイルが生成される
2. レイアウト（テキスト位置・サイズ比率）が参照画像と類似している
3. カラーパレットが参照画像と類似している
4. テキスト内容の差し替えが正しく動作する

## 必須テスト
- 解析結果→設計図変換のユニットテスト
- テキスト差し替えテスト
- カラーパレット保持テスト
- 類似度スコアリングテスト

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
