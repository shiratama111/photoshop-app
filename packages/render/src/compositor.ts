/**
 * @module compositor
 * Canvas 2D layer compositor.
 *
 * Renders a Document's layer tree to an HTML canvas using the Canvas 2D API.
 * Handles layer blending, opacity, visibility, groups, masks, and effects.
 *
 * Key design decisions:
 * - `putImageData` ignores `globalAlpha` and `globalCompositeOperation`,
 *   so each raster layer is drawn to a temp canvas first, then composited
 *   with `drawImage`.
 * - Groups are composited to an OffscreenCanvas, then drawn to the parent.
 * - Canvas pool reuses off-screen canvases to reduce allocation.
 *
 * @see {@link @photoshop-app/types!Renderer}
 * @see {@link @photoshop-app/types!RenderOptions}
 */

import type {
  BevelEmbossEffect,
  ColorOverlayEffect,
  Document,
  DropShadowEffect,
  GradientOverlayEffect,
  InnerGlowEffect,
  InnerShadowEffect,
  Layer,
  LayerGroup,
  OuterGlowEffect,
  RasterLayer,
  RenderOptions,
  Renderer,
  Size,
  StrokeEffect,
  TextLayer,
} from '@photoshop-app/types';
import type { CanvasContext2DLike, CanvasLike } from './canvas-pool';
import { CanvasPool, createBrowserCanvas, type CanvasFactory } from './canvas-pool';

/** Font fallback stack to keep JP/EN glyph rendering consistent in Electron. */
const CANVAS_TEXT_FALLBACK_FONTS =
  '"Yu Gothic UI", "Yu Gothic", Meiryo, "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif';

/** Build font-family list with robust CJK fallback for Canvas2D text rendering. */
function withCanvasTextFallback(fontFamily: string): string {
  const base = fontFamily.trim();
  if (!base) return CANVAS_TEXT_FALLBACK_FONTS;
  // Avoid duplicating the stack if already present.
  if (base.includes('Yu Gothic') || base.includes('Meiryo') || base.includes('Noto Sans CJK JP')) {
    return base;
  }
  return `${base}, ${CANVAS_TEXT_FALLBACK_FONTS}`;
}

/**
 * Canvas 2D renderer implementation.
 *
 * Usage:
 * ```ts
 * const renderer = new Canvas2DRenderer();
 * renderer.render(document, canvasElement, options);
 * ```
 */
export class Canvas2DRenderer implements Renderer {
  private pool: CanvasPool;
  private canvasFactory: CanvasFactory;
  private checkerboardTile: CanvasLike | null = null;

  constructor(canvasFactory?: CanvasFactory) {
    this.canvasFactory = canvasFactory ?? createBrowserCanvas;
    this.pool = new CanvasPool(this.canvasFactory);
  }

  /**
   * Render the full document to the target canvas.
   */
  render(
    document: Document,
    canvas: HTMLCanvasElement | CanvasLike,
    options: RenderOptions,
  ): void {
    const measurePerf =
      typeof performance !== 'undefined' &&
      typeof location !== 'undefined' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');

    if (measurePerf) performance.mark('render-start');

    const ctx = canvas.getContext('2d') as CanvasContext2DLike | null;
    if (!ctx) return;

    const { width, height } = canvas;
    const docSize = options.documentSize;
    const hiddenLayerIds = options.hiddenLayerIds ? new Set(options.hiddenLayerIds) : null;
    const effectsOnlyLayerIds = options.effectsOnlyLayerIds ? new Set(options.effectsOnlyLayerIds) : null;

    if (docSize) {
      // Pasteboard/artboard mode: dark pasteboard, then white artboard inside viewport
      ctx.clearRect(0, 0, width, height);

      // 1. Fill entire canvas with pasteboard color
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, width, height);

      // 2. Apply viewport transform
      ctx.save();
      const vp = options.viewport;
      const pixelRatio = this.getCanvasPixelRatio(canvas);
      ctx.setTransform(
        vp.zoom * pixelRatio,
        0,
        0,
        vp.zoom * pixelRatio,
        vp.offset.x * pixelRatio,
        vp.offset.y * pixelRatio,
      );

      // 3. Draw document area (artboard) in white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, docSize.width, docSize.height);

      // 4. Render layer tree bottom-to-top
      this.renderGroup(ctx, document.rootGroup, options, hiddenLayerIds, effectsOnlyLayerIds);

      ctx.restore();
    } else {
      // Legacy mode: no document size, use the original background approach
      ctx.clearRect(0, 0, width, height);
      this.drawBackground(ctx, width, height, options.background);

      ctx.save();
      const vp = options.viewport;
      const pixelRatio = this.getCanvasPixelRatio(canvas);
      ctx.setTransform(
        vp.zoom * pixelRatio,
        0,
        0,
        vp.zoom * pixelRatio,
        vp.offset.x * pixelRatio,
        vp.offset.y * pixelRatio,
      );

      this.renderGroup(ctx, document.rootGroup, options, hiddenLayerIds, effectsOnlyLayerIds);

      ctx.restore();
    }

    if (measurePerf) {
      performance.mark('render-end');
      const measure = performance.measure('Canvas2DRenderer.render', 'render-start', 'render-end');
      // eslint-disable-next-line no-console
      console.debug(`[render] ${measure.duration.toFixed(2)}ms (${width}x${height})`);
    }
  }

  /**
   * Render a single layer thumbnail.
   */
  renderLayerThumbnail(
    document: Document,
    layerId: string,
    size: Size,
  ): HTMLCanvasElement | null {
    const layer = this.findLayer(document.rootGroup, layerId);
    if (!layer) return null;

    const canvas = this.pool.acquire(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size.width, size.height);

    if (layer.type === 'raster' && layer.imageData) {
      // Scale to fit thumbnail
      const scaleX = size.width / layer.bounds.width;
      const scaleY = size.height / layer.bounds.height;
      const scale = Math.min(scaleX, scaleY);
      ctx.scale(scale, scale);
      this.drawRasterLayer(ctx, layer);
    }

    return canvas as unknown as HTMLCanvasElement;
  }

  /** Release pooled resources. */
  dispose(): void {
    this.pool.dispose();
    this.checkerboardTile = null;
  }

  private drawBackground(
    ctx: CanvasContext2DLike,
    width: number,
    height: number,
    bg: 'checkerboard' | 'white' | 'black' | 'transparent',
  ): void {
    if (bg === 'transparent') {
      // No background — preserve alpha channel for PNG export
      return;
    } else if (bg === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else if (bg === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Checkerboard pattern
      this.drawCheckerboard(ctx, width, height);
    }
  }

  /**
   * Detect canvas pixel ratio from backing store size / CSS size.
   * Returns 1 for offscreen/test canvases that do not expose client dimensions.
   */
  private getCanvasPixelRatio(canvas: HTMLCanvasElement | CanvasLike): number {
    const domCanvas = canvas as Partial<HTMLCanvasElement>;
    const clientWidth = typeof domCanvas.clientWidth === 'number' ? domCanvas.clientWidth : 0;
    const clientHeight = typeof domCanvas.clientHeight === 'number' ? domCanvas.clientHeight : 0;
    if (clientWidth <= 0 || clientHeight <= 0) return 1;

    const scaleX = canvas.width / clientWidth;
    const scaleY = canvas.height / clientHeight;
    const ratio = Math.min(scaleX, scaleY);
    if (!Number.isFinite(ratio) || ratio <= 0) return 1;
    return ratio;
  }

  private drawCheckerboard(ctx: CanvasContext2DLike, width: number, height: number): void {
    const tile = this.getCheckerboardTile();
    if (tile) {
      const pattern = ctx.createPattern(tile, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
        return;
      }
    }

    // Fallback path for test/mocked contexts that do not support patterns.
    const tileSize = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#cccccc';
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        if (((x / tileSize) + (y / tileSize)) % 2 === 0) {
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
  }

  /**
   * Lazily build a tiny 2x2 checkerboard tile and reuse it across renders.
   */
  private getCheckerboardTile(): CanvasLike | null {
    if (this.checkerboardTile) return this.checkerboardTile;

    const tileSize = 8;
    const side = tileSize * 2;
    const tile = this.canvasFactory(side, side);
    const ctx = tile.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, tileSize, tileSize);
    ctx.fillRect(tileSize, tileSize, tileSize, tileSize);

    this.checkerboardTile = tile;
    return tile;
  }

  /**
   * Render a layer group by compositing its children.
   * Detects clipping mask groups (contiguous runs of `clippingMask: true`
   * layers above a non-clipping base) and renders them as a unit using
   * `source-atop` so the clipped layers are confined to the base's alpha.
   *
   * @see CLIP-001
   */
  private renderGroup(
    ctx: CanvasContext2DLike,
    group: LayerGroup,
    options: RenderOptions,
    hiddenLayerIds: ReadonlySet<string> | null,
    effectsOnlyLayerIds?: ReadonlySet<string> | null,
  ): void {
    const children = group.children;
    let i = 0;

    while (i < children.length) {
      const layer = children[i];

      // Determine the clipping group starting at this non-clipping layer.
      // A clipping group = base (non-clipping) + contiguous run of clipping layers above it.
      if (!this.isClippingLayer(layer)) {
        const clippedRun = this.collectClippedRun(children, i);
        if (clippedRun.length > 0) {
          this.renderClippingGroup(ctx, layer, clippedRun, options, hiddenLayerIds, effectsOnlyLayerIds);
          // Skip past the base + its clipped layers.
          i += 1 + clippedRun.length;
          continue;
        }
      }

      // Normal (non-clipping) rendering path.
      if (!layer.visible) { i++; continue; }
      if (hiddenLayerIds?.has(layer.id)) { i++; continue; }

      if (layer.type === 'group') {
        this.renderGroupAsComposite(ctx, layer, options, hiddenLayerIds, effectsOnlyLayerIds);
      } else {
        // Effects-only: render layer effects but skip content (text/raster).
        const effectsOnly = effectsOnlyLayerIds?.has(layer.id) ?? false;
        this.renderLayer(ctx, layer, options, effectsOnly);
      }
      i++;
    }
  }

  /**
   * Check whether a layer has the clipping mask flag set.
   * Works with the `ClippableLayer` type extension from `@photoshop-app/core`.
   */
  private isClippingLayer(layer: Layer): boolean {
    return (layer as unknown as Record<string, unknown>).clippingMask === true;
  }

  /**
   * Starting from `baseIndex`, collect the contiguous run of clipping layers
   * that appear above the base in the children array.
   *
   * @returns Array of clipping layers (may be empty if no layers clip to this base).
   */
  private collectClippedRun(children: Layer[], baseIndex: number): Layer[] {
    const run: Layer[] = [];
    for (let j = baseIndex + 1; j < children.length; j++) {
      if (this.isClippingLayer(children[j])) {
        run.push(children[j]);
      } else {
        break;
      }
    }
    return run;
  }

  /**
   * Render a clipping group: base layer + clipped layers.
   *
   * Algorithm:
   * 1. Render the base layer to a temporary canvas.
   * 2. For each clipped layer, draw it on top using `source-atop` so it is
   *    confined to the base layer's opaque area.
   * 3. Composite the resulting temp canvas onto `ctx` using the base's blend
   *    mode and opacity.
   *
   * Effects on clipped layers are applied *after* clipping (drawn on top of
   * the clipped result).
   *
   * @see CLIP-001
   */
  private renderClippingGroup(
    ctx: CanvasContext2DLike,
    baseLayer: Layer,
    clippedLayers: Layer[],
    options: RenderOptions,
    hiddenLayerIds: ReadonlySet<string> | null,
    effectsOnlyLayerIds?: ReadonlySet<string> | null,
  ): void {
    // If the base itself is not visible, skip the entire group.
    if (!baseLayer.visible) return;
    if (hiddenLayerIds?.has(baseLayer.id)) return;

    const { width, height } = ctx.canvas;
    const clipCanvas = this.pool.acquire(width, height);
    const clipCtx = clipCanvas.getContext('2d');
    if (!clipCtx) return;

    clipCtx.clearRect(0, 0, width, height);

    // Step 1: Render base layer to the clip canvas.
    if (baseLayer.type === 'group') {
      this.renderGroup(clipCtx, baseLayer, options, hiddenLayerIds, effectsOnlyLayerIds);
    } else {
      this.renderLayerDirect(clipCtx, baseLayer, options);
    }

    // Step 2: Render each clipped layer with source-atop.
    for (const clipped of clippedLayers) {
      if (!clipped.visible) continue;
      if (hiddenLayerIds?.has(clipped.id)) continue;

      // Render the clipped layer's content to a separate temp canvas first,
      // then composite onto clipCanvas with source-atop.
      const layerCanvas = this.pool.acquire(width, height);
      const layerCtx = layerCanvas.getContext('2d');
      if (!layerCtx) {
        this.pool.release(layerCanvas);
        continue;
      }

      layerCtx.clearRect(0, 0, width, height);

      if (clipped.type === 'group') {
        this.renderGroup(layerCtx, clipped, options, hiddenLayerIds, effectsOnlyLayerIds);
      } else {
        this.renderLayerDirect(layerCtx, clipped, options);
      }

      // Composite onto clip canvas: confine to base alpha.
      clipCtx.save();
      clipCtx.globalCompositeOperation = 'source-atop';
      clipCtx.drawImage(layerCanvas, 0, 0);
      clipCtx.restore();

      this.pool.release(layerCanvas);

      // Effects are rendered AFTER clipping, directly onto the main context.
      if (options.renderEffects && clipped.type !== 'group' && clipped.effects.length > 0) {
        this.renderEffectsInFront(ctx, clipped);
      }
    }

    // Step 3: Composite the clipping group onto the main canvas
    // using the base layer's blend mode and opacity.
    ctx.save();
    ctx.globalAlpha = baseLayer.opacity;
    ctx.globalCompositeOperation = baseLayer.blendMode;
    ctx.drawImage(clipCanvas, 0, 0);
    ctx.restore();

    this.pool.release(clipCanvas);
  }

  /**
   * Render a single non-group layer without applying its own opacity/blendMode
   * to the context. Used inside clipping group rendering so that the base's
   * blend mode governs the final composite.
   */
  private renderLayerDirect(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    options: RenderOptions,
  ): void {
    // Render behind-effects (e.g. drop shadow) — only for base layer in clipping groups.
    if (options.renderEffects && layer.effects.length > 0) {
      this.renderEffectsBehind(ctx, layer);
    }

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode;

    if (layer.type === 'raster') {
      this.drawRasterLayer(ctx, layer);
    } else {
      this.drawTextLayer(ctx, layer);
    }

    ctx.restore();

    // In-front effects are handled by the caller for clipped layers,
    // but for the base layer they are part of the base rendering.
    if (options.renderEffects && layer.effects.length > 0) {
      this.renderEffectsInFront(ctx, layer);
    }
  }

  /**
   * Render a sub-group to a temporary canvas, then draw it with group opacity/blend.
   */
  private renderGroupAsComposite(
    ctx: CanvasContext2DLike,
    group: LayerGroup,
    options: RenderOptions,
    hiddenLayerIds: ReadonlySet<string> | null,
    effectsOnlyLayerIds?: ReadonlySet<string> | null,
  ): void {
    const { width, height } = ctx.canvas;
    const tempCanvas = this.pool.acquire(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.clearRect(0, 0, width, height);

    // Render children to temp canvas
    this.renderGroup(tempCtx, group, options, hiddenLayerIds, effectsOnlyLayerIds);

    // Composite to parent with group opacity/blend
    ctx.save();
    ctx.globalAlpha = group.opacity;
    ctx.globalCompositeOperation = group.blendMode;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    this.pool.release(tempCanvas);
  }

  /**
   * Render a single layer (raster or text).
   */
  private renderLayer(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    options: RenderOptions,
    effectsOnly = false,
  ): void {
    // Render effects before the layer (behind effects like shadow)
    if (options.renderEffects && layer.effects.length > 0) {
      this.renderEffectsBehind(ctx, layer);
    }

    // When effectsOnly is true, skip drawing the actual layer content
    // (the text/raster) so the inline editor overlay can show it instead.
    if (!effectsOnly) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      if (layer.type === 'raster') {
        this.drawRasterLayer(ctx, layer);
      } else {
        this.drawTextLayer(ctx, layer);
      }

      ctx.restore();
    }

    // Render effects after (in front effects like stroke)
    if (options.renderEffects && layer.effects.length > 0) {
      this.renderEffectsInFront(ctx, layer);
    }
  }

  /**
   * Draw a raster layer. Uses temp canvas to respect globalAlpha/compositeOp.
   */
  private drawRasterLayer(ctx: CanvasContext2DLike, layer: RasterLayer): void {
    if (!layer.imageData) return;

    const { width, height } = layer.bounds;
    if (width <= 0 || height <= 0) return;

    // putImageData ignores globalAlpha, so we must:
    // 1. Draw imageData to a temp canvas
    // 2. drawImage from temp canvas to main canvas
    const tempCanvas = this.pool.acquire(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.putImageData(layer.imageData, 0, 0);

    // Apply mask if present
    if (layer.mask?.enabled && layer.mask.data.length > 0) {
      this.applyMask(tempCtx, layer);
    }

    ctx.drawImage(tempCanvas, layer.position.x, layer.position.y);
    this.pool.release(tempCanvas);
  }

  /**
   * Draw a text layer using Canvas 2D text rendering.
   * Supports font styling, color, alignment, multi-line text, word wrapping,
   * and vertical writing mode (PS-TEXT-001).
   */
  private drawTextLayer(ctx: CanvasContext2DLike, layer: TextLayer): void {
    this.renderTextContent(ctx, layer);
  }

  /**
   * Reusable text rendering helper for drawing text content with optional style overrides.
   * Used by drawTextLayer (normal) and effect renderers (shadow/stroke/glow/overlay).
   */
  private renderTextContent(
    ctx: CanvasContext2DLike,
    layer: TextLayer,
    overrides?: {
      fillStyle?: string | CanvasGradient | CanvasPattern;
      strokeStyle?: string;
      lineWidth?: number;
      renderFill?: boolean;
    },
  ): void {
    const tc = ctx as unknown as CanvasRenderingContext2D;

    ctx.save();

    // Build font string
    const fontStyle = layer.italic ? 'italic' : 'normal';
    const fontWeight = layer.bold ? 'bold' : 'normal';
    tc.font = `${fontStyle} ${fontWeight} ${layer.fontSize}px ${withCanvasTextFallback(layer.fontFamily)}`;

    // Color -> CSS rgba (use override if provided)
    if (overrides?.fillStyle) {
      ctx.fillStyle = overrides.fillStyle;
    } else {
      const { r, g, b, a } = layer.color;
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
    }

    // Letter spacing (Chrome 99+)
    if ('letterSpacing' in tc) {
      (tc as unknown as Record<string, string>).letterSpacing = `${layer.letterSpacing}px`;
    }

    if (overrides?.strokeStyle) {
      (tc as unknown as Record<string, string>).strokeStyle = overrides.strokeStyle;
      (tc as unknown as Record<string, number>).lineWidth = overrides.lineWidth ?? 1;
    }

    if (layer.writingMode === 'vertical-rl') {
      this.drawTextVertical(tc, layer, overrides);
    } else {
      this.drawTextHorizontal(tc, layer, overrides);
    }

    ctx.restore();
  }

  /**
   * Draw text in horizontal-tb mode (default).
   * Supports justify alignment and underline/strikethrough decorations.
   */
  private drawTextHorizontal(
    tc: CanvasRenderingContext2D,
    layer: TextLayer,
    overrides?: {
      fillStyle?: string | CanvasGradient | CanvasPattern;
      strokeStyle?: string;
      lineWidth?: number;
      renderFill?: boolean;
    },
  ): void {
    const isJustify = layer.alignment === 'justify';
    tc.textAlign = isJustify ? 'left' : layer.alignment as CanvasTextAlign;
    tc.textBaseline = 'top';

    const lineH = layer.fontSize * layer.lineHeight;
    let x = layer.position.x;
    const y = layer.position.y;

    if (layer.textBounds && !isJustify) {
      if (layer.alignment === 'center') {
        x = layer.position.x + layer.textBounds.width / 2;
      } else if (layer.alignment === 'right') {
        x = layer.position.x + layer.textBounds.width;
      }
    }

    const lines = this.getTextLines(tc, layer);
    const isLastLine = (i: number): boolean => i === lines.length - 1;

    for (let i = 0; i < lines.length; i++) {
      const ly = y + i * lineH;

      if (isJustify && layer.textBounds && layer.textBounds.width > 0 && !isLastLine(i)) {
        // Justify: distribute words evenly across textBounds width
        this.drawJustifiedLine(tc, lines[i], layer.position.x, ly, layer.textBounds.width, overrides);
      } else {
        if (overrides?.strokeStyle) {
          tc.strokeText(lines[i], x, ly);
        }
        if (overrides?.renderFill ?? true) {
          tc.fillText(lines[i], x, ly);
        }
      }

      // Draw text decorations
      this.drawTextDecorations(tc, layer, lines[i], x, ly, overrides);
    }
  }

  /**
   * Draw a single line of text with justified (evenly distributed) word spacing.
   */
  private drawJustifiedLine(
    tc: CanvasRenderingContext2D,
    line: string,
    x: number,
    y: number,
    maxWidth: number,
    overrides?: {
      strokeStyle?: string;
      renderFill?: boolean;
    },
  ): void {
    const words = line.split(' ');
    if (words.length <= 1) {
      if (overrides?.strokeStyle) {
        tc.strokeText(line, x, y);
      }
      if (overrides?.renderFill ?? true) {
        tc.fillText(line, x, y);
      }
      return;
    }

    let totalWordWidth = 0;
    for (const word of words) {
      totalWordWidth += tc.measureText(word).width;
    }
    const gap = (maxWidth - totalWordWidth) / (words.length - 1);

    let cx = x;
    for (const word of words) {
      if (overrides?.strokeStyle) {
        tc.strokeText(word, cx, y);
      }
      if (overrides?.renderFill ?? true) {
        tc.fillText(word, cx, y);
      }
      cx += tc.measureText(word).width + gap;
    }
  }

  /**
   * Draw underline and/or strikethrough decorations for a text line.
   */
  private drawTextDecorations(
    tc: CanvasRenderingContext2D,
    layer: TextLayer,
    lineText: string,
    x: number,
    y: number,
    overrides?: {
      strokeStyle?: string;
    },
  ): void {
    if (!layer.underline && !layer.strikethrough) return;

    const lineWidth = Math.max(1, layer.fontSize / 15);
    const textWidth = tc.measureText(lineText).width;

    // Determine line start x for different alignments
    let startX = x;
    if (layer.alignment === 'center') {
      startX = x - textWidth / 2;
    } else if (layer.alignment === 'right') {
      startX = x - textWidth;
    }

    // Use current fillStyle for decoration color (or stroke override)
    const prevStrokeStyle = (tc as unknown as Record<string, string>).strokeStyle;
    const prevLineWidth = (tc as unknown as Record<string, number>).lineWidth;
    if (overrides?.strokeStyle) {
      (tc as unknown as Record<string, string>).strokeStyle = overrides.strokeStyle;
    } else {
      (tc as unknown as Record<string, string | CanvasGradient | CanvasPattern>).strokeStyle = tc.fillStyle;
    }
    (tc as unknown as Record<string, number>).lineWidth = lineWidth;

    if (layer.underline) {
      const underlineY = y + layer.fontSize;
      tc.beginPath();
      tc.moveTo(startX, underlineY);
      tc.lineTo(startX + textWidth, underlineY);
      tc.stroke();
    }

    if (layer.strikethrough) {
      const strikeY = y + layer.fontSize * 0.5;
      tc.beginPath();
      tc.moveTo(startX, strikeY);
      tc.lineTo(startX + textWidth, strikeY);
      tc.stroke();
    }

    // Restore
    (tc as unknown as Record<string, string>).strokeStyle = prevStrokeStyle;
    (tc as unknown as Record<string, number>).lineWidth = prevLineWidth;
  }

  /**
   * Draw text in vertical-rl mode.
   * Each character is drawn individually, top-to-bottom, columns right-to-left.
   */
  private drawTextVertical(
    tc: CanvasRenderingContext2D,
    layer: TextLayer,
    overrides?: {
      strokeStyle?: string;
      renderFill?: boolean;
    },
  ): void {
    tc.textAlign = 'center';
    tc.textBaseline = 'middle';

    const charH = layer.fontSize * layer.lineHeight;
    const colW = layer.fontSize * layer.lineHeight;
    const lines = layer.text.split('\n');

    const startX = layer.position.x + (lines.length - 1) * colW + layer.fontSize / 2;
    const startY = layer.position.y + layer.fontSize / 2;

    const decoLineWidth = Math.max(1, layer.fontSize / 15);

    for (let col = 0; col < lines.length; col++) {
      const x = startX - col * colW;
      const chars = [...lines[col]];
      for (let row = 0; row < chars.length; row++) {
        const cy = startY + row * charH;
        if (overrides?.strokeStyle) {
          tc.strokeText(chars[row], x, cy);
        }
        if (overrides?.renderFill ?? true) {
          tc.fillText(chars[row], x, cy);
        }

        // Vertical decorations: underline = line to the right, strikethrough = through center
        if (layer.underline || layer.strikethrough) {
          const prevStrokeStyle = (tc as unknown as Record<string, string>).strokeStyle;
          const prevLW = (tc as unknown as Record<string, number>).lineWidth;
          if (overrides?.strokeStyle) {
            (tc as unknown as Record<string, string>).strokeStyle = overrides.strokeStyle;
          } else {
            (tc as unknown as Record<string, string | CanvasGradient | CanvasPattern>).strokeStyle = tc.fillStyle;
          }
          (tc as unknown as Record<string, number>).lineWidth = decoLineWidth;

          if (layer.underline) {
            const lx = x + layer.fontSize / 2;
            tc.beginPath();
            tc.moveTo(lx, cy - charH / 2);
            tc.lineTo(lx, cy + charH / 2);
            tc.stroke();
          }
          if (layer.strikethrough) {
            tc.beginPath();
            tc.moveTo(x, cy - charH / 2);
            tc.lineTo(x, cy + charH / 2);
            tc.stroke();
          }

          (tc as unknown as Record<string, string>).strokeStyle = prevStrokeStyle;
          (tc as unknown as Record<string, number>).lineWidth = prevLW;
        }
      }
    }
  }

  /**
   * Get text lines, applying word wrap if textBounds is set.
   */
  private getTextLines(
    ctx: CanvasRenderingContext2D | { measureText(text: string): { width: number } },
    layer: TextLayer,
  ): string[] {
    const rawLines = layer.text.split('\n');

    if (!layer.textBounds || layer.textBounds.width <= 0) {
      return rawLines;
    }

    const maxWidth = layer.textBounds.width;
    const wrapped: string[] = [];

    for (const line of rawLines) {
      if (line === '') {
        wrapped.push('');
        continue;
      }

      const words = line.split(' ');
      // No-space languages (e.g., Japanese) and long unbroken tokens
      // need character-level wrapping to match inline contentEditable behavior.
      if (words.length <= 1) {
        wrapped.push(...this.wrapTextByCharacter(ctx, line, maxWidth));
        continue;
      }
      let current = '';

      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        const metrics = ctx.measureText(test);
        if (metrics.width > maxWidth && current) {
          wrapped.push(current);
          if (ctx.measureText(word).width > maxWidth) {
            const parts = this.wrapTextByCharacter(ctx, word, maxWidth);
            wrapped.push(...parts.slice(0, -1));
            current = parts[parts.length - 1] ?? '';
          } else {
            current = word;
          }
        } else {
          if (metrics.width > maxWidth) {
            const parts = this.wrapTextByCharacter(ctx, word, maxWidth);
            wrapped.push(...parts.slice(0, -1));
            current = parts[parts.length - 1] ?? '';
          } else {
            current = test;
          }
        }
      }

      if (current) {
        wrapped.push(current);
      }
    }

    return wrapped;
  }

  /**
   * Wrap a string at character boundaries so CJK text without spaces
   * still respects textBounds width.
   */
  private wrapTextByCharacter(
    ctx: CanvasRenderingContext2D | { measureText(text: string): { width: number } },
    text: string,
    maxWidth: number,
  ): string[] {
    const chars = [...text];
    const lines: string[] = [];
    let current = '';

    for (const ch of chars) {
      const test = `${current}${ch}`;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * Apply a layer mask to a temp canvas context.
   * Sets pixels to transparent where mask is 0.
   */
  private applyMask(ctx: CanvasContext2DLike, layer: RasterLayer): void {
    const mask = layer.mask;
    if (!mask || !mask.enabled || !mask.data.length) return;

    const width = Math.max(0, Math.floor(layer.bounds.width));
    const height = Math.max(0, Math.floor(layer.bounds.height));
    if (width <= 0 || height <= 0) return;

    const tc = ctx as unknown as CanvasRenderingContext2D;
    if (typeof tc.getImageData !== 'function' || typeof tc.putImageData !== 'function') return;

    try {
      const imageData = tc.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const maskWidth = mask.width;
      const maskHeight = mask.height;
      const offsetX = Math.round(mask.offset.x);
      const offsetY = Math.round(mask.offset.y);

      for (let y = 0; y < height; y++) {
        const my = y - offsetY;
        const maskYInRange = my >= 0 && my < maskHeight;

        for (let x = 0; x < width; x++) {
          let maskAlpha = 0;
          if (maskYInRange) {
            const mx = x - offsetX;
            if (mx >= 0 && mx < maskWidth) {
              const maskIndex = my * maskWidth + mx;
              if (maskIndex >= 0 && maskIndex < mask.data.length) {
                maskAlpha = mask.data[maskIndex];
              }
            }
          }

          const alphaIndex = (y * width + x) * 4 + 3;
          pixels[alphaIndex] = Math.round((pixels[alphaIndex] * maskAlpha) / 255);
        }
      }

      tc.putImageData(imageData, 0, 0);
    } catch {
      // getImageData may be unavailable in restricted test environments.
    }
  }

  /**
   * Render effects that go behind the layer (e.g. drop shadow).
   */
  private renderEffectsBehind(ctx: CanvasContext2DLike, layer: RasterLayer | TextLayer): void {
    for (const effect of layer.effects) {
      if (!effect.enabled) continue;
      if (effect.type === 'drop-shadow') {
        this.renderDropShadow(ctx, layer, effect);
      } else if (effect.type === 'outer-glow') {
        this.renderOuterGlow(ctx, layer, effect);
      }
    }
  }

  /**
   * Render effects that go in front of the layer (e.g. stroke, color overlay).
   */
  private renderEffectsInFront(ctx: CanvasContext2DLike, layer: RasterLayer | TextLayer): void {
    for (const effect of layer.effects) {
      if (!effect.enabled) continue;
      if (effect.type === 'inner-shadow') {
        this.renderInnerShadow(ctx, layer, effect);
      } else if (effect.type === 'inner-glow') {
        this.renderInnerGlow(ctx, layer, effect);
      } else if (effect.type === 'gradient-overlay') {
        this.renderGradientOverlay(ctx, layer, effect);
      } else if (effect.type === 'bevel-emboss') {
        this.renderBevelEmboss(ctx, layer, effect);
      } else if (effect.type === 'stroke') {
        this.renderStroke(ctx, layer, effect);
      } else if (effect.type === 'color-overlay') {
        this.renderColorOverlay(ctx, layer, effect);
      }
    }
  }

  private renderDropShadow(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: DropShadowEffect,
  ): void {
    const { color, opacity, angle, distance, blur, spread } = effect;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * distance;
    const dy = -Math.sin(rad) * distance;

    if (layer.type === 'text') {
      ctx.save();
      ctx.globalAlpha = opacity;
      const spreadRatio = Math.max(0, Math.min(1, (spread ?? 0) / 100));
      const effectiveBlur = Math.max(0, blur * (1 - spreadRatio));
      ctx.filter = `blur(${effectiveBlur}px)`;
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      const tc = ctx as unknown as CanvasRenderingContext2D;
      tc.translate(dx, dy);
      this.renderTextContent(ctx, layer, {
        fillStyle: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
      });
      ctx.restore();
      return;
    }

    // Raster: use alpha silhouette
    const bounds = this.getEffectBounds(layer);
    if (!bounds) return;

    const spreadRatio = Math.max(0, Math.min(1, (spread ?? 0) / 100));
    const effectiveBlur = Math.max(0, blur * (1 - spreadRatio));
    const padding = Math.ceil(Math.abs(dx) + Math.abs(dy) + blur + 2);
    const workWidth = bounds.width + padding * 2;
    const workHeight = bounds.height + padding * 2;
    if (workWidth <= 0 || workHeight <= 0) return;

    const maskCanvas = this.pool.acquire(workWidth, workHeight);
    const colorCanvas = this.pool.acquire(workWidth, workHeight);

    try {
      const maskCtx = maskCanvas.getContext('2d');
      const colorCtx = colorCanvas.getContext('2d');
      if (!maskCtx || !colorCtx) return;

      if (!this.renderLayerMask(maskCtx, layer, padding, workWidth, workHeight)) return;

      // Draw shifted mask with blur
      colorCtx.clearRect(0, 0, workWidth, workHeight);
      colorCtx.filter = `blur(${effectiveBlur}px)`;
      colorCtx.drawImage(maskCanvas, dx, dy);
      colorCtx.filter = 'none';

      // Tint with shadow color
      colorCtx.globalCompositeOperation = 'source-in';
      colorCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      colorCtx.fillRect(0, 0, workWidth, workHeight);
      colorCtx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(colorCanvas, layer.position.x - padding, layer.position.y - padding);
      ctx.restore();
    } finally {
      this.pool.release(maskCanvas);
      this.pool.release(colorCanvas);
    }
  }

  private renderOuterGlow(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: OuterGlowEffect,
  ): void {
    const { color, opacity, size, spread } = effect;

    if (layer.type === 'text') {
      ctx.save();
      ctx.globalAlpha = opacity;
      const spreadRatio = Math.max(0, Math.min(1, (spread ?? 0) / 100));
      const effectiveBlur = Math.max(0, size * (1 - spreadRatio));
      ctx.filter = `blur(${effectiveBlur}px)`;
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      this.renderTextContent(ctx, layer, {
        fillStyle: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
      });
      ctx.restore();
      return;
    }

    // Raster: use alpha silhouette
    const bounds = this.getEffectBounds(layer);
    if (!bounds) return;

    const spreadRatio = Math.max(0, Math.min(1, (spread ?? 0) / 100));
    const effectiveBlur = Math.max(0, size * (1 - spreadRatio));
    const padding = Math.ceil(size + 2);
    const workWidth = bounds.width + padding * 2;
    const workHeight = bounds.height + padding * 2;
    if (workWidth <= 0 || workHeight <= 0) return;

    const maskCanvas = this.pool.acquire(workWidth, workHeight);
    const colorCanvas = this.pool.acquire(workWidth, workHeight);

    try {
      const maskCtx = maskCanvas.getContext('2d');
      const colorCtx = colorCanvas.getContext('2d');
      if (!maskCtx || !colorCtx) return;

      if (!this.renderLayerMask(maskCtx, layer, padding, workWidth, workHeight)) return;

      // Blur the mask
      colorCtx.clearRect(0, 0, workWidth, workHeight);
      colorCtx.filter = `blur(${effectiveBlur}px)`;
      colorCtx.drawImage(maskCanvas, 0, 0);
      colorCtx.filter = 'none';

      // Tint with glow color
      colorCtx.globalCompositeOperation = 'source-in';
      colorCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      colorCtx.fillRect(0, 0, workWidth, workHeight);
      colorCtx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(colorCanvas, layer.position.x - padding, layer.position.y - padding);
      ctx.restore();
    } finally {
      this.pool.release(maskCanvas);
      this.pool.release(colorCanvas);
    }
  }

  /**
   * Render inner shadow by building an interior edge mask, blurring it,
   * then tinting and compositing it back onto the layer.
   */
  private renderInnerShadow(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: InnerShadowEffect,
  ): void {
    const bounds = this.getEffectBounds(layer);
    if (!bounds) return;

    const { color, opacity, angle, distance, blur, choke } = effect;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * distance;
    const dy = -Math.sin(rad) * distance;
    const padding = Math.ceil(Math.abs(dx) + Math.abs(dy) + blur + 2);

    const workWidth = bounds.width + padding * 2;
    const workHeight = bounds.height + padding * 2;
    if (workWidth <= 0 || workHeight <= 0) return;

    const maskCanvas = this.pool.acquire(workWidth, workHeight);
    const edgeCanvas = this.pool.acquire(workWidth, workHeight);
    const blurCanvas = this.pool.acquire(workWidth, workHeight);
    const colorCanvas = this.pool.acquire(workWidth, workHeight);

    try {
      const maskCtx = maskCanvas.getContext('2d');
      const edgeCtx = edgeCanvas.getContext('2d');
      const blurCtx = blurCanvas.getContext('2d');
      const colorCtx = colorCanvas.getContext('2d');
      if (!maskCtx || !edgeCtx || !blurCtx || !colorCtx) return;

      if (!this.renderLayerMask(maskCtx, layer, padding, workWidth, workHeight)) return;

      // Build an inner edge mask: source minus shifted source.
      edgeCtx.clearRect(0, 0, workWidth, workHeight);
      edgeCtx.drawImage(maskCanvas, 0, 0);
      edgeCtx.globalCompositeOperation = 'destination-out';
      edgeCtx.drawImage(maskCanvas, dx, dy);
      edgeCtx.globalCompositeOperation = 'source-over';

      // Choke reduces blur falloff. We approximate by shrinking blur radius and boosting opacity.
      const chokeRatio = Math.max(0, Math.min(1, choke / 100));
      const blurRadius = Math.max(0, blur * (1 - chokeRatio));
      const opacityBoost = Math.min(1, opacity * (1 + chokeRatio * 0.5));

      blurCtx.clearRect(0, 0, workWidth, workHeight);
      blurCtx.filter = `blur(${blurRadius}px)`;
      blurCtx.drawImage(edgeCanvas, 0, 0);
      blurCtx.filter = 'none';
      blurCtx.globalCompositeOperation = 'destination-in';
      blurCtx.drawImage(maskCanvas, 0, 0);
      blurCtx.globalCompositeOperation = 'source-over';

      colorCtx.clearRect(0, 0, workWidth, workHeight);
      colorCtx.drawImage(blurCanvas, 0, 0);
      colorCtx.globalCompositeOperation = 'source-in';
      colorCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      colorCtx.fillRect(0, 0, workWidth, workHeight);
      colorCtx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalAlpha = opacityBoost;
      ctx.drawImage(
        colorCanvas,
        layer.position.x - padding,
        layer.position.y - padding,
      );
      ctx.restore();
    } finally {
      this.pool.release(maskCanvas);
      this.pool.release(edgeCanvas);
      this.pool.release(blurCanvas);
      this.pool.release(colorCanvas);
    }
  }

  /**
   * Render inner glow inside the layer shape.
   * - edge: ring mask near inner boundary
   * - center: full interior mask with blurred falloff
   */
  private renderInnerGlow(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: InnerGlowEffect,
  ): void {
    const bounds = this.getEffectBounds(layer);
    if (!bounds) return;

    const { color, opacity, size, choke, source } = effect;
    const padding = Math.ceil(size + 2);
    const workWidth = bounds.width + padding * 2;
    const workHeight = bounds.height + padding * 2;
    if (workWidth <= 0 || workHeight <= 0) return;

    const maskCanvas = this.pool.acquire(workWidth, workHeight);
    const shapeCanvas = this.pool.acquire(workWidth, workHeight);
    const blurCanvas = this.pool.acquire(workWidth, workHeight);
    const colorCanvas = this.pool.acquire(workWidth, workHeight);

    try {
      const maskCtx = maskCanvas.getContext('2d');
      const shapeCtx = shapeCanvas.getContext('2d');
      const blurCtx = blurCanvas.getContext('2d');
      const colorCtx = colorCanvas.getContext('2d');
      if (!maskCtx || !shapeCtx || !blurCtx || !colorCtx) return;

      if (!this.renderLayerMask(maskCtx, layer, padding, workWidth, workHeight)) return;

      const chokeRatio = Math.max(0, Math.min(1, choke / 100));
      const blurRadius = Math.max(0, size * (1 - chokeRatio));

      shapeCtx.clearRect(0, 0, workWidth, workHeight);
      shapeCtx.drawImage(maskCanvas, 0, 0);

      if (source === 'edge') {
        // Keep only a ring near the inner edge.
        const inset = Math.max(1, Math.round(size * 0.5 + chokeRatio * size));
        const innerW = Math.max(1, workWidth - inset * 2);
        const innerH = Math.max(1, workHeight - inset * 2);
        shapeCtx.globalCompositeOperation = 'destination-out';
        shapeCtx.drawImage(maskCanvas, inset, inset, innerW, innerH);
        shapeCtx.globalCompositeOperation = 'source-over';
      } else {
        // Center source: keep more interior density by masking with a shrunken silhouette.
        const inset = Math.max(0, Math.round(chokeRatio * size * 0.75));
        if (inset > 0) {
          const innerW = Math.max(1, workWidth - inset * 2);
          const innerH = Math.max(1, workHeight - inset * 2);
          shapeCtx.globalCompositeOperation = 'destination-in';
          shapeCtx.drawImage(maskCanvas, inset, inset, innerW, innerH);
          shapeCtx.globalCompositeOperation = 'source-over';
        }
      }

      blurCtx.clearRect(0, 0, workWidth, workHeight);
      blurCtx.filter = `blur(${blurRadius}px)`;
      blurCtx.drawImage(shapeCanvas, 0, 0);
      blurCtx.filter = 'none';
      blurCtx.globalCompositeOperation = 'destination-in';
      blurCtx.drawImage(maskCanvas, 0, 0);
      blurCtx.globalCompositeOperation = 'source-over';

      colorCtx.clearRect(0, 0, workWidth, workHeight);
      colorCtx.drawImage(blurCanvas, 0, 0);
      colorCtx.globalCompositeOperation = 'source-in';
      colorCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      colorCtx.fillRect(0, 0, workWidth, workHeight);
      colorCtx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(colorCanvas, layer.position.x - padding, layer.position.y - padding);
      ctx.restore();
    } finally {
      this.pool.release(maskCanvas);
      this.pool.release(shapeCanvas);
      this.pool.release(blurCanvas);
      this.pool.release(colorCanvas);
    }
  }

  /**
   * Render gradient overlay for raster/text layers.
   */
  private renderGradientOverlay(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: GradientOverlayEffect,
  ): void {
    const bounds = this.getEffectBounds(layer);
    if (!bounds) return;

    if (layer.type === 'text') {
      const tc = ctx as unknown as CanvasRenderingContext2D;
      const gradient = this.createEffectGradient(tc, effect, bounds.width, bounds.height, {
        x: layer.position.x,
        y: layer.position.y,
      });
      ctx.save();
      ctx.globalAlpha = effect.opacity;
      this.renderTextContent(ctx, layer, { fillStyle: gradient });
      ctx.restore();
      return;
    }

    const gradientCanvas = this.pool.acquire(bounds.width, bounds.height);
    const maskCanvas = this.pool.acquire(bounds.width, bounds.height);

    try {
      const gradientCtx = gradientCanvas.getContext('2d');
      const maskCtx = maskCanvas.getContext('2d');
      if (!gradientCtx || !maskCtx) return;
      if (!this.renderLayerMask(maskCtx, layer, 0, bounds.width, bounds.height)) return;

      const gtc = gradientCtx as unknown as CanvasRenderingContext2D;
      const gradient = this.createEffectGradient(gtc, effect, bounds.width, bounds.height, { x: 0, y: 0 });
      gtc.clearRect(0, 0, bounds.width, bounds.height);
      gtc.fillStyle = gradient;
      gtc.fillRect(0, 0, bounds.width, bounds.height);
      gtc.globalCompositeOperation = 'destination-in';
      gradientCtx.drawImage(maskCanvas, 0, 0);
      gtc.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalAlpha = effect.opacity;
      ctx.drawImage(gradientCanvas, layer.position.x, layer.position.y);
      ctx.restore();
    } finally {
      this.pool.release(gradientCanvas);
      this.pool.release(maskCanvas);
    }
  }

  /**
   * Approximate Bevel & Emboss using directional edge masks and tinted light/shadow passes.
   */
  private renderBevelEmboss(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: BevelEmbossEffect,
  ): void {
    const bounds = this.getEffectBounds(layer);
    if (!bounds) return;

    const altitude = Math.max(0, Math.min(90, effect.altitude));
    const altitudeRad = (altitude * Math.PI) / 180;
    const depthFactor = Math.max(0.01, effect.depth / 100);
    const altitudeFactor = Math.max(0.15, Math.cos(altitudeRad));
    const edgeDistance = Math.max(1, effect.size * depthFactor * altitudeFactor * 0.5);
    const rad = (effect.angle * Math.PI) / 180;
    const dx = Math.cos(rad) * edgeDistance;
    const dy = -Math.sin(rad) * edgeDistance;
    const padding = Math.ceil(effect.size + Math.abs(dx) + Math.abs(dy) + effect.soften + 3);
    const workWidth = bounds.width + padding * 2;
    const workHeight = bounds.height + padding * 2;
    if (workWidth <= 0 || workHeight <= 0) return;

    const maskCanvas = this.pool.acquire(workWidth, workHeight);
    const shiftedPosCanvas = this.pool.acquire(workWidth, workHeight);
    const shiftedNegCanvas = this.pool.acquire(workWidth, workHeight);
    const highlightEdgeCanvas = this.pool.acquire(workWidth, workHeight);
    const shadowEdgeCanvas = this.pool.acquire(workWidth, workHeight);
    const highlightBlurCanvas = this.pool.acquire(workWidth, workHeight);
    const shadowBlurCanvas = this.pool.acquire(workWidth, workHeight);
    const highlightColorCanvas = this.pool.acquire(workWidth, workHeight);
    const shadowColorCanvas = this.pool.acquire(workWidth, workHeight);
    const tempCanvas = this.pool.acquire(workWidth, workHeight);

    try {
      const maskCtx = maskCanvas.getContext('2d');
      const shiftedPosCtx = shiftedPosCanvas.getContext('2d');
      const shiftedNegCtx = shiftedNegCanvas.getContext('2d');
      const highlightEdgeCtx = highlightEdgeCanvas.getContext('2d');
      const shadowEdgeCtx = shadowEdgeCanvas.getContext('2d');
      const highlightBlurCtx = highlightBlurCanvas.getContext('2d');
      const shadowBlurCtx = shadowBlurCanvas.getContext('2d');
      const highlightColorCtx = highlightColorCanvas.getContext('2d');
      const shadowColorCtx = shadowColorCanvas.getContext('2d');
      const tempCtx = tempCanvas.getContext('2d');

      if (
        !maskCtx
        || !shiftedPosCtx
        || !shiftedNegCtx
        || !highlightEdgeCtx
        || !shadowEdgeCtx
        || !highlightBlurCtx
        || !shadowBlurCtx
        || !highlightColorCtx
        || !shadowColorCtx
        || !tempCtx
      ) {
        return;
      }

      if (!this.renderLayerMask(maskCtx, layer, padding, workWidth, workHeight)) return;

      shiftedPosCtx.clearRect(0, 0, workWidth, workHeight);
      shiftedPosCtx.drawImage(maskCanvas, dx, dy);
      shiftedNegCtx.clearRect(0, 0, workWidth, workHeight);
      shiftedNegCtx.drawImage(maskCanvas, -dx, -dy);

      const styleMode =
        effect.style === 'outer-bevel'
          ? 'outer'
          : effect.style === 'emboss'
            ? 'both'
            : 'inner';

      const buildEdges = (targetCtx: CanvasContext2DLike, shiftedCanvas: CanvasLike): void => {
        targetCtx.clearRect(0, 0, workWidth, workHeight);
        if (styleMode === 'inner') {
          this.composeInnerEdge(targetCtx, maskCanvas, shiftedCanvas, workWidth, workHeight);
          return;
        }
        if (styleMode === 'outer') {
          this.composeOuterEdge(targetCtx, shiftedCanvas, maskCanvas, workWidth, workHeight);
          return;
        }
        // both (emboss): add inner + outer terms.
        this.composeInnerEdge(targetCtx, maskCanvas, shiftedCanvas, workWidth, workHeight);
        this.composeOuterEdge(tempCtx, shiftedCanvas, maskCanvas, workWidth, workHeight);
        targetCtx.drawImage(tempCanvas, 0, 0);
      };

      buildEdges(highlightEdgeCtx, shiftedPosCanvas);
      buildEdges(shadowEdgeCtx, shiftedNegCanvas);

      const blurRadius = Math.max(0, effect.soften + effect.size * 0.25);
      highlightBlurCtx.clearRect(0, 0, workWidth, workHeight);
      shadowBlurCtx.clearRect(0, 0, workWidth, workHeight);
      highlightBlurCtx.filter = `blur(${blurRadius}px)`;
      shadowBlurCtx.filter = `blur(${blurRadius}px)`;
      highlightBlurCtx.drawImage(highlightEdgeCanvas, 0, 0);
      shadowBlurCtx.drawImage(shadowEdgeCanvas, 0, 0);
      highlightBlurCtx.filter = 'none';
      shadowBlurCtx.filter = 'none';

      const swapPolarity =
        effect.direction === 'down'
          ? effect.style !== 'pillow-emboss'
          : effect.style === 'pillow-emboss';
      const hiColor = swapPolarity ? effect.shadowColor : effect.highlightColor;
      const hiOpacityBase = swapPolarity ? effect.shadowOpacity : effect.highlightOpacity;
      const shColor = swapPolarity ? effect.highlightColor : effect.shadowColor;
      const shOpacityBase = swapPolarity ? effect.highlightOpacity : effect.shadowOpacity;
      const depthBoost = Math.max(0.25, Math.min(2, effect.depth / 100));
      const hiOpacity = Math.min(1, hiOpacityBase * depthBoost);
      const shOpacity = Math.min(1, shOpacityBase * depthBoost);

      this.tintEdgeMask(highlightColorCtx, highlightBlurCanvas, hiColor, workWidth, workHeight);
      this.tintEdgeMask(shadowColorCtx, shadowBlurCanvas, shColor, workWidth, workHeight);

      ctx.save();
      ctx.globalAlpha = hiOpacity;
      ctx.drawImage(highlightColorCanvas, layer.position.x - padding, layer.position.y - padding);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = shOpacity;
      ctx.drawImage(shadowColorCanvas, layer.position.x - padding, layer.position.y - padding);
      ctx.restore();
    } finally {
      this.pool.release(maskCanvas);
      this.pool.release(shiftedPosCanvas);
      this.pool.release(shiftedNegCanvas);
      this.pool.release(highlightEdgeCanvas);
      this.pool.release(shadowEdgeCanvas);
      this.pool.release(highlightBlurCanvas);
      this.pool.release(shadowBlurCanvas);
      this.pool.release(highlightColorCanvas);
      this.pool.release(shadowColorCanvas);
      this.pool.release(tempCanvas);
    }
  }

  private renderStroke(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: StrokeEffect,
  ): void {
    const { color, size: strokeSize, position, opacity } = effect;
    const strokeColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (layer.type === 'text') {
      let lineWidth = strokeSize;
      if (position === 'outside') {
        lineWidth = strokeSize * 2;
      } else if (position === 'inside') {
        lineWidth = strokeSize * 2;
      }

      // Draw stroke behind, then fill on top for inside position
      this.renderTextContent(ctx, layer, {
        strokeStyle: strokeColor,
        lineWidth,
        renderFill: false,
      });

      if (position === 'inside') {
        // Overdraw fill to mask inner half of the stroke
        this.renderTextContent(ctx, layer);
      }

      ctx.restore();
      return;
    }

    // Raster: stroke along alpha silhouette boundary
    const bounds = this.getEffectBounds(layer);
    if (!bounds) { ctx.restore(); return; }

    const padding = Math.ceil(strokeSize + 2);
    const workWidth = bounds.width + padding * 2;
    const workHeight = bounds.height + padding * 2;
    if (workWidth <= 0 || workHeight <= 0) { ctx.restore(); return; }

    const maskCanvas = this.pool.acquire(workWidth, workHeight);
    const dilatedCanvas = this.pool.acquire(workWidth, workHeight);
    const strokeCanvas = this.pool.acquire(workWidth, workHeight);

    try {
      const maskCtx = maskCanvas.getContext('2d');
      const dilatedCtx = dilatedCanvas.getContext('2d');
      const strokeCtx = strokeCanvas.getContext('2d');
      if (!maskCtx || !dilatedCtx || !strokeCtx) { ctx.restore(); return; }

      if (!this.renderLayerMask(maskCtx, layer, padding, workWidth, workHeight)) {
        ctx.restore();
        return;
      }

      // Dilate mask by drawing shifted copies in a circle pattern
      const dilateBy = position === 'inside' ? 0 : strokeSize;
      dilatedCtx.clearRect(0, 0, workWidth, workHeight);
      if (dilateBy > 0) {
        const steps = Math.max(8, Math.ceil(dilateBy * 2));
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          dilatedCtx.drawImage(
            maskCanvas,
            Math.cos(angle) * dilateBy,
            Math.sin(angle) * dilateBy,
          );
        }
        // Also draw center
        dilatedCtx.drawImage(maskCanvas, 0, 0);
      } else {
        dilatedCtx.drawImage(maskCanvas, 0, 0);
      }

      // Build stroke band
      strokeCtx.clearRect(0, 0, workWidth, workHeight);
      if (position === 'outside') {
        // Dilated minus original
        strokeCtx.drawImage(dilatedCanvas, 0, 0);
        strokeCtx.globalCompositeOperation = 'destination-out';
        strokeCtx.drawImage(maskCanvas, 0, 0);
        strokeCtx.globalCompositeOperation = 'source-over';
      } else if (position === 'inside') {
        // Original minus eroded (approximated by dilating the outside and subtracting)
        // Erode = invert → dilate → invert. Approximate: mask minus (mask shifted inward)
        const erodedCanvas = this.pool.acquire(workWidth, workHeight);
        const erodedCtx = erodedCanvas.getContext('2d');
        if (erodedCtx) {
          // Build eroded mask: intersection of all shifted copies
          erodedCtx.clearRect(0, 0, workWidth, workHeight);
          erodedCtx.drawImage(maskCanvas, 0, 0);
          const steps = Math.max(8, Math.ceil(strokeSize * 2));
          for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            erodedCtx.globalCompositeOperation = 'destination-in';
            erodedCtx.drawImage(
              maskCanvas,
              Math.cos(angle) * strokeSize,
              Math.sin(angle) * strokeSize,
            );
          }
          erodedCtx.globalCompositeOperation = 'source-over';

          strokeCtx.drawImage(maskCanvas, 0, 0);
          strokeCtx.globalCompositeOperation = 'destination-out';
          strokeCtx.drawImage(erodedCanvas, 0, 0);
          strokeCtx.globalCompositeOperation = 'source-over';
        }
        this.pool.release(erodedCanvas);
      } else {
        // Center: half outside, half inside
        strokeCtx.drawImage(dilatedCanvas, 0, 0);
      }

      // Tint stroke band with color
      strokeCtx.globalCompositeOperation = 'source-in';
      strokeCtx.fillStyle = strokeColor;
      strokeCtx.fillRect(0, 0, workWidth, workHeight);
      strokeCtx.globalCompositeOperation = 'source-over';

      ctx.drawImage(strokeCanvas, layer.position.x - padding, layer.position.y - padding);
    } finally {
      this.pool.release(maskCanvas);
      this.pool.release(dilatedCanvas);
      this.pool.release(strokeCanvas);
    }

    ctx.restore();
  }

  /**
   * Estimate drawable bounds used for effect offscreen canvases.
   */
  private getEffectBounds(layer: RasterLayer | TextLayer): { width: number; height: number } | null {
    if (layer.type === 'raster') {
      const width = Math.ceil(layer.bounds.width);
      const height = Math.ceil(layer.bounds.height);
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }

    const lines = layer.text.split('\n');
    if (layer.textBounds && layer.textBounds.width > 0 && layer.textBounds.height > 0) {
      return {
        width: Math.ceil(layer.textBounds.width),
        height: Math.ceil(layer.textBounds.height),
      };
    }

    if (layer.writingMode === 'vertical-rl') {
      const columns = lines.length;
      const maxChars = lines.reduce((max, line) => Math.max(max, [...line].length), 0);
      const colW = layer.fontSize * layer.lineHeight;
      const charH = layer.fontSize * layer.lineHeight;
      return {
        width: Math.max(1, Math.ceil(columns * colW + layer.fontSize)),
        height: Math.max(1, Math.ceil(maxChars * charH + layer.fontSize)),
      };
    }

    const longestLine = lines.reduce((max, line) => Math.max(max, [...line].length), 0);
    return {
      width: Math.max(1, Math.ceil(longestLine * layer.fontSize * 0.6 + layer.fontSize)),
      height: Math.max(1, Math.ceil(lines.length * layer.fontSize * layer.lineHeight + layer.fontSize)),
    };
  }

  /**
   * Build CanvasGradient from GradientOverlayEffect settings.
   */
  private createEffectGradient(
    tc: CanvasRenderingContext2D,
    effect: GradientOverlayEffect,
    width: number,
    height: number,
    offset: { x: number; y: number },
  ): CanvasGradient {
    const scaleRatio = Math.max(0.1, Math.min(1.5, effect.scale / 100));
    const rad = (effect.angle * Math.PI) / 180;
    const cx = offset.x + width / 2;
    const cy = offset.y + height / 2;

    let gradient: CanvasGradient;
    if (effect.gradientType === 'radial') {
      const radius = Math.max(1, (Math.max(width, height) / 2) * scaleRatio);
      gradient = tc.createRadialGradient(cx, cy, 0, cx, cy, radius);
    } else {
      const half = Math.max(width, height) * scaleRatio * 0.5;
      const x0 = cx - Math.cos(rad) * half;
      const y0 = cy + Math.sin(rad) * half;
      const x1 = cx + Math.cos(rad) * half;
      const y1 = cy - Math.sin(rad) * half;
      gradient = tc.createLinearGradient(x0, y0, x1, y1);
    }

    const normalizedStops = effect.stops
      .map((s) => ({
        position: Math.max(0, Math.min(1, s.position)),
        color: s.color,
      }))
      .sort((a, b) => a.position - b.position);

    const stops = effect.reverse
      ? normalizedStops.map((s) => ({ ...s, position: 1 - s.position })).sort((a, b) => a.position - b.position)
      : normalizedStops;

    if (stops.length === 0) {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
      return gradient;
    }

    for (const stop of stops) {
      gradient.addColorStop(
        stop.position,
        `rgba(${Math.round(stop.color.r)}, ${Math.round(stop.color.g)}, ${Math.round(stop.color.b)}, ${stop.color.a})`,
      );
    }
    return gradient;
  }

  /**
   * Render layer alpha silhouette into an offscreen context at the specified offset.
   */
  private renderLayerMask(
    targetCtx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    offset: number,
    width: number,
    height: number,
  ): boolean {
    targetCtx.clearRect(0, 0, width, height);
    if (layer.type === 'raster') {
      if (!layer.imageData) return false;
      targetCtx.putImageData(layer.imageData, offset, offset);
      return true;
    }

    const localTextLayer: TextLayer = {
      ...layer,
      position: { x: offset, y: offset },
    };
    this.renderTextContent(targetCtx, localTextLayer, {
      fillStyle: 'rgba(255, 255, 255, 1)',
    });
    return true;
  }

  /**
   * Build inside-facing edge mask: base - shifted(base).
   */
  private composeInnerEdge(
    targetCtx: CanvasContext2DLike,
    baseMask: CanvasLike,
    shiftedMask: CanvasLike,
    width: number,
    height: number,
  ): void {
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(baseMask, 0, 0);
    targetCtx.globalCompositeOperation = 'destination-out';
    targetCtx.drawImage(shiftedMask, 0, 0);
    targetCtx.globalCompositeOperation = 'source-over';
  }

  /**
   * Build outside-facing edge mask: shifted(base) - base.
   */
  private composeOuterEdge(
    targetCtx: CanvasContext2DLike,
    shiftedMask: CanvasLike,
    baseMask: CanvasLike,
    width: number,
    height: number,
  ): void {
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(shiftedMask, 0, 0);
    targetCtx.globalCompositeOperation = 'destination-out';
    targetCtx.drawImage(baseMask, 0, 0);
    targetCtx.globalCompositeOperation = 'source-over';
  }

  /**
   * Tint an alpha mask canvas with a solid RGBA color.
   */
  private tintEdgeMask(
    targetCtx: CanvasContext2DLike,
    sourceMask: CanvasLike,
    color: { r: number; g: number; b: number; a: number },
    width: number,
    height: number,
  ): void {
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(sourceMask, 0, 0);
    targetCtx.globalCompositeOperation = 'source-in';
    targetCtx.fillStyle = `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.globalCompositeOperation = 'source-over';
  }

  /**
   * Render color overlay effect.
   * - text: redraw text with overlay color
   * - raster: tint raster alpha silhouette with overlay color
   */
  private renderColorOverlay(
    ctx: CanvasContext2DLike,
    layer: RasterLayer | TextLayer,
    effect: ColorOverlayEffect,
  ): void {
    const { color, opacity } = effect;
    const overlayColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;

    if (layer.type === 'text') {
      ctx.save();
      ctx.globalAlpha = opacity;
      this.renderTextContent(ctx, layer, {
        fillStyle: overlayColor,
      });
      ctx.restore();
      return;
    }

    if (!layer.imageData) return;
    const width = Math.max(0, Math.floor(layer.bounds.width));
    const height = Math.max(0, Math.floor(layer.bounds.height));
    if (width <= 0 || height <= 0) return;

    const tintCanvas = this.pool.acquire(width, height);
    const tintCtx = tintCanvas.getContext('2d');
    if (!tintCtx) return;

    try {
      tintCtx.clearRect(0, 0, width, height);
      tintCtx.putImageData(layer.imageData, 0, 0);
      tintCtx.globalCompositeOperation = 'source-in';
      tintCtx.fillStyle = overlayColor;
      tintCtx.fillRect(0, 0, width, height);
      tintCtx.globalCompositeOperation = 'source-over';

      if (layer.mask?.enabled && layer.mask.data.length > 0) {
        this.applyMask(tintCtx, layer);
      }

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(tintCanvas, layer.position.x, layer.position.y);
      ctx.restore();
    } finally {
      this.pool.release(tintCanvas);
    }
  }

  private findLayer(group: LayerGroup, layerId: string): Layer | null {
    for (const child of group.children) {
      if (child.id === layerId) return child;
      if (child.type === 'group') {
        const found = this.findLayer(child, layerId);
        if (found) return found;
      }
    }
    return null;
  }
}
