# PS-RENDER-002: Color Overlay のラスターレイヤー対応

## 目的
`color-overlay` を text限定から raster へ拡張し、ラスターにも同等効果を適用する。

## 対象パッケージ
- `packages/render`

## 推奨ブランチ
- `feat/ps-render-002-raster-color-overlay`

## 依存
- `PS-RENDER-001` 後を推奨（同一ファイル競合回避）

## 編集可能ファイル
- `packages/render/src/compositor.ts`
- `packages/render/src/compositor.test.ts`

## 実装要件（Must）
1. `renderColorOverlay` で raster を処理対象に追加する。
2. ラスターの不透明ピクセルに overlay color を適用する。
3. `opacity` を反映する。
4. text の既存実装は維持する。
5. `enabled=false` は描画しない。

## 実装要件（Should）
1. raster overlay は mask/opacity/blend の既存挙動を崩さない。
2. 大きな画像で過度な性能劣化を避ける。

## 受け入れ基準
1. ラスターレイヤーに color-overlay が効く。
2. テキストへの color-overlay 既存挙動が維持される。
3. renderEffects=false で効果が消える。

## 必須テスト
- raster color-overlay 描画テスト
- text color-overlay 回帰テスト
- disabled 時のスキップテスト

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`

## 手動確認手順
1. ラスターレイヤーに color-overlay を設定
2. opacity を変更
3. テキスト側の挙動も回帰確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
