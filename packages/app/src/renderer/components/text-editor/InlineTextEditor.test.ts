/**
 * @module components/text-editor/InlineTextEditor.test
 * Store-level tests for inline text editing state (start/stop editing).
 * @see APP-005: Text editing UI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';

function resetStore(): void {
  useAppStore.setState({
    document: null,
    activeTool: 'select',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    statusMessage: 'Ready',
    showAbout: false,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
    contextMenu: null,
    editingTextLayerId: null,
    layerStyleDialog: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

describe('InlineTextEditor store actions', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('startEditingText', () => {
    it('should set editingTextLayerId for a text layer', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hello');
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().startEditingText(layerId);
      expect(useAppStore.getState().editingTextLayerId).toBe(layerId);
    });

    it('should also select the layer', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hello');
      const layerId = useAppStore.getState().selectedLayerId!;
      // Deselect first
      useAppStore.getState().selectLayer(null);
      useAppStore.getState().startEditingText(layerId);
      expect(useAppStore.getState().selectedLayerId).toBe(layerId);
    });

    it('should not set editing for a non-text layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Raster');
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().startEditingText(layerId);
      expect(useAppStore.getState().editingTextLayerId).toBeNull();
    });

    it('should not set editing when no document exists', () => {
      useAppStore.getState().startEditingText('fake-id');
      expect(useAppStore.getState().editingTextLayerId).toBeNull();
    });
  });

  describe('stopEditingText', () => {
    it('should clear editingTextLayerId', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hello');
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().startEditingText(layerId);
      expect(useAppStore.getState().editingTextLayerId).toBe(layerId);
      useAppStore.getState().stopEditingText();
      expect(useAppStore.getState().editingTextLayerId).toBeNull();
    });

    it('should be safe to call when not editing', () => {
      useAppStore.getState().stopEditingText();
      expect(useAppStore.getState().editingTextLayerId).toBeNull();
    });
  });

  describe('layer style dialog', () => {
    it('should open the dialog for a layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().openLayerStyleDialog(layerId);
      expect(useAppStore.getState().layerStyleDialog).toEqual({ layerId });
    });

    it('should close the dialog', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().openLayerStyleDialog(layerId);
      useAppStore.getState().closeLayerStyleDialog();
      expect(useAppStore.getState().layerStyleDialog).toBeNull();
    });
  });

  describe('effect CRUD', () => {
    it('should add an effect to a layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().addLayerEffect(layerId, {
        type: 'stroke',
        enabled: true,
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 1,
      });
      const layer = findLayerById(doc.rootGroup, layerId)!;
      expect(layer.effects).toHaveLength(1);
      expect(layer.effects[0].type).toBe('stroke');
    });

    it('should remove an effect by index', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().addLayerEffect(layerId, {
        type: 'stroke',
        enabled: true,
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 1,
      });
      useAppStore.getState().removeLayerEffect(layerId, 0);
      const layer = findLayerById(doc.rootGroup, layerId)!;
      expect(layer.effects).toHaveLength(0);
    });

    it('should update an effect by index', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().addLayerEffect(layerId, {
        type: 'stroke',
        enabled: true,
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 1,
      });
      useAppStore.getState().updateLayerEffect(layerId, 0, {
        type: 'stroke',
        enabled: true,
        color: { r: 0, g: 1, b: 0, a: 1 },
        size: 5,
        position: 'inside',
        opacity: 0.8,
      });
      const updated = findLayerById(doc.rootGroup, layerId)!.effects[0];
      expect(updated.type).toBe('stroke');
      expect((updated as { size: number }).size).toBe(5);
    });

    it('should undo adding an effect', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      useAppStore.getState().addLayerEffect(layerId, {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.75,
        angle: 135,
        distance: 5,
        blur: 10,
        spread: 0,
      });
      expect(findLayerById(doc.rootGroup, layerId)!.effects).toHaveLength(1);
      useAppStore.getState().undo();
      expect(findLayerById(doc.rootGroup, layerId)!.effects).toHaveLength(0);
    });
  });
});
