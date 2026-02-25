/**
 * @module editor-actions/types
 * EditorAction type definitions for the Editor Action API (Phase 2-1).
 *
 * Provides a discriminated union of all programmatically-invocable editor actions.
 * Used by the MCP server (Phase 2-3) and DevTools console for AI-driven editing.
 *
 * UI-only actions (dialog open/close, tool switching) are intentionally excluded.
 *
 * @see Phase 2-1: Editor Action API
 * @see Phase 2-3: MCP Server (consumer)
 */

/** Color definition for API payloads (channels 0-255). */
export interface ColorDef {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Gradient stop definition (position 0-1, channels 0-255). */
export interface GradientStopDef {
  position: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Result of executing a single EditorAction. */
export interface ActionResult {
  success: boolean;
  actionType: string;
  error?: string;
  layerId?: string;
  data?: unknown;
}

/** Discriminated union of all editor actions. */
export type EditorAction =
  // --- Layer Lifecycle ---
  | { type: 'createTextLayer'; params: { name?: string; text?: string; x?: number; y?: number } }
  | { type: 'createRasterLayer'; params: { name?: string } }
  | { type: 'createLayerGroup'; params: { name?: string } }
  | { type: 'removeLayer'; params: { layerId: string } }
  | { type: 'duplicateLayer'; params: { layerId: string } }
  | { type: 'selectLayer'; params: { layerId: string | null } }
  | { type: 'reorderLayer'; params: { layerId: string; newIndex: number } }
  // --- Layer Properties ---
  | { type: 'setLayerPosition'; params: { layerId: string; x: number; y: number } }
  | { type: 'setLayerOpacity'; params: { layerId: string; opacity: number } }
  | { type: 'setLayerBlendMode'; params: { layerId: string; blendMode: string } }
  | { type: 'setLayerVisibility'; params: { layerId: string; visible: boolean } }
  | { type: 'renameLayer'; params: { layerId: string; name: string } }
  | { type: 'resizeLayer'; params: { layerId: string; width: number; height: number } }
  // --- Text Properties ---
  | { type: 'setTextProperties'; params: { layerId: string; properties: Record<string, unknown> } }
  // --- Layer Effects ---
  | { type: 'addLayerEffect'; params: { layerId: string; effect: Record<string, unknown> } }
  | { type: 'removeLayerEffect'; params: { layerId: string; index: number } }
  | { type: 'updateLayerEffect'; params: { layerId: string; index: number; effect: Record<string, unknown> } }
  | { type: 'setLayerEffects'; params: { layerId: string; effects: Record<string, unknown>[] } }
  // --- Filters ---
  | { type: 'applyFilter'; params: { filterName: string; options?: Record<string, unknown> } }
  // --- Procedural Generation ---
  | { type: 'addGradientBackground'; params: { stops: GradientStopDef[]; gradientType: string; angle?: number } }
  | { type: 'addPattern'; params: { pattern: string; color: ColorDef; spacing: number; size: number; opacity: number } }
  | { type: 'addConcentrationLines'; params: { centerX: number; centerY: number; lineCount: number; color: ColorDef; innerRadius: number; lineWidth: number } }
  | { type: 'addBorderFrame'; params: { borderWidth: number; color: ColorDef; cornerRadius: number; style: string } }
  | { type: 'applyGradientMask'; params: { layerId: string; direction: string; fadeStart: number; fadeEnd: number } }
  // --- Image ---
  | { type: 'addImageAsLayer'; params: { base64Data: string; name: string } }
  // --- History ---
  | { type: 'undo'; params?: Record<string, never> }
  | { type: 'redo'; params?: Record<string, never> }
  // --- Document (read-only) ---
  | { type: 'getDocumentInfo'; params?: Record<string, never> }
  | { type: 'getLayerInfo'; params: { layerId: string } }
  | { type: 'getCanvasSnapshot'; params?: { includeThumbnails?: boolean } };
