/**
 * @module components/text-editor/CanvasTextEditor.test
 * Regression checks for PS-TEXT-005 custom text editor behavior.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';
import type { TextLayer } from '@photoshop-app/types';

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

describe('CanvasTextEditor (PS-TEXT-005)', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('editing lifecycle', () => {
    it('keeps editing session active while text is updated', () => {
      createTestDocument();
      const store = useAppStore.getState();
      store.addTextLayer('T1', 'Hello');
      const layerId = useAppStore.getState().selectedLayerId!;
      store.startEditingText(layerId);

      store.setTextProperty(layerId, 'text', 'Hello 日本語');
      expect(useAppStore.getState().editingTextLayerId).toBe(layerId);
    });

    it('preserves Japanese and English characters in text layer', () => {
      createTestDocument();
      const store = useAppStore.getState();
      store.addTextLayer('T1', 'initial');
      const layerId = useAppStore.getState().selectedLayerId!;
      store.startEditingText(layerId);

      const nextText = 'initial 日本語 English <tag>';
      store.setTextProperty(layerId, 'text', nextText);

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;
      expect(layer.text).toBe(nextText);
    });

    it('does not clear a newer editor when stale blur id is passed', () => {
      createTestDocument();
      const store = useAppStore.getState();
      store.addTextLayer('T1', 'First');
      const firstId = useAppStore.getState().selectedLayerId!;
      store.startEditingText(firstId);

      store.addTextLayer('T2', 'Second');
      const secondId = useAppStore.getState().selectedLayerId!;
      store.startEditingText(secondId);

      store.stopEditingText(firstId);
      expect(useAppStore.getState().editingTextLayerId).toBe(secondId);
    });
  });

  describe('implementation safety contracts', () => {
    it('does not render editable text via dangerouslySetInnerHTML', () => {
      const source = fs.readFileSync(path.resolve(__dirname, 'InlineTextEditor.tsx'), 'utf8');
      expect(source).not.toContain('dangerouslySetInnerHTML');
    });

    it('keeps contentEditable keyboard guard in App shortcut handler', () => {
      const source = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');
      expect(source).toContain('target.isContentEditable');
    });
  });
});
