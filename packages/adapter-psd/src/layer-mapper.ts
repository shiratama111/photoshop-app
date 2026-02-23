/**
 * @module layer-mapper
 * Maps ag-psd layer structures to internal Layer types.
 *
 * ag-psd uses its own layer representation. This module converts
 * ag-psd Layer objects to our internal RasterLayer / TextLayer / LayerGroup types.
 *
 * @see {@link @photoshop-app/types!Layer}
 */

import type {
  BlendMode,
  CompatibilityIssue,
  Layer,
  LayerGroup,
  LayerMask,
  PsdImportOptions,
  RasterLayer,
  TextLayer,
} from '@photoshop-app/types';
import type { Layer as AgLayer } from 'ag-psd';

/** ag-psd blend mode string → our BlendMode enum value. */
const BLEND_MODE_MAP: Record<string, BlendMode> = {
  'normal': 'normal' as BlendMode,
  'multiply': 'multiply' as BlendMode,
  'screen': 'screen' as BlendMode,
  'overlay': 'overlay' as BlendMode,
  'darken': 'darken' as BlendMode,
  'lighten': 'lighten' as BlendMode,
  'color-dodge': 'color-dodge' as BlendMode,
  'color-burn': 'color-burn' as BlendMode,
  'hard-light': 'hard-light' as BlendMode,
  'soft-light': 'soft-light' as BlendMode,
  'difference': 'difference' as BlendMode,
  'exclusion': 'exclusion' as BlendMode,
  'hue': 'hue' as BlendMode,
  'saturation': 'saturation' as BlendMode,
  'color': 'color' as BlendMode,
  'luminosity': 'luminosity' as BlendMode,
  // ag-psd sometimes uses different names:
  'dissolve': 'normal' as BlendMode,
  'linear dodge': 'lighten' as BlendMode,
  'linear burn': 'darken' as BlendMode,
  'vivid light': 'hard-light' as BlendMode,
  'linear light': 'hard-light' as BlendMode,
  'pin light': 'hard-light' as BlendMode,
  'hard mix': 'hard-light' as BlendMode,
  'pass through': 'normal' as BlendMode,
};

/**
 * Map a single ag-psd layer to our internal Layer type.
 * @param agLayer - ag-psd layer object.
 * @param parentId - ID of the parent group.
 * @param options - Import options.
 * @param issues - Accumulated compatibility issues.
 * @returns Internal Layer object.
 */
export function mapLayer(
  agLayer: AgLayer,
  parentId: string | null,
  options: PsdImportOptions,
  issues: CompatibilityIssue[],
): Layer {
  // Determine if this is a group
  if (agLayer.children && agLayer.children.length > 0) {
    return mapGroupLayer(agLayer, parentId, options, issues);
  }

  // Text layer
  if (agLayer.text && !options.rasterizeText) {
    return mapTextLayer(agLayer, parentId, issues);
  }

  // Default: raster layer
  return mapRasterLayer(agLayer, parentId, issues);
}

function mapGroupLayer(
  agLayer: AgLayer,
  parentId: string | null,
  options: PsdImportOptions,
  issues: CompatibilityIssue[],
): LayerGroup {
  const id = crypto.randomUUID();

  const children: Layer[] = [];
  if (agLayer.children) {
    for (const child of agLayer.children) {
      children.push(mapLayer(child, id, options, issues));
    }
  }

  return {
    id,
    name: agLayer.name ?? 'Group',
    type: 'group',
    visible: !agLayer.hidden,
    opacity: (agLayer.opacity ?? 255) / 255,
    blendMode: mapBlendMode(agLayer.blendMode),
    position: { x: agLayer.left ?? 0, y: agLayer.top ?? 0 },
    locked: false,
    effects: [],
    parentId,
    children,
    expanded: !(agLayer.opened === false),
  };
}

function mapRasterLayer(
  agLayer: AgLayer,
  parentId: string | null,
  issues: CompatibilityIssue[],
): RasterLayer {
  const id = crypto.randomUUID();
  const left = agLayer.left ?? 0;
  const top = agLayer.top ?? 0;
  const right = agLayer.right ?? left;
  const bottom = agLayer.bottom ?? top;
  const width = right - left;
  const height = bottom - top;

  // Check for smart object
  if (agLayer.placedLayer) {
    issues.push({
      severity: 'warning',
      message: 'Smart object rasterized on import',
      layerName: agLayer.name,
      feature: 'smart-object',
    });
  }

  // Extract image data
  let imageData: ImageData | null = null;
  if (agLayer.canvas) {
    try {
      const ctx = agLayer.canvas.getContext('2d');
      if (ctx && width > 0 && height > 0) {
        imageData = ctx.getImageData(0, 0, width, height);
      }
    } catch {
      // Canvas not available in Node environment
      issues.push({
        severity: 'info',
        message: 'Could not extract canvas data',
        layerName: agLayer.name,
        feature: 'canvas-extraction',
      });
    }
  } else if (agLayer.imageData) {
    // ag-psd may provide raw image data
    if (width > 0 && height > 0) {
      imageData = new ImageData(
        new Uint8ClampedArray(agLayer.imageData.data),
        width,
        height,
      );
    }
  }

  // Map mask
  let mask: LayerMask | undefined;
  if (agLayer.mask && agLayer.mask.canvas) {
    try {
      const maskCanvas = agLayer.mask.canvas;
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        const mw = maskCanvas.width;
        const mh = maskCanvas.height;
        if (mw > 0 && mh > 0) {
          const maskImgData = ctx.getImageData(0, 0, mw, mh);
          const alphaChannel = new Uint8Array(mw * mh);
          for (let i = 0; i < mw * mh; i++) {
            alphaChannel[i] = maskImgData.data[i * 4 + 3]; // Alpha channel
          }
          mask = {
            data: alphaChannel,
            width: mw,
            height: mh,
            offset: {
              x: (agLayer.mask.left ?? 0) - left,
              y: (agLayer.mask.top ?? 0) - top,
            },
            enabled: !agLayer.mask.disabled,
          };
        }
      }
    } catch {
      // Mask extraction failed
    }
  }

  return {
    id,
    name: agLayer.name ?? 'Layer',
    type: 'raster',
    visible: !agLayer.hidden,
    opacity: (agLayer.opacity ?? 255) / 255,
    blendMode: mapBlendMode(agLayer.blendMode),
    position: { x: left, y: top },
    locked: false,
    effects: [],
    mask,
    parentId,
    imageData,
    bounds: { x: left, y: top, width, height },
  };
}

function mapTextLayer(
  agLayer: AgLayer,
  parentId: string | null,
  issues: CompatibilityIssue[],
): TextLayer {
  const id = crypto.randomUUID();
  const textData = agLayer.text!;

  // Extract font info from the first style run
  const style = textData.style;
  const fontSize = style?.fontSize ?? 24;
  const fontFamily = style?.font?.name ?? 'Arial';
  const bold = style?.fauxBold ?? false;
  const italic = style?.fauxItalic ?? false;

  // Extract color
  const fillColor = style?.fillColor;
  const color = fillColor
    ? { r: fillColor.r ?? 0, g: fillColor.g ?? 0, b: fillColor.b ?? 0, a: 1 }
    : { r: 0, g: 0, b: 0, a: 1 };

  // Warn about unsupported text features
  if (textData.style?.strokeEnabled) {
    issues.push({
      severity: 'info',
      message: 'Text stroke effect not fully supported',
      layerName: agLayer.name,
      feature: 'text-stroke',
    });
  }

  return {
    id,
    name: agLayer.name ?? 'Text',
    type: 'text',
    visible: !agLayer.hidden,
    opacity: (agLayer.opacity ?? 255) / 255,
    blendMode: mapBlendMode(agLayer.blendMode),
    position: { x: agLayer.left ?? 0, y: agLayer.top ?? 0 },
    locked: false,
    effects: [],
    parentId,
    text: textData.text ?? '',
    fontFamily,
    fontSize,
    color,
    bold,
    italic,
    alignment: mapAlignment(textData.paragraphStyle?.justification),
    lineHeight: style?.leading ? style.leading / fontSize : 1.2,
    letterSpacing: style?.tracking ? style.tracking / 1000 : 0,
    textBounds: null,
  };
}

function mapBlendMode(mode: string | undefined): BlendMode {
  if (!mode) return 'normal' as BlendMode;
  return BLEND_MODE_MAP[mode] ?? ('normal' as BlendMode);
}

function mapAlignment(justification: string | undefined): 'left' | 'center' | 'right' {
  switch (justification) {
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    default:
      return 'left';
  }
}
