# Photoshop App - Claude Code Instructions

## Project Overview
AI-friendly layered image editor built with Electron, specialized for YouTube/product thumbnail creation. Supports PSD import/export, AI-powered subject cutout, layer styles, text composition, and Photoshop asset (brush/style/font) import.

## Tech Stack
- **Runtime**: Electron (Node 20+)
- **UI**: React 18 + Zustand
- **Language**: TypeScript (strict mode)
- **Build**: tsup (libraries), Vite + electron-builder (app)
- **Test**: Vitest
- **Package Manager**: pnpm workspaces

## Key Libraries
| Component | Library |
|-----------|---------|
| PSD I/O | ag-psd |
| ZIP | fflate |
| AI Inference | onnxruntime-web |
| Segmentation | Mobile SAM (ONNX) |
| State | Zustand |

## Architecture
- **Monorepo** with packages: types, core, render, adapter-psd, adapter-abr, adapter-asl, ai, app
- `packages/types` is the shared contract — all other packages depend on it
- Packages communicate through typed interfaces, not direct imports of implementation

## Coding Standards
- No `any` types — use `unknown` with type guards
- All public APIs must have JSDoc comments
- All public functions must have explicit return types
- Use `@photoshop-app/types` for shared types — no local type duplication
- Use EventBus for cross-module communication
- No `eval()` or `new Function()`
- No `nodeIntegration` in renderer — use Context Bridge

## Testing
- Every public function needs a unit test
- Use Vitest with `describe/it/expect`
- Test files: `*.test.ts` colocated with source

## Review
- Codex review is required before PR
- Run: `powershell -File scripts/review.ps1 -ticket "TICKET-ID" -branch "branch-name"`
- Review checklist: `.claude/review-checklist.md`

## Custom Commands
| Trigger | Command | Description |
|---------|---------|-------------|
| 「バグ修正して」「デバッグして」「バグ取りして」「長期デバッグ」 | `/debug-fix` | 長期デバッグAgent Teamを起動（スカウト→仮説→並列検証→修正→テスト） |

## Issue-Driven Development
このプロジェクトは GitHub Issues 駆動で開発を進める。

### ブランチ命名規則
| Issue 種類 | ブランチ名 |
|-----------|-----------|
| バグ修正 | `fix/issue-<番号>-<短い説明>` |
| 機能追加 | `feat/issue-<番号>-<短い説明>` |
| リファクタ | `refactor/issue-<番号>-<短い説明>` |

例: `fix/issue-42-layer-drag-bug`, `feat/issue-15-text-edit-doubleclick`

### 運用ルール
- **1 Issue = 1 Branch = 1 PR** を原則とする
- コミットメッセージに `#<Issue番号>` を含める（例: `fix: レイヤーD&Dの順序反転 #42`）
- PR マージ時に Issue を自動クローズする（`Closes #42` を PR 本文に記載）
- ラベルで分類: `bug`, `enhancement`, `UX`, `performance`, `priority:high/low`, `pkg:*`

### Claude Code での作業フロー
1. ユーザーが Issue 番号または内容を伝える
2. バグ → `/debug-fix` ワークフロー、機能追加 → 計画モードで設計
3. Issue 用ブランチを作成して作業
4. `pnpm lint && pnpm test && pnpm build` 全PASS を確認
5. コミット → PR 作成（ユーザー承認後）

## Debug Workflow
バグ修正は `.claude/agents/debug-fix.md` に定義された構造化ワークフローに従う:
1. **Phase 0**: バグ受付票の作成（チケットID・再現手順・該当パッケージ）
2. **Phase 1**: スカウト偵察（コード変更なし、パッケージ横断で影響範囲マッピング）
3. **Phase 2**: 仮説立案（2-4個の競合仮説 + 検証方法）
4. **Phase 3**: 並列検証（Task toolで各仮説を独立検証）
5. **Phase 4**: 修正実装（ユーザー承認後、パッケージ境界厳守、最小限の変更）
6. **Phase 5**: テスト・検証（回帰テスト + `pnpm lint && pnpm test && pnpm build` 全PASS）
7. **Phase 6**: `debug-log.md` に記録、最終レポート
