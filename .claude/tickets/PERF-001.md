# PERF-001: パフォーマンスベンチマーク

## 目的
レンダリングパフォーマンスの基準値を設定し、今後の開発で性能劣化を検知できる仕組みを構築する。
目標: 1280x720 / 10レイヤー / エフェクト付き → 描画1秒以内。

## 対象パッケージ
- `packages/render`（ベンチマークファイルの追加のみ）

## 推奨ブランチ
- `feat/perf-001-benchmarks`

## 現状
- パフォーマンス計測の仕組みなし
- Canvas 2D レンダラーとWebGL レンダラーの2系統あり

## 編集可能ファイル
- `packages/render/benchmarks/` — **新規ディレクトリ作成**
  - `render-benchmark.ts` — ベンチマークランナー
  - `scenarios.ts` — テストシナリオ定義
  - `report.ts` — 結果レポート生成
- `packages/render/package.json` — `"bench"` スクリプト追加のみ

## 編集禁止ファイル
- `packages/render/src/compositor.ts`（プロダクションコードは変更しない）
- `packages/render/src/webgl-compositor.ts`
- `packages/app/` 配下全て
- `packages/core/` 配下全て

## 実装要件（Must）
1. **ベンチマークシナリオ**
   - Scenario A: 1280x720, 1レイヤー(raster), エフェクトなし → ベースライン
   - Scenario B: 1280x720, 10レイヤー(text 5 + raster 5), エフェクト各2個
   - Scenario C: 1280x720, 10レイヤー, 全レイヤーにエフェクト3個
   - Scenario D: 1920x1080, 20レイヤー, エフェクト付き → ストレステスト

2. **計測対象**
   - `compositor.renderScene()` の実行時間
   - メモリ使用量（Canvas生成数、ピクセルバッファサイズ）
   - Canvas 2D vs WebGL の比較（WebGLが使える場合）

3. **レポート出力**
   - 各シナリオの平均実行時間（10回実行の中央値）
   - ベースラインとの比較（初回実行時にベースライン保存）
   - 目標値（1秒）に対する合否判定

4. **CLI実行**
   - `pnpm --filter @photoshop-app/render bench` で実行可能
   - 結果をコンソールにテーブル形式で出力

## 実装要件（Should）
1. CI連携用のJSON出力フォーマット
2. ベースライン値のファイル保存（`benchmarks/baseline.json`）

## 受け入れ基準
1. 4シナリオのベンチマークが実行できる
2. 各シナリオの実行時間が表示される
3. Scenario B が1秒以内（目標値）であることを確認
4. `pnpm --filter @photoshop-app/render bench` で実行できる

## 実行コマンド
- `pnpm --filter @photoshop-app/render bench`
- `pnpm lint`
