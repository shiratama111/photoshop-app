/**
 * @module import-psd
 * PSD file import using ag-psd library.
 *
 * Converts a PSD file buffer into our internal Document model,
 * including layer tree mapping and compatibility reporting.
 *
 * @see https://github.com/nicktomlin/ag-psd
 * @see {@link @photoshop-app/types!Document}
 * @see {@link @photoshop-app/types!PsdImportOptions}
 */

import type {
  CompatibilityIssue,
  CompatibilityReport,
  Document,
  LayerGroup,
  PsdImportOptions,
} from '@photoshop-app/types';
import { readPsd } from 'ag-psd';
import { mapLayer } from './layer-mapper';

/** Default import options. */
const DEFAULT_OPTIONS: PsdImportOptions = {
  rasterizeText: false,
  rasterizeSmartObjects: true,
  maxDimension: 0,
};

/**
 * Normalize input to ArrayBuffer expected by ag-psd typings.
 * Copies Uint8Array input to ensure a non-shared, exact-length buffer.
 */
function toArrayBuffer(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }

  const normalized = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(normalized).set(buffer);
  return normalized;
}

/** Result of a PSD import operation. */
export interface PsdImportResult {
  /** The imported document. */
  document: Document;
  /** Compatibility report with any issues found. */
  report: CompatibilityReport;
}

/**
 * Import a PSD file buffer into our internal Document model.
 * @param buffer - Raw PSD file data (ArrayBuffer or Uint8Array).
 * @param fileName - Original file name (used for document name).
 * @param options - Import options (partial, merged with defaults).
 * @returns Imported document and compatibility report.
 */
export function importPsd(
  buffer: ArrayBuffer | Uint8Array,
  fileName = 'Untitled.psd',
  options?: Partial<PsdImportOptions>,
): PsdImportResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const issues: CompatibilityIssue[] = [];

  // Parse with ag-psd
  const psd = readPsd(toArrayBuffer(buffer), {
    skipCompositeImageData: true,
    skipLinkedFilesData: true,
    skipThumbnail: true,
  });

  const width = psd.width;
  const height = psd.height;

  // Check max dimension
  if (opts.maxDimension > 0 && (width > opts.maxDimension || height > opts.maxDimension)) {
    issues.push({
      severity: 'warning',
      message: `PSD dimensions (${width}x${height}) exceed max dimension (${opts.maxDimension})`,
      feature: 'max-dimension',
    });
  }

  // Map layers
  const rootId = crypto.randomUUID();
  const children = (psd.children ?? []).map((agLayer) =>
    mapLayer(agLayer, rootId, opts, issues),
  );

  const rootGroup: LayerGroup = {
    id: rootId,
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
  };

  // Check for unsupported color modes
  const colorMode = psd.colorMode;
  if (colorMode !== undefined && colorMode !== 3) {
    // 3 = RGB
    const modeNames: Record<number, string> = {
      0: 'Bitmap',
      1: 'Grayscale',
      2: 'Indexed',
      4: 'CMYK',
      7: 'Multichannel',
      8: 'Duotone',
      9: 'Lab',
    };
    issues.push({
      severity: 'warning',
      message: `Color mode "${modeNames[colorMode] ?? colorMode}" converted to RGB`,
      feature: 'color-mode',
    });
  }

  // Check bit depth
  if (psd.bitsPerChannel && psd.bitsPerChannel !== 8) {
    issues.push({
      severity: 'info',
      message: `${psd.bitsPerChannel}-bit channel depth converted to 8-bit`,
      feature: 'bit-depth',
    });
  }

  const now = new Date().toISOString();
  const dpi = psd.imageResources?.resolutionInfo?.horizontalResolution ?? 72;

  const document: Document = {
    id: crypto.randomUUID(),
    name: fileName.replace(/\.psd$/i, ''),
    canvas: {
      size: { width, height },
      dpi,
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

  const affectedLayerCount = issues.filter((i) => i.layerName).length;

  const report: CompatibilityReport = {
    issues,
    canProceed: !issues.some((i) => i.severity === 'error'),
    layerCount: countLayers(rootGroup),
    affectedLayerCount,
  };

  return { document, report };
}

/** Recursively count layers in a group. */
function countLayers(group: LayerGroup): number {
  let count = 0;
  for (const child of group.children) {
    count++;
    if (child.type === 'group') {
      count += countLayers(child);
    }
  }
  return count;
}
