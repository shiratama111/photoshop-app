# FONT-001: Google Fonts統合

## 目的
Google Fonts APIと連携し、1,500+のWebフォントをエディタ上で検索・プレビュー・使用可能にする。
サムネイル制作におけるフォント選択肢を劇的に拡大する。

## 対象パッケージ
- `packages/app`（メインプロセス + レンダラー）

## 推奨ブランチ
- `feat/font-001-google-fonts`

## 現状
- システムフォント列挙: 実装済み（`main/font-list.ts` → PowerShell列挙）
- カスタムフォント読込: 実装済み（`FontSelector.tsx` → FontFace API + D&D + localStorage永続化）
- Google Fonts: **未実装**

## 編集可能ファイル
- `packages/app/src/main/google-fonts.ts` — **新規作成**
- `packages/app/src/renderer/components/text-editor/GoogleFontsBrowser.tsx` — **新規作成**
- `packages/app/src/renderer/components/text-editor/google-fonts-store.ts` — **新規作成**
- `packages/app/src/renderer/components/text-editor/FontSelector.tsx` — Google Fontsタブ追加部分のみ
- `packages/app/src/main/index.ts` — IPC handler登録の1行追加のみ

## 編集禁止ファイル
- `packages/app/src/main/font-list.ts`（システムフォント — 変更不要）
- `packages/app/src/renderer/store.ts`
- `packages/render/` 配下全て
- `packages/core/` 配下全て

## 実装要件（Must）
1. **Google Fonts APIクライアント**（メインプロセス）
   - `https://www.googleapis.com/webfonts/v1/webfonts` からフォントメタデータを取得
   - API Keyは環境変数 `GOOGLE_FONTS_API_KEY` から取得（なければオフラインキャッシュのみ）
   - フォントメタデータのローカルキャッシュ（JSON、`userData`ディレクトリに保存）
   - IPC channel: `font:searchGoogleFonts`, `font:downloadGoogleFont`

2. **フォントダウンロード・登録**
   - 選択したフォントの`.woff2`をダウンロード→ `userData/fonts/` に保存
   - レンダラー側で `FontFace` APIでランタイム登録
   - ダウンロード済みフォントはアプリ再起動後も利用可能

3. **Google Fontsブラウザ UI**
   - カテゴリフィルタ（sans-serif / serif / display / handwriting / monospace）
   - テキスト検索（フォント名）
   - プレビュー文字列のカスタマイズ（「サンプルテキスト」をユーザーが入力）
   - 人気順 / 新着順 ソート
   - 「ダウンロード」ボタン → ローカルに保存 → FontSelectorに反映

4. **FontSelectorとの統合**
   - FontSelector.tsx にGoogleフォントセクションを追加（「☁ Google Fonts」ラベル）
   - ダウンロード済みのGoogleフォントはシステムフォントと同列に表示
   - 未ダウンロードのフォントは薄い表示 + クリックでダウンロード

## 実装要件（Should）
1. フォントのサブセット対応（日本語フォントは容量が大きいため、表示に必要な文字だけDLする検討）
2. フォントの分類タグ表示（「力強い」「エレガント」等 — Phase 3のAIフォント選択の布石）

## 受け入れ基準
1. Google Fonts APIからフォント一覧を取得できる
2. フォントを検索・フィルタできる
3. フォントをダウンロードしてテキストレイヤーに適用できる
4. ダウンロード済みフォントがアプリ再起動後も使える
5. API Key未設定でもオフラインキャッシュで動作する（graceful degradation）
6. 既存のシステムフォント・カスタムフォント機能に回帰がない

## 必須テスト
- Google Fonts APIクライアントのユニットテスト（モック使用）
- フォントダウンロード・キャッシュのテスト
- FontSelector統合テスト（Googleフォントセクション表示）

## 実行コマンド
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
