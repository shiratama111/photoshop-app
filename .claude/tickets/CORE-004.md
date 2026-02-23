# CORE-004: イベントバス
- **Package**: packages/core
- **Depends**: TYPES-001
- **Complexity**: S

## Description
Type-safe pub/sub event emitter. Events: document:changed, layer:added/removed/reordered, selection:changed, history:pushed/undone/redone, viewport:changed. Methods: on/off/once/emit.

## Acceptance Criteria
- Type safety tests
- No memory leaks (cleanup verification)
