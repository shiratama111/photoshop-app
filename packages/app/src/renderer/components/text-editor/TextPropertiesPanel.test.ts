/**
 * @module components/text-editor/TextPropertiesPanel.test
 * Store-level tests for text property mutations via setTextProperty.
 * PS-TEXT-007: Long text and multi-line regression tests.
 * @see APP-005: Text editing UI
 * @see docs/agent-briefs/PS-TEXT-007-MANUAL-CHECKLIST.md
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

/** Number of default children (background layer). */
const BG = 1;

function addTextAndSelect(): string {
  const store = useAppStore.getState();
  store.addTextLayer('TestText', 'Hello World');
  const doc = useAppStore.getState().document!;
  const layer = doc.rootGroup.children[BG];
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
      expect(doc.rootGroup.children).toHaveLength(BG + 1);
      expect(doc.rootGroup.children[BG].type).toBe('text');
      expect(doc.rootGroup.children[BG].name).toBe('My Text');
    });

    it('should use default name when none provided', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer();
      const doc = useAppStore.getState().document!;
      expect(doc.rootGroup.children[BG].name).toMatch(/^Text/);
    });

    it('should select the new text layer', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hi');
      const doc = useAppStore.getState().document!;
      const layerId = doc.rootGroup.children[BG].id;
      expect(useAppStore.getState().selectedLayerId).toBe(layerId);
    });

    it('should be undoable', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('T1', 'Hi');
      expect(useAppStore.getState().canUndo).toBe(true);
      useAppStore.getState().undo();
      expect(useAppStore.getState().document!.rootGroup.children).toHaveLength(BG);
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
      const layer = doc.rootGroup.children[BG] as { fontFamily: string };
      expect(layer.fontFamily).toBe('Georgia');
    });

    it('should change fontSize', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'fontSize', 24);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { fontSize: number };
      expect(layer.fontSize).toBe(24);
    });

    it('should toggle bold', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'bold', true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { bold: boolean };
      expect(layer.bold).toBe(true);
    });

    it('should toggle italic', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'italic', true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { italic: boolean };
      expect(layer.italic).toBe(true);
    });

    it('should change alignment', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'alignment', 'center');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { alignment: string };
      expect(layer.alignment).toBe('center');
    });

    it('should change text content', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'text', 'Updated');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { text: string };
      expect(layer.text).toBe('Updated');
    });

    it('should be undoable', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'fontSize', 48);
      useAppStore.getState().undo();
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { fontSize: number };
      expect(layer.fontSize).toBe(16); // default from createTextLayer
    });

    it('should change writingMode', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'writingMode', 'vertical-rl');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { writingMode: string };
      expect(layer.writingMode).toBe('vertical-rl');
    });

    it('should preserve writingMode through undo/redo', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'writingMode', 'vertical-rl');
      useAppStore.getState().undo();
      const doc1 = useAppStore.getState().document!;
      const layer1 = doc1.rootGroup.children[BG] as { writingMode: string };
      expect(layer1.writingMode).toBe('horizontal-tb');
      useAppStore.getState().redo();
      const doc2 = useAppStore.getState().document!;
      const layer2 = doc2.rootGroup.children[BG] as { writingMode: string };
      expect(layer2.writingMode).toBe('vertical-rl');
    });

    it('should recover legacy text layer without writingMode when undoing', () => {
      createTestDocument();
      const id = addTextAndSelect();
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { writingMode?: string };
      delete layer.writingMode;

      useAppStore.getState().setTextProperty(id, 'writingMode', 'vertical-rl');
      useAppStore.getState().undo();

      const docAfterUndo = useAppStore.getState().document!;
      const layerAfterUndo = docAfterUndo.rootGroup.children[BG] as { writingMode: string };
      expect(layerAfterUndo.writingMode).toBe('horizontal-tb');
    });

    it('should not change non-text layers', () => {
      createTestDocument();
      useAppStore.getState().addRasterLayer('Raster');
      const doc = useAppStore.getState().document!;
      const rasterId = doc.rootGroup.children[BG].id;
      const revBefore = useAppStore.getState().revision;
      useAppStore.getState().setTextProperty(rasterId, 'fontFamily', 'Georgia');
      // Revision should not change — nothing happened
      expect(useAppStore.getState().revision).toBe(revBefore);
    });

    it('should toggle underline and undo', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'underline', true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { underline: boolean };
      expect(layer.underline).toBe(true);

      useAppStore.getState().undo();
      const docAfter = useAppStore.getState().document!;
      const layerAfter = docAfter.rootGroup.children[BG] as { underline: boolean };
      expect(layerAfter.underline).toBe(false);
    });

    it('should toggle strikethrough and undo', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'strikethrough', true);
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { strikethrough: boolean };
      expect(layer.strikethrough).toBe(true);

      useAppStore.getState().undo();
      const docAfter = useAppStore.getState().document!;
      const layerAfter = docAfter.rootGroup.children[BG] as { strikethrough: boolean };
      expect(layerAfter.strikethrough).toBe(false);
    });

    it('should change alignment to justify', () => {
      createTestDocument();
      const id = addTextAndSelect();
      useAppStore.getState().setTextProperty(id, 'alignment', 'justify');
      const doc = useAppStore.getState().document!;
      const layer = doc.rootGroup.children[BG] as { alignment: string };
      expect(layer.alignment).toBe('justify');
    });
  });
});

// ---------------------------------------------------------------------------
// PS-TEXT-007: Long text and multi-line regression
// ---------------------------------------------------------------------------

describe('PS-TEXT-007: Long text and multi-line regression', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should store multi-paragraph Japanese text', () => {
    createTestDocument();
    const id = addTextAndSelect();
    const multiParagraph = [
      '\u6700\u521d\u306e\u6bb5\u843d\u3067\u3059\u3002',
      '\u3053\u308c\u306f\u4e8c\u756a\u76ee\u306e\u6bb5\u843d\u3067\u3059\u3002',
      '\u4e09\u756a\u76ee\u306e\u6bb5\u843d\u306b\u306a\u308a\u307e\u3059\u3002',
      '\u8907\u6570\u6bb5\u843d\u3092\u307e\u305f\u3044\u3067\u3001',
      '\u6700\u5f8c\u306e\u6bb5\u843d\u3067\u7d42\u4e86\u3067\u3059\u3002',
    ].join('\n');

    useAppStore.getState().setTextProperty(id, 'text', multiParagraph);
    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children[BG] as { text: string };
    expect(layer.text).toBe(multiParagraph);
    expect(layer.text.split('\n').length).toBe(5);
  });

  it('should store very long single-line text (300+ chars) without truncation', () => {
    createTestDocument();
    const id = addTextAndSelect();
    const longText = 'A'.repeat(300) + '\u3042'.repeat(50);

    useAppStore.getState().setTextProperty(id, 'text', longText);
    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children[BG] as { text: string };
    expect(layer.text).toBe(longText);
    expect(layer.text.length).toBe(350);
  });

  it('should store CJK-only text', () => {
    createTestDocument();
    const id = addTextAndSelect();
    const cjkText = '\u65e5\u672c\u8a9e\u4e2d\u56fd\u8a9e\u97d3\u56fd\u8a9e\u6df7\u5728\u30c6\u30ad\u30b9\u30c8';

    useAppStore.getState().setTextProperty(id, 'text', cjkText);
    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children[BG] as { text: string };
    expect(layer.text).toBe(cjkText);
  });

  it('should store emoji text without corruption', () => {
    createTestDocument();
    const id = addTextAndSelect();
    const emojiText = 'Hello \u{1F600}\u{1F680} World \u2728 \u30c6\u30b9\u30c8 \u{1F44D}';

    useAppStore.getState().setTextProperty(id, 'text', emojiText);
    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children[BG] as { text: string };
    expect(layer.text).toBe(emojiText);
  });

  it('should store mixed JP-EN multi-line text with properties', () => {
    createTestDocument();
    const id = addTextAndSelect();
    const mixedText = '\u30bf\u30a4\u30c8\u30eb Title\n\u8aac\u660e Description\n\u8a73\u7d30 Details';

    useAppStore.getState().setTextProperty(id, 'text', mixedText);
    useAppStore.getState().setTextProperty(id, 'bold', true);
    useAppStore.getState().setTextProperty(id, 'fontSize', 32);
    useAppStore.getState().setTextProperty(id, 'alignment', 'center');

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children[BG] as {
      text: string;
      bold: boolean;
      fontSize: number;
      alignment: string;
    };
    expect(layer.text).toBe(mixedText);
    expect(layer.bold).toBe(true);
    expect(layer.fontSize).toBe(32);
    expect(layer.alignment).toBe('center');
  });
});
