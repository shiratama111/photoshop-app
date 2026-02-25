# PS-PAN-001: スペースキー + ドラッグでパン

## 目的
Photoshopと同様に、`Space` 押下中にキャンバスをドラッグしてパンできるようにする。

## Photoshop準拠仕様
- 通常ツール（ブラシ、選択、テキスト等）のまま `Space` を押すと一時的にパンモード。
- `Space + 左ドラッグ` でパン。
- `Space` を離すと元のツール挙動へ復帰。
- パン中は描画や選択処理を実行しない。
- カーソル:
  - `Space` 押下中: `grab`
  - ドラッグ中: `grabbing`

## 編集可能ファイル
- `packages/app/src/renderer/components/canvas/CanvasView.tsx`
- `packages/app/src/renderer/styles.css`
- （必要時のみ）`packages/app/src/renderer/App.tsx`
- テスト新規: `packages/app/src/renderer/components/canvas/CanvasView.pan.test.tsx`

## 実装要件
1. `CanvasView` に `isSpacePressed` と `isPanning` を分離して持つ。
2. `mousedown` で以下優先順に処理:
   - ミドルクリックパン
   - `Space + 左クリック` パン
   - 既存ツール処理
3. `mousemove` はパン中なら常に `setPanOffset` のみ実行。
4. `Space` 押下の監視で、入力要素フォーカス時は無効化（テキスト編集中のスペース入力を壊さない）。
5. 既存のミドルクリックパンを壊さない。

## 受け入れ条件
- ブラシ選択中でも `Space + 左ドラッグ` でパンでき、ストロークが描かれない。
- `Space` 解放でブラシ動作に戻る。
- テキスト編集中はスペース入力が文字として入る。
- ミドルクリックパンは従来通り動作。

## テスト
- 単体: パン開始条件とツール処理抑止のテスト
- 手動:
  1. ブラシ選択 -> Space+ドラッグ -> パンのみ
  2. テキスト編集中 -> Space入力 -> 半角/全角スペース入力可能
  3. 中ボタンドラッグ -> パン可能
