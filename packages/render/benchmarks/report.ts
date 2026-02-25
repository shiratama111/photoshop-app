/**
 * @module report
 * Benchmark result formatting and baseline comparison.
 *
 * Outputs results as a console table and optionally saves/loads
 * a JSON baseline file for regression detection.
 *
 * @see PERF-001: Performance Benchmark Ticket
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a single benchmark scenario run. */
export interface BenchmarkResult {
  /** Scenario identifier (e.g. "A"). */
  scenarioId: string;
  /** Human-readable label. */
  label: string;
  /** Canvas dimensions string (e.g. "1280x720"). */
  resolution: string;
  /** Number of layers in the scene. */
  layerCount: number;
  /** Total number of effects across all layers. */
  effectCount: number;
  /** Median execution time in milliseconds. */
  medianMs: number;
  /** Minimum execution time in milliseconds. */
  minMs: number;
  /** Maximum execution time in milliseconds. */
  maxMs: number;
  /** Estimated pixel buffer memory in bytes. */
  memoryBytes: number;
  /** Target time in ms (null = no target). */
  targetMs: number | null;
  /** Whether the median met the target (null = no target). */
  passed: boolean | null;
}

/** Baseline data stored in JSON. */
interface BaselineData {
  /** ISO timestamp of when the baseline was created. */
  createdAt: string;
  /** Node.js version used. */
  nodeVersion: string;
  /** Per-scenario baseline median times. */
  results: Record<string, { medianMs: number; label: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASELINE_PATH = resolve(__dirname, 'baseline.json');

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------

/**
 * Print benchmark results as a formatted console table.
 *
 * @param results - Array of benchmark results to display.
 * @param baseline - Optional baseline data for delta comparison.
 */
export function printReport(results: BenchmarkResult[], baseline: BaselineData | null): void {
  /* eslint-disable no-console */

  console.log('\n' + '='.repeat(90));
  console.log('  RENDER BENCHMARK RESULTS');
  console.log('='.repeat(90));
  console.log('');

  // Table header
  const header = [
    pad('Scenario', 10),
    pad('Resolution', 12),
    pad('Layers', 8),
    pad('Effects', 9),
    pad('Median', 10),
    pad('Min', 10),
    pad('Max', 10),
    pad('Memory', 10),
    pad('Target', 10),
    pad('Status', 8),
  ].join(' | ');

  const separator = '-'.repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const r of results) {
    const baselineEntry = baseline?.results[r.scenarioId];
    const delta = baselineEntry ? formatDelta(r.medianMs, baselineEntry.medianMs) : '';

    const status = r.passed === true ? 'PASS' : r.passed === false ? 'FAIL' : '-';

    const row = [
      pad(r.scenarioId, 10),
      pad(r.resolution, 12),
      pad(String(r.layerCount), 8),
      pad(String(r.effectCount), 9),
      pad(formatMs(r.medianMs) + delta, 10),
      pad(formatMs(r.minMs), 10),
      pad(formatMs(r.maxMs), 10),
      pad(formatBytes(r.memoryBytes), 10),
      pad(r.targetMs !== null ? `<${r.targetMs}ms` : '-', 10),
      pad(status, 8),
    ].join(' | ');

    console.log(row);
  }

  console.log(separator);

  // Summary
  const failCount = results.filter((r) => r.passed === false).length;
  if (failCount > 0) {
    console.log(`\n  RESULT: ${failCount} scenario(s) FAILED to meet target.\n`);
  } else {
    console.log('\n  RESULT: All targeted scenarios passed.\n');
  }

  if (baseline) {
    console.log(`  Baseline: ${baseline.createdAt} (Node ${baseline.nodeVersion})`);
  }
  console.log('');

  /* eslint-enable no-console */
}

// ---------------------------------------------------------------------------
// Baseline I/O
// ---------------------------------------------------------------------------

/**
 * Load a previously saved baseline from disk.
 *
 * @returns The baseline data, or null if no baseline file exists.
 */
export function loadBaseline(): BaselineData | null {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    const raw = readFileSync(BASELINE_PATH, 'utf-8');
    return JSON.parse(raw) as BaselineData;
  } catch {
    return null;
  }
}

/**
 * Save current results as the new baseline.
 *
 * @param results - Benchmark results to save.
 */
export function saveBaseline(results: BenchmarkResult[]): void {
  const data: BaselineData = {
    createdAt: new Date().toISOString(),
    nodeVersion: process.version,
    results: {},
  };

  for (const r of results) {
    data.results[r.scenarioId] = {
      medianMs: r.medianMs,
      label: r.label,
    };
  }

  writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2), 'utf-8');

  /* eslint-disable no-console */
  console.log(`  Baseline saved to: ${BASELINE_PATH}`);
  /* eslint-enable no-console */
}

/**
 * Export results as a JSON string for CI integration.
 *
 * @param results - Benchmark results to serialize.
 * @returns JSON string of the results array.
 */
export function toJson(results: BenchmarkResult[]): string {
  return JSON.stringify(results, null, 2);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Right-pad a string to the given width. */
function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Format milliseconds with 2 decimal places. */
function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

/** Format a byte count as a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Format a delta percentage relative to a baseline value. */
function formatDelta(current: number, baseline: number): string {
  if (baseline === 0) return '';
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct >= 0 ? '+' : '';
  return ` (${sign}${pct.toFixed(1)}%)`;
}
