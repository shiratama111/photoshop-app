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
  Color,
  LayerEffect,
  StrokeEffect,
  DropShadowEffect,
  OuterGlowEffect,
  StrokePosition,
} from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';

type TabId = 'stroke' | 'drop-shadow' | 'outer-glow';

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
        <span>Color</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>Size</span>
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
        <span>Position</span>
        {(['inside', 'center', 'outside'] as StrokePosition[]).map((pos) => (
          <label key={pos} className="layer-style-dialog__radio-label">
            <input
              type="radio"
              name="stroke-position"
              checked={effect.position === pos}
              onChange={(): void => onChange({ ...effect, position: pos })}
            />
            {pos}
          </label>
        ))}
      </div>
      <div className="layer-style-dialog__row">
        <span>Opacity</span>
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
        <span>Color</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>Opacity</span>
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
        <span>Angle</span>
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
        <span>Distance</span>
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
        <span>Blur</span>
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
        <span>Spread</span>
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
        <span>Color</span>
        <input
          type="color"
          value={colorToHex(effect.color)}
          onChange={(e): void => onChange({ ...effect, color: hexToColor(e.target.value) })}
        />
      </div>
      <div className="layer-style-dialog__row">
        <span>Opacity</span>
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
        <span>Size</span>
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
        <span>Spread</span>
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

/** Layer style dialog — modal with Stroke/DropShadow/OuterGlow tabs. */
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

  const stroke = strokeIdx >= 0 ? (effects[strokeIdx] as StrokeEffect) : null;
  const dropShadow = dropShadowIdx >= 0 ? (effects[dropShadowIdx] as DropShadowEffect) : null;
  const outerGlow = outerGlowIdx >= 0 ? (effects[outerGlowIdx] as OuterGlowEffect) : null;

  const handleToggleEffect = (type: TabId): void => {
    const idx = findEffectIndex(effects, type);
    if (idx >= 0) {
      removeLayerEffect(layerId, idx);
    } else {
      const defaults: Record<TabId, LayerEffect> = {
        stroke: { ...DEFAULT_STROKE },
        'drop-shadow': { ...DEFAULT_DROP_SHADOW },
        'outer-glow': { ...DEFAULT_OUTER_GLOW },
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
        <div className="dialog-header">Layer Style</div>

        <div className="layer-style-dialog__tabs">
          {(['stroke', 'drop-shadow', 'outer-glow'] as TabId[]).map((tab) => (
            <button
              key={tab}
              className={`layer-style-dialog__tab ${activeTab === tab ? 'layer-style-dialog__tab--active' : ''}`}
              onClick={(): void => setActiveTab(tab)}
            >
              {tab === 'stroke' ? 'Stroke' : tab === 'drop-shadow' ? 'Drop Shadow' : 'Outer Glow'}
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
            Enable {activeTab === 'stroke' ? 'Stroke' : activeTab === 'drop-shadow' ? 'Drop Shadow' : 'Outer Glow'}
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

          {findEffectIndex(effects, activeTab) < 0 && (
            <div className="layer-style-dialog__empty">
              Enable to configure.
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={handleClose}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn--primary" onClick={handleClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
