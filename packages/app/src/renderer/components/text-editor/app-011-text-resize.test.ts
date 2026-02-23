/**
 * @module app-011-text-resize.test
 * Tests for text box resize feature (APP-011).
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
    const textLayer = doc.rootGroup.children[0];
    expect(textLayer.type).toBe('text');

    store.setTextProperty(textLayer.id, 'textBounds', {
      x: 10,
      y: 20,
      width: 200,
      height: 100,
    });

    const updated = useAppStore.getState().document!.rootGroup.children[0];
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

    const textLayer = useAppStore.getState().document!.rootGroup.children[0];

    // First set
    store.setTextProperty(textLayer.id, 'textBounds', {
      x: 0, y: 0, width: 100, height: 50,
    });

    // Update to larger
    store.setTextProperty(textLayer.id, 'textBounds', {
      x: 0, y: 0, width: 300, height: 150,
    });

    const updated = useAppStore.getState().document!.rootGroup.children[0];
    if (updated.type === 'text') {
      expect(updated.textBounds?.width).toBe(300);
      expect(updated.textBounds?.height).toBe(150);
    }
  });

  it('should be undoable', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Undo Test', 'Text');

    const textLayer = useAppStore.getState().document!.rootGroup.children[0];

    store.setTextProperty(textLayer.id, 'textBounds', {
      x: 0, y: 0, width: 200, height: 100,
    });

    // Undo should restore null textBounds
    store.undo();

    const restored = useAppStore.getState().document!.rootGroup.children[0];
    if (restored.type === 'text') {
      expect(restored.textBounds).toBeNull();
    }
  });

  it('should start editing text when startEditingText is called', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Edit Me', 'Content');

    const textLayer = useAppStore.getState().document!.rootGroup.children[0];
    store.startEditingText(textLayer.id);

    expect(useAppStore.getState().editingTextLayerId).toBe(textLayer.id);
  });

  it('should stop editing when stopEditingText is called', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Edit Me', 'Content');

    const textLayer = useAppStore.getState().document!.rootGroup.children[0];
    store.startEditingText(textLayer.id);
    store.stopEditingText();

    expect(useAppStore.getState().editingTextLayerId).toBeNull();
  });
});
