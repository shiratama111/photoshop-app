/**
 * @module editor-actions/dispatcher
 * Central dispatcher for EditorAction execution.
 *
 * Validates params, delegates to store actions, and returns structured results.
 * This is the main entry point for programmatic editor control (MCP, DevTools).
 *
 * Architecture:
 *   EditorAction → validateAction() → store action method → ActionResult
 *
 * @see Phase 2-1: Editor Action API
 * @see Phase 2-3: MCP Server (consumer)
 */

import type { Document, Layer, LayerGroup, RasterLayer, TextLayer, LayerEffect } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../store';
import { validateAction } from './validators';
import { resolveFilter } from './filter-registry';
import type { EditorAction, ActionResult } from './types';
import { captureCanvasSnapshot } from './snapshot';

/**
 * Execute a single EditorAction.
 * Validates params, dispatches to the store, and returns a result.
 */
export function executeAction(action: EditorAction): ActionResult {
  const state = useAppStore.getState();

  // 1. Validate
  const validation = validateAction(action, state);
  if (!validation.valid) {
    return { success: false, actionType: action.type, error: validation.error };
  }

  // 2. Dispatch
  try {
    switch (action.type) {
      // --- Layer Lifecycle ---
      case 'createTextLayer': {
        const { name, text, x, y } = action.params;
        if (x !== undefined && y !== undefined) {
          state.addTextLayerAt(x, y, name);
        } else {
          state.addTextLayer(name, text);
        }
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'createRasterLayer': {
        state.addRasterLayer(action.params.name);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'createLayerGroup': {
        state.addLayerGroup(action.params.name);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'removeLayer': {
        state.removeLayer(action.params.layerId);
        return { success: true, actionType: action.type };
      }

      case 'duplicateLayer': {
        state.duplicateLayer(action.params.layerId);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'selectLayer': {
        state.selectLayer(action.params.layerId);
        return { success: true, actionType: action.type };
      }

      case 'reorderLayer': {
        state.reorderLayer(action.params.layerId, action.params.newIndex);
        return { success: true, actionType: action.type };
      }

      // --- Layer Properties ---
      case 'setLayerPosition': {
        state.setLayerPosition(action.params.layerId, action.params.x, action.params.y);
        return { success: true, actionType: action.type };
      }

      case 'setLayerOpacity': {
        const opacity = validation.sanitized?.opacity as number ?? action.params.opacity;
        state.setLayerOpacity(action.params.layerId, opacity);
        return { success: true, actionType: action.type };
      }

      case 'setLayerBlendMode': {
        // Cast is safe — validator checked against VALID_BLEND_MODES
        state.setLayerBlendMode(
          action.params.layerId,
          action.params.blendMode as Parameters<typeof state.setLayerBlendMode>[1],
        );
        return { success: true, actionType: action.type };
      }

      case 'setLayerVisibility': {
        // Store has toggleLayerVisibility, but we need explicit set.
        // Use the toggle only if the current state differs.
        const doc = state.document!;
        const layer = findLayerById(doc.rootGroup, action.params.layerId)!;
        if (layer.visible !== action.params.visible) {
          state.toggleLayerVisibility(action.params.layerId);
        }
        return { success: true, actionType: action.type };
      }

      case 'renameLayer': {
        const name = (validation.sanitized?.name as string) ?? action.params.name;
        state.renameLayer(action.params.layerId, name);
        return { success: true, actionType: action.type };
      }

      case 'resizeLayer': {
        state.resizeLayer(action.params.layerId, action.params.width, action.params.height);
        return { success: true, actionType: action.type };
      }

      // --- Text Properties ---
      case 'setTextProperties': {
        state.setTextProperties(action.params.layerId, action.params.properties);
        return { success: true, actionType: action.type };
      }

      // --- Layer Effects ---
      case 'addLayerEffect': {
        state.addLayerEffect(
          action.params.layerId,
          action.params.effect as unknown as LayerEffect,
        );
        return { success: true, actionType: action.type };
      }

      case 'removeLayerEffect': {
        state.removeLayerEffect(action.params.layerId, action.params.index);
        return { success: true, actionType: action.type };
      }

      case 'updateLayerEffect': {
        state.updateLayerEffect(
          action.params.layerId,
          action.params.index,
          action.params.effect as unknown as LayerEffect,
        );
        return { success: true, actionType: action.type };
      }

      case 'setLayerEffects': {
        state.setLayerEffects(
          action.params.layerId,
          action.params.effects as unknown as LayerEffect[],
        );
        return { success: true, actionType: action.type };
      }

      // --- Filters ---
      case 'applyFilter': {
        const filterFn = resolveFilter(action.params.filterName, action.params.options);
        if (!filterFn) {
          return { success: false, actionType: action.type, error: `Unknown filter: ${action.params.filterName}` };
        }
        state.applyFilter(filterFn);
        return { success: true, actionType: action.type };
      }

      // --- Procedural Generation ---
      // These require generating ImageData, which needs canvas APIs.
      // For now, delegate to store's addProceduralLayer via a generated ImageData.
      case 'addGradientBackground': {
        const doc = state.document!;
        const { width, height } = doc.canvas.size;
        const imageData = generateGradientBackground(
          width, height,
          action.params.stops,
          action.params.gradientType,
          action.params.angle,
        );
        state.addProceduralLayer('Gradient Background', imageData);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'addPattern': {
        const doc = state.document!;
        const { width, height } = doc.canvas.size;
        const p = action.params;
        const imageData = generatePattern(width, height, p.pattern, p.color, p.spacing, p.size, p.opacity);
        state.addProceduralLayer(`Pattern: ${p.pattern}`, imageData);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'addConcentrationLines': {
        const doc = state.document!;
        const { width, height } = doc.canvas.size;
        const p = action.params;
        const imageData = generateConcentrationLines(width, height, p.centerX, p.centerY, p.lineCount, p.color, p.innerRadius, p.lineWidth);
        state.addProceduralLayer('Concentration Lines', imageData);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'addBorderFrame': {
        const doc = state.document!;
        const { width, height } = doc.canvas.size;
        const p = action.params;
        const imageData = generateBorderFrame(width, height, p.borderWidth, p.color, p.cornerRadius, p.style);
        state.addProceduralLayer('Border Frame', imageData);
        const newState = useAppStore.getState();
        return {
          success: true,
          actionType: action.type,
          layerId: newState.selectedLayerId ?? undefined,
        };
      }

      case 'applyGradientMask': {
        const doc = state.document!;
        const layer = findLayerById(doc.rootGroup, action.params.layerId) as RasterLayer;
        if (!layer.imageData) {
          return { success: false, actionType: action.type, error: 'Layer has no image data' };
        }
        const maskedData = generateGradientMask(
          layer.imageData,
          action.params.direction,
          action.params.fadeStart,
          action.params.fadeEnd,
        );
        state.applyGradientMask(action.params.layerId, maskedData);
        return { success: true, actionType: action.type };
      }

      // --- Image ---
      case 'addImageAsLayer': {
        const name = (validation.sanitized?.name as string) ?? action.params.name;
        const binary = base64ToArrayBuffer(action.params.base64Data);
        // addImageAsLayer is async — fire and forget, return immediately
        state.addImageAsLayer(binary, name).catch(() => {
          // Error handled internally by store
        });
        return { success: true, actionType: action.type };
      }

      // --- History ---
      case 'undo': {
        state.undo();
        return { success: true, actionType: action.type };
      }

      case 'redo': {
        state.redo();
        return { success: true, actionType: action.type };
      }

      // --- Document (read-only) ---
      case 'getDocumentInfo': {
        return {
          success: true,
          actionType: action.type,
          data: serializeDocument(state.document),
        };
      }

      case 'getLayerInfo': {
        const doc = state.document!;
        const layer = findLayerById(doc.rootGroup, action.params.layerId)!;
        return {
          success: true,
          actionType: action.type,
          data: serializeLayer(layer),
        };
      }

      case 'getCanvasSnapshot': {
        // Async action — return a pending marker. Use executeActionAsync() for real result.
        return {
          success: false,
          actionType: action.type,
          error: 'getCanvasSnapshot is async. Use executeActionAsync() instead.',
        };
      }

      default: {
        const _exhaustive: never = action;
        return { success: false, actionType: (_exhaustive as EditorAction).type, error: 'Unknown action type' };
      }
    }
  } catch (e) {
    return { success: false, actionType: action.type, error: String(e) };
  }
}

/**
 * Execute multiple EditorActions sequentially.
 * Errors in one action do NOT stop execution of remaining actions.
 */
export function executeActions(actions: EditorAction[]): ActionResult[] {
  return actions.map((action) => executeAction(action));
}

/**
 * Execute a single EditorAction, supporting async actions (e.g. getCanvasSnapshot).
 * Sync actions are handled identically to executeAction().
 */
export async function executeActionAsync(action: EditorAction): Promise<ActionResult> {
  // Handle async-only actions
  if (action.type === 'getCanvasSnapshot') {
    const state = useAppStore.getState();
    const validation = validateAction(action, state);
    if (!validation.valid) {
      return { success: false, actionType: action.type, error: validation.error };
    }
    try {
      const snapshot = await captureCanvasSnapshot(action.params?.includeThumbnails ?? true);
      if (!snapshot) {
        return { success: false, actionType: action.type, error: 'No document is open' };
      }
      return { success: true, actionType: action.type, data: snapshot };
    } catch (e) {
      return { success: false, actionType: action.type, error: String(e) };
    }
  }

  // All other actions are synchronous — delegate to executeAction
  return executeAction(action);
}

/**
 * Execute multiple EditorActions sequentially, supporting async actions.
 * Errors in one action do NOT stop execution of remaining actions.
 */
export async function executeActionsAsync(actions: EditorAction[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of actions) {
    results.push(await executeActionAsync(action));
  }
  return results;
}

// ── Serialization helpers ─────────────────────────────────────────

export function serializeDocument(doc: Document | null): unknown {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    width: doc.canvas.size.width,
    height: doc.canvas.size.height,
    dpi: doc.canvas.dpi,
    layers: serializeLayerTree(doc.rootGroup),
    selectedLayerId: doc.selectedLayerId,
  };
}

export function serializeLayerTree(group: LayerGroup): unknown[] {
  return group.children.map((layer) => serializeLayer(layer));
}

export function serializeLayer(layer: Layer): unknown {
  const base: Record<string, unknown> = {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    visible: layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    position: { ...layer.position },
    effects: layer.effects.map((e) => ({ ...e })),
  };

  if (layer.type === 'text') {
    const tl = layer as TextLayer;
    base.text = tl.text;
    base.fontFamily = tl.fontFamily;
    base.fontSize = tl.fontSize;
    base.color = { ...tl.color };
    base.bold = tl.bold;
    base.italic = tl.italic;
    base.alignment = tl.alignment;
    base.lineHeight = tl.lineHeight;
    base.letterSpacing = tl.letterSpacing;
    base.writingMode = tl.writingMode;
    if (tl.textBounds) {
      base.textBounds = { ...tl.textBounds };
    }
  }

  if (layer.type === 'raster') {
    const rl = layer as RasterLayer;
    base.bounds = { ...rl.bounds };
    base.hasImageData = !!rl.imageData;
  }

  if (layer.type === 'group') {
    const gl = layer as LayerGroup;
    base.children = gl.children.map((child) => serializeLayer(child));
  }

  return base;
}

// ── Base64 helper ─────────────────────────────────────────────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Strip data URI prefix if present
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── Procedural generation helpers ─────────────────────────────────
// These generate ImageData in-memory for the procedural actions.
// In production, the dialogs (BackgroundDialog, PatternDialog, etc.)
// do this on their own canvases. Here we replicate the logic for API use.

function generateGradientBackground(
  width: number,
  height: number,
  stops: Array<{ position: number; r: number; g: number; b: number; a: number }>,
  gradientType: string,
  angle?: number,
): ImageData {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // Sort stops by position
  const sorted = [...stops].sort((a, b) => a.position - b.position);

  if (gradientType === 'radial') {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.sqrt(cx * cx + cy * cy);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    for (const s of sorted) {
      grad.addColorStop(s.position, `rgba(${s.r},${s.g},${s.b},${s.a / 255})`);
    }
    ctx.fillStyle = grad;
  } else {
    const rad = ((angle ?? 0) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const len = Math.abs(dx * width) + Math.abs(dy * height);
    const cx = width / 2;
    const cy = height / 2;
    const grad = ctx.createLinearGradient(
      cx - dx * len / 2, cy - dy * len / 2,
      cx + dx * len / 2, cy + dy * len / 2,
    );
    for (const s of sorted) {
      grad.addColorStop(s.position, `rgba(${s.r},${s.g},${s.b},${s.a / 255})`);
    }
    ctx.fillStyle = grad;
  }

  ctx.fillRect(0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function generatePattern(
  width: number,
  height: number,
  pattern: string,
  color: { r: number; g: number; b: number; a: number },
  spacing: number,
  size: number,
  opacity: number,
): ImageData {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  const fill = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;

  switch (pattern) {
    case 'dots':
      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case 'stripes':
      ctx.lineWidth = size;
      for (let x = 0; x < width + height; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      break;
    case 'checker':
      for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x += spacing) {
          const row = Math.floor(y / spacing);
          const col = Math.floor(x / spacing);
          if ((row + col) % 2 === 0) {
            ctx.fillRect(x, y, spacing, spacing);
          }
        }
      }
      break;
    case 'diagonal-stripes':
      ctx.lineWidth = size;
      for (let d = -height; d < width + height; d += spacing) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + height, height);
        ctx.stroke();
      }
      break;
  }

  return ctx.getImageData(0, 0, width, height);
}

function generateConcentrationLines(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  lineCount: number,
  color: { r: number; g: number; b: number; a: number },
  innerRadius: number,
  lineWidth: number,
): ImageData {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const outerRadius = Math.sqrt(width * width + height * height);
  ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
  ctx.lineWidth = lineWidth;

  for (let i = 0; i < lineCount; i++) {
    const angle = (i / lineCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(angle) * innerRadius,
      centerY + Math.sin(angle) * innerRadius,
    );
    ctx.lineTo(
      centerX + Math.cos(angle) * outerRadius,
      centerY + Math.sin(angle) * outerRadius,
    );
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, width, height);
}

function generateBorderFrame(
  width: number,
  height: number,
  borderWidth: number,
  color: { r: number; g: number; b: number; a: number },
  cornerRadius: number,
  style: string,
): ImageData {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const fill = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
  ctx.strokeStyle = fill;

  const hw = borderWidth / 2;

  if (style === 'dashed') {
    ctx.setLineDash([borderWidth * 2, borderWidth]);
  }

  const drawStroke = (lw: number): void => {
    ctx.lineWidth = lw;
    if (cornerRadius > 0) {
      const r = cornerRadius;
      const x = hw;
      const y = hw;
      const w = width - borderWidth;
      const h = height - borderWidth;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(hw, hw, width - borderWidth, height - borderWidth);
    }
  };

  if (style === 'double') {
    drawStroke(borderWidth * 0.3);
    ctx.lineWidth = borderWidth * 0.3;
    const offset = borderWidth * 0.7;
    if (cornerRadius > 0) {
      const r = Math.max(0, cornerRadius - offset);
      const x = hw + offset;
      const y = hw + offset;
      const w = width - borderWidth - offset * 2;
      const h = height - borderWidth - offset * 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(hw + offset, hw + offset, width - borderWidth - offset * 2, height - borderWidth - offset * 2);
    }
  } else {
    drawStroke(borderWidth);
  }

  return ctx.getImageData(0, 0, width, height);
}

function generateGradientMask(
  sourceImageData: ImageData,
  direction: string,
  fadeStart: number,
  fadeEnd: number,
): ImageData {
  const { width, height } = sourceImageData;
  const result = new ImageData(new Uint8ClampedArray(sourceImageData.data), width, height);
  const data = result.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t: number;
      switch (direction) {
        case 'top':
          t = y / height;
          break;
        case 'bottom':
          t = 1 - y / height;
          break;
        case 'left':
          t = x / width;
          break;
        case 'right':
          t = 1 - x / width;
          break;
        case 'radial': {
          const cx = width / 2;
          const cy = height / 2;
          const maxDist = Math.sqrt(cx * cx + cy * cy);
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          t = dist / maxDist;
          break;
        }
        default:
          t = 0;
      }

      // Map t through fadeStart/fadeEnd range
      let alpha: number;
      if (t <= fadeStart) {
        alpha = 1;
      } else if (t >= fadeEnd) {
        alpha = 0;
      } else {
        alpha = 1 - (t - fadeStart) / (fadeEnd - fadeStart);
      }

      const idx = (y * width + x) * 4;
      data[idx + 3] = Math.round(data[idx + 3] * alpha);
    }
  }

  return result;
}
