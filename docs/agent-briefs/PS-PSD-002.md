# PS-PSD-002: PSDエクスポート時のエフェクト書き出し

## 目的
内部 `LayerEffect[]` を `ag-psd` の effects 形式へ逆変換し、PSD往復互換を向上する。

## 対象パッケージ
- `packages/adapter-psd`

## 推奨ブランチ
- `feat/ps-psd-002-export-effects`

## 編集可能ファイル
- `packages/adapter-psd/src/layer-exporter.ts`
- `packages/adapter-psd/src/export-psd.test.ts`
- 必要時: `packages/adapter-psd/src/export-psd.ts`

## 実装要件（Must）
1. layer export 時に `effects` を ag-psd 形式で出力する。
2. 主要効果（stroke/drop-shadow/outer-glow/color-overlay）を出力する。
3. 新規効果（inner-shadow/inner-glow/gradient-overlay/bevel-emboss）を出力する。
4. 逆変換不能な値は安全な近似値に丸める。
5. effect の `enabled` 状態を保持する。

## 実装要件（Should）
1. import側と対になるマッピング構造に揃える。
2. roundtrip で値劣化を最小化する。

## 受け入れ基準
1. exportしたPSDを再importすると、effects の種類と主要パラメータが保持される。
2. effect付きテキスト/ラスターでクラッシュしない。

## 必須テスト
- export -> import roundtrip で effects 維持テスト
- enabled false/true の保持テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/adapter-psd test`
- `pnpm lint`

## 手動確認手順
1. エフェクト付きドキュメントをPSD書き出し
2. 再読み込みし、レイヤー効果が保持されるか確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 近似変換した項目
