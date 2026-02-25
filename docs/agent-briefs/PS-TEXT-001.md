# PS-TEXT-001: I-Beamカーソル + 縦書き/横書き

## 目的
テキスト入力体験をPhotoshopに近づける。

- テキストツール選択時の I-Beam カーソル
- 縦書き/横書きの切替

## 編集可能ファイル
- `packages/types/src/layer.ts`
- `packages/types/src/index.ts`
- `packages/core/src/layer-factory.ts`
- `packages/render/src/compositor.ts`
- `packages/app/src/renderer/components/canvas/CanvasView.tsx`
- `packages/app/src/renderer/components/text-editor/InlineTextEditor.tsx`
- `packages/app/src/renderer/components/text-editor/TextPropertiesPanel.tsx`
- 関連テスト

## 実装要件
1. TextLayerに `writingMode` を追加（例: `'horizontal-tb' | 'vertical-rl'`）。
2. `createTextLayer` のデフォルトは横書き。
3. Text Properties に `横書き / 縦書き` トグルを追加。
4. テキストツール時のキャンバスカーソルを I-Beam にする。
5. `InlineTextEditor` と `compositor` 描画で `writingMode` を反映する。
6. 既存の `textBounds`, `alignment`, `lineHeight`, `letterSpacing` と整合する。

## 受け入れ条件
- テキストツール選択で I-Beam カーソルになる。
- 横書き/縦書きを切り替えるとキャンバス描画に反映される。
- 保存・undo/redoで `writingMode` が保持される。

## テスト
- 型/Factoryテスト: `writingMode` の生成デフォルトと変更
- 描画テスト: 横書き/縦書きで描画分岐
- UIテスト: TextPropertiesPanel でトグル可能

## 非目標
- 禁則処理、縦中横、ルビ等の高度組版は本チケット外
