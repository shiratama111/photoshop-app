# PS-TEXT-002: テキストレイヤースタイル拡張 + 重要機能

## 目的
「テキストにレイヤースタイル適用、色・大きさを自由に変更」を実運用レベルにする。
加えて、Photoshopにある重要なテキスト機能を優先実装する。

## 前提
- `PS-TEXT-001` マージ済み

## 編集可能ファイル
- `packages/app/src/renderer/components/dialogs/LayerStyleDialog.tsx`
- `packages/app/src/renderer/components/text-editor/TextPropertiesPanel.tsx`
- `packages/render/src/compositor.ts`
- 必要時: `packages/types/src/effects.ts`
- 関連テスト

## Must（必須）
1. テキストレイヤーに対するスタイル描画を実体化
   - Stroke
   - Drop Shadow
   - Outer Glow
2. レイヤースタイルUIのパラメータ変更が即時反映される。
3. 文字色・文字サイズ・行間・字間の変更をUndo/Redo可能に維持。

## Should（優先実装）
1. `Color Overlay` のテキスト適用
2. 文字装飾（Underline / Strikethrough）
3. 段落テキストの基本整列強化（左/中央/右に加え、必要なら均等割付）

## 受け入れ条件
- テキストに設定したスタイルがキャンバス上で視認できる。
- スタイル適用後もテキスト編集（内容/サイズ/色）が破綻しない。
- Undo/Redoでスタイル変更が追跡できる。

## テスト
- 描画テスト: 各エフェクト適用時の呼び出し/描画結果
- UIテスト: スライダー・色変更・ON/OFFが反映
- 回帰テスト: 既存ラスターレイヤースタイルへの影響なし
