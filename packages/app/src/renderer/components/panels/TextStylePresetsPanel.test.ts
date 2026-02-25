/**
 * @module components/panels/TextStylePresetsPanel.test
 * Unit tests for the text style presets panel and custom preset management.
 *
 * Tests cover:
 * - Built-in presets displayed correctly
 * - Preset application changes layer properties
 * - Custom preset save/delete with localStorage persistence
 * - No text layer selected behavior (creates new layer)
 * - Category filtering
 *
 * @see PRESET-001: Text style preset UI
 * @see text-style-presets.ts for preset definitions and CRUD functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LayerEffect, TextLayer } from '@photoshop-app/types';
import {
  BUILT_IN_TEXT_STYLES,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from './text-style-presets';
import type { TextStylePreset } from './text-style-presets';

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

// Import app store after mocks
import { useAppStore } from '../../store';

/** Clear localStorage mock state. */
function clearLocalStorage(): void {
  for (const key of Object.keys(localStorageMock)) {
    delete localStorageMock[key];
  }
  vi.clearAllMocks();
}

/** Set up app store with a test document containing a text layer. */
function setupWithTextLayer(): { layerId: string } {
  useAppStore.getState().newDocument('Test', 800, 600);
  useAppStore.getState().addTextLayer('Test Text', 'Hello');
  const layerId = useAppStore.getState().selectedLayerId!;
  return { layerId };
}

/** Set up app store with a test document but no text layer selected. */
function setupWithRasterLayer(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
  useAppStore.getState().addRasterLayer('Raster Layer');
}

describe('BUILT_IN_TEXT_STYLES', () => {
  it('should contain 8 built-in presets', () => {
    expect(BUILT_IN_TEXT_STYLES).toHaveLength(8);
  });

  it('should have unique IDs for all built-in presets', () => {
    const ids = BUILT_IN_TEXT_STYLES.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should mark all built-in presets as builtIn: true', () => {
    for (const preset of BUILT_IN_TEXT_STYLES) {
      expect(preset.builtIn).toBe(true);
    }
  });

  it('should have valid categories for all built-in presets', () => {
    const validCategories = new Set(['youtube', 'impact', 'elegant']);
    for (const preset of BUILT_IN_TEXT_STYLES) {
      expect(validCategories.has(preset.category)).toBe(true);
    }
  });

  it('should have youtube category presets', () => {
    const youtubePresets = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'youtube');
    expect(youtubePresets.length).toBeGreaterThan(0);
  });

  it('should have impact category presets', () => {
    const impactPresets = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'impact');
    expect(impactPresets.length).toBeGreaterThan(0);
  });

  it('should have elegant category presets', () => {
    const elegantPresets = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'elegant');
    expect(elegantPresets.length).toBeGreaterThan(0);
  });

  it('should have source: null for all built-in presets', () => {
    for (const preset of BUILT_IN_TEXT_STYLES) {
      expect(preset.source).toBeNull();
    }
  });
});

describe('Custom preset CRUD (localStorage)', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  describe('loadCustomPresets', () => {
    it('should return empty array when no custom presets exist', () => {
      const presets = loadCustomPresets();
      expect(presets).toEqual([]);
    });

    it('should return stored custom presets', () => {
      const preset: TextStylePreset = {
        id: 'custom-1',
        name: 'My Style',
        category: 'custom',
        fontFamily: 'Arial',
        fontSize: 24,
        bold: false,
        italic: false,
        color: { r: 255, g: 0, b: 0, a: 1 },
        effects: [],
        source: null,
        builtIn: false,
      };
      localStorageMock['photoshop-app:customTextStylePresets'] = JSON.stringify([preset]);

      const result = loadCustomPresets();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Style');
    });

    it('should return empty array for corrupted JSON', () => {
      localStorageMock['photoshop-app:customTextStylePresets'] = 'not-json';
      const result = loadCustomPresets();
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      localStorageMock['photoshop-app:customTextStylePresets'] = '{"key": "value"}';
      const result = loadCustomPresets();
      expect(result).toEqual([]);
    });
  });

  describe('saveCustomPreset', () => {
    it('should save a new custom preset and return it with generated id', () => {
      const saved = saveCustomPreset({
        name: 'New Style',
        fontFamily: 'Georgia',
        fontSize: 32,
        bold: true,
        italic: false,
        color: { r: 0, g: 0, b: 255, a: 1 },
        effects: [],
        source: null,
      });

      expect(saved.id).toMatch(/^custom-/);
      expect(saved.name).toBe('New Style');
      expect(saved.category).toBe('custom');
      expect(saved.builtIn).toBe(false);
    });

    it('should persist to localStorage', () => {
      saveCustomPreset({
        name: 'Persisted Style',
        fontFamily: 'Helvetica',
        fontSize: 48,
        bold: false,
        italic: true,
        color: { r: 100, g: 200, b: 50, a: 1 },
        effects: [],
        source: null,
      });

      expect(localStorage.setItem).toHaveBeenCalled();
      const stored = JSON.parse(localStorageMock['photoshop-app:customTextStylePresets']);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Persisted Style');
    });

    it('should append to existing custom presets', () => {
      saveCustomPreset({
        name: 'First',
        fontFamily: 'Arial',
        fontSize: 24,
        bold: false,
        italic: false,
        color: { r: 0, g: 0, b: 0, a: 1 },
        effects: [],
        source: null,
      });
      saveCustomPreset({
        name: 'Second',
        fontFamily: 'Georgia',
        fontSize: 36,
        bold: true,
        italic: false,
        color: { r: 255, g: 255, b: 255, a: 1 },
        effects: [],
        source: null,
      });

      const all = loadCustomPresets();
      expect(all).toHaveLength(2);
      expect(all[0].name).toBe('First');
      expect(all[1].name).toBe('Second');
    });

    it('should save effects correctly', () => {
      const effects: LayerEffect[] = [
        {
          type: 'stroke',
          enabled: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          size: 3,
          position: 'outside',
          opacity: 1,
        },
      ];

      saveCustomPreset({
        name: 'With Effects',
        fontFamily: 'Impact',
        fontSize: 72,
        bold: true,
        italic: false,
        color: { r: 255, g: 255, b: 255, a: 1 },
        effects,
        source: null,
      });

      const loaded = loadCustomPresets();
      expect(loaded[0].effects).toHaveLength(1);
      expect(loaded[0].effects[0].type).toBe('stroke');
    });
  });

  describe('deleteCustomPreset', () => {
    it('should delete a custom preset by ID', () => {
      const saved = saveCustomPreset({
        name: 'To Delete',
        fontFamily: 'Arial',
        fontSize: 24,
        bold: false,
        italic: false,
        color: { r: 0, g: 0, b: 0, a: 1 },
        effects: [],
        source: null,
      });

      const result = deleteCustomPreset(saved.id);
      expect(result).toBe(true);

      const remaining = loadCustomPresets();
      expect(remaining).toHaveLength(0);
    });

    it('should return false when preset ID is not found', () => {
      const result = deleteCustomPreset('non-existent-id');
      expect(result).toBe(false);
    });

    it('should only delete the specified preset and keep others', () => {
      const first = saveCustomPreset({
        name: 'Keep',
        fontFamily: 'Arial',
        fontSize: 24,
        bold: false,
        italic: false,
        color: { r: 0, g: 0, b: 0, a: 1 },
        effects: [],
        source: null,
      });
      const second = saveCustomPreset({
        name: 'Delete Me',
        fontFamily: 'Georgia',
        fontSize: 36,
        bold: true,
        italic: false,
        color: { r: 255, g: 0, b: 0, a: 1 },
        effects: [],
        source: null,
      });

      deleteCustomPreset(second.id);

      const remaining = loadCustomPresets();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(first.id);
      expect(remaining[0].name).toBe('Keep');
    });
  });
});

describe('Preset application to text layers', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  it('should apply preset font properties to a text layer', () => {
    const { layerId } = setupWithTextLayer();
    const preset = BUILT_IN_TEXT_STYLES[0]; // YouTuber定番

    // Apply each property individually as the panel would
    const store = useAppStore.getState();
    store.setTextProperty(layerId, 'fontFamily', preset.fontFamily);
    store.setTextProperty(layerId, 'fontSize', preset.fontSize);
    store.setTextProperty(layerId, 'bold', preset.bold);
    store.setTextProperty(layerId, 'italic', preset.italic);
    store.setTextProperty(layerId, 'color', { ...preset.color });

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children.find((c) => c.id === layerId) as TextLayer;
    expect(layer.fontFamily).toBe('Impact');
    expect(layer.fontSize).toBe(72);
    expect(layer.bold).toBe(true);
    expect(layer.italic).toBe(false);
    expect(layer.color.r).toBe(255);
    expect(layer.color.g).toBe(255);
    expect(layer.color.b).toBe(255);
  });

  it('should apply preset effects to a text layer', () => {
    const { layerId } = setupWithTextLayer();
    const preset = BUILT_IN_TEXT_STYLES[0]; // YouTuber定番 — has stroke + drop-shadow

    const store = useAppStore.getState();
    store.setLayerEffects(layerId, [...preset.effects]);

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children.find((c) => c.id === layerId);
    expect(layer!.effects).toHaveLength(2);
    expect(layer!.effects[0].type).toBe('stroke');
    expect(layer!.effects[1].type).toBe('drop-shadow');
  });

  it('should apply elegant preset correctly', () => {
    const { layerId } = setupWithTextLayer();
    const preset = BUILT_IN_TEXT_STYLES[2]; // エレガント

    const store = useAppStore.getState();
    store.setTextProperty(layerId, 'fontFamily', preset.fontFamily);
    store.setTextProperty(layerId, 'italic', preset.italic);
    store.setLayerEffects(layerId, [...preset.effects]);

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children.find((c) => c.id === layerId) as TextLayer;
    expect(layer.fontFamily).toBe('Georgia');
    expect(layer.italic).toBe(true);
    expect(layer.effects).toHaveLength(1);
    expect(layer.effects[0].type).toBe('drop-shadow');
  });

  it('should apply preset with no effects (simple black)', () => {
    const { layerId } = setupWithTextLayer();
    const preset = BUILT_IN_TEXT_STYLES[5]; // シンプル黒

    const store = useAppStore.getState();
    store.setTextProperty(layerId, 'fontFamily', preset.fontFamily);
    store.setTextProperty(layerId, 'color', { ...preset.color });
    store.setLayerEffects(layerId, [...preset.effects]);

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children.find((c) => c.id === layerId) as TextLayer;
    expect(layer.fontFamily).toBe('Arial');
    expect(layer.color.r).toBe(0);
    expect(layer.color.g).toBe(0);
    expect(layer.color.b).toBe(0);
    expect(layer.effects).toHaveLength(0);
  });
});

describe('No text layer selected behavior', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  it('should create a new text layer when no text layer is selected', () => {
    setupWithRasterLayer();
    const doc = useAppStore.getState().document!;
    const initialChildCount = doc.rootGroup.children.length;

    // Simulate what the panel does: addTextLayer, then apply properties
    const store = useAppStore.getState();
    store.addTextLayer('YouTuber定番');

    const updatedDoc = useAppStore.getState().document!;
    expect(updatedDoc.rootGroup.children.length).toBe(initialChildCount + 1);

    const newLayerId = useAppStore.getState().selectedLayerId!;
    const newLayer = updatedDoc.rootGroup.children.find((c) => c.id === newLayerId);
    expect(newLayer).toBeDefined();
    expect(newLayer!.type).toBe('text');
  });

  it('should apply preset style to the newly created text layer', () => {
    setupWithRasterLayer();
    const preset = BUILT_IN_TEXT_STYLES[1]; // インパクト

    // Create and apply like the panel would
    const store = useAppStore.getState();
    store.addTextLayer(preset.name);

    const newLayerId = useAppStore.getState().selectedLayerId!;
    store.setTextProperty(newLayerId, 'fontFamily', preset.fontFamily);
    store.setTextProperty(newLayerId, 'fontSize', preset.fontSize);
    store.setTextProperty(newLayerId, 'bold', preset.bold);
    store.setTextProperty(newLayerId, 'color', { ...preset.color });
    store.setLayerEffects(newLayerId, [...preset.effects]);

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children.find((c) => c.id === newLayerId) as TextLayer;
    expect(layer.fontFamily).toBe('Arial Black');
    expect(layer.fontSize).toBe(80);
    expect(layer.bold).toBe(true);
    expect(layer.color.r).toBe(255);
    expect(layer.color.g).toBe(0);
    expect(layer.effects).toHaveLength(2);
  });

  it('should select the newly created text layer', () => {
    setupWithRasterLayer();

    const store = useAppStore.getState();
    store.addTextLayer('Test');

    const selectedId = useAppStore.getState().selectedLayerId;
    expect(selectedId).not.toBeNull();

    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children.find((c) => c.id === selectedId);
    expect(layer).toBeDefined();
    expect(layer!.type).toBe('text');
  });
});

describe('Category filtering', () => {
  it('should filter built-in presets by youtube category', () => {
    const youtubePresets = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'youtube');
    expect(youtubePresets.length).toBeGreaterThanOrEqual(3);
    for (const p of youtubePresets) {
      expect(p.category).toBe('youtube');
    }
  });

  it('should filter built-in presets by impact category', () => {
    const impactPresets = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'impact');
    expect(impactPresets.length).toBeGreaterThanOrEqual(3);
    for (const p of impactPresets) {
      expect(p.category).toBe('impact');
    }
  });

  it('should filter built-in presets by elegant category', () => {
    const elegantPresets = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'elegant');
    expect(elegantPresets.length).toBeGreaterThanOrEqual(1);
    for (const p of elegantPresets) {
      expect(p.category).toBe('elegant');
    }
  });

  it('should show all presets when category is all', () => {
    const allPresets = BUILT_IN_TEXT_STYLES;
    expect(allPresets.length).toBe(8);
  });

  it('should include custom presets in the custom category', () => {
    clearLocalStorage();
    saveCustomPreset({
      name: 'Custom Test',
      fontFamily: 'Arial',
      fontSize: 24,
      bold: false,
      italic: false,
      color: { r: 0, g: 0, b: 0, a: 1 },
      effects: [],
      source: null,
    });

    const custom = loadCustomPresets();
    const customCategory = custom.filter((p) => p.category === 'custom');
    expect(customCategory).toHaveLength(1);
    expect(customCategory[0].name).toBe('Custom Test');
  });

  it('should return empty for imported category when no imported presets', () => {
    const imported = BUILT_IN_TEXT_STYLES.filter((p) => p.category === 'imported');
    expect(imported).toHaveLength(0);
  });
});
