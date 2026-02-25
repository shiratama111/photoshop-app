# PRESET-001: テキストスタイルプリセットUI

## 目的
テキストスタイルプリセット（フォント+エフェクトのセット）をUIから閲覧・適用・管理できるパネルを実装する。
サムネイル制作でよく使うスタイルをワンクリックで適用可能にする。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/preset-001-text-style-ui`

## 現状
- `text-style-presets.ts`: 8種のビルトインプリセット定義済み（YouTuber定番、インパクト、エレガント等）
- `TextStylePreset` インターフェース定義済み
- **プリセット一覧パネルは未実装**
- **カスタムプリセット保存は未実装**
- **ワンクリック適用のUI導線は未実装**

## 編集可能ファイル
- `packages/app/src/renderer/components/panels/TextStylePresetsPanel.tsx` — **新規作成**
- `packages/app/src/renderer/components/panels/text-style-presets.ts` — カスタムプリセット管理追加
- `packages/app/src/renderer/components/panels/TextStylePresetsPanel.test.ts` — **新規作成**

## 編集禁止ファイル
- `packages/app/src/renderer/store.ts`
- `packages/app/src/renderer/template-store.ts`（TMPL-001の担当）
- `packages/app/src/renderer/components/text-editor/FontSelector.tsx`（FONT-001の担当）
- `packages/app/src/renderer/components/dialogs/LayerStyleDialog.tsx`
- `packages/render/` 配下全て
- `packages/core/` 配下全て

## 実装要件（Must）
1. **プリセット一覧パネル**（`TextStylePresetsPanel.tsx`）
   - カテゴリ別タブ: YouTube / Impact / Elegant / Custom / Imported
   - 各プリセットをカード形式で表示（名前 + プレビュー）
   - プレビュー: そのスタイルで「Aa」を描画した小さなCanvas（フォント+色+エフェクト反映）

2. **ワンクリック適用**
   - プリセットカードをクリック → 選択中のテキストレイヤーにスタイル適用
   - 適用内容: fontFamily, fontSize, bold, italic, color, effects を一括設定
   - テキストレイヤーが選択されていない場合は、プリセットのスタイルで新規テキストレイヤー作成

3. **カスタムプリセット管理**
   - 「現在のスタイルを保存」ボタン → 名前入力 → カスタムプリセットとして保存
   - カスタムプリセットの削除（右クリックメニュー or 削除ボタン）
   - localStorage に永続化

4. **ASLインポート連携**
   - ASLファイル（Photoshopスタイル）からインポートしたスタイルをプリセット一覧に表示
   - category: 'imported' として表示

## 実装要件（Should）
1. プリセットカードのドラッグ&ドロップでキャンバス上のテキストに適用
2. プリセットのエクスポート（JSON形式）

## 受け入れ基準
1. 8種のビルトインプリセットが一覧表示される
2. プリセットをクリックしてテキストレイヤーにスタイルが適用される
3. カスタムプリセットの保存・削除ができる
4. カテゴリ別フィルタが動作する

## 必須テスト
- ビルトインプリセット一覧の表示テスト
- プリセット適用テスト（フォント・色・エフェクトが変更される）
- カスタムプリセット保存/削除のテスト
- テキストレイヤー未選択時の挙動テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
