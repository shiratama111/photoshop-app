# PS-TEXT-009: テキストワープ/変形

## 目的
Photoshopのテキストワープに近い体験を、Canvas2D 近似で実装する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/ps-text-009-text-warp`

## 着手前確認（必須）
ワープ設定の永続化には型拡張が必要な可能性が高い。
`packages/types` ロック方針との整合を事前確認すること。

## 優先実装
- `arch`（アーチ）

## 編集可能ファイル
- `packages/app/src/renderer/components/text-editor/*`
- `packages/app/src/renderer/components/canvas/*`
- `packages/app/src/renderer/store.ts`
- 関連テスト

## 実装要件（Must）
1. テキストワープ設定（最低1種: arch）を適用できる。
2. 編集時プレビューと確定後描画が大きく乖離しない。
3. 強度パラメータを調整できる。
4. Undo/Redo 対応。
5. 既存の通常テキストが壊れない。

## 実装要件（Should）
1. 将来波形/旗形などを追加しやすい構造にする。
2. 文字欠けや重なりを最小化する。

## 受け入れ基準
1. アーチ変形が視認できる。
2. 変形ON/OFFが正しく反映される。
3. 既存編集フロー（クリック編集・確定）が維持される。

## 必須テスト
- ワープ設定更新の store テスト
- 編集UIイベントの回帰テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`

## 手動確認手順
1. テキスト作成
2. ワープ（arch）ON
3. 強度変更と Undo/Redo 確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 型ロック影響の記録
