/**
 * @module components/text-editor/CanvasTextEditor.test
 * Regression checks for PS-TEXT-005 custom text editor behavior.
 * PS-TEXT-007: IME composition sequence tests.
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

      store.setTextProperty(layerId, 'text', 'Hello \u65e5\u672c\u8a9e');
      expect(useAppStore.getState().editingTextLayerId).toBe(layerId);
    });

    it('preserves Japanese and English characters in text layer', () => {
      createTestDocument();
      const store = useAppStore.getState();
      store.addTextLayer('T1', 'initial');
      const layerId = useAppStore.getState().selectedLayerId!;
      store.startEditingText(layerId);

      const nextText = 'initial \u65e5\u672c\u8a9e English <tag>';
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

    it('commits latest editor text on blur as a fallback path', () => {
      const source = fs.readFileSync(path.resolve(__dirname, 'InlineTextEditor.tsx'), 'utf8');
      expect(source).toContain("setTextProperty(layerId, 'text', currentText)");
    });

    it('commits and exits text editing when window loses focus', () => {
      const source = fs.readFileSync(path.resolve(__dirname, 'InlineTextEditor.tsx'), 'utf8');
      expect(source).toContain("window.addEventListener('blur', handleWindowBlur)");
    });

    it('forces canvas refresh when editing session toggles', () => {
      const source = fs.readFileSync(path.resolve(__dirname, '../canvas/CanvasView.tsx'), 'utf8');
      expect(source).toContain('const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);');
      expect(source).toContain('editingTextLayerId');
      expect(source).toContain('doRender();');
      expect(source).toContain("window.addEventListener('focus', handleFocus)");
    });
  });
});

// ---------------------------------------------------------------------------
// PS-TEXT-007: IME composition sequence
// ---------------------------------------------------------------------------

describe('PS-TEXT-007: IME composition sequence', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should preserve text during sequential setTextProperty calls (IME partial input)', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('IME Test', '');
    const layerId = useAppStore.getState().selectedLayerId!;
    store.startEditingText(layerId);

    // Simulate IME partial -> full sequence
    store.setTextProperty(layerId, 'text', '\u306b');
    store.setTextProperty(layerId, 'text', '\u306b\u307b');
    store.setTextProperty(layerId, 'text', '\u306b\u307b\u3093');
    store.setTextProperty(layerId, 'text', '\u65e5\u672c\u8a9e');

    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;
    expect(layer.text).toBe('\u65e5\u672c\u8a9e');
  });

  it('should commit final text matching compositionEnd output (finalized JP text)', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Commit Test', '');
    const layerId = useAppStore.getState().selectedLayerId!;
    store.startEditingText(layerId);

    store.setTextProperty(layerId, 'text', '\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8');
    store.stopEditingText(layerId);

    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;
    expect(layer.text).toBe('\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8');
    expect(useAppStore.getState().editingTextLayerId).toBeNull();
  });

  it('should preserve mixed CJK+Latin text after composition (mixed-width IME)', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Mixed CJK', '');
    const layerId = useAppStore.getState().selectedLayerId!;
    store.startEditingText(layerId);

    const mixedText = '\u6771\u4eacTower123\u7248';
    store.setTextProperty(layerId, 'text', mixedText);

    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;
    expect(layer.text).toBe(mixedText);
  });
});
