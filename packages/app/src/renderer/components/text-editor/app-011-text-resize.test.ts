/**
 * @module app-011-text-resize.test
 * Tests for text box resize feature (APP-011).
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
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

describe('APP-011: Text Box Resize', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should set textBounds via setTextProperty', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Test Text', 'Hello');

    const doc = useAppStore.getState().document!;
    const textLayerId = useAppStore.getState().selectedLayerId!;
    const textLayer = findLayerById(doc.rootGroup, textLayerId)!;
    expect(textLayer.type).toBe('text');

    store.setTextProperty(textLayerId, 'textBounds', {
      x: 10,
      y: 20,
      width: 200,
      height: 100,
    });

    const updated = findLayerById(useAppStore.getState().document!.rootGroup, textLayerId)!;
    if (updated.type === 'text') {
      expect(updated.textBounds).toEqual({
        x: 10,
        y: 20,
        width: 200,
        height: 100,
      });
    }
  });

  it('should allow updating textBounds dimensions', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Resizable', 'Test');

    const textLayerId = useAppStore.getState().selectedLayerId!;

    // First set
    store.setTextProperty(textLayerId, 'textBounds', {
      x: 0, y: 0, width: 100, height: 50,
    });

    // Update to larger
    store.setTextProperty(textLayerId, 'textBounds', {
      x: 0, y: 0, width: 300, height: 150,
    });

    const updated = findLayerById(useAppStore.getState().document!.rootGroup, textLayerId)!;
    if (updated.type === 'text') {
      expect(updated.textBounds?.width).toBe(300);
      expect(updated.textBounds?.height).toBe(150);
    }
  });

  it('should be undoable', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Undo Test', 'Text');

    const textLayerId = useAppStore.getState().selectedLayerId!;

    store.setTextProperty(textLayerId, 'textBounds', {
      x: 0, y: 0, width: 200, height: 100,
    });

    // Undo should restore null textBounds
    store.undo();

    const restored = findLayerById(useAppStore.getState().document!.rootGroup, textLayerId)!;
    if (restored.type === 'text') {
      expect(restored.textBounds).toBeNull();
    }
  });

  it('should start editing text when startEditingText is called', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Edit Me', 'Content');

    const textLayerId = useAppStore.getState().selectedLayerId!;
    store.startEditingText(textLayerId);

    expect(useAppStore.getState().editingTextLayerId).toBe(textLayerId);
  });

  it('should stop editing when stopEditingText is called', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Edit Me', 'Content');

    const textLayerId = useAppStore.getState().selectedLayerId!;
    store.startEditingText(textLayerId);
    store.stopEditingText();

    expect(useAppStore.getState().editingTextLayerId).toBeNull();
  });
});
