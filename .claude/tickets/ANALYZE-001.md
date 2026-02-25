# ANALYZE-001: サムネイル解析AI

## 目的
参照画像を分析して構造（レイアウト・テキスト・フォント・カラーパレット・エフェクト）を抽出する。
「この画像と同じようなサムネを作って」の前提となる画像解析エンジン。

## 対象パッケージ
- `packages/app`（AI解析レイヤー）
- `packages/ai`（画像処理拡張）

## 推奨ブランチ
- `feat/analyze-001-thumbnail-analyzer`

## 依存チケット
- STYLE-001（スタイル分析エンジン — エフェクト推定結果の記述に使用）

## 編集可能ファイル
- `packages/app/src/renderer/ai/thumbnail-analyzer.ts` — **新規作成**
- `packages/app/src/renderer/ai/thumbnail-analyzer.test.ts` — **新規作成**
- `packages/app/src/renderer/ai/color-palette.ts` — **新規作成**（カラーパレット抽出）
- `packages/ai/src/layout-detector.ts` — **新規作成**（レイアウト検出）

## 編集禁止ファイル
- `packages/ai/src/` 既存ファイル（SAM関連）
- `packages/app/src/renderer/ai/thumbnail-architect.ts`（THUMB-001の担当）
- `packages/app/src/renderer/ai/pipeline.ts`（PIPE-001の担当）
- `packages/app/src/renderer/store.ts`

## 実装要件（Must）
1. **レイアウト検出**（`layout-detector.ts`）
   - 画像内のテキスト領域・画像領域・背景領域を分割
   - 各領域の位置（x, y, width, height）とサイズ比率を出力
   - テキストの大まかな位置（上部/中央/下部、左/中/右）

2. **テキスト認識（OCR）**
   - 画像内テキストの読み取り
   - Cloud Vision API or Tesseract.js（ローカル）の選択式
   - 日本語・英語対応

3. **カラーパレット抽出**（`color-palette.ts`）
   - 画像から主要色を5-8色抽出（k-means or median cut）
   - 背景色・アクセント色・テキスト色の推定
   - コントラスト比の計算

4. **エフェクト推定**
   - テキスト周辺のピクセル分析から:
     - 縁取りの有無・色・太さの推定
     - ドロップシャドウの有無・方向の推定
     - グロー効果の有無の推定
   - Claude Vision API利用によるエフェクト認識（高精度モード）

5. **解析結果スキーマ**
   ```typescript
   interface ThumbnailAnalysis {
     layout: LayoutRegion[];       // 領域分割結果
     texts: DetectedText[];        // OCR結果 + 推定フォント
     palette: ColorPalette;        // 主要色
     effects: EstimatedEffect[];   // 推定エフェクト
     style: string;                // スタイル記述（STYLE-001のdescribeEffects利用）
   }
   ```

## 実装要件（Should）
1. フォント推定（Google Font API or font matchingモデル）
2. 解析結果の信頼度スコア

## 受け入れ基準
1. サムネイル画像からレイアウト領域が検出される
2. テキストがOCRで正しく読み取れる（日本語・英語）
3. カラーパレットが5色以上抽出される
4. 基本的なエフェクト（縁取り・影）が推定される

## 必須テスト
- カラーパレット抽出のユニットテスト
- レイアウト検出のテスト（明確なテキスト+背景の画像）
- 解析結果スキーマのバリデーションテスト
- エッジケース（テキストなし画像、単色画像）

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm --filter @photoshop-app/ai test`
- `pnpm lint`
