/**
 * @module segmentation
 * AI segmentation types for subject cutout functionality.
 * Uses SAM-style point prompts for interactive segmentation.
 */

import type { Point, Size } from './common';

/** A point prompt for segmentation (positive = include, negative = exclude). */
export interface PointPrompt {
  /** Position in document coordinates. */
  position: Point;
  /** Whether this is a positive (include) or negative (exclude) prompt. */
  label: 'positive' | 'negative';
}

/** A binary segmentation mask. */
export interface Mask {
  /** Binary mask data (0 = background, 255 = foreground). Width * height bytes. */
  data: Uint8Array;
  /** Mask dimensions. */
  size: Size;
  /** Confidence score (0-1) for the segmentation result. */
  confidence: number;
}

/** Options for mask refinement operations. */
export interface MaskRefinementOptions {
  /** Feather radius in pixels (Gaussian blur on mask edge). */
  featherRadius?: number;
  /** Expand (positive) or contract (negative) the mask boundary in pixels. */
  boundaryAdjust?: number;
}

/** Provider interface for AI-powered segmentation. */
export interface SegmentationProvider {
  /** Whether the model is loaded and ready for inference. */
  readonly isReady: boolean;

  /** Load the segmentation model. Must be called before segment(). */
  initialize(): Promise<void>;

  /**
   * Set the image to segment. Encodes the image for subsequent segment() calls.
   * @param imageData - RGBA image data to segment.
   * @param size - Dimensions of the image.
   */
  setImage(imageData: ImageData, size: Size): Promise<void>;

  /**
   * Generate a segmentation mask from point prompts.
   * @param prompts - Array of positive/negative point prompts.
   * @returns The best segmentation mask.
   */
  segment(prompts: PointPrompt[]): Promise<Mask>;

  /** Release model resources. */
  dispose(): void;
}
