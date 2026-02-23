# CORE-002: Command履歴（Undo/Redo）
- **Package**: packages/core
- **Depends**: TYPES-001
- **Complexity**: M

## Description
CommandHistory class (stack management, max depth 50). Commands: AddLayer, RemoveLayer, ReorderLayer, SetLayerProperty, ModifyPixels (save only changed region for memory efficiency).

## Acceptance Criteria
- All commands undo/redo correctly
- Redo stack clears on new command
- Memory efficiency tests
