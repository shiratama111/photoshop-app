# DECO-001: 集中線・放射線エフェクト

## 目的
サムネイルで多用される集中線（放射線）エフェクトを実装し、
マンガ風の迫力ある背景演出を可能にする。

## 対象パッケージ
- `packages/core`（集中線生成ロジック）
- `packages/render`（集中線描画）

## 推奨ブランチ
- `feat/deco-001-concentration-lines`

## 現状
- `core/src/procedural.ts`: 図形描画のプロシージャル生成あり — ここに集中線を追加可能
- `render/src/compositor.ts`: レイヤー合成の本体
- `app/src/renderer/components/dialogs/BorderDialog.tsx`: 枠線ダイアログが存在（別チケットでは触れない）
- **集中線エフェクトは未実装**

## 編集可能ファイル
- `packages/core/src/procedural.ts` — 集中線生成関数を追加
- `packages/core/src/procedural.test.ts` — テスト追加（新規作成の場合もあり）
- `packages/render/src/decorations.ts` — **新規作成**（装飾レイヤー描画）
- `packages/render/src/decorations.test.ts` — **新規作成**

## 編集禁止ファイル
- `packages/render/src/compositor.ts`（CLIP-001の担当）
- `packages/core/src/layer-tree.ts`（CLIP-001の担当）
- `packages/app/` 配下全て
- `packages/app/src/renderer/components/dialogs/BorderDialog.tsx`

## 実装要件（Must）
1. **集中線生成関数**（`core/procedural.ts`に追加）
   ```typescript
   interface ConcentrationLinesConfig {
     centerX: number;
     centerY: number;
     canvasWidth: number;
     canvasHeight: number;
     lineCount: number;        // 線の本数（20〜100）
     lineWidthMin: number;     // 線の最小幅
     lineWidthMax: number;     // 線の最大幅
     innerRadius: number;      // 中心の空白半径（0〜1、キャンバスサイズに対する割合）
     color: { r: number; g: number; b: number; a: number };
     randomSeed?: number;      // 再現可能なランダム
   }
   function generateConcentrationLines(config: ConcentrationLinesConfig): ImageData;
   ```

2. **集中線描画**（`render/decorations.ts`）
   - `generateConcentrationLines()` の結果を Canvas 上に描画
   - ブレンドモード対応（通常 / 乗算 / スクリーン等）
   - 不透明度対応

3. **パラメータの妥当性**
   - デフォルト値で「よくあるサムネイルの集中線」が出力される
   - 線の太さ・本数・中心位置・空白半径がカスタマイズ可能

## 実装要件（Should）
1. 色のグラデーション対応（中心→外側で色が変わる）
2. 放射状グラデーション背景との組み合わせプリセット

## 受け入れ基準
1. `generateConcentrationLines()` が正しいサイズの ImageData を返す
2. 指定した本数の線が描画される
3. innerRadius で中心の空白が制御できる
4. 既存の `procedural.ts` の関数に回帰がない

## 必須テスト
- 集中線生成のユニットテスト（サイズ、線の本数、中心位置）
- 境界値テスト（lineCount=0, innerRadius=0, innerRadius=1）
- decorations.ts の描画テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/core test`
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`
