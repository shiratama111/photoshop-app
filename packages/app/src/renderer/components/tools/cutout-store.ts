/**
 * @module cutout-store
 * Standalone Zustand store for AI cutout tool state.
 *
 * Separated from the main store to maintain clean file ownership.
 * Interacts with the main store for document/layer operations.
 *
 * @see APP-006: AI cutout UI
 */

import { create } from 'zustand';
import type {
  Command,
  LayerMask,
  Mask,
  PointPrompt,
  RasterLayer,
} from '@photoshop-app/types';
import {
  createRasterLayer,
  findLayerById,
  AddLayerCommand,
} from '@photoshop-app/core';
import { useAppStore } from '../../store';
import { t } from '../../i18n';

/** Brush mode for cutout refinement. */
export type CutoutBrushMode = 'add' | 'remove';

/** AI cutout session state. */
export interface CutoutState {
  /** Point prompts placed on the canvas. */
  prompts: PointPrompt[];
  /** Current segmentation mask result, or null if not yet computed. */
  currentMask: Mask | null;
  /** Whether the mask brush adds or removes foreground. */
  brushMode: CutoutBrushMode;
  /** Brush radius in pixels. */
  brushSize: number;
  /** Boundary adjustment in pixels (-100..100). Positive = dilate, negative = erode. */
  boundaryAdjust: number;
  /** Feather radius in pixels (0..50). */
  featherRadius: number;
  /** Whether AI inference is currently running. */
  isProcessing: boolean;
  /** Confidence score of the current mask (0..1). */
  confidence: number;
}

/** Cutout store state shape. */
interface CutoutStoreState {
  /** Current cutout session, or null if not active. */
  cutout: CutoutState | null;
}

/** Cutout store actions. */
interface CutoutStoreActions {
  /** Start a cutout session for the selected layer. */
  startCutout: () => void;
  /** Cancel the current cutout session. */
  cancelCutout: () => void;
  /** Add a point prompt (positive or negative). */
  addCutoutPrompt: (prompt: PointPrompt) => void;
  /** Set the current mask result from AI inference. */
  setCutoutMask: (mask: Mask) => void;
  /** Set the processing flag. */
  setCutoutProcessing: (processing: boolean) => void;
  /** Set the brush mode (add/remove). */
  setCutoutBrushMode: (mode: CutoutBrushMode) => void;
  /** Set the brush size. */
  setCutoutBrushSize: (size: number) => void;
  /** Set the boundary adjustment value. */
  setCutoutBoundaryAdjust: (value: number) => void;
  /** Set the feather radius. */
  setCutoutFeatherRadius: (radius: number) => void;
  /** Replace the mask data (after brush refinement). */
  updateCutoutMaskData: (data: Uint8Array) => void;
  /** Apply the current cutout mask to the selected layer. */
  applyCutoutAsMask: () => void;
  /** Cut the masked region to a new layer. */
  cutToNewLayer: () => void;
}

/** Zustand store for cutout tool state. */
export const useCutoutStore = create<CutoutStoreState & CutoutStoreActions>((set, get) => ({
  cutout: null,

  startCutout: (): void => {
    const { document: doc, selectedLayerId } = useAppStore.getState();
    if (!doc) {
      useAppStore.getState().setActiveTool('select');
      return;
    }
    if (!selectedLayerId) {
      useAppStore.getState().setActiveTool('select');
      useAppStore.getState().setStatusMessage(t('status.cutoutSelectLayerFirst'));
      return;
    }
    set({
      cutout: {
        prompts: [],
        currentMask: null,
        brushMode: 'add',
        brushSize: 20,
        boundaryAdjust: 0,
        featherRadius: 0,
        isProcessing: false,
        confidence: 0,
      },
    });
    useAppStore.getState().setActiveTool('segment');
    useAppStore.getState().setStatusMessage(t('status.cutoutStarted'));
  },

  cancelCutout: (): void => {
    set({ cutout: null });
    useAppStore.getState().setActiveTool('select');
    useAppStore.getState().setStatusMessage(t('status.ready'));
  },

  addCutoutPrompt: (prompt): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({
      cutout: {
        ...cutout,
        prompts: [...cutout.prompts, prompt],
        isProcessing: true,
      },
    });
  },

  setCutoutMask: (mask): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({
      cutout: {
        ...cutout,
        currentMask: mask,
        isProcessing: false,
        confidence: mask.confidence,
      },
    });
  },

  setCutoutProcessing: (processing): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({ cutout: { ...cutout, isProcessing: processing } });
  },

  setCutoutBrushMode: (mode): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({ cutout: { ...cutout, brushMode: mode } });
  },

  setCutoutBrushSize: (size): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({ cutout: { ...cutout, brushSize: Math.max(1, Math.min(200, size)) } });
  },

  setCutoutBoundaryAdjust: (value): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({ cutout: { ...cutout, boundaryAdjust: Math.max(-100, Math.min(100, value)) } });
  },

  setCutoutFeatherRadius: (radius): void => {
    const { cutout } = get();
    if (!cutout) return;
    set({ cutout: { ...cutout, featherRadius: Math.max(0, Math.min(50, radius)) } });
  },

  updateCutoutMaskData: (data): void => {
    const { cutout } = get();
    if (!cutout || !cutout.currentMask) return;
    set({
      cutout: {
        ...cutout,
        currentMask: { ...cutout.currentMask, data },
      },
    });
  },

  applyCutoutAsMask: (): void => {
    const { cutout } = get();
    const { document: doc, selectedLayerId } = useAppStore.getState();
    if (!doc || !selectedLayerId || !cutout || !cutout.currentMask) return;
    const layer = findLayerById(doc.rootGroup, selectedLayerId);
    if (!layer) return;

    const mask = cutout.currentMask;
    const prevMask = layer.mask;
    const newMask: LayerMask = {
      data: new Uint8Array(mask.data),
      width: mask.size.width,
      height: mask.size.height,
      offset: { x: 0, y: 0 },
      enabled: true,
    };

    const cmd: Command = {
      description: `Apply cutout mask to ${layer.name}`,
      execute: (): void => { layer.mask = newMask; },
      undo: (): void => { layer.mask = prevMask; },
    };
    cmd.execute();
    doc.dirty = true;
    set({ cutout: null });
    useAppStore.getState().setActiveTool('select');
    useAppStore.setState({ revision: useAppStore.getState().revision + 1 });
    useAppStore.getState().setStatusMessage(`${t('status.cutoutApplied')}: ${layer.name}`);
  },

  cutToNewLayer: (): void => {
    const { cutout } = get();
    const { document: doc, selectedLayerId } = useAppStore.getState();
    if (!doc || !selectedLayerId || !cutout || !cutout.currentMask) return;
    const layer = findLayerById(doc.rootGroup, selectedLayerId);
    if (!layer || layer.type !== 'raster') {
      useAppStore.getState().setStatusMessage(t('status.cutoutSelectRasterToCut'));
      return;
    }

    const newLayer = createRasterLayer(
      `${layer.name} cutout`,
      doc.canvas.size.width,
      doc.canvas.size.height,
    );
    const mask = cutout.currentMask;
    newLayer.mask = {
      data: new Uint8Array(mask.data),
      width: mask.size.width,
      height: mask.size.height,
      offset: { x: 0, y: 0 },
      enabled: true,
    };

    const raster = layer as RasterLayer;
    if (raster.imageData) {
      newLayer.imageData = new ImageData(
        new Uint8ClampedArray(raster.imageData.data),
        raster.imageData.width,
        raster.imageData.height,
      );
    }

    const cmd = new AddLayerCommand(doc.rootGroup, newLayer);
    cmd.execute();
    doc.dirty = true;
    set({ cutout: null });
    useAppStore.getState().setActiveTool('select');
    useAppStore.setState({
      selectedLayerId: newLayer.id,
      revision: useAppStore.getState().revision + 1,
    });
    useAppStore.getState().setStatusMessage(`${t('status.cutoutCutToNewLayer')}: ${newLayer.name}`);
  },
}));
