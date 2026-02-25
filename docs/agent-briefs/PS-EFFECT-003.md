# PS-EFFECT-003: Gradient Overlay 描画実装

## 目的
`gradient-overlay` エフェクトを実装し、線形/円形グラデーションでレイヤーをオーバーレイできるようにする。

## 対象パッケージ
- `packages/render`

## 推奨ブランチ
- `feat/ps-effect-003-gradient-overlay-render`

## 依存
- `PS-EFFECT-002` マージ後推奨（同一ファイル競合回避）

## 編集可能ファイル
- `packages/render/src/compositor.ts`
- `packages/render/src/compositor.test.ts`

## 実装要件（Must）
1. `renderEffectsInFront` で `gradient-overlay` を処理する。
2. `renderGradientOverlay` を追加する。
3. `gradientType: linear | radial` を両対応する。
4. `stops / angle / scale / reverse / opacity` を反映する。
5. テキストは glyph 形状にクリップして適用する。
6. ラスターもレイヤー領域に適用する。

## 実装要件（Should）
1. `createLinearGradient / createRadialGradient` を利用する。
2. stop position は 0〜1 に正規化し、安全にソートする。

## 受け入れ基準
1. linear/radial 切替が描画に反映される。
2. reverse ON/OFF で色順が反転する。
3. scale/angle の変更が視覚的に確認できる。

## 必須テスト
- linear gradient overlay 描画テスト
- radial gradient overlay 描画テスト
- reverse/scale の基本挙動テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`

## 手動確認手順
1. テキストレイヤーへ gradient overlay 適用
2. linear/radial を切替
3. reverse/angle/scale を変更して視覚確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
