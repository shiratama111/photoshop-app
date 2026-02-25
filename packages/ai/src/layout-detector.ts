/**
 * @module layout-detector
 * Heuristic-based layout region detection for thumbnail analysis.
 *
 * Detects distinct regions (text, image, background) in an image using
 * edge detection and variance analysis. No ML model is required.
 *
 * Algorithm:
 * 1. Convert to grayscale
 * 2. Apply Sobel edge detection
 * 3. Threshold edge map to create binary edge mask
 * 4. Find connected components via flood-fill on the edge mask
 * 5. Merge small components into nearby larger ones
 * 6. Classify regions by pixel variance:
 *    - Low variance => solid background
 *    - Medium-high variance + elongated aspect ratio => text
 *    - High variance + compact shape => image/photo
 * 7. Return bounding boxes with classification and confidence
 *
 * @see ANALYZE-001: Thumbnail Analysis Engine
 * @see {@link ../../../app/src/renderer/ai/thumbnail-analyzer.ts} — consumes detectLayout
 */

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Type classification for a detected layout region. */
export type LayoutRegionType = 'text' | 'image' | 'background';

/** Bounding box for a layout region. */
export interface RegionBounds {
  /** X offset from the left edge in pixels. */
  x: number;
  /** Y offset from the top edge in pixels. */
  y: number;
  /** Width in pixels. */
  w: number;
  /** Height in pixels. */
  h: number;
}

/** A detected region within the image. */
export interface LayoutRegion {
  /** What kind of content this region likely contains. */
  type: LayoutRegionType;
  /** Bounding box of the region. */
  bounds: RegionBounds;
  /** Detection confidence (0-1). */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Edge detection threshold (0-255) for the Sobel output. */
const EDGE_THRESHOLD = 30;

/** Minimum region area (in pixels) to keep after component detection. */
const MIN_REGION_AREA = 100;

/**
 * Fraction of total image area below which a component is considered too small.
 * Small components are discarded.
 */
const MIN_REGION_FRACTION = 0.005;

/**
 * Variance threshold that separates "solid/background" from "content" regions.
 * Regions with variance below this are classified as background.
 */
const BACKGROUND_VARIANCE_THRESHOLD = 200;

/**
 * Variance threshold above which a region is likely photographic/image content.
 * Between BACKGROUND and IMAGE thresholds => text-like.
 */
const IMAGE_VARIANCE_THRESHOLD = 2000;

/**
 * Aspect ratio threshold: regions wider than this ratio are likely text.
 * Text lines tend to be much wider than tall.
 */
const TEXT_ASPECT_RATIO = 2.5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect layout regions in an image using heuristic edge and variance analysis.
 *
 * @param imageData - Source image data (RGBA format).
 * @returns Array of detected {@link LayoutRegion} objects sorted by area (descending).
 *
 * @example
 * ```ts
 * const regions = detectLayout(ctx.getImageData(0, 0, 1280, 720));
 * for (const r of regions) {
 *   console.log(r.type, r.bounds, r.confidence);
 * }
 * ```
 */
export function detectLayout(imageData: ImageData): LayoutRegion[] {
  const { width, height } = imageData;

  // Step 1: Convert to grayscale
  const gray = toGrayscale(imageData);

  // Step 2: Sobel edge detection
  const edges = sobelEdges(gray, width, height);

  // Step 3: Threshold to binary mask
  const edgeMask = thresholdMask(edges, width, height, EDGE_THRESHOLD);

  // Step 4: Connected component labeling
  const { labels, count } = connectedComponents(edgeMask, width, height);

  // Step 5: Compute bounding boxes for each component
  const components = extractComponentBounds(labels, width, height, count);

  // Step 6: Filter out tiny components
  const totalArea = width * height;
  const minArea = Math.max(MIN_REGION_AREA, totalArea * MIN_REGION_FRACTION);
  const significant = components.filter((c) => c.area >= minArea);

  // Step 7: Classify each region by variance
  const regions = significant.map((comp) =>
    classifyRegion(comp, imageData),
  );

  // If no regions detected, report entire image as a single background region
  if (regions.length === 0) {
    return [{
      type: 'background',
      bounds: { x: 0, y: 0, w: width, h: height },
      confidence: 1.0,
    }];
  }

  // Sort by area descending
  return regions.sort(
    (a, b) => (b.bounds.w * b.bounds.h) - (a.bounds.w * a.bounds.h),
  );
}

// ---------------------------------------------------------------------------
// Internal: Grayscale Conversion
// ---------------------------------------------------------------------------

/**
 * Convert RGBA image data to a grayscale Uint8Array.
 *
 * @param imageData - Source RGBA image data.
 * @returns Grayscale pixel array (one byte per pixel).
 */
function toGrayscale(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    // ITU-R BT.601 luminance formula
    gray[i] = Math.round(
      0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2],
    );
  }
  return gray;
}

// ---------------------------------------------------------------------------
// Internal: Sobel Edge Detection
// ---------------------------------------------------------------------------

/**
 * Apply Sobel edge detection to a grayscale image.
 *
 * @param gray - Grayscale pixel array.
 * @param width - Image width.
 * @param height - Image height.
 * @returns Edge magnitude array (0-255 range, clamped).
 */
function sobelEdges(gray: Uint8Array, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // 3x3 neighborhood
      const tl = gray[(y - 1) * width + (x - 1)];
      const tc = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const ml = gray[y * width + (x - 1)];
      const mr = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const bc = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];

      // Sobel X kernel: [-1 0 1; -2 0 2; -1 0 1]
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      // Sobel Y kernel: [-1 -2 -1; 0 0 0; 1 2 1]
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

      // Magnitude (approximation: |gx| + |gy| is faster than sqrt)
      const mag = Math.abs(gx) + Math.abs(gy);
      edges[y * width + x] = Math.min(255, mag);
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Internal: Threshold & Binary Mask
// ---------------------------------------------------------------------------

/**
 * Threshold an edge magnitude image into a binary mask.
 *
 * @param edges - Edge magnitude array.
 * @param width - Image width.
 * @param height - Image height.
 * @param threshold - Edge magnitude threshold (0-255).
 * @returns Binary mask (1 = edge, 0 = no edge).
 */
function thresholdMask(
  edges: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    mask[i] = edges[i] >= threshold ? 1 : 0;
  }
  return mask;
}

// ---------------------------------------------------------------------------
// Internal: Connected Components (Union-Find)
// ---------------------------------------------------------------------------

/**
 * Label connected components in a binary mask using two-pass union-find.
 *
 * @param mask - Binary edge mask (1 = foreground).
 * @param width - Image width.
 * @param height - Image height.
 * @returns Object with label map and number of unique labels.
 */
function connectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; count: number } {
  const labels = new Int32Array(width * height);
  const parent: number[] = [0]; // parent[0] unused (label 0 = background)
  let nextLabel = 1;

  /**
   * Find the root of a label in the union-find structure.
   * @param x - Label to find root for.
   * @returns Root label.
   */
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  /**
   * Union two labels in the union-find structure.
   * @param a - First label.
   * @param b - Second label.
   */
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
    }
  }

  // First pass: assign provisional labels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0) {
        labels[idx] = 0;
        continue;
      }

      const leftLabel = x > 0 ? labels[idx - 1] : 0;
      const topLabel = y > 0 ? labels[(y - 1) * width + x] : 0;

      if (leftLabel === 0 && topLabel === 0) {
        // New label
        labels[idx] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else if (leftLabel !== 0 && topLabel === 0) {
        labels[idx] = leftLabel;
      } else if (leftLabel === 0 && topLabel !== 0) {
        labels[idx] = topLabel;
      } else {
        // Both neighbors have labels — union them
        labels[idx] = leftLabel;
        union(leftLabel, topLabel);
      }
    }
  }

  // Second pass: resolve labels to root
  const rootMap = new Map<number, number>();
  let finalCount = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 0) continue;
    const root = find(labels[i]);
    if (!rootMap.has(root)) {
      finalCount++;
      rootMap.set(root, finalCount);
    }
    labels[i] = rootMap.get(root)!;
  }

  return { labels, count: finalCount };
}

// ---------------------------------------------------------------------------
// Internal: Component Bounding Boxes
// ---------------------------------------------------------------------------

/** Internal component descriptor with bounding box and area. */
interface ComponentInfo {
  /** Bounding box. */
  bounds: RegionBounds;
  /** Total pixel count in the component. */
  area: number;
  /** Component label for pixel lookup. */
  label: number;
}

/**
 * Extract bounding boxes and pixel counts for each labeled component.
 *
 * @param labels - Component label map.
 * @param width - Image width.
 * @param height - Image height.
 * @param count - Number of unique component labels.
 * @returns Array of component info objects.
 */
function extractComponentBounds(
  labels: Int32Array,
  width: number,
  height: number,
  count: number,
): ComponentInfo[] {
  // Per-label bounding box trackers
  const minX = new Int32Array(count + 1).fill(width);
  const maxX = new Int32Array(count + 1).fill(0);
  const minY = new Int32Array(count + 1).fill(height);
  const maxY = new Int32Array(count + 1).fill(0);
  const area = new Int32Array(count + 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y * width + x];
      if (label === 0) continue;
      if (x < minX[label]) minX[label] = x;
      if (x > maxX[label]) maxX[label] = x;
      if (y < minY[label]) minY[label] = y;
      if (y > maxY[label]) maxY[label] = y;
      area[label]++;
    }
  }

  const components: ComponentInfo[] = [];
  for (let i = 1; i <= count; i++) {
    if (area[i] === 0) continue;
    components.push({
      bounds: {
        x: minX[i],
        y: minY[i],
        w: maxX[i] - minX[i] + 1,
        h: maxY[i] - minY[i] + 1,
      },
      area: area[i],
      label: i,
    });
  }

  return components;
}

// ---------------------------------------------------------------------------
// Internal: Region Classification
// ---------------------------------------------------------------------------

/**
 * Classify a component as text, image, or background based on pixel variance
 * and aspect ratio heuristics.
 *
 * @param comp - Component info with bounding box.
 * @param imageData - Original RGBA image data for variance computation.
 * @returns A classified {@link LayoutRegion}.
 */
function classifyRegion(comp: ComponentInfo, imageData: ImageData): LayoutRegion {
  const { bounds } = comp;
  const variance = computeRegionVariance(imageData, bounds);
  const aspectRatio = bounds.w / Math.max(1, bounds.h);

  let type: LayoutRegionType;
  let confidence: number;

  if (variance < BACKGROUND_VARIANCE_THRESHOLD) {
    type = 'background';
    confidence = 0.8;
  } else if (variance < IMAGE_VARIANCE_THRESHOLD && aspectRatio >= TEXT_ASPECT_RATIO) {
    // Medium variance + wide shape -> likely text
    type = 'text';
    confidence = 0.6;
  } else if (variance >= IMAGE_VARIANCE_THRESHOLD) {
    // High variance -> photographic image
    type = 'image';
    confidence = 0.7;
  } else {
    // Medium variance, compact shape -> could be either, default to image
    type = 'image';
    confidence = 0.4;
  }

  return { type, bounds, confidence };
}

/**
 * Compute the pixel intensity variance within a bounding box.
 *
 * @param imageData - Source RGBA image data.
 * @param bounds - Region bounding box.
 * @returns Variance of grayscale pixel values within the region.
 */
function computeRegionVariance(imageData: ImageData, bounds: RegionBounds): number {
  const { data, width } = imageData;
  const { x: bx, y: by, w: bw, h: bh } = bounds;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Clamp bounds to image dimensions
  const xEnd = Math.min(bx + bw, imageData.width);
  const yEnd = Math.min(by + bh, imageData.height);

  for (let y = by; y < yEnd; y++) {
    for (let x = bx; x < xEnd; x++) {
      const offset = (y * width + x) * 4;
      const gray = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      sum += gray;
      sumSq += gray * gray;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}
