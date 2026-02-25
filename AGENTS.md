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

## File Ownership (Wave 5-10: Roadmap Tickets)

Wave 5-10 のチケットは **各チケットのmdファイル内に「編集可能ファイル」「編集禁止ファイル」を明記** している。
必ずチケットファイルを読んでからコーディングを開始すること。

### Wave 5 (Quality Hardening — 全並列)
- FONT-001: `main/google-fonts.ts`(new), `text-editor/GoogleFontsBrowser.tsx`(new), `FontSelector.tsx`(Google Fontsタブ部分のみ)
- QUALITY-001: `render/src/effect-quality.test.ts`(new), `render/src/effect-combination.test.ts`(new)
- EXPORT-001: `app/src/renderer/export-quality.test.ts`(new)
- PERF-001: `render/benchmarks/`(new dir)

### Wave 6 (Templates & Presets — 全並列)
- TMPL-001: `template-store.ts`, `TemplateDialog.tsx`, `NewDocumentDialog.tsx`
- PRESET-001: `text-style-presets.ts`, `TextStylePresetsPanel.tsx`(new)
- DECO-001: `core/procedural.ts`(集中線追加), `render/decorations.ts`(new)
- CLIP-001: `core/layer-tree.ts`(clipping), `render/compositor.ts`(clipping描画)

### Wave 7 (Advanced Features — 全並列)
- BG-001: `PatternDialog.tsx`, `background-presets.ts`, `pattern-generator.ts`(new)
- GMASK-001: `render/gradient-mask.ts`(new), `GradientMaskDialog.tsx`
- SMART-001: `core/smart-object.ts`(new), `core/layer-factory.ts`, `core/commands/`(new)

### Wave 8 (AI Control — 全並列)
- STYLE-001: `editor-actions/style-analyzer.ts`(new), `editor-actions/style-vocabulary.ts`(new)
- MCP-002: `mcp/src/tools.ts`(ツール追加)

### Wave 9 (AI Generation — THUMB-001 + AIFONT-001 並列 → PIPE-001)
- THUMB-001: `ai/thumbnail-architect.ts`(new), `ai/design-patterns.ts`(new)
- AIFONT-001: `ai/font-selector-ai.ts`(new), `ai/font-catalog.ts`(new)
- PIPE-001: `ai/pipeline.ts`(new), `mcp/tools.ts`(パイプラインツール追加)

### Wave 10 (Reference Reproduction — ANALYZE-001 + BATCH-001 並列 → TRANSFER-001)
- ANALYZE-001: `ai/thumbnail-analyzer.ts`(new), `ai/color-palette.ts`(new), `packages/ai/layout-detector.ts`(new)
- BATCH-001: `ai/image-gen-client.ts`(new), `ai/batch-generator.ts`(new)
- TRANSFER-001: `ai/style-transfer.ts`(new)

## Dependency Graph
```
INFRA-001 -> TYPES-001 -> [Wave 1] -> [Wave 2] -> [Wave 3] -> [Wave 4]
                                                                   ↓
[Wave 5: FONT-001 | QUALITY-001 | EXPORT-001 | PERF-001]
                          ↓
[Wave 6: TMPL-001 | PRESET-001 | DECO-001 | CLIP-001]
                          ↓
[Wave 7: BG-001 | GMASK-001 | SMART-001]
                          ↓
[Wave 8: STYLE-001 | MCP-002]
                          ↓
[Wave 9: THUMB-001 + AIFONT-001 → PIPE-001]
                          ↓
[Wave 10: ANALYZE-001 + BATCH-001 → TRANSFER-001]
```

Wave 1 (parallel): CORE-001, CORE-002, CORE-004, RENDER-001, RENDER-002, PSD-001, PSD-002, ABR-001, ASL-001, AI-001, APP-001
Wave 2 (after deps): CORE-003, RENDER-003, AI-002, APP-002, TEST-001
Wave 3 (after APP-002): APP-003, APP-004, APP-005, APP-006, APP-007
Wave 4 (final): APP-008
Wave 5 (quality): FONT-001, QUALITY-001, EXPORT-001, PERF-001
Wave 6 (templates): TMPL-001, PRESET-001, DECO-001, CLIP-001
Wave 7 (advanced): BG-001, GMASK-001, SMART-001
Wave 8 (ai-control): STYLE-001, MCP-002
Wave 9 (ai-gen): THUMB-001, AIFONT-001, PIPE-001
Wave 10 (reproduction): ANALYZE-001, TRANSFER-001, BATCH-001
