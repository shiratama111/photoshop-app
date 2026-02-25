/**
 * @module render-benchmark
 * Benchmark runner for Canvas2DRenderer performance measurement.
 *
 * Runs each scenario multiple times, collects timing data, computes
 * median/min/max, estimates memory usage, and reports pass/fail
 * against defined targets.
 *
 * Usage:
 * ```
 * pnpm --filter @photoshop-app/render bench
 * ```
 *
 * Flags:
 * - `--save-baseline`  Save current results as the new baseline
 * - `--json`           Output results as JSON to stdout
 * - `--runs <n>`       Override number of runs per scenario (default: 10)
 *
 * @see PERF-001: Performance Benchmark Ticket
 * @see {@link @photoshop-app/render!Canvas2DRenderer}
 */

import { Canvas2DRenderer } from '../src/compositor';
import type { CanvasLike } from '../src/canvas-pool';
import type { Layer } from '@photoshop-app/types';
import { buildScenarios, createMockCanvas } from './scenarios';
import type { BenchmarkScenario } from './scenarios';
import type { BenchmarkResult } from './report';
import { printReport, loadBaseline, saveBaseline, toJson } from './report';

// ---------------------------------------------------------------------------
// Polyfill ImageData for Node.js
// ---------------------------------------------------------------------------

if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(
      widthOrData: number | Uint8ClampedArray,
      heightOrWidth: number,
      height?: number,
    ) {
      if (widthOrData instanceof Uint8ClampedArray) {
        this.data = widthOrData;
        this.width = heightOrWidth;
        this.height = height!;
      } else {
        this.width = widthOrData;
        this.height = heightOrWidth;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  /** Number of runs per scenario. */
  runs: number;
  /** Whether to save results as the new baseline. */
  saveBaselineFlag: boolean;
  /** Whether to output JSON instead of table. */
  jsonOutput: boolean;
}

/** Parse command-line arguments. */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let runs = 10;
  let saveBaselineFlag = false;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--runs' && i + 1 < args.length) {
      const parsed = parseInt(args[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        runs = parsed;
      }
      i++;
    } else if (args[i] === '--save-baseline') {
      saveBaselineFlag = true;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    }
  }

  return { runs, saveBaselineFlag, jsonOutput };
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/**
 * Count the total number of layers (flat, including nested groups) in a layer tree.
 */
function countLayers(layers: readonly Layer[]): number {
  let count = 0;
  for (const layer of layers) {
    count++;
    if (layer.type === 'group') {
      count += countLayers(layer.children);
    }
  }
  return count;
}

/**
 * Count the total number of enabled effects across all layers.
 */
function countEffects(layers: readonly Layer[]): number {
  let count = 0;
  for (const layer of layers) {
    count += layer.effects.filter((e) => e.enabled).length;
    if (layer.type === 'group') {
      count += countEffects(layer.children);
    }
  }
  return count;
}

/**
 * Estimate pixel buffer memory usage for a scenario.
 * This accounts for: output canvas + one temp canvas per raster layer
 * (the pool reuses, but peak usage matters).
 */
function estimateMemory(scenario: BenchmarkScenario): number {
  const canvasBytes = scenario.width * scenario.height * 4;
  const rasterCount = countRasterLayers(scenario.document.rootGroup.children);
  // Output canvas + one temp per raster layer (worst case: no pooling reuse)
  return canvasBytes * (1 + rasterCount);
}

/** Count raster layers in a layer tree. */
function countRasterLayers(layers: readonly Layer[]): number {
  let count = 0;
  for (const layer of layers) {
    if (layer.type === 'raster') count++;
    if (layer.type === 'group') count += countRasterLayers(layer.children);
  }
  return count;
}

/**
 * Compute the median of a sorted numeric array.
 */
function median(sorted: readonly number[]): number {
  const len = sorted.length;
  if (len === 0) return 0;
  const mid = Math.floor(len / 2);
  return len % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Run a single benchmark scenario the specified number of times.
 *
 * @param scenario - The scenario to benchmark.
 * @param runs - Number of iterations.
 * @returns The benchmark result with timing stats.
 */
function runScenario(scenario: BenchmarkScenario, runs: number): BenchmarkResult {
  // Create renderer with mock canvas factory for Node.js
  const renderer = new Canvas2DRenderer(createMockCanvas);
  const canvas: CanvasLike = createMockCanvas(scenario.width, scenario.height);

  // Warm-up run (not counted)
  renderer.render(
    scenario.document,
    canvas as unknown as HTMLCanvasElement,
    scenario.renderOptions,
  );

  // Timed runs
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    renderer.render(
      scenario.document,
      canvas as unknown as HTMLCanvasElement,
      scenario.renderOptions,
    );
    const end = performance.now();
    times.push(end - start);
  }

  // Clean up
  renderer.dispose();

  // Sort for median/min/max
  times.sort((a, b) => a - b);

  const medianMs = median(times);
  const layerCount = countLayers(scenario.document.rootGroup.children);
  const effectCount = countEffects(scenario.document.rootGroup.children);
  const memoryBytes = estimateMemory(scenario);

  const passed = scenario.targetMs !== null
    ? medianMs < scenario.targetMs
    : null;

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    resolution: `${scenario.width}x${scenario.height}`,
    layerCount,
    effectCount,
    medianMs,
    minMs: times[0],
    maxMs: times[times.length - 1],
    memoryBytes,
    targetMs: scenario.targetMs,
    passed,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Entry point: build scenarios, run benchmarks, report results.
 */
function main(): void {
  const opts = parseArgs();
  const scenarios = buildScenarios();
  const baseline = loadBaseline();

  /* eslint-disable no-console */
  console.log(`Running ${scenarios.length} scenarios (${opts.runs} runs each)...`);
  console.log('');
  /* eslint-enable no-console */

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    /* eslint-disable no-console */
    process.stdout.write(`  [${scenario.id}] ${scenario.label} ... `);
    /* eslint-enable no-console */

    const result = runScenario(scenario, opts.runs);
    results.push(result);

    const status = result.passed === true
      ? 'PASS'
      : result.passed === false
        ? 'FAIL'
        : 'done';

    /* eslint-disable no-console */
    console.log(`${result.medianMs.toFixed(2)}ms (${status})`);
    /* eslint-enable no-console */
  }

  // Output
  if (opts.jsonOutput) {
    /* eslint-disable no-console */
    console.log(toJson(results));
    /* eslint-enable no-console */
  } else {
    printReport(results, baseline);
  }

  // Save baseline if requested
  if (opts.saveBaselineFlag) {
    saveBaseline(results);
  }

  // Exit with error code if any targeted scenario failed
  const hasFail = results.some((r) => r.passed === false);
  if (hasFail) {
    process.exit(1);
  }
}

main();
