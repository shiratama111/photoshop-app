# PS-TEXT-008: 文字単位スタイリング（リッチテキスト）

## 目的
選択範囲ごとに異なるフォントサイズ/色などを持つ `TextRun` ベース編集を実現する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/ps-text-008-rich-text-runs`

## 着手前確認（必須）
このチケットは本来 `packages/types` の拡張を伴う。
`AGENTS.md` では types がロックのため、以下のどちらで進めるかをコーディネータ確認すること。
1. typesロックを一時解除して本実装
2. app内モデル先行（types未変更の暫定実装）

## 編集可能ファイル（A案: types解除時）
- `packages/app/src/renderer/components/text-editor/*`
- `packages/app/src/renderer/store.ts`
- `packages/app/src/renderer/components/canvas/CanvasView.tsx`
- 関連テスト

## 実装要件（Must）
1. テキストを run 単位で編集できるデータ構造を導入する。
2. run ごとに `fontFamily / fontSize / color / bold / italic` を保持する。
3. 選択範囲へのスタイル適用を可能にする。
4. Undo/Redo で run 編集操作を追跡できる。
5. 既存テキスト（単一スタイル）からの移行経路を持つ。

## 実装要件（Should）
1. 互換レイヤーは表示時に自動run化（1 run）する。
2. 大量テキストでも編集体験が著しく劣化しない。

## 受け入れ基準
1. `Hello` と `World` に異なる色/サイズを適用できる。
2. 再編集時に run 情報が保持される。
3. Undo/Redo で run 単位変更が正しく戻る。

## 必須テスト
- run 分割/結合ロジック
- 範囲スタイル適用
- Undo/Redo 回帰

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`

## 手動確認手順
1. 文字列を入力
2. 一部範囲に色/サイズ変更
3. 保存/再編集/Undo/Redo を確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- `types` ロックの取り扱い結果
