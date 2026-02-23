# INFRA-001: モノレポ初期構築
- **Package**: root / scripts
- **Depends**: none
- **Complexity**: M

## Description
pnpm-workspace.yaml、tsconfig.base.json、.eslintrc.json、.prettierrc、ルートpackage.json、各パッケージのpackage.json + tsconfig.json（スタブindex.ts）、.gitignore、AGENTS.md、CLAUDE.md、Electron builder設定、Vitest設定、GitHub Actions CI、scripts/review.ps1を作成

## Acceptance Criteria
- `pnpm install` succeeds
- `pnpm build` succeeds
- `pnpm test` succeeds
- `pnpm lint` succeeds
