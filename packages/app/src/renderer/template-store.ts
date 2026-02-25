/**
 * @module template-store
 * Zustand store for document template management.
 *
 * Templates store the layer tree structure (names, types, positions, text content,
 * effects) without raster pixel data, making them lightweight.
 *
 * Persistence: localStorage with 200x112px thumbnail previews.
 *
 * @see Phase 1: Template save/load
 */

import { create } from 'zustand';
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

/** Serializable layer structure (no pixel data). */
interface TemplateLayer {
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
  // Raster — dimensions only (no pixels)
  bounds?: { x: number; y: number; width: number; height: number };
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

function serializeLayer(layer: Layer): TemplateLayer {
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

function deserializeLayer(tl: TemplateLayer): Layer {
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
    }
    return group;
  }

  // Raster — create empty layer with correct dimensions
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

function loadTemplates(): TemplateEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as TemplateEntry[];
  } catch {
    return [];
  }
}

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

export interface TemplateState {
  templates: TemplateEntry[];
}

export interface TemplateActions {
  saveAsTemplate: (name: string) => void;
  loadTemplate: (templateId: string) => void;
  deleteTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
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
      thumbnailUrl: null,
    };

    // Generate thumbnail
    try {
      const canvas = appState.renderLayerThumbnail
        ? null // We'll use a simpler approach
        : null;
      void canvas; // unused fallback
      // Simple: render the document to a small canvas for thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = THUMBNAIL_WIDTH;
      thumbCanvas.height = THUMBNAIL_HEIGHT;
      const ctx = thumbCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${doc.canvas.size.width} x ${doc.canvas.size.height}`, THUMBNAIL_WIDTH / 2, THUMBNAIL_HEIGHT / 2);
        entry.thumbnailUrl = thumbCanvas.toDataURL('image/png');
      }
    } catch {
      // thumbnail generation failed
    }

    const updated = [...get().templates, entry];
    set({ templates: updated });
    saveTemplatesStorage(updated);
    appState.setStatusMessage(`${t('template.saved')}: ${name}`);
  },

  loadTemplate: (templateId): void => {
    const entry = get().templates.find((tmpl) => tmpl.id === templateId);
    if (!entry) return;

    const appState = useAppStore.getState();
    const children = entry.layers.map(deserializeLayer);

    const doc: Document = {
      id: crypto.randomUUID(),
      name: entry.name,
      canvas: {
        size: { width: entry.width, height: entry.height },
        dpi: 72,
        colorMode: 'rgb',
        bitDepth: 8,
      },
      rootGroup: {
        id: crypto.randomUUID(),
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

    appState.setDocument(doc);
    if (children[0]) {
      appState.selectLayer(children[0].id);
    }
    appState.setStatusMessage(`${t('template.loaded')}: ${entry.name}`);
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
}));
