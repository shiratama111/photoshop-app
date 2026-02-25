# PS-TEXT-004: クリック起点編集の統一 + 文字非表示バグ修正

## 目的
テキスト入力の基本導線を安定化し、入力文字が見えない不具合を解消する。

## 対象課題
1. ダブルクリック依存をやめ、単クリックで編集開始できるようにする。
2. 入力は受け付けているのに文字が視認できない不具合を修正する。

## 編集可能ファイル
- `packages/app/src/renderer/components/canvas/CanvasView.tsx`
- `packages/app/src/renderer/components/text-editor/InlineTextEditor.tsx`
- `packages/render/src/compositor.ts`
- `packages/app/src/renderer/store.ts`（必要時）
- `packages/app/src/renderer/styles.css`（必要時）
- 関連テスト:
  - `packages/app/src/renderer/components/canvas/CanvasView.text-create.test.ts`
  - `packages/app/src/renderer/components/text-editor/InlineTextEditor.test.ts`
  - `packages/render/src/compositor.test.ts`

## 実装要件（Must）
1. `text` ツール時、キャンバス単クリックで以下を実行すること。
   - 既存テキストヒット時: 既存レイヤー編集開始
   - 非ヒット時: 新規テキストレイヤー作成 + 編集開始
2. ダブルクリック専用でしか編集開始できない経路を残さないこと。
3. 入力文字は編集中に必ず視認可能であること。
4. 確定後（blur後）も compositor 結果に文字が表示されること。
5. 日本語/英語混在入力で文字化け・欠落・透明表示がないこと。
6. Undo/Redoで作成・編集の履歴が壊れないこと。

## 実装要件（Should）
1. クリック判定を `textBounds` 優先で行い、なければ安全な推定ヒットボックスを使うこと。
2. テキスト可視性は「背景依存で見えない」状態を避ける補助スタイルを用意すること（編集中のみ）。

## 非目標
- 高度組版（ルビ、禁則処理、縦中横）
- テキスト変形でのフォント自動拡縮（PS-TEXT-006で対応）

## 受け入れ基準（厳格）
1. テキストツールで単クリックすると100%編集開始できる。
2. `テスト ABC 123` を入力中、各文字がリアルタイムで見える。
3. 確定後に同一文字列がキャンバス上に表示される。
4. 既存テキストをクリックしても新規レイヤーが増えない。
5. Undoで作成前/編集前に戻り、Redoで復元される。

## 必須テスト
1. 単体テスト
   - 単クリック時の新規/既存分岐
   - `editingTextLayerId` の開始/終了整合
2. 描画テスト
   - compositorで入力文字列が描画されること
3. 文字列回帰テスト
   - `テスト ABC 123` の保持
4. 実行コマンド
   - `pnpm --filter @photoshop-app/app test`
   - `pnpm --filter @photoshop-app/render test`
   - `pnpm lint`

## 手動確認手順
1. テキストツールを選択し、キャンバス空白を単クリック
2. `テスト ABC 123` を入力し、編集中に可視であることを確認
3. クリック確定後、キャンバス上に同文字列が描画されることを確認
4. 既存テキストを単クリックし、既存編集に入ることを確認
5. Undo/Redoで作成・編集履歴を確認

## 変更報告フォーマット（実装AI必須）
- 変更ファイル一覧
- 追加/変更テスト一覧
- テスト実行結果（3コマンド）
- 未解決事項（あれば）
