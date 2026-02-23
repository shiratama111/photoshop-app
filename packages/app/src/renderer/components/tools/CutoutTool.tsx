/**
 * @module CutoutTool
 * AI cutout tool component — options panel + canvas interaction handler.
 *
 * Features:
 * - Point prompt mode: click canvas to add positive/negative points
 * - Brush mode: paint to refine the mask
 * - Boundary adjustment and feather sliders
 * - Apply mask / Cut to new layer actions
 * - Integrates with MaskOverlay for visualization
 *
 * Uses a separate cutout-store for state management.
 *
 * @see APP-006: AI cutout UI
 */

import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store';
import { useCutoutStore } from './cutout-store';
import type { PointPrompt } from '@photoshop-app/types';
import { MaskOverlay } from '../overlays/MaskOverlay';
import {
  paintBrush,
  paintBrushLine,
  adjustBoundary,
  featherMask,
} from './mask-refinement';
import './cutout.css';

/** Interaction mode for the cutout tool. */
type InteractionMode = 'prompt' | 'brush';

/** CutoutTool provides the floating options panel and canvas interaction. */
export function CutoutTool(): React.JSX.Element | null {
  const doc = useAppStore((s) => s.document);
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);

  const cutout = useCutoutStore((s) => s.cutout);
  const cancelCutout = useCutoutStore((s) => s.cancelCutout);
  const addCutoutPrompt = useCutoutStore((s) => s.addCutoutPrompt);
  const setCutoutMask = useCutoutStore((s) => s.setCutoutMask);
  const setCutoutProcessing = useCutoutStore((s) => s.setCutoutProcessing);
  const setCutoutBrushMode = useCutoutStore((s) => s.setCutoutBrushMode);
  const setCutoutBrushSize = useCutoutStore((s) => s.setCutoutBrushSize);
  const setCutoutBoundaryAdjust = useCutoutStore((s) => s.setCutoutBoundaryAdjust);
  const setCutoutFeatherRadius = useCutoutStore((s) => s.setCutoutFeatherRadius);
  const updateCutoutMaskData = useCutoutStore((s) => s.updateCutoutMaskData);
  const applyCutoutAsMask = useCutoutStore((s) => s.applyCutoutAsMask);
  const cutToNewLayer = useCutoutStore((s) => s.cutToNewLayer);

  const [mode, setMode] = useState<InteractionMode>('prompt');
  const [lastBrushPos, setLastBrushPos] = useState<{ x: number; y: number } | null>(null);

  if (!cutout || !doc) return null;

  const canvasSize = doc.canvas.size;

  /** Convert screen coordinates to canvas coordinates. */
  const screenToCanvas = (screenX: number, screenY: number): { x: number; y: number } => ({
    x: Math.round((screenX - panOffset.x) / zoom),
    y: Math.round((screenY - panOffset.y) / zoom),
  });

  /** Handle canvas click for point prompts. */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (mode !== 'prompt') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);

      // Out of bounds check
      if (pos.x < 0 || pos.x >= canvasSize.width || pos.y < 0 || pos.y >= canvasSize.height) {
        return;
      }

      const label = e.button === 2 || e.altKey ? 'negative' : 'positive';
      const prompt: PointPrompt = { position: pos, label };
      addCutoutPrompt(prompt);

      // Run AI inference
      void runInference([...cutout.prompts, prompt]);
    },
    [mode, canvasSize, cutout?.prompts, zoom, panOffset],
  );

  /** Handle brush mouse down. */
  const handleBrushDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (mode !== 'brush' || !cutout.currentMask) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
      const value = cutout.brushMode === 'add' ? 255 : 0;
      const newData = new Uint8Array(cutout.currentMask.data);
      paintBrush(newData, cutout.currentMask.size, pos.x, pos.y, cutout.brushSize, value as 0 | 255);
      updateCutoutMaskData(newData);
      setLastBrushPos(pos);
    },
    [mode, cutout?.currentMask, cutout?.brushMode, cutout?.brushSize, zoom, panOffset],
  );

  /** Handle brush mouse move (drag). */
  const handleBrushMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (mode !== 'brush' || !cutout.currentMask || !lastBrushPos || e.buttons !== 1) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
      const value = cutout.brushMode === 'add' ? 255 : 0;
      const newData = new Uint8Array(cutout.currentMask.data);
      paintBrushLine(
        newData, cutout.currentMask.size,
        lastBrushPos.x, lastBrushPos.y,
        pos.x, pos.y,
        cutout.brushSize, value as 0 | 255,
      );
      updateCutoutMaskData(newData);
      setLastBrushPos(pos);
    },
    [mode, cutout?.currentMask, cutout?.brushMode, cutout?.brushSize, lastBrushPos, zoom, panOffset],
  );

  /** Handle brush mouse up. */
  const handleBrushUp = useCallback((): void => {
    setLastBrushPos(null);
  }, []);

  /** Run AI segmentation inference with the given prompts. */
  async function runInference(prompts: PointPrompt[]): Promise<void> {
    setCutoutProcessing(true);
    try {
      const ai = await import('@photoshop-app/ai');
      const provider = ai.createSegmentationProvider({ runtime: 'onnx' });
      await provider.initialize();

      // Render the document to an offscreen canvas for inference
      const exportCanvas = window.document.createElement('canvas');
      exportCanvas.width = canvasSize.width;
      exportCanvas.height = canvasSize.height;
      useAppStore.getState().renderToCanvas(exportCanvas);

      const ctx = exportCanvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
      await provider.setImage(imageData);
      const mask = await provider.segment(prompts);

      // Apply boundary adjustment and feathering
      const currentCutout = useCutoutStore.getState().cutout;
      let finalData = mask.data;
      if (currentCutout && currentCutout.boundaryAdjust !== 0) {
        finalData = adjustBoundary(finalData, mask.size, currentCutout.boundaryAdjust);
      }
      if (currentCutout && currentCutout.featherRadius > 0) {
        finalData = featherMask(finalData, mask.size, currentCutout.featherRadius);
      }

      setCutoutMask({ ...mask, data: finalData });
    } catch {
      setCutoutProcessing(false);
      useAppStore.getState().setStatusMessage('AI inference failed');
    }
  }

  /** Handle boundary adjustment change. */
  const handleBoundaryChange = (value: number): void => {
    setCutoutBoundaryAdjust(value);
    // Re-apply boundary + feather to original mask if available
    if (cutout.currentMask) {
      let data = cutout.currentMask.data;
      if (value !== 0) {
        data = adjustBoundary(data, cutout.currentMask.size, value);
      }
      if (cutout.featherRadius > 0) {
        data = featherMask(data, cutout.currentMask.size, cutout.featherRadius);
      }
      updateCutoutMaskData(data);
    }
  };

  /** Handle feather radius change. */
  const handleFeatherChange = (value: number): void => {
    setCutoutFeatherRadius(value);
    if (cutout.currentMask) {
      let data = cutout.currentMask.data;
      if (cutout.boundaryAdjust !== 0) {
        data = adjustBoundary(data, cutout.currentMask.size, cutout.boundaryAdjust);
      }
      if (value > 0) {
        data = featherMask(data, cutout.currentMask.size, value);
      }
      updateCutoutMaskData(data);
    }
  };

  const hasMask = cutout.currentMask !== null;

  return (
    <>
      {/* Mask overlay on canvas */}
      <MaskOverlay
        mask={cutout.currentMask}
        prompts={cutout.prompts}
        canvasSize={canvasSize}
        zoom={zoom}
        panOffset={panOffset}
        brushActive={mode === 'brush'}
        brushSize={cutout.brushSize}
        onClick={handleCanvasClick}
        onMouseDown={handleBrushDown}
        onBrushMove={handleBrushMove}
        onMouseUp={handleBrushUp}
      />

      {/* Options panel */}
      <div className="cutout-tool-panel">
        <div className="cutout-tool-header">
          <span>AI Cutout</span>
          <button
            className="cutout-tool-close"
            onClick={cancelCutout}
            title="Cancel (Esc)"
          >
            x
          </button>
        </div>

        {/* Mode toggle */}
        <div className="cutout-tool-section">
          <span className="cutout-tool-label">Mode</span>
          <div className="cutout-tool-toggle">
            <button
              className={`cutout-toggle-btn ${mode === 'prompt' ? 'cutout-toggle-btn--active' : ''}`}
              onClick={(): void => setMode('prompt')}
            >
              Prompt
            </button>
            <button
              className={`cutout-toggle-btn ${mode === 'brush' ? 'cutout-toggle-btn--active' : ''}`}
              onClick={(): void => setMode('brush')}
              disabled={!hasMask}
            >
              Brush
            </button>
          </div>

          {mode === 'prompt' && (
            <div className="cutout-tool-toggle">
              <button
                className={`cutout-toggle-btn ${cutout.brushMode === 'add' ? 'cutout-toggle-btn--active' : ''}`}
                onClick={(): void => setCutoutBrushMode('add')}
              >
                + Positive
              </button>
              <button
                className={`cutout-toggle-btn ${cutout.brushMode === 'remove' ? 'cutout-toggle-btn--active' : ''}`}
                onClick={(): void => setCutoutBrushMode('remove')}
              >
                - Negative
              </button>
            </div>
          )}
        </div>

        {/* Brush size (shown in brush mode) */}
        {mode === 'brush' && (
          <div className="cutout-tool-section">
            <span className="cutout-tool-label">Brush Size</span>
            <input
              type="range"
              className="cutout-tool-slider"
              min={1}
              max={200}
              value={cutout.brushSize}
              onChange={(e): void => setCutoutBrushSize(Number(e.target.value))}
            />
            <span className="cutout-tool-value">{cutout.brushSize}px</span>
          </div>
        )}

        {/* Boundary adjustment */}
        <div className="cutout-tool-section">
          <span className="cutout-tool-label">Boundary</span>
          <input
            type="range"
            className="cutout-tool-slider"
            min={-100}
            max={100}
            value={cutout.boundaryAdjust}
            onChange={(e): void => handleBoundaryChange(Number(e.target.value))}
            disabled={!hasMask}
          />
          <span className="cutout-tool-value">{cutout.boundaryAdjust}px</span>
        </div>

        {/* Feather */}
        <div className="cutout-tool-section">
          <span className="cutout-tool-label">Feather</span>
          <input
            type="range"
            className="cutout-tool-slider"
            min={0}
            max={50}
            value={cutout.featherRadius}
            onChange={(e): void => handleFeatherChange(Number(e.target.value))}
            disabled={!hasMask}
          />
          <span className="cutout-tool-value">{cutout.featherRadius}px</span>
        </div>

        {/* Status */}
        {cutout.isProcessing && (
          <div className="cutout-processing">Processing...</div>
        )}
        {hasMask && !cutout.isProcessing && (
          <div className="cutout-confidence">
            Confidence: {Math.round(cutout.confidence * 100)}%
          </div>
        )}

        {/* Actions */}
        <div className="cutout-tool-actions">
          <button
            className="cutout-action-btn cutout-action-btn--primary"
            onClick={applyCutoutAsMask}
            disabled={!hasMask}
          >
            Apply Mask
          </button>
          <button
            className="cutout-action-btn"
            onClick={cutToNewLayer}
            disabled={!hasMask}
          >
            Cut to New Layer
          </button>
          <button
            className="cutout-action-btn"
            onClick={cancelCutout}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
