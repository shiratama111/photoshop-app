/**
 * @module components/text-editor/TextPropertiesPanel.test
 * Store-level tests for text property mutations via setTextProperty.
 * @see APP-005: Text editing UI
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
    layerStyleDialog: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

function addTextAndSelect(): string {
  const store = useAppStore.getState();
  store.addTextLayer('TestText', 'Hello World');
  const doc = useAppStore.getState().document!;
  const layer = doc.rootGroup.children[0];
  return layer.id;
}

describe('TextPropertiesPanel store actions', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addTextLayer', () => {
    it('should add a text layer to the document', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('My Text', 'Sample');
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.children).toHaveLength(1);
      expect(doc.rootGroup.children[0].type).toBe('text');
      expect(doc.rootGroup.children[0].name).toBe('My Text');
    });

    it('should use default name when none provided', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer();
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.children[0].name).toMatch(/^Text/);
    });

    it('should select the new text layer', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hi');
      const doc = useAppStore.getState().document!;
      const layerId = doc.rootGroup.children[0].id;
      expect(useAppStore.getState().selectedLayerId).toBe(layerId);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hi');
      expect(useAppStore.getState().canUndo).toBe(true);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(0);
    });

    it('should not add when no document exists', () => {
      useAppStore.getState().addTextLayer('T1', 'Hi');
      expect(useAppStore.getState().document).toBeNull();
    });
  });

  describe('setTextProperty', () => {
    it('should change fontFamily', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'fontFamily', 'Georgia');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { fontFamily: string };
      expect(layer.fontFamily).toBe('Georgia');
    });

    it('should change fontSize', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'fontSize', 24);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { fontSize: number };
      expect(layer.fontSize).toBe(24);
    });

    it('should toggle bold', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'bold', true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { bold: boolean };
      expect(layer.bold).toBe(true);
    });

    it('should toggle italic', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'italic', true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { italic: boolean };
      expect(layer.italic).toBe(true);
    });

    it('should change alignment', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'alignment', 'center');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { alignment: string };
      expect(layer.alignment).toBe('center');
    });

    it('should change text content', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'text', 'Updated');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { text: string };
      expect(layer.text).toBe('Updated');
    });

    it('should be undoable', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'fontSize', 48);
      useAppStore.getState().undo();
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[0] as { fontSize: number };
      expect(layer.fontSize).toBe(16); // default from createTextLayer
    });

    it('should not change non-text layers', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Raster');
      const doc = useAppStore.getState().document!;
      const rasterId = doc.rootGroup.children[0].id;
      const revBefore = useAppStore.getState().revision;
      useAppStore.getState().setTextProperty(rasterId, 'fontFamily', 'Georgia');
      // Revision should not change — nothing happened
      expect(useAppStore.getState().revision).toBe(revBefore);
    });
  });
});
