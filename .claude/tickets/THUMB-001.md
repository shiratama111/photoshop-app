# THUMB-001: サムネイル設計AI

## 目的
ユーザーの指示から「サムネイルの設計図」（JSON）を生成するAIワークフローを構築する。
「衝撃的なニュース系サムネ、タイトル: AIが弁護士を超えた日」のような指示で
レイアウト・色・フォント・エフェクトの完全な設計図を自動生成する。

## 対象パッケージ
- `packages/app`（AI統合レイヤー）

## 推奨ブランチ
- `feat/thumb-001-thumbnail-architect`

## 依存チケット
- STYLE-001（スタイル分析エンジン — スタイル語彙を使用）
- FONT-001（Google Fonts — フォントカタログを参照）

## 編集可能ファイル
- `packages/app/src/renderer/ai/thumbnail-architect.ts` — **新規作成**
- `packages/app/src/renderer/ai/thumbnail-architect.test.ts` — **新規作成**
- `packages/app/src/renderer/ai/design-patterns.ts` — **新規作成**（デザインパターンDB）
- `packages/app/src/renderer/ai/design-schema.ts` — **新規作成**（設計図スキーマ）

## 編集禁止ファイル
- `packages/app/src/renderer/editor-actions/`（STYLE-001の担当）
- `packages/app/src/renderer/store.ts`
- `packages/mcp/`（MCP-002の担当）

## 実装要件（Must）
1. **設計図スキーマ**（`design-schema.ts`）
   ```typescript
   interface ThumbnailDesign {
     canvas: { width: number; height: number };
     background: BackgroundDesign;  // 色、グラデーション、パターン
     layers: LayerDesign[];         // テキスト、画像配置、装飾
     metadata: { category: string; mood: string; targetPlatform: string };
   }
   ```

2. **デザインパターンDB**（`design-patterns.ts`）
   - カテゴリ別テンプレート: ニュース系、How-To系、Vlog系、商品紹介系、ゲーム実況系
   - 各カテゴリのレイアウトパターン（テキスト位置、サイズ配分、色彩傾向）
   - 色彩心理学ルール（赤=緊急、青=信頼、黄=注目 等）

3. **Thumbnail Architect**（`thumbnail-architect.ts`）
   - 入力: ユーザー指示（自然言語）+ オプション（カテゴリ、プラットフォーム、色指定等）
   - 出力: `ThumbnailDesign` JSON
   - 処理: Claude API呼び出し（structured output）+ デザインパターンDBの参照
   - プロンプトにデザインパターンDBのルールを注入

4. **設計図→EditorAction変換**
   - `ThumbnailDesign` → `EditorAction[]` への変換関数
   - 設計図の各要素をEditor Action APIの操作列に変換

## 実装要件（Should）
1. 反復改善: 「もう少し派手に」「色を変えて」等の指示で設計図を更新
2. 複数バリエーション生成（同じ指示で3パターン出力）

## 受け入れ基準
1. 自然言語指示から設計図JSONが生成される
2. 設計図がThumbnailDesignスキーマに準拠している
3. 設計図→EditorAction変換が動作する
4. 5カテゴリ以上のデザインパターンが登録されている

## 必須テスト
- 設計図スキーマのバリデーションテスト
- デザインパターンDBの完全性テスト
- 設計図→EditorAction変換テスト
- API呼び出しのモックテスト

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
