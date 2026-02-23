/**
 * @module export-psd
 * PSD file export using ag-psd library.
 *
 * Converts our internal Document model to a PSD file buffer.
 *
 * @see {@link @photoshop-app/types!Document}
 * @see {@link @photoshop-app/types!PsdExportOptions}
 */

import type { Document, PsdExportOptions } from '@photoshop-app/types';
import type { Psd } from 'ag-psd';
import { writePsd } from 'ag-psd';
import { exportLayer } from './layer-exporter';

/** Default export options. */
const DEFAULT_OPTIONS: PsdExportOptions = {
  preserveText: true,
  generateComposite: false,
  includeEffects: true,
};

/**
 * Export an internal Document to a PSD file buffer.
 * @param document - The document to export.
 * @param options - Export options (partial, merged with defaults).
 * @returns PSD file as an ArrayBuffer.
 */
export function exportPsd(
  document: Document,
  options?: Partial<PsdExportOptions>,
): ArrayBuffer {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const children = document.rootGroup.children.map((layer) =>
    exportLayer(layer, opts),
  );

  const psd: Psd = {
    width: document.canvas.size.width,
    height: document.canvas.size.height,
    children,
    imageResources: {
      xResolution: document.canvas.dpi,
      yResolution: document.canvas.dpi,
    },
  };

  return writePsd(psd);
}
