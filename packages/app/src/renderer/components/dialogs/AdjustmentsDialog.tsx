import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import {
  brightness,
  contrast,
  hueSaturation,
  levels,
  curves,
  colorBalance,
} from '@photoshop-app/core';

export const AdjustmentsDialog: React.FC = () => {
  const adjustmentDialog = useAppStore((state) => state.adjustmentDialog);
  const closeAdjustmentDialog = useAppStore((state) => state.closeAdjustmentDialog);
  const applyFilter = useAppStore((state) => state.applyFilter);

  // Brightness-Contrast state
  const [brightnessValue, setBrightnessValue] = useState(0);
  const [contrastValue, setContrastValue] = useState(0);

  // Hue-Saturation state
  const [hueValue, setHueValue] = useState(0);
  const [saturationValue, setSaturationValue] = useState(0);
  const [lightnessValue, setLightnessValue] = useState(0);

  // Levels state
  const [inputBlack, setInputBlack] = useState(0);
  const [inputWhite, setInputWhite] = useState(255);
  const [gamma, setGamma] = useState(1.0);
  const [outputBlack, setOutputBlack] = useState(0);
  const [outputWhite, setOutputWhite] = useState(255);

  // Curves state
  const [curvePreset, setCurvePreset] = useState('default');

  // Color Balance state
  const [shadowsValue, setShadowsValue] = useState(0);
  const [midtonesValue, setMidtonesValue] = useState(0);
  const [highlightsValue, setHighlightsValue] = useState(0);

  // Reset state when dialog type changes
  useEffect(() => {
    if (adjustmentDialog) {
      setBrightnessValue(0);
      setContrastValue(0);
      setHueValue(0);
      setSaturationValue(0);
      setLightnessValue(0);
      setInputBlack(0);
      setInputWhite(255);
      setGamma(1.0);
      setOutputBlack(0);
      setOutputWhite(255);
      setCurvePreset('default');
      setShadowsValue(0);
      setMidtonesValue(0);
      setHighlightsValue(0);
    }
  }, [adjustmentDialog?.type]);

  if (!adjustmentDialog) {
    return null;
  }

  const handleApply = () => {
    switch (adjustmentDialog.type) {
      case 'brightness-contrast':
        applyFilter((imageData) => {
          let result = brightness(imageData, brightnessValue);
          result = contrast(result, contrastValue);
          return result;
        });
        break;

      case 'hue-saturation':
        applyFilter((imageData) =>
          hueSaturation(imageData, hueValue, saturationValue, lightnessValue)
        );
        break;

      case 'levels':
        applyFilter((imageData) =>
          levels(imageData, inputBlack, inputWhite, gamma, outputBlack, outputWhite)
        );
        break;

      case 'curves': {
        const curvePoints = getCurvePoints(curvePreset);
        applyFilter((imageData) => curves(imageData, curvePoints));
        break;
      }

      case 'color-balance':
        applyFilter((imageData) =>
          colorBalance(
            imageData,
            [shadowsValue, shadowsValue, shadowsValue],
            [midtonesValue, midtonesValue, midtonesValue],
            [highlightsValue, highlightsValue, highlightsValue],
          )
        );
        break;
    }
    closeAdjustmentDialog();
  };

  const handleCancel = () => {
    closeAdjustmentDialog();
  };

  const getCurvePoints = (preset: string): Array<{ x: number; y: number }> => {
    switch (preset) {
      case 'increase-contrast':
        return [
          { x: 0, y: 0 },
          { x: 64, y: 51 },
          { x: 128, y: 128 },
          { x: 191, y: 204 },
          { x: 255, y: 255 },
        ];
      case 'lighter':
        return [
          { x: 0, y: 26 },
          { x: 128, y: 153 },
          { x: 255, y: 255 },
        ];
      case 'darker':
        return [
          { x: 0, y: 0 },
          { x: 128, y: 102 },
          { x: 255, y: 230 },
        ];
      case 'linear':
      case 'default':
      default:
        return [
          { x: 0, y: 0 },
          { x: 255, y: 255 },
        ];
    }
  };

  const renderControls = () => {
    switch (adjustmentDialog.type) {
      case 'brightness-contrast':
        return (
          <>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Brightness:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={brightnessValue}
                onChange={(e) => setBrightnessValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{brightnessValue}</span>
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Contrast:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={contrastValue}
                onChange={(e) => setContrastValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{contrastValue}</span>
            </div>
          </>
        );

      case 'hue-saturation':
        return (
          <>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Hue:</label>
              <input
                type="range"
                className="effect-slider"
                min="-180"
                max="180"
                value={hueValue}
                onChange={(e) => setHueValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{hueValue}</span>
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Saturation:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={saturationValue}
                onChange={(e) => setSaturationValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{saturationValue}</span>
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Lightness:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={lightnessValue}
                onChange={(e) => setLightnessValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{lightnessValue}</span>
            </div>
          </>
        );

      case 'levels':
        return (
          <>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Input Black:</label>
              <input
                type="number"
                className="effect-slider-value"
                min="0"
                max="255"
                value={inputBlack}
                onChange={(e) => setInputBlack(Number(e.target.value))}
              />
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Input White:</label>
              <input
                type="number"
                className="effect-slider-value"
                min="0"
                max="255"
                value={inputWhite}
                onChange={(e) => setInputWhite(Number(e.target.value))}
              />
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Gamma:</label>
              <input
                type="number"
                className="effect-slider-value"
                min="0.1"
                max="9.9"
                step="0.1"
                value={gamma}
                onChange={(e) => setGamma(Number(e.target.value))}
              />
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Output Black:</label>
              <input
                type="number"
                className="effect-slider-value"
                min="0"
                max="255"
                value={outputBlack}
                onChange={(e) => setOutputBlack(Number(e.target.value))}
              />
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Output White:</label>
              <input
                type="number"
                className="effect-slider-value"
                min="0"
                max="255"
                value={outputWhite}
                onChange={(e) => setOutputWhite(Number(e.target.value))}
              />
            </div>
          </>
        );

      case 'curves':
        return (
          <div className="layer-style-dialog__row">
            <label className="layer-style-dialog__label">Preset:</label>
            <select
              className="effect-slider-value"
              value={curvePreset}
              onChange={(e) => setCurvePreset(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="increase-contrast">Increase Contrast</option>
              <option value="lighter">Lighter</option>
              <option value="darker">Darker</option>
              <option value="linear">Linear</option>
            </select>
          </div>
        );

      case 'color-balance':
        return (
          <>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Shadows:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={shadowsValue}
                onChange={(e) => setShadowsValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{shadowsValue}</span>
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Midtones:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={midtonesValue}
                onChange={(e) => setMidtonesValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{midtonesValue}</span>
            </div>
            <div className="layer-style-dialog__row">
              <label className="layer-style-dialog__label">Highlights:</label>
              <input
                type="range"
                className="effect-slider"
                min="-100"
                max="100"
                value={highlightsValue}
                onChange={(e) => setHighlightsValue(Number(e.target.value))}
              />
              <span className="effect-slider-value">{highlightsValue}</span>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getDialogTitle = () => {
    switch (adjustmentDialog.type) {
      case 'brightness-contrast':
        return 'Brightness/Contrast';
      case 'hue-saturation':
        return 'Hue/Saturation';
      case 'levels':
        return 'Levels';
      case 'curves':
        return 'Curves';
      case 'color-balance':
        return 'Color Balance';
      default:
        return 'Adjustments';
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <h3>{getDialogTitle()}</h3>
        </div>
        <div className="dialog-body">{renderControls()}</div>
        <div className="dialog-footer">
          <button className="dialog-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn--primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
