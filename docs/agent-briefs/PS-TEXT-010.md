# PS-TEXT-010: フォント管理の強化

## 目的
固定フォント7種から脱却し、システムフォント + 最近使用 + プレビュー基盤を導入する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/ps-text-010-font-management`

## 編集可能ファイル
- `packages/app/src/main/index.ts`
- `packages/app/src/preload/index.ts`
- `packages/app/src/renderer/store.ts`
- `packages/app/src/renderer/components/text-editor/TextPropertiesPanel.tsx`
- 関連テスト

## 実装要件（Must）
1. main process でシステムフォント一覧取得IPCを追加する。
2. preload で安全なAPIを公開する。
3. renderer/store でフォント一覧を取得しUIへ供給する。
4. TextPropertiesPanel の固定配列 `FONTS` を動的供給へ置換する。
5. 最近使ったフォント一覧を保持し、上位表示する。

## 実装要件（Should）
1. フォント名プレビュー（最低限 select option の fontFamily 適用）
2. 取得失敗時は既存7フォントへフォールバック
3. Google Fonts 連携は最小スパイク（将来拡張可能な接口）

## 受け入れ基準
1. 実行環境のフォントが一覧表示される。
2. フォント変更が既存テキストに反映される。
3. 最近使用フォントが更新される。

## 必須テスト
- IPCハンドラのユニットテスト（可能な範囲）
- store のフォント取得/フォールバックテスト
- TextPropertiesPanel の描画テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`

## 手動確認手順
1. TextPropertiesPanel を開く
2. システムフォント一覧が表示されることを確認
3. 任意フォントを選び反映を確認
4. 再選択で最近使用リスト順が更新されることを確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
