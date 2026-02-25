# PS-EFFECT-005: LayerStyleDialog に全エフェクトタブ追加

## 目的
LayerStyleDialog を 4タブ -> 8タブへ拡張し、新規エフェクト編集UIを追加する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/ps-effect-005-layer-style-tabs`

## 編集可能ファイル
- `packages/app/src/renderer/components/dialogs/LayerStyleDialog.tsx`
- `packages/app/src/renderer/i18n/messages.ts`
- `packages/app/src/renderer/styles.css`（必要時のみ）
- 関連テスト（必要に応じて新規）

## 実装要件（Must）
1. 以下のタブを追加する。
   - Inner Shadow
   - Inner Glow
   - Gradient Overlay
   - Bevel & Emboss
2. 各タブに enable/disable と主要パラメータ操作UIを追加する。
3. 既存4タブ（stroke/drop-shadow/outer-glow/color-overlay）を壊さない。
4. i18n キーを ja/en に追加する。
5. store の `addLayerEffect/updateLayerEffect/removeLayerEffect` 既存APIで動作させる。

## 実装要件（Should）
1. 型絞り込みを明示し、unsafe cast を最小化する。
2. タブ追加後も操作レスポンスが悪化しない。

## 受け入れ基準
1. 8タブが表示される。
2. 各タブで ON/OFF と値変更が可能。
3. 値変更がライブプレビューに反映される。
4. キャンセル/OK の既存挙動が維持される。

## 必須テスト
- 主要タブ表示のテスト
- effect 追加/更新/削除フローのテスト
- i18n キー欠落がないことの確認

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`

## 手動確認手順
1. テキストレイヤーで LayerStyleDialog を開く
2. 8タブに遷移し ON/OFF とスライダー変更
3. 描画プレビューと保存状態を確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
