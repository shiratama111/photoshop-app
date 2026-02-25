/**
 * @module editor-actions/editor-action-dispatcher.test
 * Tests for the Editor Action API (Phase 2-1).
 *
 * Covers:
 * - Validation: invalid params produce errors
 * - Dispatch: actions correctly call store methods
 * - executeActions: batch execution, error isolation
 *
 * @see Phase 2-1: Editor Action API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store';
import { validateAction } from './validators';
import { executeAction, executeActions } from './dispatcher';
import { t } from '../i18n';

function resetStore(): void {
  useAppStore.setState({
    document: null,
    activeTool: 'select',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    statusMessage: t('status.ready'),
    showAbout: false,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
    contextMenu: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

function getLayerIds(): string[] {
  const doc = useAppStore.getState().document;
  if (!doc) return [];
  return doc.rootGroup.children.map((l) => l.id);
}

describe('Editor Action API', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── Validation Tests ────────────────────────────────────────────

  describe('validation', () => {
    it('rejects actions when no document is open', () => {
      const result = validateAction(
        { type: 'createTextLayer', params: {} },
        { document: null },
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No document');
    });

    it('rejects invalid blendMode', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const layerId = getLayerIds()[0];
      const result = validateAction(
        { type: 'setLayerBlendMode', params: { layerId, blendMode: 'invalid' } },
        state,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid blendMode: 'invalid'");
    });

    it('rejects invalid filterName', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const result = validateAction(
        { type: 'applyFilter', params: { filterName: 'nonexistent' } },
        state,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unknown filter: 'nonexistent'");
    });

    it('rejects non-existent layerId', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const result = validateAction(
        { type: 'removeLayer', params: { layerId: 'nonexistent-id' } },
        state,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Layer not found');
    });

    it('clamps opacity out of range and passes', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const layerId = getLayerIds()[0];
      const result = validateAction(
        { type: 'setLayerOpacity', params: { layerId, opacity: 1.5 } },
        state,
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized?.opacity).toBe(1);
    });

    it('clamps negative opacity to 0', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const layerId = getLayerIds()[0];
      const result = validateAction(
        { type: 'setLayerOpacity', params: { layerId, opacity: -0.5 } },
        state,
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized?.opacity).toBe(0);
    });

    it('rejects empty gradientStops', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const result = validateAction(
        { type: 'addGradientBackground', params: { stops: [], gradientType: 'linear' } },
        state,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2');
    });

    it('rejects invalid border style', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const result = validateAction(
        {
          type: 'addBorderFrame',
          params: { borderWidth: 5, color: { r: 0, g: 0, b: 0, a: 255 }, cornerRadius: 0, style: 'dotted' },
        },
        state,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid border style: 'dotted'");
    });

    it('rejects invalid effect type', () => {
      createTestDocument();
      const state = useAppStore.getState();
      const layerId = getLayerIds()[0];
      const result = validateAction(
        { type: 'addLayerEffect', params: { layerId, effect: { type: 'glow' } } },
        state,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid effect type: 'glow'");
    });

    it('validates undo/redo without document', () => {
      const result = validateAction({ type: 'undo' }, { document: null });
      expect(result.valid).toBe(true);
    });

    it('validates getDocumentInfo without document', () => {
      const result = validateAction({ type: 'getDocumentInfo' }, { document: null });
      expect(result.valid).toBe(true);
    });
  });

  // ── Dispatch Tests ──────────────────────────────────────────────

  describe('dispatch', () => {
    it('createTextLayer adds a text layer', () => {
      createTestDocument();
      const before = getLayerIds().length;
      const result = executeAction({
        type: 'createTextLayer',
        params: { name: 'Test Text', text: 'Hello' },
      });
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('createTextLayer');
      expect(result.layerId).toBeDefined();
      expect(getLayerIds().length).toBe(before + 1);
    });

    it('createRasterLayer adds a raster layer', () => {
      createTestDocument();
      const before = getLayerIds().length;
      const result = executeAction({
        type: 'createRasterLayer',
        params: { name: 'New Raster' },
      });
      expect(result.success).toBe(true);
      expect(result.layerId).toBeDefined();
      expect(getLayerIds().length).toBe(before + 1);
    });

    it('createLayerGroup adds a group', () => {
      createTestDocument();
      const before = getLayerIds().length;
      const result = executeAction({
        type: 'createLayerGroup',
        params: { name: 'New Group' },
      });
      expect(result.success).toBe(true);
      expect(result.layerId).toBeDefined();
      expect(getLayerIds().length).toBe(before + 1);
    });

    it('removeLayer removes a layer', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const before = getLayerIds().length;
      const result = executeAction({ type: 'removeLayer', params: { layerId } });
      expect(result.success).toBe(true);
      expect(getLayerIds().length).toBe(before - 1);
    });

    it('duplicateLayer duplicates a layer', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const before = getLayerIds().length;
      const result = executeAction({ type: 'duplicateLayer', params: { layerId } });
      expect(result.success).toBe(true);
      expect(result.layerId).toBeDefined();
      expect(result.layerId).not.toBe(layerId);
      expect(getLayerIds().length).toBe(before + 1);
    });

    it('setLayerPosition updates position', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'setLayerPosition',
        params: { layerId, x: 100, y: 200 },
      });
      expect(result.success).toBe(true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children.find((l) => l.id === layerId)!;
      expect(layer.position).toEqual({ x: 100, y: 200 });
    });

    it('setLayerOpacity clamps and sets opacity', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'setLayerOpacity',
        params: { layerId, opacity: 1.5 },
      });
      expect(result.success).toBe(true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children.find((l) => l.id === layerId)!;
      expect(layer.opacity).toBe(1);
    });

    it('setLayerBlendMode sets blend mode', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'setLayerBlendMode',
        params: { layerId, blendMode: 'multiply' },
      });
      expect(result.success).toBe(true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children.find((l) => l.id === layerId)!;
      expect(layer.blendMode).toBe('multiply');
    });

    it('setLayerBlendMode rejects invalid mode', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'setLayerBlendMode',
        params: { layerId, blendMode: 'invalid' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid blendMode');
    });

    it('renameLayer renames a layer', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'renameLayer',
        params: { layerId, name: 'Renamed' },
      });
      expect(result.success).toBe(true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children.find((l) => l.id === layerId)!;
      expect(layer.name).toBe('Renamed');
    });

    it('selectLayer selects a layer', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'selectLayer',
        params: { layerId },
      });
      expect(result.success).toBe(true);
      expect(useAppStore.getState().selectedLayerId).toBe(layerId);
    });

    it('selectLayer with null deselects', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      useAppStore.getState().selectLayer(layerId);
      const result = executeAction({
        type: 'selectLayer',
        params: { layerId: null },
      });
      expect(result.success).toBe(true);
      expect(useAppStore.getState().selectedLayerId).toBeNull();
    });

    it('undo/redo work', () => {
      createTestDocument();
      const before = getLayerIds().length;
      executeAction({ type: 'createTextLayer', params: { text: 'test' } });
      expect(getLayerIds().length).toBe(before + 1);

      const undoResult = executeAction({ type: 'undo' });
      expect(undoResult.success).toBe(true);
      expect(getLayerIds().length).toBe(before);

      const redoResult = executeAction({ type: 'redo' });
      expect(redoResult.success).toBe(true);
      expect(getLayerIds().length).toBe(before + 1);
    });

    it('getDocumentInfo returns document data', () => {
      createTestDocument();
      const result = executeAction({ type: 'getDocumentInfo' });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe('Test');
      expect(data.width).toBe(800);
      expect(data.height).toBe(600);
      expect(Array.isArray(data.layers)).toBe(true);
    });

    it('getDocumentInfo returns null when no document', () => {
      const result = executeAction({ type: 'getDocumentInfo' });
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('getLayerInfo returns layer data', () => {
      createTestDocument();
      const layerId = getLayerIds()[0];
      const result = executeAction({
        type: 'getLayerInfo',
        params: { layerId },
      });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.id).toBe(layerId);
      expect(typeof data.name).toBe('string');
      expect(typeof data.type).toBe('string');
    });

    it('fails gracefully for non-existent layer', () => {
      createTestDocument();
      const result = executeAction({
        type: 'removeLayer',
        params: { layerId: 'does-not-exist' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Layer not found');
    });
  });

  // ── Batch Execution Tests ───────────────────────────────────────

  describe('executeActions', () => {
    it('executes multiple actions and returns results array', () => {
      createTestDocument();
      const results = executeActions([
        { type: 'createTextLayer', params: { text: 'First' } },
        { type: 'createTextLayer', params: { text: 'Second' } },
      ]);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('continues after error — error does not stop batch', () => {
      createTestDocument();
      const results = executeActions([
        { type: 'createTextLayer', params: { text: 'OK' } },
        { type: 'removeLayer', params: { layerId: 'nonexistent' } },
        { type: 'createTextLayer', params: { text: 'Also OK' } },
      ]);
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('returns empty array for empty input', () => {
      const results = executeActions([]);
      expect(results).toEqual([]);
    });
  });

  // ── Store Integration Tests ─────────────────────────────────────

  describe('store integration', () => {
    it('dispatchEditorAction is available on the store', () => {
      const state = useAppStore.getState();
      expect(typeof state.dispatchEditorAction).toBe('function');
    });

    it('dispatchEditorActions is available on the store', () => {
      const state = useAppStore.getState();
      expect(typeof state.dispatchEditorActions).toBe('function');
    });

    it('dispatchEditorAction delegates to executeAction', () => {
      createTestDocument();
      const result = useAppStore.getState().dispatchEditorAction({
        type: 'createTextLayer',
        params: { text: 'via store' },
      });
      expect(result.success).toBe(true);
      expect(result.layerId).toBeDefined();
    });

    it('dispatchEditorActions delegates to executeActions', () => {
      createTestDocument();
      const results = useAppStore.getState().dispatchEditorActions([
        { type: 'createTextLayer', params: { text: 'batch 1' } },
        { type: 'createTextLayer', params: { text: 'batch 2' } },
      ]);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
