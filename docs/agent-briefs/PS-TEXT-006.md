# PS-TEXT-006: テキストレイヤーTransform対応 + 変形時フォント自動拡縮

## 目的
テキストを画像レイヤー同様に扱えるようにし、ボックス変形時にフォントサイズを自動連動させる。

## 背景
現状 `TransformHandles` はラスターレイヤーのみ対象であり、テキストを直接変形できない。

## 編集可能ファイル
- `packages/app/src/renderer/components/canvas/TransformHandles.tsx`
- `packages/app/src/renderer/store.ts`
- `packages/types/src/layer.ts`（必要時）
- `packages/core/src/commands/*`（必要時）
- `packages/render/src/compositor.ts`（必要時）
- 関連テスト:
  - `packages/app/src/renderer/components/canvas/app-012-layer-resize.test.ts`（拡張）
  - `packages/app/src/renderer/store.test.ts`
  - 必要なら `packages/app/src/renderer/components/canvas/text-transform.test.ts` 新規

## 実装要件（Must）
1. テキストレイヤー選択時にもTransformHandlesが表示されること。
2. テキストボックスをドラッグで拡大/縮小したとき、以下を同時更新すること。
   - `textBounds.width/height`
   - `fontSize`（スケール連動）
3. フォントサイズ連動は次のルールを満たすこと。
   - 拡大時: `fontSize` 増加
   - 縮小時: `fontSize` 減少（下限1px）
   - Undo/Redoで可逆
4. テキスト位置（`position`）は変形結果に整合すること。
5. 日本語/英語混在文字列でも変形後描画が崩壊しないこと。

## 実装要件（Should）
1. スケーリング係数は非等方スケール時の破綻を避けること
   - 例: `sqrt(scaleX * scaleY)` など、仕様を明記して採用
2. 変形中プレビューとコミット後結果の見た目乖離を最小化すること。

## 非目標
- 自由変形（回転、遠近）
- 文字詰め自動最適化

## 受け入れ基準（厳格）
1. テキストレイヤーに8ハンドルが表示される。
2. 右下ハンドル拡大で `fontSize` が増える。
3. 左上ハンドル縮小で `fontSize` が減る（1未満にならない）。
4. 変形後に `テスト ABC 123` が描画され、可読性が維持される。
5. Undo/Redoでボックスサイズと `fontSize` が元に戻る。

## 必須テスト
1. 単体テスト
   - テキスト選択時のハンドル表示条件
   - 変形コミット時の `textBounds` / `fontSize` 更新
2. 回帰テスト
   - ラスター変形（APP-012）を壊さない
3. 実行コマンド
   - `pnpm --filter @photoshop-app/app test`
   - `pnpm lint`

## 手動確認手順
1. テキストレイヤーを選択
2. ハンドルで拡大し、フォントサイズが上がることを確認
3. ハンドルで縮小し、フォントサイズが下がることを確認
4. `テスト ABC 123` 表示が崩れないことを確認
5. Undo/Redoで往復確認

## 変更報告フォーマット（実装AI必須）
- 変更ファイル一覧
- 追加/変更テスト一覧
- テスト実行結果
- スケーリング式（採用理由付き）
- 未解決事項（あれば）
