# TMPL-001: テンプレートファイルI/O (.psxp)

## 目的
テンプレートの保存先をlocalStorageからファイルシステム(.psxp形式)に拡張し、
プリセットキャンバスサイズ（YouTube/Twitter/Instagram等）を実装する。

## 対象パッケージ
- `packages/app`

## 推奨ブランチ
- `feat/tmpl-001-psxp-file-io`

## 現状
- `template-store.ts`: localStorage保存のテンプレートstore — 完成済み（save/load/delete/rename）
- `TemplateDialog.tsx`: テンプレート一覧UI — 存在するが機能は基本的
- `NewDocumentDialog.tsx`: 新規ドキュメントダイアログ — 存在
- **ファイルI/O (.psxp) は未実装**
- **プリセットキャンバスサイズは未実装**

## 編集可能ファイル
- `packages/app/src/renderer/template-store.ts` — `.psxp` ファイルI/O追加
- `packages/app/src/renderer/components/dialogs/TemplateDialog.tsx` — ファイル保存/読込UI追加
- `packages/app/src/renderer/components/dialogs/NewDocumentDialog.tsx` — プリセットサイズ追加
- `packages/app/src/main/file-dialog.ts` — `.psxp` フィルタ追加（最小限）

## 編集禁止ファイル
- `packages/app/src/renderer/store.ts`
- `packages/app/src/renderer/components/panels/text-style-presets.ts`（PRESET-001の担当）
- `packages/render/` 配下全て
- `packages/core/` 配下全て

## 実装要件（Must）
1. **`.psxp` ファイル形式定義**
   - JSON構造をZIP圧縮（fflate使用 — 既に依存済み）
   - 中身: `template.json`（メタデータ + レイヤー構造）+ `thumbnail.png`（プレビュー画像）
   - types定義は既に `ProjectFile` として存在（確認の上使用or拡張）

2. **テンプレート保存（Export）**
   - 「テンプレートとして保存」→ ファイルダイアログ → `.psxp` 保存
   - レイヤー構造・エフェクト・テキスト内容を含む（ラスターピクセルは含まない or 低解像度サムネイルのみ）
   - 保存時にサムネイル画像を生成して同梱

3. **テンプレート読込（Import）**
   - `.psxp` ファイルを開く → レイヤー構造を復元 → 新規ドキュメントとして開く
   - TemplateDialog上で「ファイルから読込」ボタン

4. **プリセットキャンバスサイズ**
   - NewDocumentDialogにプリセットドロップダウン追加:
     - YouTube サムネイル: 1280 x 720
     - Twitter ヘッダー: 1500 x 500
     - Twitter 投稿: 1200 x 675
     - Instagram 正方形: 1080 x 1080
     - Instagram ストーリー: 1080 x 1920
     - A4 横 (72dpi): 842 x 595
     - カスタム（手動入力 — 既存機能）

## 実装要件（Should）
1. `.psxp` にラスターレイヤーのピクセルデータも保存するオプション（フルテンプレート）
2. テンプレート一覧でのサムネイルプレビュー表示

## 受け入れ基準
1. `.psxp` ファイルとしてテンプレートが保存できる
2. `.psxp` ファイルからテンプレートを読み込んで新規ドキュメントが開ける
3. プリセットキャンバスサイズが6種以上選択できる
4. localStorageベースの既存テンプレート機能に回帰がない

## 必須テスト
- `.psxp` ファイルの保存→読込ラウンドトリップテスト
- プリセットサイズ選択テスト
- 空テンプレート・テキストのみテンプレートの保存/読込

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
