/**
 * @module snapshot.test
 * Tests for canvas state snapshot capture.
 *
 * @see Phase 2-2: Canvas State Snapshot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the store before importing snapshot
vi.mock('../store', () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}));

// Mock the render package
vi.mock('@photoshop-app/render', () => {
  const mockRender = vi.fn();
  const mockRenderLayerThumbnail = vi.fn().mockReturnValue(null);
  const mockDispose = vi.fn();

  return {
    Canvas2DRenderer: vi.fn().mockImplementation(() => ({
      render: mockRender,
      renderLayerThumbnail: mockRenderLayerThumbnail,
      dispose: mockDispose,
    })),
    ViewportImpl: vi.fn().mockImplementation(() => ({
      setZoom: vi.fn(),
    })),
  };
});

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number;
  height: number;
  private ctx = {
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(16),
      width: 4,
      height: 4,
    }),
  };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(): unknown {
    return this.ctx;
  }

  async convertToBlob(): Promise<Blob> {
    // Return a tiny valid PNG-like blob
    return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
  }
}

// Set up global OffscreenCanvas before imports
(globalThis as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;

import { captureCanvasSnapshot } from './snapshot';
import { useAppStore } from '../store';

const mockGetState = vi.mocked(useAppStore.getState);

type MockDocumentOverrides = Partial<{
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  selectedLayerId: string | null;
  children: unknown[];
}>;

type MockDocument = {
  id: string;
  name: string;
  canvas: {
    size: {
      width: number;
      height: number;
    };
    dpi: number;
  };
  selectedLayerId: string | null;
  rootGroup: {
    id: string;
    name: string;
    type: 'group';
    visible: boolean;
    opacity: number;
    blendMode: 'normal';
    position: { x: number; y: number };
    effects: unknown[];
    children: unknown[];
  };
};

function createMockDocument(overrides?: MockDocumentOverrides): MockDocument {
  return {
    id: overrides?.id ?? 'doc-1',
    name: overrides?.name ?? 'Test Document',
    canvas: {
      size: {
        width: overrides?.width ?? 800,
        height: overrides?.height ?? 600,
      },
      dpi: overrides?.dpi ?? 72,
    },
    selectedLayerId: overrides?.selectedLayerId ?? null,
    rootGroup: {
      id: 'root',
      name: 'Root',
      type: 'group',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      position: { x: 0, y: 0 },
      effects: [],
      children: overrides?.children ?? [],
    },
  };
}

describe('captureCanvasSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no document is open', async () => {
    mockGetState.mockReturnValue({ document: null } as ReturnType<typeof useAppStore.getState>);

    const result = await captureCanvasSnapshot();
    expect(result).toBeNull();
  });

  it('returns valid snapshot structure with document open', async () => {
    const doc = createMockDocument();
    mockGetState.mockReturnValue({ document: doc } as unknown as ReturnType<typeof useAppStore.getState>);

    const result = await captureCanvasSnapshot(false);
    expect(result).not.toBeNull();
    expect(result!.document.id).toBe('doc-1');
    expect(result!.document.name).toBe('Test Document');
    expect(result!.document.width).toBe(800);
    expect(result!.document.height).toBe(600);
    expect(result!.document.dpi).toBe(72);
    expect(result!.layers).toEqual([]);
    expect(result!.thumbnail).toContain('data:image/png;base64,');
    expect(result!.layerThumbnails).toEqual({});
  });

  it('includes layer data in the snapshot', async () => {
    const doc = createMockDocument({
      children: [
        {
          id: 'layer-1',
          name: 'Text Layer',
          type: 'text',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          position: { x: 0, y: 0 },
          effects: [],
          text: 'Hello',
          fontFamily: 'Arial',
          fontSize: 24,
          color: { r: 0, g: 0, b: 0, a: 255 },
          bold: false,
          italic: false,
          alignment: 'left',
          lineHeight: 1.2,
          letterSpacing: 0,
          writingMode: 'horizontal-tb',
        },
      ],
    });
    mockGetState.mockReturnValue({ document: doc } as unknown as ReturnType<typeof useAppStore.getState>);

    const result = await captureCanvasSnapshot(false);
    expect(result).not.toBeNull();
    expect(result!.layers).toHaveLength(1);
    const layer = result!.layers[0] as Record<string, unknown>;
    expect(layer.id).toBe('layer-1');
    expect(layer.name).toBe('Text Layer');
    expect(layer.type).toBe('text');
  });

  it('attempts per-layer thumbnails when includeThumbnails is true', async () => {
    const doc = createMockDocument({
      children: [
        {
          id: 'raster-1',
          name: 'Raster Layer',
          type: 'raster',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          position: { x: 0, y: 0 },
          effects: [],
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          imageData: null,
        },
      ],
    });
    mockGetState.mockReturnValue({ document: doc } as unknown as ReturnType<typeof useAppStore.getState>);

    // renderLayerThumbnail returns null (mocked), so layerThumbnails should be empty
    const result = await captureCanvasSnapshot(true);
    expect(result).not.toBeNull();
    // layerThumbnails is empty because mock returns null
    expect(result!.layerThumbnails).toEqual({});
  });
});
