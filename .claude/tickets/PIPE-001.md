# PIPE-001: E2E自動生成パイプライン

## 目的
ユーザー指示 → 設計図生成 → EditorAction実行 → レンダリング → PNG出力
の一気通貫パイプラインを構築する。
「こういうサムネを作って」の一言で完成品が出る状態を達成する。

## 対象パッケージ
- `packages/app`（パイプラインオーケストレーター）
- `packages/mcp`（MCP経由のパイプライン起動）

## 推奨ブランチ
- `feat/pipe-001-e2e-pipeline`

## 依存チケット
- THUMB-001（サムネイル設計AI — 設計図生成）
- AIFONT-001（フォント自動選択AI — フォント解決）
- STYLE-001（スタイル分析エンジン — スタイル解決）

## 編集可能ファイル
- `packages/app/src/renderer/ai/pipeline.ts` — **新規作成**
- `packages/app/src/renderer/ai/pipeline.test.ts` — **新規作成**
- `packages/mcp/src/tools.ts` — パイプラインツール追加（`generate_thumbnail` ツール）

## 編集禁止ファイル
- `packages/app/src/renderer/ai/thumbnail-architect.ts`（THUMB-001の担当）
- `packages/app/src/renderer/ai/font-selector-ai.ts`（AIFONT-001の担当）
- `packages/app/src/renderer/editor-actions/style-analyzer.ts`（STYLE-001の担当）
- `packages/app/src/renderer/store.ts`

## 実装要件（Must）
1. **パイプラインオーケストレーター**（`pipeline.ts`）
   ```
   ユーザー指示
     → ThumbnailArchitect.generate(指示)
     → FontSelectorAI.resolveFonts(設計図)
     → StyleAnalyzer.resolveStyles(設計図)
     → EditorActionDispatcher.execute(actions)
     → Canvas2DRenderer.render()
     → ExportPNG()
   ```

2. **パイプライン制御**
   - ステップごとの進捗通知（EventBus経由）
   - 中間結果の確認ポイント（設計図確認→承認→実行）
   - エラー時の部分ロールバック（Undo）

3. **反復改善フロー**
   - 生成後に「もう少し派手に」「色を変えて」等の追加指示
   - 設計図の差分更新→差分アクション実行
   - レイヤーの手動編集との共存（AIが作ったレイヤーは通常レイヤーとして編集可能）

4. **MCPツール**
   - `generate_thumbnail(instruction, options?)` — テキスト指示からサムネイル自動生成
   - `refine_thumbnail(instruction)` — 既存サムネイルの反復改善
   - Claude Codeから「サムネイル作って」で完結するフロー

## 実装要件（Should）
1. 複数バリエーション一括生成（3パターン出力→ユーザーが選択）
2. 生成ログの保存（指示→設計図→結果の履歴）

## 受け入れ基準
1. テキスト指示からPNG画像が1回の操作で生成される
2. 生成されたサムネイルが設計図の指定通りのレイアウト・色・エフェクト
3. MCP経由でパイプラインが起動できる
4. 反復改善が動作する（追加指示→更新→再レンダリング）

## 必須テスト
- パイプライン全体の統合テスト（モックAI使用）
- 各ステップのユニットテスト
- エラーハンドリングテスト（API失敗、不正な設計図等）
- 反復改善テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm --filter @photoshop-app/mcp test`
- `pnpm lint`
