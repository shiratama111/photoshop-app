/**
 * @module CutoutTool.test
 * Unit tests for the cutout store actions.
 * @see APP-006: AI cutout UI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Mask, PointPrompt } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';
import { useCutoutStore } from './cutout-store';

function resetStores(): void {
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
  useCutoutStore.setState({ cutout: null });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 100, 100);
}

function getSelectedLayerId(): string {
  const id = useAppStore.getState().selectedLayerId;
  if (!id) throw new Error('No selected layer');
  return id;
}

function createTestMask(): Mask {
  const data = new Uint8Array(100 * 100);
  for (let y = 25; y < 75; y++) {
    for (let x = 25; x < 75; x++) {
      data[y * 100 + x] = 255;
    }
  }
  return {
    data,
    size: { width: 100, height: 100 },
    confidence: 0.95,
  };
}

describe('cutout store actions', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('startCutout', () => {
    it('should initialize cutout state when a layer is selected', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);

      useCutoutStore.getState().startCutout();

      const { cutout } = useCutoutStore.getState();
      expect(cutout).not.toBeNull();
      expect(cutout!.prompts).toHaveLength(0);
      expect(cutout!.currentMask).toBeNull();
      expect(cutout!.brushMode).toBe('add');
      expect(cutout!.brushSize).toBe(20);
      expect(cutout!.boundaryAdjust).toBe(0);
      expect(cutout!.featherRadius).toBe(0);
      expect(cutout!.isProcessing).toBe(false);
      expect(cutout!.confidence).toBe(0);
      expect(useAppStore.getState().activeTool).toBe('segment');
    });

    it('should not start if no layer is selected', () => {
      createTestDocument();
      useAppStore.getState().selectLayer(null);
      useAppStore.getState().setActiveTool('segment');

      useCutoutStore.getState().startCutout();

      expect(useCutoutStore.getState().cutout).toBeNull();
      expect(useAppStore.getState().activeTool).toBe('select');
      expect(useAppStore.getState().statusMessage).toBe('Select a layer first');
    });

    it('should not start if no document is open', () => {
      useAppStore.getState().setActiveTool('segment');
      useCutoutStore.getState().startCutout();

      expect(useCutoutStore.getState().cutout).toBeNull();
      expect(useAppStore.getState().activeTool).toBe('select');
    });
  });

  describe('cancelCutout', () => {
    it('should clear cutout state', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().cancelCutout();

      expect(useCutoutStore.getState().cutout).toBeNull();
      expect(useAppStore.getState().activeTool).toBe('select');
      expect(useAppStore.getState().statusMessage).toBe('Ready');
    });
  });

  describe('addCutoutPrompt', () => {
    it('should add a prompt and set processing', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      const prompt: PointPrompt = {
        position: { x: 50, y: 50 },
        label: 'positive',
      };
      useCutoutStore.getState().addCutoutPrompt(prompt);

      const { cutout } = useCutoutStore.getState();
      expect(cutout!.prompts).toHaveLength(1);
      expect(cutout!.prompts[0]).toEqual(prompt);
      expect(cutout!.isProcessing).toBe(true);
    });

    it('should do nothing if cutout is not active', () => {
      const prompt: PointPrompt = {
        position: { x: 50, y: 50 },
        label: 'positive',
      };
      useCutoutStore.getState().addCutoutPrompt(prompt);

      expect(useCutoutStore.getState().cutout).toBeNull();
    });
  });

  describe('setCutoutMask', () => {
    it('should set the mask and update confidence', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      const mask = createTestMask();
      useCutoutStore.getState().setCutoutMask(mask);

      const { cutout } = useCutoutStore.getState();
      expect(cutout!.currentMask).toBe(mask);
      expect(cutout!.isProcessing).toBe(false);
      expect(cutout!.confidence).toBe(0.95);
    });
  });

  describe('setCutoutBrushMode', () => {
    it('should change brush mode', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutBrushMode('remove');
      expect(useCutoutStore.getState().cutout!.brushMode).toBe('remove');

      useCutoutStore.getState().setCutoutBrushMode('add');
      expect(useCutoutStore.getState().cutout!.brushMode).toBe('add');
    });
  });

  describe('setCutoutBrushSize', () => {
    it('should set brush size within valid range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutBrushSize(50);
      expect(useCutoutStore.getState().cutout!.brushSize).toBe(50);
    });

    it('should clamp brush size to 1-200 range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutBrushSize(300);
      expect(useCutoutStore.getState().cutout!.brushSize).toBe(200);

      useCutoutStore.getState().setCutoutBrushSize(-5);
      expect(useCutoutStore.getState().cutout!.brushSize).toBe(1);
    });
  });

  describe('setCutoutBoundaryAdjust', () => {
    it('should set boundary adjustment within valid range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutBoundaryAdjust(10);
      expect(useCutoutStore.getState().cutout!.boundaryAdjust).toBe(10);

      useCutoutStore.getState().setCutoutBoundaryAdjust(-20);
      expect(useCutoutStore.getState().cutout!.boundaryAdjust).toBe(-20);
    });

    it('should clamp to -100..100 range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutBoundaryAdjust(200);
      expect(useCutoutStore.getState().cutout!.boundaryAdjust).toBe(100);

      useCutoutStore.getState().setCutoutBoundaryAdjust(-200);
      expect(useCutoutStore.getState().cutout!.boundaryAdjust).toBe(-100);
    });
  });

  describe('setCutoutFeatherRadius', () => {
    it('should set feather radius within valid range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutFeatherRadius(10);
      expect(useCutoutStore.getState().cutout!.featherRadius).toBe(10);
    });

    it('should clamp to 0..50 range', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().setCutoutFeatherRadius(100);
      expect(useCutoutStore.getState().cutout!.featherRadius).toBe(50);

      useCutoutStore.getState().setCutoutFeatherRadius(-5);
      expect(useCutoutStore.getState().cutout!.featherRadius).toBe(0);
    });
  });

  describe('updateCutoutMaskData', () => {
    it('should replace the mask data', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      const mask = createTestMask();
      useCutoutStore.getState().setCutoutMask(mask);

      const newData = new Uint8Array(100 * 100);
      newData.fill(255);
      useCutoutStore.getState().updateCutoutMaskData(newData);

      const updatedMask = useCutoutStore.getState().cutout!.currentMask!;
      expect(updatedMask.data).toBe(newData);
      expect(updatedMask.size).toEqual({ width: 100, height: 100 });
    });

    it('should do nothing if no mask exists', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      const newData = new Uint8Array(100);
      useCutoutStore.getState().updateCutoutMaskData(newData);

      expect(useCutoutStore.getState().cutout!.currentMask).toBeNull();
    });
  });

  describe('applyCutoutAsMask', () => {
    it('should apply the mask to the selected layer', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();
      useCutoutStore.getState().setCutoutMask(createTestMask());

      useCutoutStore.getState().applyCutoutAsMask();

      const layer = findLayerById(useAppStore.getState().document!.rootGroup, layerId)!;
      expect(layer.mask).toBeDefined();
      expect(layer.mask!.enabled).toBe(true);
      expect(layer.mask!.width).toBe(100);
      expect(layer.mask!.height).toBe(100);
      // Cutout should be cleared
      expect(useCutoutStore.getState().cutout).toBeNull();
      expect(useAppStore.getState().activeTool).toBe('select');
    });

    it('should do nothing if no mask exists', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('L1');
      const layerId = getSelectedLayerId();
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();

      useCutoutStore.getState().applyCutoutAsMask();

      const layer = findLayerById(useAppStore.getState().document!.rootGroup, layerId)!;
      expect(layer.mask).toBeUndefined();
    });
  });

  describe('cutToNewLayer', () => {
    it('should create a new layer from the masked selection', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Source');
      const layerId = getSelectedLayerId();
      const countBefore = useAppStore.getState().document!.rootGroup.children.length;
      useAppStore.getState().selectLayer(layerId);
      useCutoutStore.getState().startCutout();
      useCutoutStore.getState().setCutoutMask(createTestMask());

      useCutoutStore.getState().cutToNewLayer();

      const children = useAppStore.getState().document!.rootGroup.children;
      expect(children).toHaveLength(countBefore + 1);
      const newLayer = children[children.length - 1];
      expect(newLayer.name).toBe('Source cutout');
      expect(newLayer.type).toBe('raster');
      // New layer should be selected
      expect(useAppStore.getState().selectedLayerId).toBe(newLayer.id);
      // Cutout should be cleared
      expect(useCutoutStore.getState().cutout).toBeNull();
      expect(useAppStore.getState().activeTool).toBe('select');
    });

    it('should reject non-raster layers', () => {
      createTestDocument();
      useAppStore.getState().addLayerGroup('Group');
      const groupId = getSelectedLayerId();
      const countBefore = useAppStore.getState().document!.rootGroup.children.length;
      useAppStore.getState().selectLayer(groupId);
      useCutoutStore.getState().startCutout();
      useCutoutStore.getState().setCutoutMask(createTestMask());

      useCutoutStore.getState().cutToNewLayer();

      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(countBefore);
      expect(useAppStore.getState().statusMessage).toBe('Select a raster layer to cut');
    });
  });
});
