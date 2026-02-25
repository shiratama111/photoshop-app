/**
 * @module layer-exporter
 * Converts internal Layer types to ag-psd layer structures for PSD export.
 *
 * @see {@link @photoshop-app/types!Layer}
 */

import type { Layer, LayerGroup, PsdExportOptions, RasterLayer, TextLayer } from '@photoshop-app/types';
import type {
  Layer as AgLayer,
  LayerEffectsInfo,
  LayerEffectGradientOverlay,
  UnitsValue,
} from 'ag-psd';

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
      return exportRasterLayer(layer, options);
  }
}

function exportGroupLayer(group: LayerGroup, options: PsdExportOptions): AgLayer {
  const result: AgLayer = {
    name: group.name,
    hidden: !group.visible,
    opacity: group.opacity,
    blendMode: group.blendMode,
    children: group.children.map((child) => exportLayer(child, options)),
    opened: group.expanded,
  };

  if (options.includeEffects) {
    const effects = mapEffects(group.effects);
    if (effects) result.effects = effects;
  }

  return result;
}

function exportRasterLayer(layer: RasterLayer, options: PsdExportOptions): AgLayer {
  const result: AgLayer = {
    name: layer.name,
    hidden: !layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    left: layer.position.x,
    top: layer.position.y,
    right: layer.position.x + layer.bounds.width,
    bottom: layer.position.y + layer.bounds.height,
  };

  if (layer.imageData) {
    result.imageData = layer.imageData;
  }

  if (options.includeEffects) {
    const effects = mapEffects(layer.effects);
    if (effects) result.effects = effects;
  }

  return result;
}

function exportTextLayer(layer: TextLayer, options: PsdExportOptions): AgLayer {
  const result: AgLayer = {
    name: layer.name,
    hidden: !layer.visible,
    opacity: layer.opacity,
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
        underline: layer.underline,
        strikethrough: layer.strikethrough,
      },
      paragraphStyle: {
        justification: layer.alignment,
      },
    };
  }

  if (options.includeEffects) {
    const effects = mapEffects(layer.effects);
    if (effects) result.effects = effects;
  }

  return result;
}

function mapEffects(effects: Layer['effects']): LayerEffectsInfo | undefined {
  if (!effects.length) return undefined;

  const result: LayerEffectsInfo = {};

  for (const effect of effects) {
    if (!effect.enabled) continue;

    switch (effect.type) {
      case 'drop-shadow': {
        result.dropShadow = result.dropShadow ?? [];
        result.dropShadow.push({
          enabled: true,
          color: toAgColor(effect.color),
          opacity: effect.opacity,
          angle: effect.angle,
          distance: px(effect.distance),
          size: px(effect.blur),
          choke: px(effect.spread),
        });
        break;
      }
      case 'inner-shadow': {
        result.innerShadow = result.innerShadow ?? [];
        result.innerShadow.push({
          enabled: true,
          color: toAgColor(effect.color),
          opacity: effect.opacity,
          angle: effect.angle,
          distance: px(effect.distance),
          size: px(effect.blur),
          choke: px(effect.choke),
        });
        break;
      }
      case 'outer-glow': {
        result.outerGlow = {
          enabled: true,
          color: toAgColor(effect.color),
          opacity: effect.opacity,
          size: px(effect.size),
          choke: px(effect.spread),
        };
        break;
      }
      case 'inner-glow': {
        result.innerGlow = {
          enabled: true,
          color: toAgColor(effect.color),
          opacity: effect.opacity,
          size: px(effect.size),
          choke: px(effect.choke),
          source: effect.source,
        };
        break;
      }
      case 'stroke': {
        result.stroke = result.stroke ?? [];
        result.stroke.push({
          enabled: true,
          size: px(effect.size),
          position: effect.position,
          opacity: effect.opacity,
          color: toAgColor(effect.color),
        });
        break;
      }
      case 'color-overlay': {
        result.solidFill = result.solidFill ?? [];
        result.solidFill.push({
          enabled: true,
          opacity: effect.opacity,
          color: toAgColor(effect.color),
        });
        break;
      }
      case 'gradient-overlay': {
        result.gradientOverlay = result.gradientOverlay ?? [];
        result.gradientOverlay.push(mapGradientOverlay(effect));
        break;
      }
      case 'bevel-emboss': {
        result.bevel = {
          enabled: true,
          style: mapBevelStyle(effect.style),
          strength: effect.depth,
          direction: effect.direction,
          size: px(effect.size),
          soften: px(effect.soften),
          angle: effect.angle,
          altitude: effect.altitude,
          highlightColor: toAgColor(effect.highlightColor),
          highlightOpacity: effect.highlightOpacity,
          shadowColor: toAgColor(effect.shadowColor),
          shadowOpacity: effect.shadowOpacity,
        };
        break;
      }
      default:
        break;
    }
  }

  const hasAny = Object.values(result).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined;
  });
  return hasAny ? result : undefined;
}

function mapGradientOverlay(effect: Extract<Layer['effects'][number], { type: 'gradient-overlay' }>): LayerEffectGradientOverlay {
  const stops = effect.stops.length > 0
    ? [...effect.stops].sort((a, b) => a.position - b.position)
    : [
      { position: 0, color: { r: 255, g: 255, b: 255, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
    ];

  const gradientOverlay: LayerEffectGradientOverlay & { angle?: number } = {
    enabled: true,
    opacity: effect.opacity,
    type: effect.gradientType,
    reverse: effect.reverse,
    scale: effect.scale,
    angle: effect.angle,
    gradient: {
      type: 'solid',
      name: 'Gradient Overlay',
      colorStops: stops.map((s) => ({
        color: toAgColor(s.color),
        location: Math.round(clamp(s.position, 0, 1) * 4096),
        midpoint: 50,
      })),
      opacityStops: [
        { opacity: 100, location: 0, midpoint: 50 },
        { opacity: 100, location: 4096, midpoint: 50 },
      ],
    },
  };

  return gradientOverlay;
}

function mapBevelStyle(style: Extract<Layer['effects'][number], { type: 'bevel-emboss' }>['style']) {
  switch (style) {
    case 'outer-bevel':
      return 'outer bevel' as const;
    case 'emboss':
      return 'emboss' as const;
    case 'pillow-emboss':
      return 'pillow emboss' as const;
    case 'stroke-emboss':
      return 'stroke emboss' as const;
    case 'inner-bevel':
    default:
      return 'inner bevel' as const;
  }
}

function px(value: number): UnitsValue {
  return { units: 'Pixels', value };
}

function toAgColor(color: { r: number; g: number; b: number; a: number }) {
  return {
    r: clamp(Math.round(color.r), 0, 255),
    g: clamp(Math.round(color.g), 0, 255),
    b: clamp(Math.round(color.b), 0, 255),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
