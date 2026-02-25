---
name: debug-fix
description: >
  photoshop-app 長期デバッグ — 構造化された多段階アプローチでバグを体系的に調査・修正する。
  スカウト偵察→仮説立案→検証→修正実装→回帰テストのワークフロー。
  Electron + React + TypeScript + pnpm モノレポ対応。
triggers:
  - バグ修正して
  - デバッグして
  - バグ取りして
  - 長期デバッグ
---

# photoshop-app 長期デバッグ スキル（Codex版）

構造化された長期アプローチで photoshop-app のバグを調査・修正する。

## プロジェクトコンテキスト

- **アプリ**: AI対応レイヤー画像エディタ（Electron + React 18 + Zustand）
- **言語**: TypeScript (strict, no `any`)
- **モノレポ**: pnpm workspaces — types, core, render, adapter-psd, adapter-abr, adapter-asl, ai, app
- **テスト**: Vitest（`*.test.ts` をソースと同じ場所に配置）
- **ビルド**: tsup（ライブラリ）、Vite + electron-builder（app）
- **検証コマンド**: `pnpm lint && pnpm test && pnpm build`

## 共通ルール

- 各フェーズの成果物は `debug-log.md` に追記する
- 推測で修正しない。仮説は検証してから修正に進む
- ドゥームループ検出: 同じ修正を3回試して失敗したら問題のフレームを変える
- コード変更は最小限に。バグ修正に無関係なリファクタリングをしない
- **パッケージ境界を厳守**: 修正は該当パッケージ内のみ
- **`types` パッケージは変更不可**（LOCKED）
- **`any` 禁止**: `unknown` + 型ガードを使う
- 修正後は `pnpm lint && pnpm test && pnpm build` が全てPASS必須

## ワークフロー

### Phase 0: バグの受付と状況確認

ユーザーから情報を収集（不足があれば質問）:
- チケットID（あれば）
- バグの概要と期待動作
- 再現手順
- エラーメッセージ（DevTools コンソール全文）
- 該当パッケージ
- 環境情報
- 既に試したこと
- 緊急度

### Phase 1: スカウト偵察（コード変更なし）

1. **バグの再現**: `pnpm dev` で起動、DevTools で確認
2. **影響範囲のマッピング**:
   - 関連ファイル一覧（パッケージ横断で追跡）
   - コールチェーン/データフロー（EventBus、Zustand store）
   - `git log` / `git blame` で最近の変更を確認
3. **ログ注入**: 戦略的な位置にログを追加して情報収集
4. **環境確認**: Node/pnpm バージョン、依存関係の整合性

**出力**: スカウトレポート（関連ファイル、コールチェーン、初期所見）

### Phase 2: 仮説立案

- 2-4個の競合仮説を立てる
- 各仮説に検証方法（Vitest テスト、手動再現、ログ確認）を付ける
- 検証コストと確率で優先順位付け

### Phase 3: 仮説検証

- 各仮説を順番に（または並行して）検証
- ユニットテストで検証可能 → `*.test.ts` を書いて実行
- 手動再現が必要 → `pnpm dev` で確認
- 全仮説否定 → Phase 1に戻り深堀り

### Phase 4: 修正実装

1. **修正方針をユーザーに提示し承認を得る**
2. 最小限の修正を実装
3. パッケージ境界を厳守（`types` 変更不可）
4. `any` 禁止、既存コーディング規約に従う

### Phase 5: テスト・検証

1. バグ修正を再現手順で確認
2. 回帰テストを作成（`packages/{pkg}/src/{module}.test.ts`）
3. `pnpm lint` → 0エラー
4. `pnpm test` → 全パッケージPASS
5. `pnpm build` → ビルド成功
6. エッジケースの確認

### Phase 6: 最終報告と記録

`debug-log.md` に記録し、ユーザーに「結論→根本原因→変更点→テスト結果→残課題」の順で報告。

## フェーズ間の判断ルール

| 状況 | アクション |
|:-----|:---------|
| Phase 1で原因が明白 | Phase 2-3をスキップし、Phase 4へ |
| Phase 3で全仮説が否定 | Phase 1に戻り深堀りスカウト |
| Phase 4の修正でテスト失敗 | Phase 2に戻り仮説を再検討 |
| 3回同じ修正が失敗 | 問題のフレームを変えて再アプローチ |
| `types` パッケージの変更が必要 | ユーザーに報告し別チケット化を提案 |
| 複数パッケージに跨る修正 | ユーザーに修正範囲を報告し承認を得る |

## 参照

- Claude Code版の詳細定義: `.claude/agents/debug-fix.md`
- レビューチェックリスト: `.claude/review-checklist.md`
- チケット定義: `.claude/tickets/`
