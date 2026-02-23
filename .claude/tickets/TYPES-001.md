# TYPES-001: 共有型定義パッケージ
- **Package**: packages/types
- **Depends**: INFRA-001
- **Complexity**: L (most important ticket)

## Description
All shared type definitions: Document, Canvas, Layer (union), RasterLayer, TextLayer, LayerGroup, BaseLayer, BlendMode (enum), LayerEffect (union), StrokeEffect, DropShadowEffect, OuterGlowEffect, Command, CommandHistory, SegmentationProvider, Mask, BrushPreset, LayerStylePreset, Renderer, Viewport, EventBus, ProjectFile, PsdImportOptions, PsdExportOptions, Color, Rect, Point, CompatibilityReport. All with JSDoc. Zero runtime code.

## Acceptance Criteria
- Build with 0 errors
- All interfaces have JSDoc
- Other packages can import via `@photoshop-app/types`
