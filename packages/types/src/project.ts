/**
 * @module project
 * Project file (.psxp) format types and PSD import/export options.
 */

import type { Canvas } from './document';

/** Manifest data stored in the project ZIP file. */
export interface ProjectManifest {
  /** Format version for migration support. */
  version: number;
  /** Canvas properties. */
  canvas: Canvas;
  /** Serialized layer tree (JSON-safe, without pixel data). */
  layerTree: ProjectLayerNode[];
  /** Creation timestamp (ISO 8601). */
  createdAt: string;
  /** Last modification timestamp (ISO 8601). */
  modifiedAt: string;
}

/** A serialized layer node in the project manifest. */
export interface ProjectLayerNode {
  /** Layer ID. */
  id: string;
  /** Layer type. */
  type: 'raster' | 'text' | 'group';
  /** Layer name. */
  name: string;
  /** Layer properties (opacity, blendMode, visibility, etc.). */
  properties: Record<string, unknown>;
  /** Path to the layer's image file within the ZIP (for raster layers). */
  imagePath?: string;
  /** Child nodes (for groups). */
  children?: ProjectLayerNode[];
}

/** A complete project file (ZIP contents). */
export interface ProjectFile {
  /** Project manifest. */
  manifest: ProjectManifest;
  /** Map of file paths to binary data within the ZIP. */
  files: Map<string, Uint8Array>;
}

/** Options for importing a PSD file. */
export interface PsdImportOptions {
  /** Whether to rasterize text layers (default: false, preserves as TextLayer). */
  rasterizeText: boolean;
  /** Whether to rasterize smart objects (default: true). */
  rasterizeSmartObjects: boolean;
  /** Maximum dimension for imported images (0 = no limit). */
  maxDimension: number;
}

/** Options for exporting to PSD format. */
export interface PsdExportOptions {
  /** Whether to include text layer data (default: true). */
  preserveText: boolean;
  /** Whether to generate a composite (flattened) image (default: true). */
  generateComposite: boolean;
  /** Whether to include layer effects in the PSD (default: true). */
  includeEffects: boolean;
}

/** Severity level for compatibility issues. */
export type CompatibilitySeverity = 'info' | 'warning' | 'error';

/** A single compatibility issue found during PSD import/export. */
export interface CompatibilityIssue {
  /** Severity of the issue. */
  severity: CompatibilitySeverity;
  /** Human-readable description of the issue. */
  message: string;
  /** Name of the affected layer, if applicable. */
  layerName?: string;
  /** The feature that caused the issue. */
  feature: string;
}

/** Report of compatibility issues found during PSD import/export. */
export interface CompatibilityReport {
  /** List of issues found. */
  issues: CompatibilityIssue[];
  /** Whether the import/export can proceed despite issues. */
  canProceed: boolean;
  /** Total number of layers processed. */
  layerCount: number;
  /** Number of layers with issues. */
  affectedLayerCount: number;
}
