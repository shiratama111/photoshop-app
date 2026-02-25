# AIFONT-001: フォント自動選択AI

## 目的
テキスト内容と雰囲気からフォントを自動選択するAI機能を実装する。
「力強い」「エレガント」「カジュアル」等の形容詞やテキスト内容から最適フォントを推薦する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/aifont-001-font-selection`

## 依存チケット
- FONT-001（Google Fonts統合 — フォントカタログが必要）

## 編集可能ファイル
- `packages/app/src/renderer/ai/font-selector-ai.ts` — **新規作成**
- `packages/app/src/renderer/ai/font-selector-ai.test.ts` — **新規作成**
- `packages/app/src/renderer/ai/font-catalog.ts` — **新規作成**（フォントメタデータカタログ）

## 編集禁止ファイル
- `packages/app/src/renderer/components/text-editor/FontSelector.tsx`（FONT-001の担当）
- `packages/app/src/renderer/ai/thumbnail-architect.ts`（THUMB-001の担当）
- `packages/app/src/renderer/store.ts`

## 実装要件（Must）
1. **フォントカタログ**（`font-catalog.ts`）
   - フォントごとのメタデータ: カテゴリ（serif/sans/display/handwriting）、ウェイト、言語対応
   - 属性タグ: 「力強い」「エレガント」「カジュアル」「ポップ」「フォーマル」「レトロ」「モダン」「手書き風」
   - 日本語フォントの分類: ゴシック系、明朝系、丸ゴシック、手書き、デザイン
   - Google Fontsのメタデータとの統合

2. **フォント推薦エンジン**（`font-selector-ai.ts`）
   - 入力: テキスト内容 + 雰囲気記述（形容詞 or カテゴリ）+ 言語
   - 出力: 推薦フォントリスト（スコア付き、上位5件）
   - ルールベースマッチング: 属性タグと形容詞のマッチング
   - 言語適合性: 日本語テキストには日本語対応フォントを優先

3. **推薦ルール**
   - サムネイルのジャンル別推薦（ニュース系→Impact/Noto Sans JP Bold、エレガント→Georgia/游明朝）
   - テキスト長による推薦（短い→太字Display系、長い→読みやすいSans系）
   - 既存レイヤーのフォントとの調和（見出し←→本文の組み合わせ）

## 実装要件（Should）
1. Claude API連携による高度な推薦（テキストの感情分析→フォント選択）
2. ユーザーの選択履歴からの学習（よく使うフォントを優先）

## 受け入れ基準
1. テキスト+形容詞から5件以上のフォントが推薦される
2. 日本語テキストに日本語対応フォントが推薦される
3. 推薦スコアが妥当（形容詞とフォント属性の一致度）
4. 50件以上のフォントにメタデータが付与されている

## 必須テスト
- フォントカタログの完全性テスト（タグ付与率）
- 推薦結果の妥当性テスト（「力強い」→ bold/display系が上位）
- 日本語フォントフィルタテスト
- エッジケース（空テキスト、未知の形容詞）

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
