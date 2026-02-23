/**
 * @module store.test
 * Unit tests for the Zustand application store.
 * @see APP-002: Canvas view + layer panel integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlendMode } from '@photoshop-app/types';
import { useAppStore } from './store';

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
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

describe('useAppStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('should have no document', () => {
      expect(useAppStore.getState().document).toBeNull();
    });

    it('should default to select tool', () => {
      expect(useAppStore.getState().activeTool).toBe('select');
    });

    it('should default to 100% zoom', () => {
      expect(useAppStore.getState().zoom).toBe(1);
    });

    it('should show Ready status', () => {
      expect(useAppStore.getState().statusMessage).toBe('Ready');
    });

    it('should have no selected layer', () => {
      expect(useAppStore.getState().selectedLayerId).toBeNull();
    });

    it('should not be able to undo or redo', () => {
      expect(useAppStore.getState().canUndo).toBe(false);
      expect(useAppStore.getState().canRedo).toBe(false);
    });

    it('should have no context menu', () => {
      expect(useAppStore.getState().contextMenu).toBeNull();
    });
  });

  describe('setActiveTool', () => {
    it('should change the active tool', () => {
      useAppStore.getState().setActiveTool('brush');
      expect(useAppStore.getState().activeTool).toBe('brush');
    });
  });

  describe('setStatusMessage', () => {
    it('should update status message', () => {
      useAppStore.getState().setStatusMessage('Saving...');
      expect(useAppStore.getState().statusMessage).toBe('Saving...');
    });
  });

  describe('toggleAbout', () => {
    it('should toggle about dialog visibility', () => {
      expect(useAppStore.getState().showAbout).toBe(false);
      useAppStore.getState().toggleAbout();
      expect(useAppStore.getState().showAbout).toBe(true);
      useAppStore.getState().toggleAbout();
      expect(useAppStore.getState().showAbout).toBe(false);
    });
  });

  describe('newDocument', () => {
    it('should create a new document with correct dimensions', () => {
      createTestDocument();
      const doc = useAppStore.getState().document;
      expect(doc).not.toBeNull();
      expect(doc!.name).toBe('Test');
      expect(doc!.canvas.size.width).toBe(800);
      expect(doc!.canvas.size.height).toBe(600);
    });

    it('should set default canvas properties', () => {
      createTestDocument();
      const doc = useAppStore.getState().document!;
      expect(doc.canvas.dpi).toBe(72);
      expect(doc.canvas.colorMode).toBe('rgb');
      expect(doc.canvas.bitDepth).toBe(8);
    });

    it('should have empty root group', () => {
      createTestDocument();
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.type).toBe('group');
      expect(doc.rootGroup.children).toHaveLength(0);
    });

    it('should update status message', () => {
      createTestDocument();
      expect(useAppStore.getState().statusMessage).toContain('Created');
      expect(useAppStore.getState().statusMessage).toContain('800x600');
    });

    it('should have correct metadata', () => {
      createTestDocument();
      const doc = useAppStore.getState().document!;
      expect(doc.id).toBeTruthy();
      expect(doc.selectedLayerId).toBeNull();
      expect(doc.filePath).toBeNull();
      expect(doc.dirty).toBe(false);
      expect(doc.createdAt).toBeTruthy();
    });

    it('should clear undo/redo history', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      expect(useAppStore.getState().canUndo).toBe(true);
      useAppStore.getState().newDocument('New', 100, 100);
      expect(useAppStore.getState().canUndo).toBe(false);
      expect(useAppStore.getState().canRedo).toBe(false);
    });
  });

  describe('setDocument', () => {
    it('should set document to null', () => {
      createTestDocument();
      useAppStore.getState().setDocument(null);
      expect(useAppStore.getState().document).toBeNull();
    });
  });

  describe('addRasterLayer', () => {
    it('should add a raster layer to the document', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Background');
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.children).toHaveLength(1);
      expect(doc.rootGroup.children[0].name).toBe('Background');
      expect(doc.rootGroup.children[0].type).toBe('raster');
    });

    it('should auto-name the layer if no name is given', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer();
      expect(useAppStore.getState().document!.rootGroup.children[0].name).toBe('Layer 1');
    });

    it('should select the new layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const doc = useAppStore.getState().document!;
      expect(useAppStore.getState().selectedLayerId).toBe(doc.rootGroup.children[0].id);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      expect(useAppStore.getState().canUndo).toBe(true);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(0);
    });

    it('should mark document as dirty', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      expect(useAppStore.getState().document!.dirty).toBe(true);
    });

    it('should do nothing if no document', () => {
      useAppStore.getState().addRasterLayer('L1');
      expect(useAppStore.getState().document).toBeNull();
    });
  });

  describe('addLayerGroup', () => {
    it('should add a layer group', () => {
      createTestDocument();
      useAppStore.getState().addLayerGroup('Group 1');
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.children).toHaveLength(1);
      expect(doc.rootGroup.children[0].type).toBe('group');
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addLayerGroup('G1');
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(0);
    });
  });

  describe('removeLayer', () => {
    it('should remove a layer from the document', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().removeLayer(layerId);
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(0);
    });

    it('should clear selection if the removed layer was selected', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().selectLayer(layerId);
      useAppStore.getState().removeLayer(layerId);
      expect(useAppStore.getState().selectedLayerId).toBeNull();
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().removeLayer(layerId);
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(0);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(1);
      expect(useAppStore.getState().document!.rootGroup.children[0].id).toBe(layerId);
    });

    it('should do nothing for non-existent layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      useAppStore.getState().removeLayer('non-existent');
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(1);
    });
  });

  describe('duplicateLayer', () => {
    it('should create a copy of the layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Original');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().duplicateLayer(layerId);
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.children).toHaveLength(2);
      expect(doc.rootGroup.children[1].name).toBe('Original copy');
      expect(doc.rootGroup.children[1].id).not.toBe(layerId);
    });

    it('should select the duplicated layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const originalId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().duplicateLayer(originalId);
      const newId = useAppStore.getState().document!.rootGroup.children[1].id;
      expect(useAppStore.getState().selectedLayerId).toBe(newId);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().duplicateLayer(layerId);
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(2);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(1);
    });
  });

  describe('toggleLayerVisibility', () => {
    it('should toggle visibility on and off', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      expect(useAppStore.getState().document!.rootGroup.children[0].visible).toBe(true);
      useAppStore.getState().toggleLayerVisibility(layerId);
      expect(useAppStore.getState().document!.rootGroup.children[0].visible).toBe(false);
      useAppStore.getState().toggleLayerVisibility(layerId);
      expect(useAppStore.getState().document!.rootGroup.children[0].visible).toBe(true);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().toggleLayerVisibility(layerId);
      expect(useAppStore.getState().document!.rootGroup.children[0].visible).toBe(false);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children[0].visible).toBe(true);
    });
  });

  describe('setLayerOpacity', () => {
    it('should set opacity value', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().setLayerOpacity(layerId, 0.5);
      expect(useAppStore.getState().document!.rootGroup.children[0].opacity).toBe(0.5);
    });

    it('should clamp opacity to 0-1 range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().setLayerOpacity(layerId, 1.5);
      expect(useAppStore.getState().document!.rootGroup.children[0].opacity).toBe(1);
      useAppStore.getState().setLayerOpacity(layerId, -0.5);
      expect(useAppStore.getState().document!.rootGroup.children[0].opacity).toBe(0);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().setLayerOpacity(layerId, 0.3);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children[0].opacity).toBe(1);
    });
  });

  describe('setLayerBlendMode', () => {
    it('should change blend mode', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().setLayerBlendMode(layerId, BlendMode.Multiply);
      expect(useAppStore.getState().document!.rootGroup.children[0].blendMode).toBe(BlendMode.Multiply);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().setLayerBlendMode(layerId, BlendMode.Screen);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children[0].blendMode).toBe(BlendMode.Normal);
    });
  });

  describe('renameLayer', () => {
    it('should rename a layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Old Name');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().renameLayer(layerId, 'New Name');
      expect(useAppStore.getState().document!.rootGroup.children[0].name).toBe('New Name');
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Original');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().renameLayer(layerId, 'Renamed');
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children[0].name).toBe('Original');
    });
  });

  describe('reorderLayer', () => {
    it('should move a layer to a new index', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      useAppStore.getState().addRasterLayer('L2');
      useAppStore.getState().addRasterLayer('L3');
      const l1Id = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().reorderLayer(l1Id, 2);
      expect(useAppStore.getState().document!.rootGroup.children[2].id).toBe(l1Id);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      useAppStore.getState().addRasterLayer('L2');
      const l1Id = useAppStore.getState().document!.rootGroup.children[0].id;
      const l2Id = useAppStore.getState().document!.rootGroup.children[1].id;
      useAppStore.getState().reorderLayer(l1Id, 1);
      useAppStore.getState().undo();
      const children = useAppStore.getState().document!.rootGroup.children;
      expect(children[0].id).toBe(l1Id);
      expect(children[1].id).toBe(l2Id);
    });
  });

  describe('selectLayer', () => {
    it('should select a layer by ID', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().selectLayer(layerId);
      expect(useAppStore.getState().selectedLayerId).toBe(layerId);
    });

    it('should deselect when passing null', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = useAppStore.getState().document!.rootGroup.children[0].id;
      useAppStore.getState().selectLayer(layerId);
      useAppStore.getState().selectLayer(null);
      expect(useAppStore.getState().selectedLayerId).toBeNull();
    });

    it('should not select non-existent layer', () => {
      createTestDocument();
      useAppStore.getState().selectLayer('non-existent');
      expect(useAppStore.getState().selectedLayerId).toBeNull();
    });
  });

  describe('undo/redo', () => {
    it('should undo and redo operations', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(1);
      expect(useAppStore.getState().canUndo).toBe(true);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(0);
      expect(useAppStore.getState().canRedo).toBe(true);
      useAppStore.getState().redo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(1);
    });

    it('should do nothing if cannot undo', () => {
      createTestDocument();
      const rev = useAppStore.getState().revision;
      useAppStore.getState().undo();
      expect(useAppStore.getState().revision).toBe(rev);
    });

    it('should do nothing if cannot redo', () => {
      createTestDocument();
      const rev = useAppStore.getState().revision;
      useAppStore.getState().redo();
      expect(useAppStore.getState().revision).toBe(rev);
    });

    it('should increment revision on each mutation', () => {
      createTestDocument();
      const rev0 = useAppStore.getState().revision;
      useAppStore.getState().addRasterLayer('L1');
      const rev1 = useAppStore.getState().revision;
      expect(rev1).toBeGreaterThan(rev0);
      useAppStore.getState().undo();
      const rev2 = useAppStore.getState().revision;
      expect(rev2).toBeGreaterThan(rev1);
    });
  });

  describe('context menu', () => {
    it('should show and hide context menu', () => {
      useAppStore.getState().showContextMenu(100, 200, 'layer-1');
      expect(useAppStore.getState().contextMenu).toEqual({ x: 100, y: 200, layerId: 'layer-1' });
      useAppStore.getState().hideContextMenu();
      expect(useAppStore.getState().contextMenu).toBeNull();
    });
  });
});
