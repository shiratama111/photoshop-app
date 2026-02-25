# PS-RENDER-001: レイヤーマスク実装

## 目的
`compositor.ts` の `applyMask` を実装し、レイヤーマスクによる alpha 乗算を有効化する。

## 対象パッケージ
- `packages/render`

## 推奨ブランチ
- `feat/ps-render-001-layer-mask`

## 現状
- `applyMask` は placeholder（実処理なし）

## 編集可能ファイル
- `packages/render/src/compositor.ts`
- `packages/render/src/compositor.test.ts`

## 実装要件（Must）
1. `getImageData/putImageData` で mask alpha を乗算する。
2. `mask.offset` を考慮する。
3. `mask.enabled === false` は適用しない。
4. mask範囲外ピクセルは変更しない。
5. テスト環境で `getImageData` 不在時に安全にスキップする。

## 実装要件（Should）
1. ループ処理を最適化し不要計算を減らす。
2. 0/255 境界値で破綻しない。

## 受け入れ基準
1. マスク適用時に透過が反映される。
2. マスク無効時は元画像のまま。
3. 既存 raster 描画回帰がない。

## 必須テスト
- mask enabled の alpha 反映テスト
- mask disabled の非反映テスト
- offset 反映テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`

## 手動確認手順
1. マスク付きPSDを読み込む
2. マスク有効/無効で表示差を確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
