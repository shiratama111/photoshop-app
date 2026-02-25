/**
 * @module editor-actions/validators
 * Validation functions for EditorAction parameters.
 *
 * Validates action params before dispatch: type checks, range clamping,
 * layer existence, and enum membership. Returns sanitized values when clamping.
 *
 * @see Phase 2-1: Editor Action API
 */

import type { Document, Layer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { REGISTERED_FILTER_NAMES } from './filter-registry';
import type { EditorAction, ColorDef, GradientStopDef } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: Record<string, unknown>;
}

const VALID_BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity',
];

const VALID_PATTERN_TYPES = ['dots', 'stripes', 'checker', 'diagonal-stripes'];
const VALID_BORDER_STYLES = ['solid', 'double', 'dashed'];
const VALID_MASK_DIRECTIONS = ['top', 'bottom', 'left', 'right', 'radial'];
const VALID_GRADIENT_TYPES = ['linear', 'radial'];

const VALID_TEXT_PROPERTIES = [
  'text', 'fontFamily', 'fontSize', 'color', 'bold', 'italic',
  'alignment', 'lineHeight', 'letterSpacing', 'writingMode', 'underline', 'strikethrough',
];

const VALID_EFFECT_TYPES = [
  'stroke', 'drop-shadow', 'outer-glow', 'inner-shadow',
  'inner-glow', 'color-overlay', 'gradient-overlay', 'bevel-emboss',
];

function ok(sanitized?: Record<string, unknown>): ValidationResult {
  return { valid: true, sanitized };
}

function fail(error: string): ValidationResult {
  return { valid: false, error };
}

function requireDoc(doc: Document | null): ValidationResult | null {
  if (!doc) return fail('No document is open');
  return null;
}

function requireLayer(doc: Document, layerId: string): { result?: ValidationResult; layer?: Layer } {
  const layer = findLayerById(doc.rootGroup, layerId);
  if (!layer) return { result: fail(`Layer not found: '${layerId}'`) };
  return { layer };
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateColor(c: ColorDef | undefined, fieldName: string): ValidationResult | null {
  if (!c) return fail(`${fieldName} is required`);
  if (!isFiniteNum(c.r) || !isFiniteNum(c.g) || !isFiniteNum(c.b) || !isFiniteNum(c.a)) {
    return fail(`${fieldName} must have numeric r, g, b, a channels`);
  }
  return null;
}

function validateGradientStops(stops: GradientStopDef[] | undefined): ValidationResult | null {
  if (!stops || !Array.isArray(stops) || stops.length < 2) {
    return fail('gradientStops must have at least 2 entries');
  }
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (!isFiniteNum(s.position) || s.position < 0 || s.position > 1) {
      return fail(`gradientStops[${i}].position must be between 0 and 1`);
    }
    const colorErr = validateColor(s as unknown as ColorDef, `gradientStops[${i}]`);
    if (colorErr) return colorErr;
  }
  return null;
}

/**
 * Validate an EditorAction against the current app state.
 * Requires minimal state: just the document for layer lookups.
 */
export function validateAction(
  action: EditorAction,
  state: { document: Document | null },
): ValidationResult {
  const { document: doc } = state;

  switch (action.type) {
    // --- Layer Lifecycle ---
    case 'createTextLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const p = action.params;
      if (p.x !== undefined && !isFiniteNum(p.x)) return fail('x must be a finite number');
      if (p.y !== undefined && !isFiniteNum(p.y)) return fail('y must be a finite number');
      return ok();
    }

    case 'createRasterLayer':
    case 'createLayerGroup': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      return ok();
    }

    case 'removeLayer':
    case 'duplicateLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      return ok();
    }

    case 'selectLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      if (action.params.layerId !== null) {
        const { result } = requireLayer(doc!, action.params.layerId);
        if (result) return result;
      }
      return ok();
    }

    case 'reorderLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!isFiniteNum(action.params.newIndex) || action.params.newIndex < 0) {
        return fail('newIndex must be a non-negative number');
      }
      return ok();
    }

    // --- Layer Properties ---
    case 'setLayerPosition': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!isFiniteNum(action.params.x)) return fail('x must be a finite number');
      if (!isFiniteNum(action.params.y)) return fail('y must be a finite number');
      return ok();
    }

    case 'setLayerOpacity': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!isFiniteNum(action.params.opacity)) return fail('opacity must be a finite number');
      const clamped = Math.max(0, Math.min(1, action.params.opacity));
      return ok({ opacity: clamped });
    }

    case 'setLayerBlendMode': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!VALID_BLEND_MODES.includes(action.params.blendMode)) {
        return fail(`Invalid blendMode: '${action.params.blendMode}'. Valid: ${VALID_BLEND_MODES.join(', ')}`);
      }
      return ok();
    }

    case 'setLayerVisibility': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (typeof action.params.visible !== 'boolean') return fail('visible must be a boolean');
      return ok();
    }

    case 'renameLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      const name = action.params.name || 'Untitled';
      return ok({ name });
    }

    case 'resizeLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result, layer } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (layer!.type !== 'raster') return fail('resizeLayer only works on raster layers');
      if (!isFiniteNum(action.params.width) || action.params.width < 1 || action.params.width > 16384) {
        return fail('width must be between 1 and 16384');
      }
      if (!isFiniteNum(action.params.height) || action.params.height < 1 || action.params.height > 16384) {
        return fail('height must be between 1 and 16384');
      }
      return ok();
    }

    // --- Text Properties ---
    case 'setTextProperties': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result, layer } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (layer!.type !== 'text') return fail('setTextProperties only works on text layers');
      const keys = Object.keys(action.params.properties);
      const invalid = keys.filter((k) => !VALID_TEXT_PROPERTIES.includes(k));
      if (invalid.length > 0) {
        return fail(`Invalid text properties: ${invalid.join(', ')}. Valid: ${VALID_TEXT_PROPERTIES.join(', ')}`);
      }
      const fontSize = action.params.properties.fontSize;
      if (fontSize !== undefined) {
        if (!isFiniteNum(fontSize) || (fontSize as number) < 1 || (fontSize as number) > 1000) {
          return fail('fontSize must be between 1 and 1000');
        }
      }
      return ok();
    }

    // --- Layer Effects ---
    case 'addLayerEffect': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      const effectType = action.params.effect?.type;
      if (typeof effectType !== 'string' || !VALID_EFFECT_TYPES.includes(effectType)) {
        return fail(`Invalid effect type: '${effectType}'. Valid: ${VALID_EFFECT_TYPES.join(', ')}`);
      }
      return ok();
    }

    case 'removeLayerEffect': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result, layer } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!isFiniteNum(action.params.index) || action.params.index < 0) {
        return fail('index must be a non-negative number');
      }
      if (action.params.index >= layer!.effects.length) {
        return fail(`Effect index ${action.params.index} out of range (layer has ${layer!.effects.length} effects)`);
      }
      return ok();
    }

    case 'updateLayerEffect': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result, layer } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!isFiniteNum(action.params.index) || action.params.index < 0) {
        return fail('index must be a non-negative number');
      }
      if (action.params.index >= layer!.effects.length) {
        return fail(`Effect index ${action.params.index} out of range (layer has ${layer!.effects.length} effects)`);
      }
      const effectType = action.params.effect?.type;
      if (typeof effectType !== 'string' || !VALID_EFFECT_TYPES.includes(effectType)) {
        return fail(`Invalid effect type: '${effectType}'. Valid: ${VALID_EFFECT_TYPES.join(', ')}`);
      }
      return ok();
    }

    case 'setLayerEffects': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (!Array.isArray(action.params.effects)) {
        return fail('effects must be an array');
      }
      for (let i = 0; i < action.params.effects.length; i++) {
        const et = action.params.effects[i]?.type;
        if (typeof et !== 'string' || !VALID_EFFECT_TYPES.includes(et)) {
          return fail(`Invalid effect type at index ${i}: '${et}'. Valid: ${VALID_EFFECT_TYPES.join(', ')}`);
        }
      }
      return ok();
    }

    // --- Filters ---
    case 'applyFilter': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      if (!REGISTERED_FILTER_NAMES.includes(action.params.filterName)) {
        return fail(`Unknown filter: '${action.params.filterName}'. Valid: ${REGISTERED_FILTER_NAMES.join(', ')}`);
      }
      return ok();
    }

    // --- Procedural Generation ---
    case 'addGradientBackground': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const stopsErr = validateGradientStops(action.params.stops);
      if (stopsErr) return stopsErr;
      if (!VALID_GRADIENT_TYPES.includes(action.params.gradientType)) {
        return fail(`Invalid gradientType: '${action.params.gradientType}'. Valid: ${VALID_GRADIENT_TYPES.join(', ')}`);
      }
      return ok();
    }

    case 'addPattern': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      if (!VALID_PATTERN_TYPES.includes(action.params.pattern)) {
        return fail(`Invalid pattern: '${action.params.pattern}'. Valid: ${VALID_PATTERN_TYPES.join(', ')}`);
      }
      const colorErr = validateColor(action.params.color, 'color');
      if (colorErr) return colorErr;
      if (!isFiniteNum(action.params.spacing) || action.params.spacing < 1) {
        return fail('spacing must be a positive number');
      }
      if (!isFiniteNum(action.params.size) || action.params.size < 1) {
        return fail('size must be a positive number');
      }
      if (!isFiniteNum(action.params.opacity)) return fail('opacity must be a finite number');
      return ok();
    }

    case 'addConcentrationLines': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      if (!isFiniteNum(action.params.centerX)) return fail('centerX must be a finite number');
      if (!isFiniteNum(action.params.centerY)) return fail('centerY must be a finite number');
      if (!isFiniteNum(action.params.lineCount) || action.params.lineCount < 1) {
        return fail('lineCount must be a positive number');
      }
      const colorErr = validateColor(action.params.color, 'color');
      if (colorErr) return colorErr;
      if (!isFiniteNum(action.params.innerRadius)) return fail('innerRadius must be a finite number');
      if (!isFiniteNum(action.params.lineWidth) || action.params.lineWidth < 0.1) {
        return fail('lineWidth must be a positive number');
      }
      return ok();
    }

    case 'addBorderFrame': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      if (!isFiniteNum(action.params.borderWidth) || action.params.borderWidth < 1) {
        return fail('borderWidth must be a positive number');
      }
      const colorErr = validateColor(action.params.color, 'color');
      if (colorErr) return colorErr;
      if (!isFiniteNum(action.params.cornerRadius) || action.params.cornerRadius < 0) {
        return fail('cornerRadius must be a non-negative number');
      }
      if (!VALID_BORDER_STYLES.includes(action.params.style)) {
        return fail(`Invalid border style: '${action.params.style}'. Valid: ${VALID_BORDER_STYLES.join(', ')}`);
      }
      return ok();
    }

    case 'applyGradientMask': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result, layer } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      if (layer!.type !== 'raster') return fail('applyGradientMask only works on raster layers');
      if (!VALID_MASK_DIRECTIONS.includes(action.params.direction)) {
        return fail(`Invalid direction: '${action.params.direction}'. Valid: ${VALID_MASK_DIRECTIONS.join(', ')}`);
      }
      if (!isFiniteNum(action.params.fadeStart) || action.params.fadeStart < 0 || action.params.fadeStart > 1) {
        return fail('fadeStart must be between 0 and 1');
      }
      if (!isFiniteNum(action.params.fadeEnd) || action.params.fadeEnd < 0 || action.params.fadeEnd > 1) {
        return fail('fadeEnd must be between 0 and 1');
      }
      return ok();
    }

    // --- Image ---
    case 'addImageAsLayer': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      if (!action.params.base64Data || typeof action.params.base64Data !== 'string') {
        return fail('base64Data must be a non-empty string');
      }
      const name = action.params.name || 'Image';
      return ok({ name });
    }

    // --- History ---
    case 'undo':
    case 'redo':
      return ok();

    // --- Document (read-only) ---
    case 'getDocumentInfo':
      return ok();

    case 'getLayerInfo': {
      const docErr = requireDoc(doc);
      if (docErr) return docErr;
      const { result } = requireLayer(doc!, action.params.layerId);
      if (result) return result;
      return ok();
    }

    case 'getCanvasSnapshot':
      return ok();

    default: {
      const _exhaustive: never = action;
      return fail(`Unknown action type: '${(_exhaustive as EditorAction).type}'`);
    }
  }
}
