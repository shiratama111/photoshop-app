# PS-HISTORY-001: 履歴を行動名で表示

## 目的
Historyパネルで `Action 1/2/3` ではなく、ユーザーが行った内容を表示する。

## 現状課題
- `HistoryPanel.tsx` がローカル状態で `Action N` を生成しており、実操作と一致しない。
- `Command.description` は存在するが、UIに十分活用されていない。

## 編集可能ファイル
- `packages/app/src/renderer/components/panels/HistoryPanel.tsx`
- `packages/app/src/renderer/store.ts`
- `packages/core/src/command-history.ts`
- `packages/core/src/commands/set-layer-property.ts`
- 必要に応じて各 `packages/core/src/commands/*.ts`
- 関連テスト

## 実装要件
1. 履歴エントリの単一情報源を `store` 側に移す（UIローカル生成禁止）。
2. `execute/undo/redo` 時に説明文を確定し、履歴配列と現在インデックスを更新する。
3. 説明文を人間向けに改善:
   - 例: `Set fontSize on "Title"` ではなく `「Title」の文字サイズを変更`
4. Historyパネルのクリックジャンプ（過去履歴選択で undo/redo 連続実行）を維持。
5. 新規ドキュメント作成時・ファイル読み込み時は履歴を初期化。

## 受け入れ条件
- 履歴に具体的行動が表示される（追加、削除、名前変更、文字サイズ変更など）。
- undo/redo で現在行インジケータが正しく移動。
- 新規作成/開くで履歴が `Original` のみになる。

## テスト
- 単体:
  - コマンド実行時に履歴説明が積まれる
  - undo/redoで履歴位置が更新される
- UI:
  - HistoryPanel が `Action N` を表示しない
  - クリックで過去状態に移動できる
