# PS-TEXT-005: カスタムテキスト編集オーバーレイ（OS標準見た目依存の排除）

## 目的
OS/ブラウザ標準のテキストボックス見た目・挙動依存を減らし、アプリ独自の編集UIへ置き換える。

## 背景
現状は `textarea` 直出しに近く、次の問題がある。
- OS/ブラウザ由来の見た目（リサイズグリップ等）が前面に出る
- 編集UIがキャンバス操作体系と分離され、Photoshop的な体験に一致しない

## 編集可能ファイル
- `packages/app/src/renderer/components/text-editor/InlineTextEditor.tsx`
- `packages/app/src/renderer/components/text-editor/index.ts`
- `packages/app/src/renderer/styles.css`
- `packages/app/src/renderer/App.tsx`（必要時）
- `packages/app/src/renderer/store.ts`（必要時）
- 関連テスト:
  - `packages/app/src/renderer/components/text-editor/InlineTextEditor.test.ts`
  - 必要なら `packages/app/src/renderer/components/text-editor/CanvasTextEditor.test.tsx` 新規

## 実装要件（Must）
1. 編集UIはアプリ独自スタイルで表示されること。
2. ブラウザ標準の `resize: both` / 既定境界線 / 既定背景に依存しないこと。
3. 編集ボックスは以下を備えること。
   - 編集枠（アプリ定義）
   - キャレット可視
   - IME入力（日本語）を妨げない
4. 既存の `setTextProperty` / `startEditingText` / `stopEditingText` の状態遷移を壊さないこと。
5. 編集中に Esc でキャンセル（または編集終了）が機能すること。
6. 編集中Space入力は文字として扱われ、Spaceパンに奪われないこと。

## 実装要件（Should）
1. 表示コンポーネントとテキスト状態更新ロジックを分離し、テストしやすくすること。
2. 将来のインライン装飾（プレースホルダ、選択ハイライト）に拡張しやすい構造にすること。

## 非目標
- フォント選択UIの刷新（既存パネルの大改修）
- 変形でのフォント自動拡縮（PS-TEXT-006で対応）

## 受け入れ基準（厳格）
1. 編集UIがOS標準見た目ではなく、アプリ定義スタイルで表示される。
2. 日本語IME変換中に入力が欠落しない。
3. 英語連続入力でカーソル飛びや文字欠落がない。
4. Esc/blur時の編集終了処理が安定している。

## 必須テスト
1. 単体テスト
   - IME合成開始/終了時の状態遷移
   - キー入力/blurでの終了動作
2. UIテスト
   - カスタムクラス適用と標準 `resize` 非依存の確認
3. 実行コマンド
   - `pnpm --filter @photoshop-app/app test`
   - `pnpm lint`

## 手動確認手順
1. テキスト編集開始
2. 日本語IMEで変換入力し、確定前後とも文字が見えることを確認
3. 英語入力で連続タイピングし、欠落がないことを確認
4. Esc/blurで編集終了し、レイヤー内容が保持されることを確認

## 変更報告フォーマット（実装AI必須）
- 変更ファイル一覧
- 追加/変更テスト一覧
- テスト実行結果
- 未解決事項（あれば）
