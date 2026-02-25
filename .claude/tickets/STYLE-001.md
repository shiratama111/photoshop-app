# STYLE-001: スタイル分析エンジン

## 目的
レイヤーエフェクトのパラメータと自然言語を相互変換するエンジンを構築する。
AIが「白文字に黒の太い縁取り」と指示するだけでエフェクト設定が生成され、
逆にエフェクト設定を読んで「金色のメタリック文字」と説明できるようにする。

## 対象パッケージ
- `packages/app`（editor-actions配下）

## 推奨ブランチ
- `feat/style-001-style-analyzer`

## 現状
- Editor Action API: 実装済み（`editor-actions/`）
- Canvas Snapshot: 実装済み（`editor-actions/snapshot.ts`）
- MCP Server: 実装済み（`packages/mcp/`）
- `text-style-presets.ts`: 8プリセットの定義あり — スタイル分析の「正解データ」として活用可能
- **自然言語↔エフェクトパラメータの変換は未実装**

## 編集可能ファイル
- `packages/app/src/renderer/editor-actions/style-analyzer.ts` — **新規作成**
- `packages/app/src/renderer/editor-actions/style-analyzer.test.ts` — **新規作成**
- `packages/app/src/renderer/editor-actions/style-vocabulary.ts` — **新規作成**（スタイル語彙辞書）

## 編集禁止ファイル
- `packages/app/src/renderer/editor-actions/dispatcher.ts`
- `packages/app/src/renderer/editor-actions/types.ts`
- `packages/app/src/renderer/store.ts`
- `packages/mcp/`（MCP-002の担当）
- `packages/render/` 配下全て
- `packages/core/` 配下全て

## 実装要件（Must）
1. **エフェクトパラメータ → 自然言語記述**（`describeEffects()`）
   - 入力: `LayerEffect[]`（+ fontFamily, color等のテキストプロパティ）
   - 出力: 自然言語の説明文（日本語 + 英語対応）
   - 例:
     - `[stroke(black, 4px), drop-shadow]` → 「白文字に黒の太い縁取り + 影」
     - `[gradient-overlay(gold→orange), bevel-emboss]` → 「金色のメタリック文字」
     - `[stroke(red, 3px)]` → 「赤い縁取り付き速報風テキスト」

2. **自然言語 → エフェクトパラメータ**（`parseStyleDescription()`）
   - 入力: 自然言語の説明文（「白文字に黒縁取り」「インパクトのある赤文字」等）
   - 出力: `{ fontFamily?, fontSize?, color?, effects: LayerEffect[] }`
   - ルールベースの解析（Phase 3でAI推論に拡張予定）

3. **スタイル語彙辞書**（`style-vocabulary.ts`）
   - 色名マッピング: 「白」「黒」「赤」「金色」「ネオン」→ RGB値
   - 形容詞マッピング: 「太い」→ size大, 「薄い」→ opacity低, 「派手」→ glow + saturated colors
   - スタイル名マッピング: 「YouTuber風」「インパクト」「エレガント」→ プリセットパラメータ
   - 日本語・英語両対応

4. **Snapshot統合**
   - `getCanvasSnapshot()` の出力にスタイル記述を含める
   - AIが現在のスタイルを「読む」ことができるようにする

## 実装要件（Should）
1. 類似スタイルの提案（「こういう雰囲気に近いプリセットはこれです」）
2. スタイルの差分記述（「現在のスタイルからもう少し派手にするには→outer-glowを追加」）

## 受け入れ基準
1. 8種のビルトインプリセットを正しく自然言語で記述できる
2. 基本的な自然言語（「白文字に黒縁取り」「赤い太文字」）をエフェクトに変換できる
3. 日本語・英語の両方で動作する
4. 既存のEditor Action API・Snapshotに回帰がない

## 必須テスト
- 全8ビルトインプリセットの記述テスト
- 基本的な自然言語解析テスト（10パターン以上）
- 色名→RGB変換テスト
- ラウンドトリップテスト（エフェクト→記述→エフェクト で同等結果）

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
