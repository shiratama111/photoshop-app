# QUALITY-001: エフェクト品質テストスイート

## 目的
全8レイヤーエフェクトの描画品質を体系的にテストし、サムネイル制作に耐える品質であることを検証する。
特にテキストレイヤーへの適用と、複数エフェクトの組み合わせを重点的にカバーする。

## 対象パッケージ
- `packages/render`（テストファイルの追加のみ — プロダクションコード変更なし）

## 推奨ブランチ
- `feat/quality-001-effect-tests`

## 現状
- 8エフェクト実装済み: stroke, drop-shadow, outer-glow, inner-shadow, inner-glow, color-overlay, gradient-overlay, bevel-emboss
- `compositor.test.ts` に基本テストあり
- **組み合わせテスト・品質テストは未整備**

## 編集可能ファイル
- `packages/render/src/effect-quality.test.ts` — **新規作成**
- `packages/render/src/effect-combination.test.ts` — **新規作成**
- `packages/render/src/fixtures/` — **新規作成**（テスト用画像・期待値）

## 編集禁止ファイル
- `packages/render/src/compositor.ts`（プロダクションコードは変更しない）
- `packages/render/src/webgl-compositor.ts`
- `packages/app/` 配下全て
- `packages/core/` 配下全て

## 実装要件（Must）
1. **単体エフェクトテスト**（各エフェクトごとに）
   - ラスターレイヤーへの適用
   - テキストレイヤーへの適用
   - `enabled: false` でスキップされること
   - パラメータ変更が描画に反映されること（color, size, opacity, angle等）

2. **組み合わせテスト**（サムネ頻出パターン）
   - stroke + drop-shadow（YouTuber定番）
   - stroke + outer-glow（インパクト系）
   - gradient-overlay + stroke（グラデ文字）
   - bevel-emboss + drop-shadow（エレガント）
   - 全8エフェクト同時ON

3. **品質アサーション**
   - 描画結果のピクセルサンプリング — エフェクト領域に期待する色が存在すること
   - エフェクト適用前後でキャンバスサイズが変わらないこと
   - 透過レイヤーでエフェクトが正しく表示されること

4. **サムネイル実用サイズテスト**
   - 1280x720キャンバスで10レイヤー（text 5 + raster 5）
   - 各レイヤーにエフェクト2-3個
   - エラーなく描画が完了すること

## 実装要件（Should）
1. Photoshop出力との視覚比較用リファレンス画像の管理（`fixtures/`に格納）
2. テスト結果を画像として保存する仕組み（手動確認用）

## 受け入れ基準
1. 全8エフェクトの単体テストが通る（raster + text）
2. 4パターン以上の組み合わせテストが通る
3. 1280x720 / 10レイヤー / エフェクト付きでの描画テストが通る
4. 既存の `compositor.test.ts` に回帰がない

## 必須テスト
- 上記の全テストケース

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`
