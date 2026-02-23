# CORE-004: イベントバス
- **Package**: packages/core
- **Depends**: TYPES-001
- **Complexity**: S
- **Status**: Done
- **Branch**: feat/core-001-document-model
- **Commit**: 3e4b2cf

## Description
Type-safe pub/sub event emitter. Events: document:changed, layer:added/removed/reordered, selection:changed, history:pushed/undone/redone, viewport:changed. Methods: on/off/once/emit.

## Acceptance Criteria
- [x] Type safety tests
- [x] No memory leaks (cleanup verification)

## Implementation Summary
- `src/event-bus.ts` — `EventBusImpl` class implementing `EventBus` interface
  - `on()`: subscribe with unsubscribe function return
  - `once()`: single-fire listener with proper wrapper tracking
  - `off()`: remove listener (supports both `on` and `once` registrations)
  - `emit()`: snapshot iteration for safe mutation during emission
  - `clear()`: remove all listeners
  - Empty `Set` cleanup to prevent memory leaks
- `src/event-bus.test.ts` — 20 tests (on/emit, off, once, clear, memory leak prevention, emission-time safety, all 10 EventMap events)
