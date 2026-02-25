/**
 * @module components/dialogs/LayerStyleDialog
 * Modal dialog for managing layer effects (Stroke, Drop Shadow, Outer Glow).
 *
 * Features tabbed interface with enable/disable per effect,
 * live preview via store updates, and Cancel/OK actions.
 *
 * @see APP-005: Layer style UI
 */

import React, { useCallback, useState } from 'react';
import type {
  BevelEmbossEffect,
  BevelDirection,
  BevelStyle,
  Color,
  ColorOverlayEffect,
  DropShadowEffect,
  GradientOverlayEffect,
  InnerGlowEffect,
  InnerShadowEffect,
  LayerEffect,
  OuterGlowEffect,
  StrokeEffect,
  StrokePosition,
} from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';
import { t } from '../../i18n';

type TabId =
  | 'stroke'
  | 'drop-shadow'
  | 'outer-glow'
  | 'color-overlay'
  | 'inner-shadow'
  | 'inner-glow'
  | 'gradient-overlay'
  | 'bevel-emboss';

const TAB_ORDER: TabId[] = [
  'stroke',
  'drop-shadow',
  'outer-glow',
  'color-overlay',
  'inner-shadow',
  'inner-glow',
  'gradient-overlay',
  'bevel-emboss',
];

const TAB_LABEL_KEYS: Record<TabId, string> = {
  stroke: 'layerStyle.tab.stroke',
  'drop-shadow': 'layerStyle.tab.dropShadow',
  'outer-glow': 'layerStyle.tab.outerGlow',
  'color-overlay': 'layerStyle.tab.colorOverlay',
  'inner-shadow': 'layerStyle.tab.innerShadow',
  'inner-glow': 'layerStyle.tab.innerGlow',
  'gradient-overlay': 'layerStyle.tab.gradientOverlay',
  'bevel-emboss': 'layerStyle.tab.bevelEmboss',
};

const ENABLE_LABEL_KEYS: Record<TabId, string> = {
  stroke: 'layerStyle.enable.stroke',
  'drop-shadow': 'layerStyle.enable.dropShadow',
  'outer-glow': 'layerStyle.enable.outerGlow',
  'color-overlay': 'layerStyle.enable.colorOverlay',
  'inner-shadow': 'layerStyle.enable.innerShadow',
  'inner-glow': 'layerStyle.enable.innerGlow',
  'gradient-overlay': 'layerStyle.enable.gradientOverlay',
  'bevel-emboss': 'layerStyle.enable.bevelEmboss',
};

/** Convert 0-1 Color to hex string. */
function colorToHex(c: Color): string {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/** Convert hex to 0-1 Color. */
function hexToColor(hex: string): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b, a: 1 };
}

/** Find effect index by type. */
function findEffectIndex(effects: LayerEffect[], type: string): number {
  return effects.findIndex((e) => e.type === type);
}

function ensureTwoStops(stops: GradientOverlayEffect['stops']): GradientOverlayEffect['stops'] {
  if (stops.length >= 2) {
    return [...stops]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ ...s }));
  }
  if (stops.length === 1) {
    const only = stops[0];
    return [
      { position: 0, color: { ...only.color } },
      { position: 1, color: { ...only.color } },
    ];
  }
  return [
    { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
  ];
}

const DEFAULT_STROKE: StrokeEffect = {
  type: 'stroke',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  size: 2,
  position: 'outside',
  opacity: 1,
};

const DEFAULT_DROP_SHADOW: DropShadowEffect = {
  type: 'drop-shadow',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 0.75,
  angle: 135,
  distance: 5,
  blur: 5,
  spread: 0,
};

const DEFAULT_OUTER_GLOW: OuterGlowEffect = {
  type: 'outer-glow',
  enabled: true,
  color: { r: 1, g: 1, b: 0.5, a: 1 },
  opacity: 0.75,
  size: 10,
  spread: 0,
};

const DEFAULT_INNER_SHADOW: InnerShadowEffect = {
  type: 'inner-shadow',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 0.75,
  angle: 120,
  distance: 5,
  blur: 5,
  choke: 0,
};

const DEFAULT_INNER_GLOW: InnerGlowEffect = {
  type: 'inner-glow',
  enabled: true,
  color: { r: 1, g: 1, b: 0.5, a: 1 },
  opacity: 0.75,
  size: 10,
  choke: 0,
  source: 'edge',
};

const DEFAULT_GRADIENT_OVERLAY: GradientOverlayEffect = {
  type: 'gradient-overlay',
  enabled: true,
  opacity: 1,
  angle: 90,
  gradientType: 'linear',
  stops: [
    { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
  ],
  reverse: false,
  scale: 100,
};

const DEFAULT_BEVEL_EMBOSS: BevelEmbossEffect = {
  type: 'bevel-emboss',
  enabled: true,
  style: 'inner-bevel',
  depth: 100,
  direction: 'up',
  size: 5,
  soften: 0,
  angle: 120,
  altitude: 30,
  highlightColor: { r: 1, g: 1, b: 1, a: 1 },
  highlightOpacity: 0.75,
  shadowColor: { r: 0, g: 0, b: 0, a: 1 },
  shadowOpacity: 0.75,
};

const DEFAULT_COLOR_OVERLAY: ColorOverlayEffect = {
  type: 'color-overlay',
  enabled: true,
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
};

/** Stroke effect controls. */
function StrokeControls({
  effect,
  onChange,
}: {
  effect: StrokeEffect;
  onChange: (e: StrokeEffect) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.color')}</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.size')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="50"
          value={effect.size}
          onChange={(e): void => onChange({ ...effect, size: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.size}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.position')}</span>
        {(['inside', 'center', 'outside'] as StrokePosition[]).map((pos) => (
          <label key={pos} className="layer-style-dialog__radio-label">
            <input
              type="radio"
              name="stroke-position"
              checked={effect.position === pos}
              onChange={(): void => onChange({ ...effect, position: pos })}
            />
            {t(`layerStyle.position.${pos}`)}
          </label>
        ))}
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
    </>
  );
}

/** Drop shadow controls. */
function DropShadowControls({
  effect,
  onChange,
}: {
  effect: DropShadowEffect;
  onChange: (e: DropShadowEffect) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.color')}</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.angle')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="360"
          value={effect.angle}
          onChange={(e): void => onChange({ ...effect, angle: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.angle}&deg;</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.distance')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.distance}
          onChange={(e): void => onChange({ ...effect, distance: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.distance}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.blur')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="50"
          value={effect.blur}
          onChange={(e): void => onChange({ ...effect, blur: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.blur}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.spread')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.spread}
          onChange={(e): void => onChange({ ...effect, spread: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.spread}%</span>
      </div>
    </>
  );
}

/** Outer glow controls. */
function OuterGlowControls({
  effect,
  onChange,
}: {
  effect: OuterGlowEffect;
  onChange: (e: OuterGlowEffect) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.color')}</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.size')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="50"
          value={effect.size}
          onChange={(e): void => onChange({ ...effect, size: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.size}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.spread')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.spread}
          onChange={(e): void => onChange({ ...effect, spread: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.spread}%</span>
      </div>
    </>
  );
}

/** Inner shadow controls. */
function InnerShadowControls({
  effect,
  onChange,
}: {
  effect: InnerShadowEffect;
  onChange: (e: InnerShadowEffect) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.color')}</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.angle')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="360"
          value={effect.angle}
          onChange={(e): void => onChange({ ...effect, angle: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.angle}&deg;</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.distance')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.distance}
          onChange={(e): void => onChange({ ...effect, distance: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.distance}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.blur')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="50"
          value={effect.blur}
          onChange={(e): void => onChange({ ...effect, blur: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.blur}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.choke')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.choke}
          onChange={(e): void => onChange({ ...effect, choke: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.choke}%</span>
      </div>
    </>
  );
}

/** Inner glow controls. */
function InnerGlowControls({
  effect,
  onChange,
}: {
  effect: InnerGlowEffect;
  onChange: (e: InnerGlowEffect) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.color')}</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.size')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.size}
          onChange={(e): void => onChange({ ...effect, size: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.size}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.choke')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={effect.choke}
          onChange={(e): void => onChange({ ...effect, choke: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.choke}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.source')}</span>
        {(['edge', 'center'] as const).map((src) => (
          <label key={src} className="layer-style-dialog__radio-label">
            <input
              type="radio"
              name="inner-glow-source"
              checked={effect.source === src}
              onChange={(): void => onChange({ ...effect, source: src })}
            />
            {t(`layerStyle.source.${src}`)}
          </label>
        ))}
      </div>
    </>
  );
}

/** Gradient overlay controls. */
function GradientOverlayControls({
  effect,
  onChange,
}: {
  effect: GradientOverlayEffect;
  onChange: (e: GradientOverlayEffect) => void;
}): React.JSX.Element {
  const stops = ensureTwoStops(effect.stops);
  const startStop = stops[0];
  const endStop = stops[stops.length - 1];

  const onStartColorChange = (hex: string): void => {
    const next = [...stops];
    next[0] = { ...next[0], color: hexToColor(hex), position: 0 };
    onChange({ ...effect, stops: next });
  };

  const onEndColorChange = (hex: string): void => {
    const next = [...stops];
    next[next.length - 1] = { ...next[next.length - 1], color: hexToColor(hex), position: 1 };
    onChange({ ...effect, stops: next });
  };

  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.gradientType')}</span>
        {(['linear', 'radial'] as const).map((kind) => (
          <label key={kind} className="layer-style-dialog__radio-label">
            <input
              type="radio"
              name="gradient-overlay-type"
              checked={effect.gradientType === kind}
              onChange={(): void => onChange({ ...effect, gradientType: kind })}
            />
            {t(`layerStyle.gradientType.${kind}`)}
          </label>
        ))}
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.gradientStart')}</span>
        <input
          type="color"
          value={colorToHex(startStop.color)}
          onChange={(e): void => onStartColorChange(e.target.value)}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.gradientEnd')}</span>
        <input
          type="color"
          value={colorToHex(endStop.color)}
          onChange={(e): void => onEndColorChange(e.target.value)}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.angle')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="360"
          value={effect.angle}
          onChange={(e): void => onChange({ ...effect, angle: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.angle}&deg;</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.scale')}</span>
        <input
          type="range"
          className="effect-slider"
          min="10"
          max="150"
          value={effect.scale}
          onChange={(e): void => onChange({ ...effect, scale: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.scale}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.reverse')}</span>
        <label className="layer-style-dialog__radio-label">
          <input
            type="checkbox"
            checked={effect.reverse}
            onChange={(e): void => onChange({ ...effect, reverse: e.target.checked })}
          />
          {t('layerStyle.reverse')}
        </label>
      </div>
    </>
  );
}

/** Bevel & Emboss controls. */
function BevelEmbossControls({
  effect,
  onChange,
}: {
  effect: BevelEmbossEffect;
  onChange: (e: BevelEmbossEffect) => void;
}): React.JSX.Element {
  const styles: BevelStyle[] = [
    'outer-bevel',
    'inner-bevel',
    'emboss',
    'pillow-emboss',
    'stroke-emboss',
  ];

  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.style')}</span>
        <select
          value={effect.style}
          onChange={(e): void => onChange({ ...effect, style: e.target.value as BevelStyle })}
        >
          {styles.map((s) => (
            <option key={s} value={s}>{t(`layerStyle.style.${s}`)}</option>
          ))}
        </select>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.depth')}</span>
        <input
          type="range"
          className="effect-slider"
          min="1"
          max="1000"
          value={effect.depth}
          onChange={(e): void => onChange({ ...effect, depth: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.depth}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.direction')}</span>
        {(['up', 'down'] as BevelDirection[]).map((dir) => (
          <label key={dir} className="layer-style-dialog__radio-label">
            <input
              type="radio"
              name="bevel-direction"
              checked={effect.direction === dir}
              onChange={(): void => onChange({ ...effect, direction: dir })}
            />
            {t(`layerStyle.direction.${dir}`)}
          </label>
        ))}
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.size')}</span>
        <input
          type="range"
          className="effect-slider"
          min="1"
          max="100"
          value={effect.size}
          onChange={(e): void => onChange({ ...effect, size: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.size}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.soften')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="50"
          value={effect.soften}
          onChange={(e): void => onChange({ ...effect, soften: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.soften}px</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.angle')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="360"
          value={effect.angle}
          onChange={(e): void => onChange({ ...effect, angle: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.angle}&deg;</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.altitude')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="90"
          value={effect.altitude}
          onChange={(e): void => onChange({ ...effect, altitude: Number(e.target.value) })}
        />
        <span className="effect-slider-value">{effect.altitude}&deg;</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.highlightColor')}</span>
        <input
          type="color"
          value={colorToHex(effect.highlightColor)}
          onChange={(e): void => onChange({ ...effect, highlightColor: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.highlightOpacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.highlightOpacity * 100)}
          onChange={(e): void => onChange({ ...effect, highlightOpacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.highlightOpacity * 100)}%</span>
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.shadowColor')}</span>
        <input
          type="color"
          value={colorToHex(effect.shadowColor)}
          onChange={(e): void => onChange({ ...effect, shadowColor: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.shadowOpacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.shadowOpacity * 100)}
          onChange={(e): void => onChange({ ...effect, shadowOpacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.shadowOpacity * 100)}%</span>
      </div>
    </>
  );
}

/** Color overlay controls. */
function ColorOverlayControls({
  effect,
  onChange,
}: {
  effect: ColorOverlayEffect;
  onChange: (e: ColorOverlayEffect) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.color')}</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>{t('layerStyle.opacity')}</span>
        <input
          type="range"
          className="effect-slider"
          min="0"
          max="100"
          value={Math.round(effect.opacity * 100)}
          onChange={(e): void => onChange({ ...effect, opacity: Number(e.target.value) / 100 })}
        />
        <span className="effect-slider-value">{Math.round(effect.opacity * 100)}%</span>
      </div>
    </>
  );
}

/** Layer style dialog with 8 effect tabs. */
export function LayerStyleDialog(): React.JSX.Element | null {
  const layerStyleDialog = useAppStore((s) => s.layerStyleDialog);
  const document = useAppStore((s) => s.document);
  const revision = useAppStore((s) => s.revision);
  const closeLayerStyleDialog = useAppStore((s) => s.closeLayerStyleDialog);
  const addLayerEffect = useAppStore((s) => s.addLayerEffect);
  const updateLayerEffect = useAppStore((s) => s.updateLayerEffect);
  const removeLayerEffect = useAppStore((s) => s.removeLayerEffect);

  const [activeTab, setActiveTab] = useState<TabId>('stroke');

  void revision;

  const handleClose = useCallback((): void => {
    closeLayerStyleDialog();
  }, [closeLayerStyleDialog]);

  if (!layerStyleDialog || !document) return null;

  const layer = findLayerById(document.rootGroup, layerStyleDialog.layerId);
  if (!layer) return null;

  const layerId = layer.id;
  const effects = layer.effects;

  const strokeIdx = findEffectIndex(effects, 'stroke');
  const dropShadowIdx = findEffectIndex(effects, 'drop-shadow');
  const outerGlowIdx = findEffectIndex(effects, 'outer-glow');
  const colorOverlayIdx = findEffectIndex(effects, 'color-overlay');
  const innerShadowIdx = findEffectIndex(effects, 'inner-shadow');
  const innerGlowIdx = findEffectIndex(effects, 'inner-glow');
  const gradientOverlayIdx = findEffectIndex(effects, 'gradient-overlay');
  const bevelEmbossIdx = findEffectIndex(effects, 'bevel-emboss');

  const stroke = strokeIdx >= 0 ? (effects[strokeIdx] as StrokeEffect) : null;
  const dropShadow = dropShadowIdx >= 0 ? (effects[dropShadowIdx] as DropShadowEffect) : null;
  const outerGlow = outerGlowIdx >= 0 ? (effects[outerGlowIdx] as OuterGlowEffect) : null;
  const colorOverlay = colorOverlayIdx >= 0 ? (effects[colorOverlayIdx] as ColorOverlayEffect) : null;
  const innerShadow = innerShadowIdx >= 0 ? (effects[innerShadowIdx] as InnerShadowEffect) : null;
  const innerGlow = innerGlowIdx >= 0 ? (effects[innerGlowIdx] as InnerGlowEffect) : null;
  const gradientOverlay = gradientOverlayIdx >= 0 ? (effects[gradientOverlayIdx] as GradientOverlayEffect) : null;
  const bevelEmboss = bevelEmbossIdx >= 0 ? (effects[bevelEmbossIdx] as BevelEmbossEffect) : null;

  const handleToggleEffect = (type: TabId): void => {
    const idx = findEffectIndex(effects, type);
    if (idx >= 0) {
      removeLayerEffect(layerId, idx);
    } else {
      const defaults: Record<TabId, LayerEffect> = {
        stroke: { ...DEFAULT_STROKE },
        'drop-shadow': { ...DEFAULT_DROP_SHADOW },
        'outer-glow': { ...DEFAULT_OUTER_GLOW },
        'color-overlay': { ...DEFAULT_COLOR_OVERLAY },
        'inner-shadow': { ...DEFAULT_INNER_SHADOW },
        'inner-glow': { ...DEFAULT_INNER_GLOW },
        'gradient-overlay': { ...DEFAULT_GRADIENT_OVERLAY },
        'bevel-emboss': { ...DEFAULT_BEVEL_EMBOSS },
      };
      addLayerEffect(layerId, defaults[type]);
    }
  };

  const handleUpdateEffect = (idx: number, effect: LayerEffect): void => {
    updateLayerEffect(layerId, idx, effect);
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog layer-style-dialog" onClick={(e): void => e.stopPropagation()}>
        <div className="dialog-header">{t('layerStyle.title')}</div>

        <div className="layer-style-dialog__tabs">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              className={`layer-style-dialog__tab ${activeTab === tab ? 'layer-style-dialog__tab--active' : ''}`}
              onClick={(): void => setActiveTab(tab)}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </button>
          ))}
        </div>

        <div className="dialog-body layer-style-dialog__content">
          <label className="layer-style-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={findEffectIndex(effects, activeTab) >= 0}
              onChange={(): void => handleToggleEffect(activeTab)}
            />
            {t(ENABLE_LABEL_KEYS[activeTab])}
          </label>

          {activeTab === 'stroke' && stroke && (
            <StrokeControls
              effect={stroke}
              onChange={(e): void => handleUpdateEffect(strokeIdx, e)}
            />
          )}

          {activeTab === 'drop-shadow' && dropShadow && (
            <DropShadowControls
              effect={dropShadow}
              onChange={(e): void => handleUpdateEffect(dropShadowIdx, e)}
            />
          )}

          {activeTab === 'outer-glow' && outerGlow && (
            <OuterGlowControls
              effect={outerGlow}
              onChange={(e): void => handleUpdateEffect(outerGlowIdx, e)}
            />
          )}

          {activeTab === 'color-overlay' && colorOverlay && (
            <ColorOverlayControls
              effect={colorOverlay}
              onChange={(e): void => handleUpdateEffect(colorOverlayIdx, e)}
            />
          )}

          {activeTab === 'inner-shadow' && innerShadow && (
            <InnerShadowControls
              effect={innerShadow}
              onChange={(e): void => handleUpdateEffect(innerShadowIdx, e)}
            />
          )}

          {activeTab === 'inner-glow' && innerGlow && (
            <InnerGlowControls
              effect={innerGlow}
              onChange={(e): void => handleUpdateEffect(innerGlowIdx, e)}
            />
          )}

          {activeTab === 'gradient-overlay' && gradientOverlay && (
            <GradientOverlayControls
              effect={gradientOverlay}
              onChange={(e): void => handleUpdateEffect(gradientOverlayIdx, e)}
            />
          )}

          {activeTab === 'bevel-emboss' && bevelEmboss && (
            <BevelEmbossControls
              effect={bevelEmboss}
              onChange={(e): void => handleUpdateEffect(bevelEmbossIdx, e)}
            />
          )}

          {findEffectIndex(effects, activeTab) < 0 && (
            <div className="layer-style-dialog__empty">
              {t('layerStyle.empty')}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={handleClose}>
            {t('common.cancel')}
          </button>
          <button className="dialog-btn dialog-btn--primary" onClick={handleClose}>
            {t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
