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

## Debug Workflow
バグ修正は `.claude/agents/debug-fix.md` に定義された構造化ワークフローに従う:
1. **Phase 0**: バグ受付票の作成（チケットID・再現手順・該当パッケージ）
2. **Phase 1**: スカウト偵察（コード変更なし、パッケージ横断で影響範囲マッピング）
3. **Phase 2**: 仮説立案（2-4個の競合仮説 + 検証方法）
4. **Phase 3**: 並列検証（Task toolで各仮説を独立検証）
5. **Phase 4**: 修正実装（ユーザー承認後、パッケージ境界厳守、最小限の変更）
6. **Phase 5**: テスト・検証（回帰テスト + `pnpm lint && pnpm test && pnpm build` 全PASS）
7. **Phase 6**: `debug-log.md` に記録、最終レポート
