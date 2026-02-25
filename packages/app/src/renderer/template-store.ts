/**
 * @module template-store
 * Zustand store for document template management.
 *
 * Templates store the layer tree structure (names, types, positions, text content,
 * effects) without raster pixel data, making them lightweight.
 *
 * Persistence: localStorage with 200x112px thumbnail previews.
 * File I/O: .psxp format (ZIP-compressed JSON + thumbnail) via fflate.
 *
 * @see Phase 1: Template save/load
 * @see TMPL-001: Template file I/O (.psxp)
 */

import { create } from 'zustand';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Document, Layer, LayerGroup, TextLayer } from '@photoshop-app/types';
import {
  createRasterLayer,
  createTextLayer,
  createLayerGroup,
} from '@photoshop-app/core';
import { useAppStore } from './store';
import { t } from './i18n';

const STORAGE_KEY = 'photoshop-app:templates';
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 112;

/** Current .psxp template file format version. */
const PSXP_TEMPLATE_VERSION = 1;

/** Serializable layer structure (no pixel data). */
export interface TemplateLayer {
  type: 'raster' | 'text' | 'group';
  name: string;
  position: { x: number; y: number };
  opacity: number;
  blendMode: string;
  visible: boolean;
  effects: unknown[];
  // Text-specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: { r: number; g: number; b: number; a: number };
  alignment?: string;
  lineHeight?: number;
  letterSpacing?: number;
  writingMode?: string;
  // Group-specific
  children?: TemplateLayer[];
  // Raster -- dimensions only (no pixels)
  bounds?: { x: number; y: number; width: number; height: number };
}

/** JSON manifest stored inside the .psxp ZIP as template.json. */
export interface PsxpTemplateManifest {
  version: number;
  name: string;
  width: number;
  height: number;
  layers: TemplateLayer[];
  createdAt: string;
}

/** A saved template entry. */
export interface TemplateEntry {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: TemplateLayer[];
  createdAt: string;
  thumbnailUrl: string | null;
}

/** Type for the electronAPI template file methods exposed via preload. */
interface TemplateFileAPI {
  saveTemplateFile: (data: ArrayBuffer, defaultName?: string) => Promise<string | null>;
  openTemplateFile: () => Promise<{ filePath: string; data: ArrayBuffer } | null>;
}

/**
 * Get the template file portion of the electron API.
 * @returns The template file API methods, or an empty object if unavailable.
 */
function getTemplateFileAPI(): Partial<TemplateFileAPI> {
  return (window as unknown as { electronAPI?: Partial<TemplateFileAPI> }).electronAPI ?? {};
}

/**
 * Serialize a layer tree node into a TemplateLayer (no pixel data).
 * @param layer - The layer to serialize.
 * @returns A serializable TemplateLayer object.
 */
export function serializeLayer(layer: Layer): TemplateLayer {
  const base: TemplateLayer = {
    type: layer.type,
    name: layer.name,
    position: { ...layer.position },
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    visible: layer.visible,
    effects: layer.effects.map((e) => ({ ...e })),
  };

  if (layer.type === 'text') {
    const tl = layer as TextLayer;
    base.text = tl.text;
    base.fontFamily = tl.fontFamily;
    base.fontSize = tl.fontSize;
    base.bold = tl.bold;
    base.italic = tl.italic;
    base.color = { ...tl.color };
    base.alignment = tl.alignment;
    base.lineHeight = tl.lineHeight;
    base.letterSpacing = tl.letterSpacing;
    base.writingMode = tl.writingMode;
  } else if (layer.type === 'group') {
    const g = layer as LayerGroup;
    base.children = g.children.map(serializeLayer);
  } else if (layer.type === 'raster') {
    base.bounds = layer.bounds ? { ...layer.bounds } : undefined;
  }

  return base;
}

/**
 * Deserialize a TemplateLayer into a live Layer object.
 * @param tl - The template layer data to deserialize.
 * @returns A Layer object.
 */
export function deserializeLayer(tl: TemplateLayer): Layer {
  if (tl.type === 'text') {
    const layer = createTextLayer(tl.name, tl.text ?? 'Text', {
      fontFamily: tl.fontFamily ?? 'Arial',
      fontSize: tl.fontSize ?? 24,
      bold: tl.bold ?? false,
      italic: tl.italic ?? false,
      color: tl.color ?? { r: 0, g: 0, b: 0, a: 1 },
      alignment: (tl.alignment as 'left' | 'center' | 'right') ?? 'left',
      lineHeight: tl.lineHeight ?? 1.2,
      letterSpacing: tl.letterSpacing ?? 0,
      writingMode: (tl.writingMode as 'horizontal-tb' | 'vertical-rl') ?? 'horizontal-tb',
      underline: false,
      strikethrough: false,
    });
    layer.position = { ...tl.position };
    layer.opacity = tl.opacity;
    layer.blendMode = tl.blendMode as Layer['blendMode'];
    layer.visible = tl.visible;
    layer.effects = tl.effects as Layer['effects'];
    return layer;
  }

  if (tl.type === 'group') {
    const group = createLayerGroup(tl.name);
    group.position = { ...tl.position };
    group.opacity = tl.opacity;
    group.blendMode = tl.blendMode as Layer['blendMode'];
    group.visible = tl.visible;
    group.effects = tl.effects as Layer['effects'];
    if (tl.children) {
      group.children = tl.children.map(deserializeLayer);
      for (const child of group.children) {
        child.parentId = group.id;
      }
    }
    return group;
  }

  // Raster -- create empty layer with correct dimensions
  const w = tl.bounds?.width ?? 100;
  const h = tl.bounds?.height ?? 100;
  const layer = createRasterLayer(tl.name, w, h);
  layer.position = { ...tl.position };
  layer.opacity = tl.opacity;
  layer.blendMode = tl.blendMode as Layer['blendMode'];
  layer.visible = tl.visible;
  layer.effects = tl.effects as Layer['effects'];
  return layer;
}

/**
 * Pack a TemplateEntry into a .psxp ZIP buffer (fflate zipSync).
 * Contents: template.json (manifest) + thumbnail.png (if available).
 * @param entry - The template entry to pack.
 * @returns The ZIP binary as Uint8Array.
 */
export function packPsxpTemplate(entry: TemplateEntry): Uint8Array {
  const manifest: PsxpTemplateManifest = {
    version: PSXP_TEMPLATE_VERSION,
    name: entry.name,
    width: entry.width,
    height: entry.height,
    layers: entry.layers,
    createdAt: entry.createdAt,
  };

  const files: Record<string, Uint8Array> = {
    'template.json': strToU8(JSON.stringify(manifest, null, 2)),
  };

  // Include thumbnail if available (data URL -> binary)
  if (entry.thumbnailUrl) {
    const thumbBinary = dataUrlToUint8Array(entry.thumbnailUrl);
    if (thumbBinary) {
      files['thumbnail.png'] = thumbBinary;
    }
  }

  return zipSync(files);
}

/**
 * Unpack a .psxp ZIP buffer into a TemplateEntry.
 * @param data - The ZIP binary data.
 * @returns The parsed TemplateEntry.
 * @throws {Error} If the ZIP does not contain a valid template.json.
 */
export function unpackPsxpTemplate(data: Uint8Array): TemplateEntry {
  const files = unzipSync(data);

  const templateJsonBytes = files['template.json'];
  if (!templateJsonBytes) {
    throw new Error('Invalid .psxp template: missing template.json');
  }

  const raw: unknown = JSON.parse(strFromU8(templateJsonBytes));
  if (!isPsxpManifest(raw)) {
    throw new Error('Invalid .psxp template: malformed template.json');
  }

  const manifest = raw;

  // Extract thumbnail if present
  let thumbnailUrl: string | null = null;
  const thumbBytes = files['thumbnail.png'];
  if (thumbBytes) {
    thumbnailUrl = uint8ArrayToDataUrl(thumbBytes, 'image/png');
  }

  return {
    id: crypto.randomUUID(),
    name: manifest.name,
    width: manifest.width,
    height: manifest.height,
    layers: manifest.layers,
    createdAt: manifest.createdAt,
    thumbnailUrl,
  };
}

/**
 * Type guard to validate a parsed JSON object as PsxpTemplateManifest.
 * @param value - The value to check.
 * @returns True if the value has the correct shape.
 */
function isPsxpManifest(value: unknown): value is PsxpTemplateManifest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['version'] === 'number' &&
    typeof obj['name'] === 'string' &&
    typeof obj['width'] === 'number' &&
    typeof obj['height'] === 'number' &&
    Array.isArray(obj['layers']) &&
    typeof obj['createdAt'] === 'string'
  );
}

/**
 * Convert a data URL string to Uint8Array binary.
 * @param dataUrl - The data URL (e.g. "data:image/png;base64,...").
 * @returns The binary data, or null if conversion fails.
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const b64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Convert Uint8Array binary to a data URL string.
 * @param data - The binary data.
 * @param mimeType - The MIME type (e.g. "image/png").
 * @returns The data URL string.
 */
function uint8ArrayToDataUrl(data: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Type guard to validate template entries loaded from localStorage.
 */
function isTemplateEntry(value: unknown): value is TemplateEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['id'] === 'string' &&
    typeof entry['name'] === 'string' &&
    typeof entry['width'] === 'number' &&
    typeof entry['height'] === 'number' &&
    Array.isArray(entry['layers']) &&
    typeof entry['createdAt'] === 'string' &&
    (entry['thumbnailUrl'] === null || typeof entry['thumbnailUrl'] === 'string')
  );
}

/**
 * Create a simple canvas thumbnail for a template.
 */
function createTemplateThumbnail(width: number, height: number): string | null {
  try {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = THUMBNAIL_WIDTH;
    thumbCanvas.height = THUMBNAIL_HEIGHT;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${width} x ${height}`, THUMBNAIL_WIDTH / 2, THUMBNAIL_HEIGHT / 2);
    return thumbCanvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Build a live document instance from a template entry.
 */
function createDocumentFromTemplate(
  entry: Pick<TemplateEntry, 'name' | 'width' | 'height' | 'layers'>,
): Document {
  const children = entry.layers.map(deserializeLayer);
  const rootGroupId = crypto.randomUUID();
  for (const child of children) {
    child.parentId = rootGroupId;
  }

  return {
    id: crypto.randomUUID(),
    name: entry.name,
    canvas: {
      size: { width: entry.width, height: entry.height },
      dpi: 72,
      colorMode: 'rgb',
      bitDepth: 8,
    },
    rootGroup: {
      id: rootGroupId,
      name: 'Root',
      type: 'group',
      visible: true,
      opacity: 1,
      blendMode: 'normal' as Document['rootGroup']['blendMode'],
      position: { x: 0, y: 0 },
      locked: false,
      effects: [],
      parentId: null,
      children,
      expanded: true,
    },
    selectedLayerId: children[0]?.id ?? null,
    filePath: null,
    dirty: false,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

/**
 * Load a template entry into the main app store as a new document.
 */
function loadTemplateIntoApp(
  entry: Pick<TemplateEntry, 'name' | 'width' | 'height' | 'layers'>,
  statusKey: 'template.loaded' | 'template.imported',
): void {
  const appState = useAppStore.getState();
  const doc = createDocumentFromTemplate(entry);
  appState.setDocument(doc);
  if (doc.selectedLayerId) {
    appState.selectLayer(doc.selectedLayerId);
  }
  appState.setStatusMessage(`${t(statusKey)}: ${entry.name}`);
}

/**
 * Load templates from localStorage.
 * @returns Array of saved template entries.
 */
function loadTemplates(): TemplateEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTemplateEntry);
  } catch {
    return [];
  }
}

/**
 * Save templates to localStorage.
 * @param templates - The template entries to persist.
 */
function saveTemplatesStorage(templates: TemplateEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // quota exceeded
  }
}

let initialTemplates: TemplateEntry[] = [];
try {
  initialTemplates = loadTemplates();
} catch {
  // localStorage unavailable
}

/** Template store state. */
export interface TemplateState {
  templates: TemplateEntry[];
}

/** Template store actions. */
export interface TemplateActions {
  /** Save the current document as a localStorage template. */
  saveAsTemplate: (name: string) => void;
  /** Load a localStorage template by ID into a new document. */
  loadTemplate: (templateId: string) => void;
  /** Delete a localStorage template by ID. */
  deleteTemplate: (id: string) => void;
  /** Rename a localStorage template. */
  renameTemplate: (id: string, name: string) => void;
  /** Export a localStorage template to a .psxp file on disk. */
  exportTemplateFile: (templateId: string) => Promise<void>;
  /** Import a .psxp file from disk and load it as a new document. */
  importTemplateFile: () => Promise<void>;
}

export const useTemplateStore = create<TemplateState & TemplateActions>((set, get) => ({
  templates: initialTemplates,

  saveAsTemplate: (name): void => {
    const appState = useAppStore.getState();
    const doc = appState.document;
    if (!doc) return;

    const layers = doc.rootGroup.children.map(serializeLayer);
    const entry: TemplateEntry = {
      id: crypto.randomUUID(),
      name,
      width: doc.canvas.size.width,
      height: doc.canvas.size.height,
      layers,
      createdAt: new Date().toISOString(),
      thumbnailUrl: createTemplateThumbnail(doc.canvas.size.width, doc.canvas.size.height),
    };

    const updated = [...get().templates, entry];
    set({ templates: updated });
    saveTemplatesStorage(updated);
    appState.setStatusMessage(`${t('template.saved')}: ${name}`);
  },

  loadTemplate: (templateId): void => {
    const entry = get().templates.find((tmpl) => tmpl.id === templateId);
    if (!entry) return;
    loadTemplateIntoApp(entry, 'template.loaded');
  },

  deleteTemplate: (id): void => {
    const updated = get().templates.filter((tmpl) => tmpl.id !== id);
    set({ templates: updated });
    saveTemplatesStorage(updated);
  },

  renameTemplate: (id, name): void => {
    const updated = get().templates.map((tmpl) =>
      tmpl.id === id ? { ...tmpl, name } : tmpl,
    );
    set({ templates: updated });
    saveTemplatesStorage(updated);
  },

  exportTemplateFile: async (templateId): Promise<void> => {
    const entry = get().templates.find((tmpl) => tmpl.id === templateId);
    if (!entry) return;

    const api = getTemplateFileAPI();
    if (!api.saveTemplateFile) return;

    const zipData = packPsxpTemplate(entry);
    const arrayBuffer = zipData.buffer.slice(
      zipData.byteOffset,
      zipData.byteOffset + zipData.byteLength,
    ) as ArrayBuffer;

    const savedPath = await api.saveTemplateFile(arrayBuffer, entry.name);
    if (savedPath) {
      const appState = useAppStore.getState();
      appState.setStatusMessage(`${t('template.exported')}: ${entry.name}`);
    }
  },

  importTemplateFile: async (): Promise<void> => {
    const api = getTemplateFileAPI();
    if (!api.openTemplateFile) return;

    const result = await api.openTemplateFile();
    if (!result) return;

    try {
      const zipData = new Uint8Array(result.data);
      const entry = unpackPsxpTemplate(zipData);
      loadTemplateIntoApp(entry, 'template.imported');
    } catch {
      const appState = useAppStore.getState();
      appState.setStatusMessage(t('template.importError'));
    }
  },
}));
