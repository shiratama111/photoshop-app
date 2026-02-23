# RENDER-003: WebGLコンポジター（オプション高速化）
- **Package**: packages/render
- **Depends**: TYPES-001, RENDER-001
- **Complexity**: L

## Description
WebGL 2 GPU-accelerated compositing. Layers as textures. Blend modes via GLSL fragment shaders. Fallback to Canvas 2D. Effects as post-processing shaders.

## Acceptance Criteria
- Visually matches Canvas 2D output
- 60fps with 20 layers at 4000x4000
- Textures properly released
