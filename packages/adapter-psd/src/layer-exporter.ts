/**
 * @module layer-exporter
 * Converts internal Layer types to ag-psd layer structures for PSD export.
 *
 * @see {@link @photoshop-app/types!Layer}
 */

import type { Layer, LayerGroup, PsdExportOptions, RasterLayer, TextLayer } from '@photoshop-app/types';
import type { Layer as AgLayer } from 'ag-psd';

/**
 * Convert an internal Layer to an ag-psd Layer for export.
 */
export function exportLayer(layer: Layer, options: PsdExportOptions): AgLayer {
  switch (layer.type) {
    case 'group':
      return exportGroupLayer(layer, options);
    case 'text':
      return exportTextLayer(layer, options);
    case 'raster':
      return exportRasterLayer(layer);
  }
}

function exportGroupLayer(group: LayerGroup, options: PsdExportOptions): AgLayer {
  return {
    name: group.name,
    hidden: !group.visible,
    opacity: Math.round(group.opacity * 255),
    blendMode: group.blendMode,
    children: group.children.map((child) => exportLayer(child, options)),
    opened: group.expanded,
  };
}

function exportRasterLayer(layer: RasterLayer): AgLayer {
  const result: AgLayer = {
    name: layer.name,
    hidden: !layer.visible,
    opacity: Math.round(layer.opacity * 255),
    blendMode: layer.blendMode,
    left: layer.position.x,
    top: layer.position.y,
    right: layer.position.x + layer.bounds.width,
    bottom: layer.position.y + layer.bounds.height,
  };

  if (layer.imageData) {
    result.imageData = layer.imageData;
  }

  return result;
}

function exportTextLayer(layer: TextLayer, options: PsdExportOptions): AgLayer {
  const result: AgLayer = {
    name: layer.name,
    hidden: !layer.visible,
    opacity: Math.round(layer.opacity * 255),
    blendMode: layer.blendMode,
    left: layer.position.x,
    top: layer.position.y,
  };

  if (options.preserveText) {
    result.text = {
      text: layer.text,
      style: {
        fontSize: layer.fontSize,
        font: { name: layer.fontFamily },
        fillColor: { r: layer.color.r, g: layer.color.g, b: layer.color.b },
        fauxBold: layer.bold,
        fauxItalic: layer.italic,
      },
      paragraphStyle: {
        justification: layer.alignment,
      },
    };
  }

  return result;
}
