# PS-PSD-001: PSDインポート時のエフェクト読み込み

## 目的
PSD import で `ag-psd` の `layer.effects` を内部 `LayerEffect[]` にマッピングする。

## 対象パッケージ
- `packages/adapter-psd`

## 推奨ブランチ
- `feat/ps-psd-001-import-effects`

## 現状
- `layer-mapper.ts` で `effects: []` 固定

## 編集可能ファイル
- `packages/adapter-psd/src/layer-mapper.ts`
- `packages/adapter-psd/src/import-psd.test.ts`
- 必要時: `packages/adapter-psd/src/import-psd.ts`

## 実装要件（Must）
1. `agLayer.effects` を読み取り、既存 LayerEffect 型へ変換する。
2. 最低限、既実装済み効果（stroke/drop-shadow/outer-glow/color-overlay）を取り込む。
3. 新規効果（inner-shadow/inner-glow/gradient-overlay/bevel-emboss）も取り込む。
4. 未対応値は安全なデフォルトへフォールバックする。
5. 変換不能項目は `CompatibilityIssue` に warning/info を追加する。

## 実装要件（Should）
1. 変換処理を関数分離し、export側と再利用しやすい形にする。
2. レイヤー種別（raster/text/group）で不正 effect を付与しない。

## 受け入れ基準
1. PSD import 後、effects が空配列固定でなくなる。
2. 主要エフェクトの値が概ね保持される。
3. 例外なく import 完了する。

## 必須テスト
- effects を持つ PSD の import テスト
- 未対応 effect 値のフォールバック/issue テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/adapter-psd test`
- `pnpm lint`

## 手動確認手順
1. エフェクト付きPSDを読み込む
2. レイヤー効果がUIに反映されることを確認
3. 重大クラッシュがないことを確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 変換対象/未対応の一覧
