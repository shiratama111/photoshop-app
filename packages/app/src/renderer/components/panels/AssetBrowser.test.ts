/**
 * @module components/panels/AssetBrowser.test
 * Unit tests for the asset store (brush/style preset management).
 *
 * Tests cover:
 * - ABR import and brush preset management
 * - ASL import and style preset management
 * - Brush selection
 * - Style application to layers
 * - Preset removal and clearing
 *
 * @see APP-007: Asset browser panel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AbrParseResult, AslParseResult, BrushPreset, LayerStylePreset } from '@photoshop-app/types';

// Mock adapter-abr
vi.mock('@photoshop-app/adapter-abr', () => ({
  parseAbr: vi.fn(),
  BinaryReader: vi.fn(),
}));

// Mock adapter-asl
vi.mock('@photoshop-app/adapter-asl', () => ({
  parseAsl: vi.fn(),
  mapEffect: vi.fn(),
  mapEffects: vi.fn(),
}));

// We need to import after mocks are set up
import { parseAbr } from '@photoshop-app/adapter-abr';
import { parseAsl } from '@photoshop-app/adapter-asl';

// Mock localStorage
const localStorageMock: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(localStorageMock)) {
      delete localStorageMock[key];
    }
  }),
});

// Import after mocks
import { useAssetStore } from './asset-store';
import { useAppStore } from '../../store';

/** Create a test brush preset. */
function createTestBrush(id: string, name: string): BrushPreset {
  return {
    id,
    name,
    tipImage: null,
    diameter: 20,
    hardness: 0.5,
    spacing: 0.25,
    angle: 0,
    roundness: 1,
    source: 'test.abr',
  };
}

/** Create a test style preset. */
function createTestStyle(id: string, name: string): LayerStylePreset {
  return {
    id,
    name,
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 1,
      },
    ],
    source: 'test.asl',
  };
}

/** Create an ABR parse result mock. */
function createAbrResult(brushes: BrushPreset[]): AbrParseResult {
  return { version: 6, brushes, warnings: [] };
}

/** Create an ASL parse result mock. */
function createAslResult(styles: LayerStylePreset[]): AslParseResult {
  return { styles, skippedEffects: [], warnings: [] };
}

/** Reset the asset store state. */
function resetAssetStore(): void {
  useAssetStore.setState({
    brushPresets: [],
    brushThumbnails: {},
    stylePresets: [],
    selectedBrushId: null,
  });
}

/** Reset the app store with a test document. */
function setupAppStore(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
  useAppStore.getState().addRasterLayer('Test Layer');
}

describe('useAssetStore', () => {
  beforeEach(() => {
    resetAssetStore();
    vi.clearAllMocks();
    for (const key of Object.keys(localStorageMock)) {
      delete localStorageMock[key];
    }
  });

  describe('initial state', () => {
    it('should start with empty brush presets', () => {
      expect(useAssetStore.getState().brushPresets).toEqual([]);
    });

    it('should start with empty style presets', () => {
      expect(useAssetStore.getState().stylePresets).toEqual([]);
    });

    it('should start with no selected brush', () => {
      expect(useAssetStore.getState().selectedBrushId).toBeNull();
    });

    it('should start with empty thumbnails', () => {
      expect(useAssetStore.getState().brushThumbnails).toEqual({});
    });
  });

  describe('importAbr', () => {
    it('should add parsed brushes to the store', () => {
      const brush1 = createTestBrush('b1', 'Brush 1');
      const brush2 = createTestBrush('b2', 'Brush 2');
      vi.mocked(parseAbr).mockReturnValue(createAbrResult([brush1, brush2]));

      useAssetStore.getState().importAbr(new ArrayBuffer(10), 'test.abr');

      expect(useAssetStore.getState().brushPresets).toHaveLength(2);
      expect(useAssetStore.getState().brushPresets[0].name).toBe('Brush 1');
      expect(useAssetStore.getState().brushPresets[1].name).toBe('Brush 2');
    });

    it('should append to existing brushes', () => {
      const existing = createTestBrush('e1', 'Existing');
      useAssetStore.setState({ brushPresets: [existing] });

      const newBrush = createTestBrush('n1', 'New');
      vi.mocked(parseAbr).mockReturnValue(createAbrResult([newBrush]));

      useAssetStore.getState().importAbr(new ArrayBuffer(10), 'new.abr');

      expect(useAssetStore.getState().brushPresets).toHaveLength(2);
      expect(useAssetStore.getState().brushPresets[0].name).toBe('Existing');
      expect(useAssetStore.getState().brushPresets[1].name).toBe('New');
    });

    it('should persist brushes to localStorage', () => {
      const brush = createTestBrush('b1', 'Brush 1');
      vi.mocked(parseAbr).mockReturnValue(createAbrResult([brush]));

      useAssetStore.getState().importAbr(new ArrayBuffer(10), 'test.abr');

      expect(localStorage.setItem).toHaveBeenCalled();
      const stored = JSON.parse(localStorageMock['photoshop-app:brushPresets']);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Brush 1');
    });

    it('should do nothing when no brushes are parsed', () => {
      vi.mocked(parseAbr).mockReturnValue(createAbrResult([]));

      useAssetStore.getState().importAbr(new ArrayBuffer(10), 'empty.abr');

      expect(useAssetStore.getState().brushPresets).toHaveLength(0);
    });

    it('should pass fileName to parseAbr', () => {
      vi.mocked(parseAbr).mockReturnValue(createAbrResult([]));

      useAssetStore.getState().importAbr(new ArrayBuffer(10), 'my-brushes.abr');

      expect(parseAbr).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'my-brushes.abr');
    });
  });

  describe('importAsl', () => {
    it('should add parsed styles to the store', () => {
      const style = createTestStyle('s1', 'Style 1');
      vi.mocked(parseAsl).mockReturnValue(createAslResult([style]));

      useAssetStore.getState().importAsl(new ArrayBuffer(10), 'test.asl');

      expect(useAssetStore.getState().stylePresets).toHaveLength(1);
      expect(useAssetStore.getState().stylePresets[0].name).toBe('Style 1');
    });

    it('should append to existing styles', () => {
      const existing = createTestStyle('e1', 'Existing');
      useAssetStore.setState({ stylePresets: [existing] });

      const newStyle = createTestStyle('n1', 'New');
      vi.mocked(parseAsl).mockReturnValue(createAslResult([newStyle]));

      useAssetStore.getState().importAsl(new ArrayBuffer(10), 'new.asl');

      expect(useAssetStore.getState().stylePresets).toHaveLength(2);
    });

    it('should persist styles to localStorage', () => {
      const style = createTestStyle('s1', 'Style 1');
      vi.mocked(parseAsl).mockReturnValue(createAslResult([style]));

      useAssetStore.getState().importAsl(new ArrayBuffer(10), 'test.asl');

      const stored = JSON.parse(localStorageMock['photoshop-app:stylePresets']);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Style 1');
    });

    it('should do nothing when no styles are parsed', () => {
      vi.mocked(parseAsl).mockReturnValue(createAslResult([]));

      useAssetStore.getState().importAsl(new ArrayBuffer(10), 'empty.asl');

      expect(useAssetStore.getState().stylePresets).toHaveLength(0);
    });
  });

  describe('selectBrush', () => {
    it('should select a brush by ID', () => {
      useAssetStore.getState().selectBrush('b1');
      expect(useAssetStore.getState().selectedBrushId).toBe('b1');
    });

    it('should deselect when passing null', () => {
      useAssetStore.getState().selectBrush('b1');
      useAssetStore.getState().selectBrush(null);
      expect(useAssetStore.getState().selectedBrushId).toBeNull();
    });
  });

  describe('applyStyle', () => {
    it('should apply style effects to the selected layer', () => {
      setupAppStore();
      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;

      const style = createTestStyle('s1', 'Test Style');
      useAssetStore.setState({ stylePresets: [style] });

      useAssetStore.getState().applyStyle('s1');

      const layer = doc.rootGroup.children.find(c => c.id === layerId)!;
      expect(layer.effects).toHaveLength(1);
      expect(layer.effects[0].type).toBe('stroke');
    });

    it('should not apply if no layer is selected', () => {
      setupAppStore();
      useAppStore.getState().selectLayer(null);

      const style = createTestStyle('s1', 'Test Style');
      useAssetStore.setState({ stylePresets: [style] });

      useAssetStore.getState().applyStyle('s1');
      // Should not throw, just do nothing
    });

    it('should not apply if style ID is not found', () => {
      setupAppStore();
      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;

      useAssetStore.getState().applyStyle('non-existent');

      const layer = doc.rootGroup.children.find(c => c.id === layerId)!;
      expect(layer.effects).toHaveLength(0);
    });
  });

  describe('removeBrush', () => {
    it('should remove a brush by ID', () => {
      const b1 = createTestBrush('b1', 'Brush 1');
      const b2 = createTestBrush('b2', 'Brush 2');
      useAssetStore.setState({ brushPresets: [b1, b2] });

      useAssetStore.getState().removeBrush('b1');

      expect(useAssetStore.getState().brushPresets).toHaveLength(1);
      expect(useAssetStore.getState().brushPresets[0].id).toBe('b2');
    });

    it('should clear selection if the removed brush was selected', () => {
      const brush = createTestBrush('b1', 'Brush 1');
      useAssetStore.setState({ brushPresets: [brush], selectedBrushId: 'b1' });

      useAssetStore.getState().removeBrush('b1');

      expect(useAssetStore.getState().selectedBrushId).toBeNull();
    });

    it('should keep selection if a different brush was removed', () => {
      const b1 = createTestBrush('b1', 'Brush 1');
      const b2 = createTestBrush('b2', 'Brush 2');
      useAssetStore.setState({ brushPresets: [b1, b2], selectedBrushId: 'b2' });

      useAssetStore.getState().removeBrush('b1');

      expect(useAssetStore.getState().selectedBrushId).toBe('b2');
    });

    it('should remove the thumbnail for the brush', () => {
      const brush = createTestBrush('b1', 'Brush 1');
      useAssetStore.setState({
        brushPresets: [brush],
        brushThumbnails: { b1: 'data:image/png;base64,...' },
      });

      useAssetStore.getState().removeBrush('b1');

      expect(useAssetStore.getState().brushThumbnails).toEqual({});
    });
  });

  describe('removeStyle', () => {
    it('should remove a style by ID', () => {
      const s1 = createTestStyle('s1', 'Style 1');
      const s2 = createTestStyle('s2', 'Style 2');
      useAssetStore.setState({ stylePresets: [s1, s2] });

      useAssetStore.getState().removeStyle('s1');

      expect(useAssetStore.getState().stylePresets).toHaveLength(1);
      expect(useAssetStore.getState().stylePresets[0].id).toBe('s2');
    });
  });

  describe('clearBrushes', () => {
    it('should remove all brushes', () => {
      const b1 = createTestBrush('b1', 'Brush 1');
      const b2 = createTestBrush('b2', 'Brush 2');
      useAssetStore.setState({
        brushPresets: [b1, b2],
        brushThumbnails: { b1: 'url1', b2: 'url2' },
        selectedBrushId: 'b1',
      });

      useAssetStore.getState().clearBrushes();

      expect(useAssetStore.getState().brushPresets).toEqual([]);
      expect(useAssetStore.getState().brushThumbnails).toEqual({});
      expect(useAssetStore.getState().selectedBrushId).toBeNull();
    });
  });

  describe('clearStyles', () => {
    it('should remove all styles', () => {
      const s1 = createTestStyle('s1', 'Style 1');
      useAssetStore.setState({ stylePresets: [s1] });

      useAssetStore.getState().clearStyles();

      expect(useAssetStore.getState().stylePresets).toEqual([]);
    });
  });
});
