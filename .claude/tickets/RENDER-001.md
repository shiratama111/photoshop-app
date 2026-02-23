# RENDER-001: Canvas 2Dコンポジター
- **Package**: packages/render
- **Depends**: TYPES-001
- **Complexity**: L

## Description
Canvas 2D API implementation of Renderer interface. Traverse layer tree bottom-to-top, compositing with opacity + blendMode. Groups use offscreen canvas. Text via ctx.fillText(). Masks via destination-in. Effects (stroke/shadow/glow) via multi-pass rendering.

## Acceptance Criteria
- Correct multi-layer compositing
- All standard blend modes work
- 60fps with 5-10 layers at 2000x2000
