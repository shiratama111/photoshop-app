# Multi-Agent Collaboration Rules

## Branch Rules
- **1 ticket = 1 branch**: Each agent works on one ticket in one feature branch
- **Branch naming**: `feat/{ticket-id-lowercase}-{short-description}`
  - Example: `feat/core-001-document-model`, `feat/render-001-canvas-compositor`
- **Commit messages**: `{TICKET-ID}: {description}`
  - Example: `CORE-001: Implement Document class with layer tree management`

## Package Ownership
- Only edit files within your ticket's designated package
- **Never modify** files in other packages
- The `packages/types` package is **locked** after TYPES-001 merge. If you need type changes, record them in your ticket notes and report to the coordinator

## APP Package Sub-ownership (Wave 3)
To avoid conflicts within `packages/app`, each APP ticket owns specific directories:
- APP-003: `components/toolbar/`, `hooks/useHistory.ts`
- APP-004: `main/file-dialog.ts`, `components/dialogs/PsdDialog.tsx`
- APP-005: `components/text-editor/`, `components/dialogs/LayerStyleDialog.tsx`
- APP-006: `components/tools/CutoutTool.tsx`, `components/overlays/MaskOverlay.tsx`
- APP-007: `components/panels/AssetBrowser.tsx`

## Custom Commands & Skills
| Trigger | Command / Skill | Description |
|---------|----------------|-------------|
| 「バグ修正して」「デバッグして」「バグ取りして」「長期デバッグ」 | `/debug-fix` / `.agents/skills/debug-fix/` | 長期デバッグAgent Team（スカウト→仮説→検証→修正→テスト） |

バグ修正時は `.claude/agents/debug-fix.md`（Claude Code）または `.agents/skills/debug-fix/SKILL.md`（Codex）のワークフローに従う。

## Pre-PR Checklist
1. `pnpm lint` passes with 0 errors
2. `pnpm test` passes for your package
3. Rebase on latest `origin/main`: `git fetch origin && git rebase origin/main`
4. Run Codex review: `powershell -File scripts/review.ps1 -ticket "TICKET-ID" -branch "your-branch"`
5. Review result must be PASS or PASS_WITH_NOTES

## Merge Strategy
- Squash merge to main
- Delete feature branch after merge

## Dependency Graph
```
INFRA-001 -> TYPES-001 -> [Wave 1] -> [Wave 2] -> [Wave 3] -> [Wave 4]
```

Wave 1 (parallel): CORE-001, CORE-002, CORE-004, RENDER-001, RENDER-002, PSD-001, PSD-002, ABR-001, ASL-001, AI-001, APP-001
Wave 2 (after deps): CORE-003, RENDER-003, AI-002, APP-002, TEST-001
Wave 3 (after APP-002): APP-003, APP-004, APP-005, APP-006, APP-007
Wave 4 (final): APP-008
