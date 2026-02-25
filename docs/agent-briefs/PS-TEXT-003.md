# PS-TEXT-003: テキストツール単クリックで入力開始（日本語/英語対応）

## 目的
Photoshop同様に、テキストツール選択後にキャンバスをクリックした位置から直接入力を開始できるようにする。

## 現状不具合
- テキストツールでI-Beamにはなるが、クリックしても新規入力が開始されない
- 新規テキスト作成APIに位置指定がなく、クリック位置を起点にできない

## 編集可能ファイル
- `packages/app/src/renderer/components/canvas/CanvasView.tsx`
- `packages/app/src/renderer/components/text-editor/InlineTextEditor.tsx`
- `packages/app/src/renderer/store.ts`
- `packages/core/src/layer-factory.ts`（必要時）
- `packages/types/src/layer.ts`（必要時）
- 関連テスト:
  - `packages/app/src/renderer/components/text-editor/InlineTextEditor.test.ts`
  - `packages/app/src/renderer/components/text-editor/app-011-text-resize.test.ts`
  - `packages/app/src/renderer/store.test.ts`
  - 必要なら `packages/app/src/renderer/components/canvas/CanvasView.text-create.test.ts` を新規追加

## 実装要件（Must）
1. `activeTool === 'text'` でキャンバスを単クリックしたとき、新規テキスト入力が開始されること。
2. 新規テキストレイヤーはクリックしたドキュメント座標に作成されること。
3. レイヤー作成直後に `editingTextLayerId` が設定され、入力ボックスにフォーカスが当たること。
4. 入力ボックス初期サイズは文字サイズに連動すること（最小限、`fontSize` に応じて高さが決まること）。
5. 既存テキスト上をクリックした場合は新規作成せず、既存レイヤー編集に入ること。
6. 日本語と英語の混在入力（例: `テスト ABC 123`）が正常に入力・保持されること。
7. 既存のダブルクリック編集フローを壊さないこと（他ツール時を含む）。
8. Undo/Redoで新規テキストレイヤー作成と文字変更が追跡可能であること。

## 実装要件（Should）
1. 位置指定付きテキスト作成APIを `store` で明示的に提供する（既存API互換は維持）。
2. 日本語IME入力中の合成を阻害しないイベント処理にする。
3. 新規作成時の初期テキストは既存仕様を踏襲しつつ、空入力でも編集開始可能にする。

## 非目標
- ルビ、禁則処理、縦中横など高度組版
- Photoshop互換の全文字組版エンジン

## 受け入れ基準（厳格）
以下すべてを満たした場合のみ完了:

1. テキストツールでキャンバス空白部をクリックすると、その位置に入力ボックスが表示される。
2. 入力ボックスはクリック位置起点で表示され、文字サイズ変更値に応じた見た目サイズになる。
3. 日本語入力（IME変換を含む）と英語入力の両方で文字欠落・重複・確定漏れがない。
4. 既存テキストをクリックしたときは既存編集に入り、新規レイヤーは増えない。
5. Undoで新規テキスト作成前に戻り、Redoで再作成される。

## 必須テスト
1. 単体テスト
   - クリック位置での新規テキストレイヤー作成
   - `editingTextLayerId` 設定とフォーカス開始
   - 既存テキストクリック時の再編集分岐
2. 文字列回帰テスト
   - 日本語/英語混在文字列の保存確認
3. 実行コマンド
   - `pnpm --filter @photoshop-app/app test`
   - `pnpm lint`

## 手動確認手順
1. テキストツールを選択
2. キャンバス空白部をクリック
3. 表示された入力ボックスに `テスト ABC 123` を入力
4. いったん確定（他所クリック）し、再度クリックして内容が保持されることを確認
5. 既存テキストの近傍クリックで新規レイヤーが増えないことを確認
6. Undo/Redoで作成と編集履歴が正しく往復することを確認

## 変更報告フォーマット（実装AI必須）
- 変更ファイル一覧
- 追加/変更テスト一覧
- `pnpm --filter @photoshop-app/app test` 実行結果
- `pnpm lint` 実行結果
- 未解決事項（あれば）
