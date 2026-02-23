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
