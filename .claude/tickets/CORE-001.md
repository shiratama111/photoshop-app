# CORE-001: ドキュメントモデルとレイヤーツリー
- **Package**: packages/core
- **Depends**: TYPES-001
- **Complexity**: M

## Description
Document (canvas size, root LayerGroup), Layer types (Raster/Text/Group). Layer CRUD: add, remove, reorder, find by ID. UUID v4 for IDs. Depth-first traversal.

## Acceptance Criteria
- Unit tests for all layer CRUD operations
- Coverage 90%+
