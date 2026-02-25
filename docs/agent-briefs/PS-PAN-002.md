# PS-PAN-002: SelectionOverlay配下でも Space + Drag パンを成立させる

## 目的
`Space + 左ドラッグ` によるパンを、`select/crop` 利用時を含め常に安定動作させる。

## 現状不具合
- `CanvasView` 側のパン実装は存在するが、`SelectionOverlay` が `mousedown` を消費する経路でパン開始できない
- 結果として「Spaceを押してドラッグしても動かない」ケースがある

## 編集可能ファイル
- `packages/app/src/renderer/components/canvas/CanvasView.tsx`
- `packages/app/src/renderer/components/canvas/SelectionOverlay.tsx`
- `packages/app/src/renderer/styles.css`（必要な場合のみ）
- テスト:
  - `packages/app/src/renderer/components/canvas/CanvasView.pan.test.ts`
  - 必要なら `packages/app/src/renderer/components/canvas/SelectionOverlay.*.test.ts` を新規追加

## 実装要件（Must）
1. `Space + 左ドラッグ` でパンが開始されること（アクティブツールに依存しない）。
2. `select` / `crop` ツール時でも、`Space` 押下中は `SelectionOverlay` がパン開始を妨げないこと。
3. パン中は選択範囲作成・ブラシ描画など他ツール処理を実行しないこと。
4. `Space` 解放後は元のツール挙動に戻ること。
5. ミドルクリックパン（既存機能）を壊さないこと。
6. テキスト入力中（`input/textarea/select/contentEditable`）は Spaceパンを発動しないこと。
7. カーソル状態を保持すること:
   - Space押下中: `grab`
   - パン中: `grabbing`
8. 既存の `SelectionOverlay` 機能（矩形/楕円/自動選択）の非Space時挙動を維持すること。

## 実装要件（Should）
1. Space押下判定をCanvas/Overlayで二重実装せず、判定経路を明確化すること。
2. イベント優先順位をコードコメントで簡潔に明示すること。

## 非目標
- 2本指トラックパッドジェスチャーの追加
- Space以外の新規ショートカット追加

## 受け入れ基準（厳格）
以下すべてを満たした場合のみ完了:

1. `brush` ツール中に `Space + 左ドラッグ` しても描画されず、パンのみ発生する。
2. `select` ツール中に `SelectionOverlay` 上から `Space + 左ドラッグ` してパンできる。
3. `crop` ツール中でも同様に `Space + 左ドラッグ` でパンできる。
4. `Space` を離すと `select/crop` のドラッグ選択に戻る。
5. `textarea` フォーカス中に Spaceを押しても文字入力が優先され、パン状態に入らない。
6. ミドルクリックパンは従来どおり動作する。

## 必須テスト
1. 単体テスト
   - Space押下時のパン開始条件
   - Space未押下時の既存ツール処理継続
   - 入力フォーカス時のSpace無効化
   - ミドルクリックパン維持
2. 回帰テスト
   - `SelectionOverlay` 経由イベントでSpaceパンが阻害されないこと
3. 実行コマンド
   - `pnpm --filter @photoshop-app/app test`
   - `pnpm lint`

## 手動確認手順
1. ツールを `select` にする
2. キャンバスで `Space + 左ドラッグ` を行い、パンすることを確認
3. Spaceを離し、通常ドラッグで選択範囲が作れることを確認
4. ツールを `brush` にして `Space + 左ドラッグ` し、描画されないことを確認
5. テキスト編集状態で Space入力し、スペース文字が入力されることを確認

## 変更報告フォーマット（実装AI必須）
- 変更ファイル一覧
- 追加/変更テスト一覧
- `pnpm --filter @photoshop-app/app test` 実行結果
- `pnpm lint` 実行結果
- 未解決事項（あれば）
