/**
 * @module scenarios
 * Benchmark scenario definitions for rendering performance measurement.
 *
 * Defines four scenarios (A-D) with varying complexity to establish
 * performance baselines and detect regressions.
 *
 * @see PERF-001: Performance Benchmark Ticket
 * @see {@link @photoshop-app/render!Canvas2DRenderer}
 */

import type {
  Document,
  DropShadowEffect,
  LayerEffect,
  LayerGroup,
  OuterGlowEffect,
  RasterLayer,
  RenderOptions,
  StrokeEffect,
  TextLayer,
  Viewport,
} from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import type { CanvasLike, CanvasContext2DLike } from '../src/canvas-pool';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Describes a single benchmark scenario. */
export interface BenchmarkScenario {
  /** Short identifier (e.g. "A", "B"). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** The Document to render. */
  document: Document;
  /** RenderOptions to pass to the renderer. */
  renderOptions: RenderOptions;
  /** Target render time in milliseconds (null = no target). */
  targetMs: number | null;
}

// ---------------------------------------------------------------------------
// Helpers: unique IDs
// ---------------------------------------------------------------------------

let idCounter = 0;

/** Generate a simple sequential ID for benchmark layers. */
function benchId(): string {
  return `bench-${++idCounter}`;
}

// ---------------------------------------------------------------------------
// Helpers: effect factories
// ---------------------------------------------------------------------------

/** Create a drop-shadow effect with sensible defaults. */
function makeDropShadow(): DropShadowEffect {
  return {
    type: 'drop-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 0.5,
    angle: 135,
    distance: 4,
    blur: 6,
    spread: 0,
  };
}

/** Create a stroke effect with sensible defaults. */
function makeStroke(): StrokeEffect {
  return {
    type: 'stroke',
    enabled: true,
    color: { r: 255, g: 0, b: 0, a: 1 },
    size: 2,
    position: 'outside',
    opacity: 1,
  };
}

/** Create an outer-glow effect with sensible defaults. */
function makeOuterGlow(): OuterGlowEffect {
  return {
    type: 'outer-glow',
    enabled: true,
    color: { r: 255, g: 255, b: 0, a: 1 },
    opacity: 0.6,
    size: 8,
    spread: 20,
  };
}

// ---------------------------------------------------------------------------
// Helpers: layer factories (benchmark-specific, no core dependency)
// ---------------------------------------------------------------------------

/**
 * Create a raster layer with filled pixel data.
 * Uses a simple RGBA fill to simulate real pixel content.
 */
function makeRasterLayer(
  name: string,
  width: number,
  height: number,
  effects: LayerEffect[] = [],
): RasterLayer {
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill with a semi-transparent blue to simulate real content
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 60;      // R
    data[i + 1] = 120;  // G
    data[i + 2] = 200;  // B
    data[i + 3] = 200;  // A
  }
  const imageData = new ImageData(data, width, height);

  return {
    id: benchId(),
    name,
    type: 'raster',
    visible: true,
    opacity: 0.8,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects,
    parentId: null,
    imageData,
    bounds: { x: 0, y: 0, width, height },
  };
}

/** Create a text layer with the given content and effects. */
function makeTextLayer(
  name: string,
  text: string,
  effects: LayerEffect[] = [],
): TextLayer {
  return {
    id: benchId(),
    name,
    type: 'text',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 40, y: 40 },
    locked: false,
    effects,
    parentId: null,
    text,
    fontFamily: 'Arial',
    fontSize: 32,
    color: { r: 255, g: 255, b: 255, a: 1 },
    bold: true,
    italic: false,
    alignment: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
    textBounds: null,
    writingMode: 'horizontal-tb',
    underline: false,
    strikethrough: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers: document & options
// ---------------------------------------------------------------------------

/** Build a Document with the given root children and canvas size. */
function makeDocument(
  width: number,
  height: number,
  children: Array<RasterLayer | TextLayer | LayerGroup>,
): Document {
  const rootId = benchId();
  return {
    id: benchId(),
    name: 'Benchmark',
    canvas: { size: { width, height }, dpi: 72, colorMode: 'rgb', bitDepth: 8 },
    rootGroup: {
      id: rootId,
      name: 'Root',
      type: 'group',
      visible: true,
      opacity: 1,
      blendMode: BlendMode.Normal,
      position: { x: 0, y: 0 },
      locked: false,
      effects: [],
      parentId: null,
      children: children.map((c) => ({ ...c, parentId: rootId })),
      expanded: true,
    },
    selectedLayerId: null,
    filePath: null,
    dirty: false,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

/**
 * Create a minimal Viewport implementation for benchmarking.
 * Uses zoom=1, offset=0 — no pan/scroll overhead.
 */
function makeBenchViewport(width: number, height: number): Viewport {
  return {
    zoom: 1,
    offset: { x: 0, y: 0 },
    visibleArea: { x: 0, y: 0, width, height },
    setZoom(): void { /* no-op */ },
    setOffset(): void { /* no-op */ },
    screenToDocument(p) { return { ...p }; },
    documentToScreen(p) { return { ...p }; },
    fitToWindow(): void { /* no-op */ },
    zoomToActual(): void { /* no-op */ },
  };
}

/** Create RenderOptions for benchmarking. */
function makeRenderOptions(width: number, height: number): RenderOptions {
  return {
    viewport: makeBenchViewport(width, height),
    renderEffects: true,
    showSelection: false,
    showGuides: false,
    background: 'white',
  };
}

// ---------------------------------------------------------------------------
// Mock canvas for Node.js environment
// ---------------------------------------------------------------------------

/**
 * Create a mock canvas for Node.js (no real rendering).
 * Replicates the pattern used in compositor.test.ts.
 */
export function createMockCanvas(width: number, height: number): CanvasLike {
  const ctx = createMockContext(width, height);
  const canvas: CanvasLike = {
    width,
    height,
    getContext: () => ctx,
  };
  ctx.canvas = canvas;
  return canvas;
}

/** Create a mock CanvasContext2DLike that records no operations (fast). */
function createMockContext(width: number, height: number): CanvasContext2DLike & Record<string, unknown> {
  const canvas = { width, height } as CanvasLike;
  const noop = (): void => { /* no-op */ };
  const makeGradient = (): CanvasGradient => ({
    addColorStop: noop,
  } as unknown as CanvasGradient);

  return {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    fillStyle: '' as string | CanvasPattern | CanvasGradient,
    save: noop,
    restore: noop,
    clearRect: noop,
    drawImage: noop,
    putImageData: noop,
    getImageData: () => new ImageData(width, height),
    translate: noop,
    scale: noop,
    setTransform: noop,
    fillRect: noop,
    fillText: noop,
    strokeText: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    strokeRect: noop,
    strokeStyle: '',
    lineWidth: 1,
    measureText: (text: string) => ({ width: text.length * 8 }),
    createPattern: () => null,
    createLinearGradient: () => makeGradient(),
    createRadialGradient: () => makeGradient(),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    letterSpacing: '0px',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
}

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

/**
 * Build all benchmark scenarios.
 *
 * - **A**: Baseline -- 1 raster layer, no effects
 * - **B**: Target -- 10 layers (5 text + 5 raster), 2 effects each (must be < 1 s)
 * - **C**: Heavy -- 10 layers, 3 effects each
 * - **D**: Stress -- 1920x1080, 20 layers with effects
 *
 * @returns Array of BenchmarkScenario in order A-D.
 */
export function buildScenarios(): BenchmarkScenario[] {
  // Reset counter for reproducible IDs across runs
  idCounter = 0;

  return [
    buildScenarioA(),
    buildScenarioB(),
    buildScenarioC(),
    buildScenarioD(),
  ];
}

/** Scenario A: 1280x720, 1 raster layer, no effects. */
function buildScenarioA(): BenchmarkScenario {
  const w = 1280;
  const h = 720;
  const layers = [makeRasterLayer('BG', w, h)];

  return {
    id: 'A',
    label: 'Baseline (1 raster, no effects)',
    width: w,
    height: h,
    document: makeDocument(w, h, layers),
    renderOptions: makeRenderOptions(w, h),
    targetMs: null,
  };
}

/** Scenario B: 1280x720, 10 layers (5 text + 5 raster), 2 effects each. */
function buildScenarioB(): BenchmarkScenario {
  const w = 1280;
  const h = 720;
  const layers: Array<RasterLayer | TextLayer> = [];

  for (let i = 0; i < 5; i++) {
    layers.push(
      makeRasterLayer(`Raster-${i}`, w, h, [makeDropShadow(), makeStroke()]),
    );
    layers.push(
      makeTextLayer(`Text-${i}`, `Benchmark text ${i}`, [makeDropShadow(), makeStroke()]),
    );
  }

  return {
    id: 'B',
    label: 'Target (10 layers, 2 effects each)',
    width: w,
    height: h,
    document: makeDocument(w, h, layers),
    renderOptions: makeRenderOptions(w, h),
    targetMs: 1000,
  };
}

/** Scenario C: 1280x720, 10 layers, 3 effects each. */
function buildScenarioC(): BenchmarkScenario {
  const w = 1280;
  const h = 720;
  const layers: Array<RasterLayer | TextLayer> = [];

  for (let i = 0; i < 5; i++) {
    layers.push(
      makeRasterLayer(`Raster-${i}`, w, h, [makeDropShadow(), makeStroke(), makeOuterGlow()]),
    );
    layers.push(
      makeTextLayer(`Text-${i}`, `Heavy effects ${i}`, [makeDropShadow(), makeStroke(), makeOuterGlow()]),
    );
  }

  return {
    id: 'C',
    label: 'Heavy (10 layers, 3 effects each)',
    width: w,
    height: h,
    document: makeDocument(w, h, layers),
    renderOptions: makeRenderOptions(w, h),
    targetMs: null,
  };
}

/** Scenario D: 1920x1080, 20 layers, effects -- stress test. */
function buildScenarioD(): BenchmarkScenario {
  const w = 1920;
  const h = 1080;
  const layers: Array<RasterLayer | TextLayer> = [];

  for (let i = 0; i < 10; i++) {
    layers.push(
      makeRasterLayer(`Raster-${i}`, w, h, [makeDropShadow(), makeStroke()]),
    );
    layers.push(
      makeTextLayer(`Text-${i}`, `Stress test layer ${i}`, [makeDropShadow(), makeOuterGlow()]),
    );
  }

  return {
    id: 'D',
    label: 'Stress (20 layers, 1920x1080)',
    width: w,
    height: h,
    document: makeDocument(w, h, layers),
    renderOptions: makeRenderOptions(w, h),
    targetMs: null,
  };
}
