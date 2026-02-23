# RENDER-002: ビューポート（ズーム/パン）
- **Package**: packages/render
- **Depends**: TYPES-001
- **Complexity**: M

## Description
Viewport class. Zoom (0.01x-64x), pan offset. Screen<->document coordinate transform. Zoom-to-point, fit-to-window, 100% view. Smooth animation.

## Acceptance Criteria
- Cursor-centered zoom
- Accurate coordinate transforms
- Keyboard shortcuts (Ctrl+0/1/+/-)
