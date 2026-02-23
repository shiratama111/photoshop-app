# CORE-003: プロジェクト保存形式（.psxp）
- **Package**: packages/core
- **Depends**: TYPES-001, CORE-001
- **Complexity**: M

## Description
ZIP-based project file. manifest.json (version, canvas, layer tree structure) + layers/ (PNG per layer) + thumbnails/. Use fflate for ZIP. serialize/deserialize functions.

## Acceptance Criteria
- Round-trip produces identical document
- 4000x4000 with 10 layers completes in under 2 seconds
