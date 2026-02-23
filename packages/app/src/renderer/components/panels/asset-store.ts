/**
 * @module components/panels/asset-store
 * Zustand store for brush and style preset management.
 *
 * Manages:
 * - Brush preset collection (ABR import, selection, removal)
 * - Style preset collection (ASL import, application to layers, removal)
 * - Thumbnail generation for brush tip display
 * - localStorage persistence for presets across app restarts
 *
 * @see APP-007: Asset browser panel
 * @see {@link @photoshop-app/adapter-abr!parseAbr}
 * @see {@link @photoshop-app/adapter-asl!parseAsl}
 */

import { create } from 'zustand';
import type { BrushPreset, LayerStylePreset, LayerEffect } from '@photoshop-app/types';
import { parseAbr } from '@photoshop-app/adapter-abr';
import { parseAsl } from '@photoshop-app/adapter-asl';
import { useAppStore } from '../../store';

/** localStorage key for persisted brush presets. */
const STORAGE_KEY_BRUSHES = 'photoshop-app:brushPresets';

/** localStorage key for persisted style presets. */
const STORAGE_KEY_STYLES = 'photoshop-app:stylePresets';

/** Default thumbnail size in pixels. */
const THUMBNAIL_SIZE = 48;

/** Serializable brush preset for localStorage (tipImage replaced with thumbnailUrl). */
interface PersistedBrush {
  readonly id: string;
  readonly name: string;
  readonly diameter: number;
  readonly hardness: number;
  readonly spacing: number;
  readonly angle: number;
  readonly roundness: number;
  readonly source: string | null;
  readonly thumbnailUrl: string | null;
}

/**
 * Generate a data URL thumbnail for a brush preset.
 * Uses tipImage if available, otherwise renders a synthetic radial gradient.
 * Returns empty string when running outside a browser (e.g. Node.js tests).
 */
export function generateBrushThumbnail(brush: BrushPreset): string {
  if (typeof document === 'undefined') return '';

  const size = THUMBNAIL_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(0, 0, size, size);

  if (brush.tipImage) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = brush.tipImage.width;
    tempCanvas.height = brush.tipImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(brush.tipImage, 0, 0);
      ctx.drawImage(tempCanvas, 2, 2, size - 4, size - 4);
    }
  } else {
    const center = size / 2;
    const radius = (size - 8) / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    const hardStop = Math.max(0.01, brush.hardness * 0.9);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(hardStop, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Convert a BrushPreset to its persisted format.
 * Strips the tipImage and stores a thumbnail URL instead.
 */
function serializeBrush(brush: BrushPreset, thumbnailUrl: string | null): PersistedBrush {
  return {
    id: brush.id,
    name: brush.name,
    diameter: brush.diameter,
    hardness: brush.hardness,
    spacing: brush.spacing,
    angle: brush.angle,
    roundness: brush.roundness,
    source: brush.source,
    thumbnailUrl,
  };
}

/**
 * Convert a persisted brush back to a BrushPreset.
 * tipImage is set to null (not persisted).
 */
function deserializeBrush(data: PersistedBrush): BrushPreset {
  return {
    id: data.id,
    name: data.name,
    tipImage: null,
    diameter: data.diameter,
    hardness: data.hardness,
    spacing: data.spacing,
    angle: data.angle,
    roundness: data.roundness,
    source: data.source,
  };
}

/** Load persisted brush presets from localStorage. */
function loadBrushes(): { brushes: BrushPreset[]; thumbnails: Record<string, string> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BRUSHES);
    if (!raw) return { brushes: [], thumbnails: {} };
    const parsed = JSON.parse(raw) as PersistedBrush[];
    if (!Array.isArray(parsed)) return { brushes: [], thumbnails: {} };

    const brushes: BrushPreset[] = [];
    const thumbnails: Record<string, string> = {};

    for (const item of parsed) {
      brushes.push(deserializeBrush(item));
      if (item.thumbnailUrl) {
        thumbnails[item.id] = item.thumbnailUrl;
      }
    }
    return { brushes, thumbnails };
  } catch {
    return { brushes: [], thumbnails: {} };
  }
}

/** Save brush presets to localStorage. */
function saveBrushes(brushes: BrushPreset[], thumbnails: Record<string, string>): void {
  try {
    const data = brushes.map((b) => serializeBrush(b, thumbnails[b.id] ?? null));
    localStorage.setItem(STORAGE_KEY_BRUSHES, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

/** Load persisted style presets from localStorage. */
function loadStyles(): LayerStylePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STYLES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LayerStylePreset[];
  } catch {
    return [];
  }
}

/** Save style presets to localStorage. */
function saveStyles(styles: LayerStylePreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STYLES, JSON.stringify(styles));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

// Initialize from localStorage (gracefully handles missing APIs in Node.js)
let initialBrushData: { brushes: BrushPreset[]; thumbnails: Record<string, string> } = {
  brushes: [],
  thumbnails: {},
};
let initialStyles: LayerStylePreset[] = [];
try {
  initialBrushData = loadBrushes();
  initialStyles = loadStyles();
} catch {
  // localStorage unavailable (Node.js test environment)
}

/** Asset store state. */
export interface AssetState {
  /** Imported brush presets. */
  brushPresets: BrushPreset[];
  /** Brush thumbnail data URLs keyed by preset ID. */
  brushThumbnails: Record<string, string>;
  /** Imported style presets. */
  stylePresets: LayerStylePreset[];
  /** Currently selected brush preset ID. */
  selectedBrushId: string | null;
}

/** Asset store actions. */
export interface AssetActions {
  /** Import brushes from an ABR file buffer. */
  importAbr: (buffer: ArrayBuffer, fileName: string) => void;
  /** Import styles from an ASL file buffer. */
  importAsl: (buffer: ArrayBuffer, fileName: string) => void;
  /** Select a brush preset by ID. */
  selectBrush: (id: string | null) => void;
  /** Apply a style preset's effects to the currently selected layer. */
  applyStyle: (styleId: string) => void;
  /** Remove a brush preset by ID. */
  removeBrush: (id: string) => void;
  /** Remove a style preset by ID. */
  removeStyle: (id: string) => void;
  /** Remove all brush presets. */
  clearBrushes: () => void;
  /** Remove all style presets. */
  clearStyles: () => void;
}

/** Zustand store for asset (brush/style) preset management. */
export const useAssetStore = create<AssetState & AssetActions>((set, get) => ({
  brushPresets: initialBrushData.brushes,
  brushThumbnails: initialBrushData.thumbnails,
  stylePresets: initialStyles,
  selectedBrushId: null,

  importAbr: (buffer, fileName): void => {
    const result = parseAbr(buffer, fileName);
    if (result.brushes.length === 0) {
      useAppStore.getState().setStatusMessage(`No brushes found in ${fileName}`);
      return;
    }

    const { brushPresets, brushThumbnails } = get();
    const newThumbnails = { ...brushThumbnails };
    for (const brush of result.brushes) {
      newThumbnails[brush.id] = generateBrushThumbnail(brush);
    }

    const updated = [...brushPresets, ...result.brushes];
    set({ brushPresets: updated, brushThumbnails: newThumbnails });
    saveBrushes(updated, newThumbnails);
    useAppStore.getState().setStatusMessage(
      `Imported ${result.brushes.length} brush${result.brushes.length !== 1 ? 'es' : ''} from ${fileName}`,
    );
  },

  importAsl: (buffer, fileName): void => {
    const result = parseAsl(buffer, fileName);
    if (result.styles.length === 0) {
      useAppStore.getState().setStatusMessage(`No styles found in ${fileName}`);
      return;
    }

    const updated = [...get().stylePresets, ...result.styles];
    set({ stylePresets: updated });
    saveStyles(updated);
    useAppStore.getState().setStatusMessage(
      `Imported ${result.styles.length} style${result.styles.length !== 1 ? 's' : ''} from ${fileName}`,
    );
  },

  selectBrush: (id): void => {
    set({ selectedBrushId: id });
  },

  applyStyle: (styleId): void => {
    const style = get().stylePresets.find((s) => s.id === styleId);
    if (!style) return;
    const appState = useAppStore.getState();
    const { selectedLayerId } = appState;
    if (!selectedLayerId) {
      appState.setStatusMessage('Select a layer to apply the style');
      return;
    }
    const effects: LayerEffect[] = style.effects.map((e) => ({ ...e }));
    appState.setLayerEffects(selectedLayerId, effects);
    appState.setStatusMessage(`Applied style: ${style.name}`);
  },

  removeBrush: (id): void => {
    const { brushPresets, brushThumbnails, selectedBrushId } = get();
    const updated = brushPresets.filter((b) => b.id !== id);
    const newThumbnails = { ...brushThumbnails };
    delete newThumbnails[id];
    set({
      brushPresets: updated,
      brushThumbnails: newThumbnails,
      selectedBrushId: selectedBrushId === id ? null : selectedBrushId,
    });
    saveBrushes(updated, newThumbnails);
  },

  removeStyle: (id): void => {
    const updated = get().stylePresets.filter((s) => s.id !== id);
    set({ stylePresets: updated });
    saveStyles(updated);
  },

  clearBrushes: (): void => {
    set({ brushPresets: [], brushThumbnails: {}, selectedBrushId: null });
    saveBrushes([], {});
  },

  clearStyles: (): void => {
    set({ stylePresets: [] });
    saveStyles([]);
  },
}));
