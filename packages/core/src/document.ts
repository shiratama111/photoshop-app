/**
 * @module document
 * Document creation and management.
 * Provides factory functions for creating new Document instances.
 *
 * @see CORE-001: DocumentManager
 */

import type { Document, LayerGroup } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import { generateId } from './uuid';

/**
 * Creates a new Document with an empty root layer group.
 *
 * @param name   - Display name for the document.
 * @param width  - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 * @param dpi    - Resolution in DPI. Defaults to 72.
 * @returns A new Document instance.
 */
export function createDocument(
  name: string,
  width: number,
  height: number,
  dpi?: number,
): Document {
  const now = new Date().toISOString();

  const rootGroup: LayerGroup = {
    id: generateId(),
    name: 'Root',
    type: 'group',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    children: [],
    expanded: true,
  };

  return {
    id: generateId(),
    name,
    canvas: {
      size: { width, height },
      dpi: dpi ?? 72,
      colorMode: 'rgb',
      bitDepth: 8,
    },
    rootGroup,
    selectedLayerId: null,
    filePath: null,
    dirty: false,
    createdAt: now,
    modifiedAt: now,
  };
}
