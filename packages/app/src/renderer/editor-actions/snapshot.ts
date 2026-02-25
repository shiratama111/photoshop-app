/**
 * @module editor-actions/snapshot
 * Canvas state snapshot capture for AI consumption.
 *
 * Captures the current document state as a serializable snapshot
 * including base64-encoded thumbnail and per-layer thumbnails.
 * Used by the MCP server (Phase 2-3) to let Claude Code "see" the canvas.
 *
 * Reuses the proven exportAsImage rendering pattern:
 *   OffscreenCanvas → ViewportImpl(1:1) → Canvas2DRenderer.render() → convertToBlob()
 *
 * @see Phase 2-2: Canvas State Snapshot
 * @see Phase 2-3: MCP Server (consumer)
 */

import type { Document, LayerGroup } from '@photoshop-app/types';
import { Canvas2DRenderer, ViewportImpl } from '@photoshop-app/render';
import { useAppStore } from '../store';
import { serializeDocument } from './dispatcher';

/** Full canvas state snapshot for AI consumption. */
export interface CanvasSnapshot {
  document: {
    id: string;
    name: string;
    width: number;
    height: number;
    dpi: number;
    selectedLayerId: string | null;
  };
  /** Serialized layer tree (recursive). */
  layers: unknown[];
  /** Base64-encoded PNG thumbnail (max 480px on longest side). */
  thumbnail: string;
  /** Per-layer thumbnails: layerId → base64 PNG (64×64). */
  layerThumbnails: Record<string, string>;
}

/** Maximum size (px) for the longest side of the canvas thumbnail. */
const THUMBNAIL_MAX_SIZE = 480;

/** Size (px) for per-layer thumbnail squares. */
const LAYER_THUMBNAIL_SIZE = 64;

/**
 * Capture a full snapshot of the current canvas state.
 * Returns null if no document is open.
 *
 * @param includeThumbnails - Whether to include per-layer thumbnails (default: true).
 */
export async function captureCanvasSnapshot(
  includeThumbnails = true,
): Promise<CanvasSnapshot | null> {
  const state = useAppStore.getState();
  const doc = state.document;
  if (!doc) return null;

  // 1. Serialize document structure (reuses existing serializer)
  const serialized = serializeDocument(doc) as Record<string, unknown>;

  // 2. Render canvas thumbnail
  const thumbnail = await renderCanvasThumbnail(doc);

  // 3. Collect per-layer thumbnails
  const layerThumbnails: Record<string, string> = {};
  if (includeThumbnails) {
    const renderer = new Canvas2DRenderer();
    const layerIds = collectLayerIds(doc.rootGroup);

    const entries = await Promise.all(
      layerIds.map(async (layerId) => {
        const thumbCanvas = renderer.renderLayerThumbnail(
          doc,
          layerId,
          { width: LAYER_THUMBNAIL_SIZE, height: LAYER_THUMBNAIL_SIZE },
        );
        if (!thumbCanvas) return null;
        // renderLayerThumbnail returns a pooled OffscreenCanvas cast as HTMLCanvasElement
        const base64 = await offscreenToBase64(thumbCanvas as unknown as OffscreenCanvas);
        return { layerId, base64 };
      }),
    );

    for (const entry of entries) {
      if (entry) {
        layerThumbnails[entry.layerId] = entry.base64;
      }
    }

    renderer.dispose();
  }

  return {
    document: {
      id: serialized.id as string,
      name: serialized.name as string,
      width: serialized.width as number,
      height: serialized.height as number,
      dpi: serialized.dpi as number,
      selectedLayerId: serialized.selectedLayerId as string | null,
    },
    layers: serialized.layers as unknown[],
    thumbnail,
    layerThumbnails,
  };
}

/**
 * Render a scaled-down thumbnail of the full canvas.
 * Uses the same pattern as exportAsImage (OffscreenCanvas + ViewportImpl + renderer.render).
 */
async function renderCanvasThumbnail(doc: Document): Promise<string> {
  const { width, height } = doc.canvas.size;

  // Calculate scaled dimensions (max 480px on longest side)
  const scale = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(width, height));
  const thumbW = Math.max(1, Math.round(width * scale));
  const thumbH = Math.max(1, Math.round(height * scale));

  const offscreen = new OffscreenCanvas(thumbW, thumbH);

  // Create a 1:1 viewport at thumbnail size, then zoom to fit
  const viewport = new ViewportImpl({ width: thumbW, height: thumbH });
  if (scale < 1) {
    viewport.setZoom(scale);
  }

  const renderer = new Canvas2DRenderer();
  renderer.render(doc, offscreen as unknown as HTMLCanvasElement, {
    viewport,
    renderEffects: true,
    showSelection: false,
    showGuides: false,
    background: 'transparent',
  });
  renderer.dispose();

  return offscreenToBase64(offscreen);
}

/** Convert an OffscreenCanvas to a base64-encoded PNG data URI. */
async function offscreenToBase64(canvas: OffscreenCanvas): Promise<string> {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/** Recursively collect all layer IDs from a layer group. */
function collectLayerIds(group: LayerGroup): string[] {
  const ids: string[] = [];
  for (const layer of group.children) {
    ids.push(layer.id);
    if (layer.type === 'group') {
      ids.push(...collectLayerIds(layer as LayerGroup));
    }
  }
  return ids;
}
