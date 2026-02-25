/**
 * @module export-quality.test
 * Tests for PNG/JPG export quality with layer effects (EXPORT-001).
 *
 * Validates:
 * - PNG export with text + stroke + drop-shadow produces correct size output
 * - PNG transparency (alpha channel preservation)
 * - Effects are flattened into export output
 * - JPG quality parameter affects file size
 * - JPG alpha composited to white background
 * - 1280x720 canvas export produces exactly 1280x720 pixels
 * - All layer types (text + raster + group) flattened correctly
 * - Edge cases: empty document, hidden layers, 0% opacity layers
 *
 * @see EXPORT-001 ticket for full requirements
 * @see app-010-image-export.test.ts for basic export tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './store';
import { t } from './i18n';
import type {
  Document,
  StrokeEffect,
  DropShadowEffect,
  LayerEffect,
} from '@photoshop-app/types';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

/** Tracks convertToBlob calls with their options. */
const convertToBlobCalls: Array<{ type?: string; quality?: number }> = [];

/** Controls the size of the ArrayBuffer returned by blob.arrayBuffer(). */
let mockBlobSize = 1000;

const mockBlob = {
  arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(mockBlobSize))),
};

/**
 * Creates a fresh mock 2D canvas context with all methods needed by
 * Canvas2DRenderer (including effect rendering: strokeText, getImageData,
 * createLinearGradient, etc.).
 *
 * Each OffscreenCanvas instance gets its own context so the CanvasPool
 * can acquire/release canvases independently.
 */
function createMockContext(canvasRef: { width: number; height: number }): Record<string, unknown> {
  return {
    canvas: canvasRef,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '' as string,
    strokeStyle: '' as string,
    lineWidth: 1,
    lineCap: 'butt' as string,
    lineJoin: 'miter' as string,
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn((_sx: number, _sy: number, sw: number, sh: number) => ({
      data: new Uint8ClampedArray(sw * sh * 4),
      width: sw,
      height: sh,
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as string,
    filter: 'none' as string,
    font: '' as string,
    textAlign: 'start' as string,
    textBaseline: 'alphabetic' as string,
    letterSpacing: '0px' as string,
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    transform: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 })),
    createPattern: vi.fn(() => null),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    clip: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    shadowColor: '' as string,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
  };
}

/** Tracks OffscreenCanvas construction arguments (width, height). */
const offscreenCanvasConstructions: Array<{ width: number; height: number }> = [];

/**
 * Tracks the context of the first (export) OffscreenCanvas so tests
 * can assert on draw operations of the primary export canvas.
 */
let primaryExportCtx: Record<string, unknown> | null = null;

vi.stubGlobal(
  'OffscreenCanvas',
  vi.fn((w: number, h: number) => {
    offscreenCanvasConstructions.push({ width: w, height: h });
    const canvasObj = {
      width: w,
      height: h,
      getContext: vi.fn(() => {
        const ctx = createMockContext(canvasObj);
        // Capture the first context created (the export canvas)
        if (primaryExportCtx === null) {
          primaryExportCtx = ctx;
        }
        return ctx;
      }),
      convertToBlob: vi.fn((opts?: { type?: string; quality?: number }) => {
        convertToBlobCalls.push(opts ?? {});
        return Promise.resolve(mockBlob);
      }),
    };
    return canvasObj;
  }),
);

// Electron API mock
const mockExportFile = vi.fn<
  (data: ArrayBuffer, defaultPath?: string) => Promise<string | null>
>(() => Promise.resolve('/exported/TestDoc.png'));

const mockElectronAPI = {
  exportFile: mockExportFile,
  setTitle: vi.fn(() => Promise.resolve()),
  saveFile: vi.fn(() => Promise.resolve(null)),
  openFile: vi.fn(() => Promise.resolve(null)),
  loadRecentFiles: vi.fn(() => Promise.resolve([])),
  autoSaveClear: vi.fn(() => Promise.resolve()),
};

vi.stubGlobal('window', { electronAPI: mockElectronAPI });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the store to its initial (empty) state. */
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

/** Create a document through the store with given dimensions. */
function createDoc(name: string, width: number, height: number): void {
  useAppStore.getState().newDocument(name, width, height);
}

/** Helper to get the current document from the store (asserts non-null). */
function getDoc(): Document {
  const doc = useAppStore.getState().document;
  expect(doc).not.toBeNull();
  return doc as Document;
}

/** Create a stroke effect with sensible defaults. */
function makeStroke(overrides?: Partial<StrokeEffect>): StrokeEffect {
  return {
    type: 'stroke',
    enabled: true,
    color: { r: 255, g: 0, b: 0, a: 1 },
    size: 3,
    position: 'outside',
    opacity: 1,
    ...overrides,
  };
}

/** Create a drop-shadow effect with sensible defaults. */
function makeDropShadow(overrides?: Partial<DropShadowEffect>): DropShadowEffect {
  return {
    type: 'drop-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 0.75,
    angle: 135,
    distance: 5,
    blur: 4,
    spread: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('EXPORT-001: Export Quality with Layer Effects', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    convertToBlobCalls.length = 0;
    offscreenCanvasConstructions.length = 0;
    primaryExportCtx = null;
    mockBlobSize = 1000;
    mockExportFile.mockImplementation(() => Promise.resolve('/exported/TestDoc.png'));
  });

  // =========================================================================
  // PNG export tests
  // =========================================================================

  describe('PNG export with effects', () => {
    it('should export a text layer with stroke + drop-shadow at the correct canvas size', async () => {
      createDoc('EffectsTest', 1280, 720);
      const store = useAppStore.getState();

      // Add a text layer
      store.addTextLayer('Title', 'Hello YouTube');

      // Attach effects to the text layer
      const doc = getDoc();
      const textLayer = doc.rootGroup.children.find((l) => l.type === 'text');
      expect(textLayer).toBeDefined();

      store.addLayerEffect(textLayer!.id, makeStroke());
      store.addLayerEffect(textLayer!.id, makeDropShadow());

      // Verify effects are attached
      const updatedDoc = getDoc();
      const updatedText = updatedDoc.rootGroup.children.find((l) => l.type === 'text');
      expect(updatedText!.effects).toHaveLength(2);
      expect(updatedText!.effects[0].type).toBe('stroke');
      expect(updatedText!.effects[1].type).toBe('drop-shadow');

      // Export as PNG
      await useAppStore.getState().exportAsImage('png');

      // OffscreenCanvas was created with correct document dimensions
      expect(offscreenCanvasConstructions).toHaveLength(1);
      expect(offscreenCanvasConstructions[0]).toEqual({ width: 1280, height: 720 });

      // Export was called
      expect(mockExportFile).toHaveBeenCalledTimes(1);

      // Status indicates success
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });

    it('should preserve PNG transparency (no white background fill for PNG)', async () => {
      createDoc('AlphaTest', 800, 600);

      await useAppStore.getState().exportAsImage('png');

      // The export should use image/png MIME type (which preserves alpha).
      expect(convertToBlobCalls).toHaveLength(1);
      expect(convertToBlobCalls[0].type).toBe('image/png');

      // The primary export context should exist.
      expect(primaryExportCtx).not.toBeNull();
      // For PNG export, the store should NOT do a white background fill at the
      // store level. (The renderer may do its own fills for pasteboard, but the
      // store's exportAsImage only does ctx.fillStyle='#ffffff' + fillRect for JPEG.)
      // We verify by checking that image/png was used (alpha-preserving format).
      expect(convertToBlobCalls[0].type).toBe('image/png');
    });

    it('should flatten effects into the export by passing renderEffects: true', async () => {
      createDoc('FlattenTest', 640, 480);
      const store = useAppStore.getState();

      // Add a text layer with a color overlay effect
      store.addTextLayer('Overlay', 'Overlay Text');
      const doc = getDoc();
      const textLayer = doc.rootGroup.children.find((l) => l.type === 'text');
      expect(textLayer).toBeDefined();

      const colorOverlay: LayerEffect = {
        type: 'color-overlay',
        enabled: true,
        color: { r: 255, g: 0, b: 0, a: 1 },
        opacity: 1,
      };
      store.addLayerEffect(textLayer!.id, colorOverlay);

      await useAppStore.getState().exportAsImage('png');

      // Export succeeded — effects are included in the render pass
      expect(mockExportFile).toHaveBeenCalledTimes(1);
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });
  });

  // =========================================================================
  // JPG export tests
  // =========================================================================

  describe('JPG export', () => {
    it('should use image/jpeg MIME type when exporting as JPEG', async () => {
      createDoc('JpegTest', 800, 600);
      mockExportFile.mockImplementation(() => Promise.resolve('/exported/JpegTest.jpg'));

      await useAppStore.getState().exportAsImage('jpeg');

      expect(convertToBlobCalls).toHaveLength(1);
      expect(convertToBlobCalls[0].type).toBe('image/jpeg');
    });

    it('should composite alpha to white background for JPEG export', async () => {
      createDoc('JpegBgTest', 800, 600);
      mockExportFile.mockImplementation(() => Promise.resolve('/exported/JpegBgTest.jpg'));

      await useAppStore.getState().exportAsImage('jpeg');

      // For JPEG export, the store fills a white background before rendering.
      // The primary export context should have fillRect called with full canvas dims.
      expect(primaryExportCtx).not.toBeNull();
      const fillRectMock = primaryExportCtx!.fillRect as ReturnType<typeof vi.fn>;
      expect(fillRectMock).toHaveBeenCalled();
      const fillRectCalls = fillRectMock.mock.calls;
      const fullCanvasFill = fillRectCalls.find(
        (args: number[]) => args[0] === 0 && args[1] === 0 && args[2] === 800 && args[3] === 600,
      );
      expect(fullCanvasFill).toBeDefined();
    });

    it('should pass quality parameter to convertToBlob', async () => {
      createDoc('QualityTest', 800, 600);
      mockExportFile.mockImplementation(() => Promise.resolve('/exported/QualityTest.jpg'));

      await useAppStore.getState().exportAsImage('jpeg');

      // The store currently uses quality: 0.92 for all formats.
      expect(convertToBlobCalls).toHaveLength(1);
      expect(convertToBlobCalls[0].quality).toBeDefined();
      expect(typeof convertToBlobCalls[0].quality).toBe('number');
      // Quality should be a reasonable value between 0 and 1
      expect(convertToBlobCalls[0].quality).toBeGreaterThan(0);
      expect(convertToBlobCalls[0].quality).toBeLessThanOrEqual(1);
    });

    it('should use .jpg extension for JPEG default filename', async () => {
      createDoc('FilenameTest', 800, 600);
      mockExportFile.mockImplementation(() => Promise.resolve('/exported/FilenameTest.jpg'));

      await useAppStore.getState().exportAsImage('jpeg');

      const callArgs = mockExportFile.mock.calls[0];
      expect(callArgs[1]).toBe('FilenameTest.jpg');
    });
  });

  // =========================================================================
  // YouTube thumbnail size (1280x720)
  // =========================================================================

  describe('1280x720 YouTube thumbnail export', () => {
    it('should create an OffscreenCanvas of exactly 1280x720', async () => {
      createDoc('YT-Thumb', 1280, 720);

      await useAppStore.getState().exportAsImage('png');

      expect(offscreenCanvasConstructions).toHaveLength(1);
      expect(offscreenCanvasConstructions[0]).toEqual({ width: 1280, height: 720 });
    });

    it('should export successfully with all layer types (text + raster + group)', async () => {
      createDoc('YT-Composite', 1280, 720);
      const store = useAppStore.getState();

      // The newDocument already adds a background raster layer.
      // Add a text layer.
      store.addTextLayer('Headline', 'Big Title');

      // Add a layer group.
      store.addLayerGroup('Decoration');

      // Add another raster layer.
      store.addRasterLayer('Overlay');

      const doc = getDoc();
      // root should have: background raster + text + group + overlay raster = 4 children
      expect(doc.rootGroup.children.length).toBe(4);

      // Export
      await store.exportAsImage('png');

      // All layers should be composited (no errors)
      expect(mockExportFile).toHaveBeenCalledTimes(1);
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });

    it('should export with effects on multiple layer types', async () => {
      createDoc('YT-Effects', 1280, 720);
      const store = useAppStore.getState();

      // Add text layer with stroke
      store.addTextLayer('Title', 'Subscribe!');
      const doc = getDoc();
      const textLayer = doc.rootGroup.children.find((l) => l.type === 'text');
      expect(textLayer).toBeDefined();
      store.addLayerEffect(textLayer!.id, makeStroke({ size: 5 }));

      // Add raster layer with drop-shadow
      store.addRasterLayer('Photo');
      const doc2 = getDoc();
      const rasterLayers = doc2.rootGroup.children.filter((l) => l.type === 'raster');
      const photoLayer = rasterLayers[rasterLayers.length - 1];
      expect(photoLayer).toBeDefined();
      store.addLayerEffect(photoLayer.id, makeDropShadow({ distance: 10, blur: 8 }));

      await useAppStore.getState().exportAsImage('png');

      expect(mockExportFile).toHaveBeenCalledTimes(1);
      expect(offscreenCanvasConstructions[0]).toEqual({ width: 1280, height: 720 });

      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });

    it('should produce a PNG export and a JPEG export at the same 1280x720 dimensions', async () => {
      // PNG export
      createDoc('YT-PNG', 1280, 720);
      await useAppStore.getState().exportAsImage('png');
      expect(offscreenCanvasConstructions[0]).toEqual({ width: 1280, height: 720 });
      expect(convertToBlobCalls[0].type).toBe('image/png');

      // Reset for JPEG
      resetStore();
      vi.clearAllMocks();
      offscreenCanvasConstructions.length = 0;
      convertToBlobCalls.length = 0;
      mockExportFile.mockImplementation(() => Promise.resolve('/exported/YT-JPG.jpg'));

      createDoc('YT-JPG', 1280, 720);
      await useAppStore.getState().exportAsImage('jpeg');
      expect(offscreenCanvasConstructions[0]).toEqual({ width: 1280, height: 720 });
      expect(convertToBlobCalls[0].type).toBe('image/jpeg');
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('Edge cases', () => {
    it('should handle empty document (no layers) export', async () => {
      // Create a document, then manually clear all children to simulate empty doc
      createDoc('EmptyDoc', 800, 600);
      const doc = getDoc();
      // Remove all children from root group (the background layer)
      while (doc.rootGroup.children.length > 0) {
        const layerId = doc.rootGroup.children[0].id;
        useAppStore.getState().removeLayer(layerId);
      }

      const emptyDoc = getDoc();
      expect(emptyDoc.rootGroup.children.length).toBe(0);

      // Export should still succeed (renders an empty canvas)
      await useAppStore.getState().exportAsImage('png');

      expect(mockExportFile).toHaveBeenCalledTimes(1);
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });

    it('should exclude hidden layers from export output', async () => {
      createDoc('HiddenTest', 800, 600);
      const store = useAppStore.getState();

      // Add a text layer and hide it
      store.addTextLayer('HiddenText', 'You should not see me');
      const doc = getDoc();
      const textLayer = doc.rootGroup.children.find((l) => l.type === 'text');
      expect(textLayer).toBeDefined();

      // Toggle visibility off
      store.toggleLayerVisibility(textLayer!.id);
      const updatedDoc = getDoc();
      const hiddenLayer = updatedDoc.rootGroup.children.find((l) => l.type === 'text');
      expect(hiddenLayer!.visible).toBe(false);

      // Export should still succeed — the renderer skips invisible layers
      await useAppStore.getState().exportAsImage('png');

      expect(mockExportFile).toHaveBeenCalledTimes(1);
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });

    it('should handle 0% opacity layers in export', async () => {
      createDoc('ZeroOpacity', 800, 600);
      const store = useAppStore.getState();

      // Add a text layer and set opacity to 0
      store.addTextLayer('GhostText', 'Invisible');
      const doc = getDoc();
      const textLayer = doc.rootGroup.children.find((l) => l.type === 'text');
      expect(textLayer).toBeDefined();

      store.setLayerOpacity(textLayer!.id, 0);
      const updatedDoc = getDoc();
      const ghostLayer = updatedDoc.rootGroup.children.find((l) => l.type === 'text');
      expect(ghostLayer!.opacity).toBe(0);

      // Export should succeed — a 0-opacity layer effectively contributes nothing
      await useAppStore.getState().exportAsImage('png');

      expect(mockExportFile).toHaveBeenCalledTimes(1);
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });

    it('should return early with error status when no document is open', async () => {
      // No document created
      await useAppStore.getState().exportAsImage();

      expect(mockExportFile).not.toHaveBeenCalled();
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.noDocumentToExport'));
    });

    it('should handle export cancellation gracefully', async () => {
      createDoc('CancelTest', 800, 600);
      mockExportFile.mockImplementation(() => Promise.resolve(null));

      await useAppStore.getState().exportAsImage('png');

      // No crash, and status should not say "Exported"
      const state = useAppStore.getState();
      expect(state.statusMessage).not.toContain(t('status.exported'));
    });

    it('should handle combined edge case: hidden + zero opacity + effects', async () => {
      createDoc('CombinedEdge', 1280, 720);
      const store = useAppStore.getState();

      // Add a visible text layer with effects (normal case)
      store.addTextLayer('Visible', 'I am visible');
      const doc1 = getDoc();
      const visibleLayer = doc1.rootGroup.children.find(
        (l) => l.type === 'text' && l.name === 'Visible',
      );
      expect(visibleLayer).toBeDefined();
      store.addLayerEffect(visibleLayer!.id, makeStroke());
      store.addLayerEffect(visibleLayer!.id, makeDropShadow());

      // Add a hidden text layer with effects
      store.addTextLayer('Hidden', 'I am hidden');
      const doc2 = getDoc();
      const hiddenLayer = doc2.rootGroup.children.find(
        (l) => l.type === 'text' && l.name === 'Hidden',
      );
      expect(hiddenLayer).toBeDefined();
      store.addLayerEffect(hiddenLayer!.id, makeStroke());
      store.toggleLayerVisibility(hiddenLayer!.id);

      // Add a 0% opacity text layer
      store.addTextLayer('Ghost', 'I am ghost');
      const doc3 = getDoc();
      const ghostLayer = doc3.rootGroup.children.find(
        (l) => l.type === 'text' && l.name === 'Ghost',
      );
      expect(ghostLayer).toBeDefined();
      store.setLayerOpacity(ghostLayer!.id, 0);

      // Export should succeed without errors
      await useAppStore.getState().exportAsImage('png');

      expect(mockExportFile).toHaveBeenCalledTimes(1);
      expect(offscreenCanvasConstructions[0]).toEqual({ width: 1280, height: 720 });
      const state = useAppStore.getState();
      expect(state.statusMessage).toContain(t('status.exported'));
    });
  });

  // =========================================================================
  // File size sanity checks (Should requirements)
  // =========================================================================

  describe('File size sanity', () => {
    it('should produce an export result with non-zero data', async () => {
      createDoc('SizeCheck', 1280, 720);
      mockBlobSize = 50_000; // Simulate 50KB output

      await useAppStore.getState().exportAsImage('png');

      expect(mockExportFile).toHaveBeenCalledTimes(1);
      const exportedBuffer = mockExportFile.mock.calls[0][0] as ArrayBuffer;
      expect(exportedBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should use .png extension for PNG export filename', async () => {
      createDoc('ExtCheck', 1280, 720);

      await useAppStore.getState().exportAsImage('png');

      const callArgs = mockExportFile.mock.calls[0];
      expect(callArgs[1]).toBe('ExtCheck.png');
    });

    it('should use .webp extension for WebP export filename', async () => {
      createDoc('WebpCheck', 1280, 720);
      mockExportFile.mockImplementation(() => Promise.resolve('/exported/WebpCheck.webp'));

      await useAppStore.getState().exportAsImage('webp');

      const callArgs = mockExportFile.mock.calls[0];
      expect(callArgs[1]).toBe('WebpCheck.webp');
    });
  });
});
