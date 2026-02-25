# PS-TEXT-007: テキスト品質ゲート（回帰テスト + 手動検証シナリオ）

## 目的
PS-TEXT-004〜006で導入したテキスト機能を安定運用可能な品質まで固定する。

## 編集可能ファイル
- `packages/app/src/renderer/components/canvas/*.test.ts`
- `packages/app/src/renderer/components/text-editor/*.test.ts`
- `packages/app/src/renderer/store.test.ts`
- `packages/render/src/compositor.test.ts`
- `tests/integration/*`（必要時）
- `docs/agent-briefs/DISPATCH_MESSAGES.md`（必要時）

## 実装要件（Must）
1. 次の回帰観点を自動テスト化すること。
   - 単クリックで新規/既存編集分岐
   - 日本語IME入力の保持
   - 文字可視性（編集中/確定後）
   - テキスト変形時の `fontSize` 連動
   - Undo/Redo整合
2. 手動検証チェックリストを文書化すること。
3. 既存機能（ブラシ、パン、選択、ラスター変形）への副作用がないことを確認すること。

## 実装要件（Should）
1. 失敗時に原因追跡しやすい命名のテストケースにすること。
2. 長文化した入力（複数行・日本語英語混在）でケースを追加すること。

## 非目標
- 新機能追加
- UIデザイン刷新

## 受け入れ基準（厳格）
1. テキスト重点テスト群がローカル/CIで安定通過する。
2. 仕様逸脱（クリック不可、文字非表示、変形で文字崩壊）が再発しない。
3. 手動チェックリストに従って再現確認できる。

## 必須テスト実行
1. `pnpm --filter @photoshop-app/app test`
2. `pnpm --filter @photoshop-app/render test`
3. `pnpm test`
4. `pnpm lint`

## 手動確認（必須シナリオ）
1. 新規作成: 単クリック -> 入力 -> 確定
2. 既存編集: 既存文字クリック -> 追記
3. IME: 日本語変換中の入力維持
4. 変形: ハンドル操作で文字サイズ連動
5. 履歴: Undo/Redoで往復
6. 副作用: Spaceパン/選択/ブラシの回帰なし

## 変更報告フォーマット（実装AI必須）
- 追加/変更テスト一覧
- テスト実行結果（4コマンド）
- 手動確認結果（シナリオごとにPASS/FAIL）
- 既知課題（あれば）
