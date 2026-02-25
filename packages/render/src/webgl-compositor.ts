/**
 * @module webgl-compositor
 * WebGL 2 GPU-accelerated layer compositor.
 *
 * Renders a Document's layer tree using WebGL 2 with layers uploaded as
 * GPU textures and blend modes implemented via GLSL fragment shaders.
 * Falls back to Canvas2DRenderer when WebGL 2 is unavailable.
 *
 * Key design decisions:
 * - Each layer's ImageData is uploaded as a texture.
 * - Compositing is done via ping-pong framebuffers (src/dst swap).
 * - Blend modes are handled entirely in the fragment shader.
 * - Groups are composited to temporary framebuffer textures.
 * - TexturePool recycles GPU resources to minimize allocation.
 *
 * @see {@link @photoshop-app/types!Renderer}
 * @see {@link Canvas2DRenderer} for the fallback implementation.
 */

import type {
  Document,
  DropShadowEffect,
  LayerGroup,
  RasterLayer,
  RenderOptions,
  Renderer,
  Size,
  TextLayer,
} from '@photoshop-app/types';
import { Canvas2DRenderer } from './compositor';
import type { CanvasFactory } from './canvas-pool';
import { TexturePool, type RenderTarget } from './texture-pool';
import {
  BLEND_MODE_MAP,
  BLUR_FRAGMENT_SHADER,
  CHECKERBOARD_FRAGMENT_SHADER,
  COMPOSITE_FRAGMENT_SHADER,
  COPY_FRAGMENT_SHADER,
  SOLID_FRAGMENT_SHADER,
  VERTEX_SHADER,
} from './shaders';

/** Compiled shader program with cached uniform locations. */
interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
}

/**
 * WebGL 2 renderer with Canvas 2D fallback.
 *
 * Usage:
 * ```ts
 * const renderer = new WebGLRenderer(canvas);
 * renderer.render(document, canvas, options);
 * renderer.dispose();
 * ```
 */
export class WebGLRenderer implements Renderer {
  private gl: WebGL2RenderingContext | null = null;
  private fallback: Canvas2DRenderer;
  private texturePool: TexturePool | null = null;
  private quadVAO: WebGLVertexArrayObject | null = null;

  // Compiled shader programs
  private compositeProgram: ShaderProgram | null = null;
  private copyProgram: ShaderProgram | null = null;
  private checkerboardProgram: ShaderProgram | null = null;
  private solidProgram: ShaderProgram | null = null;
  private blurProgram: ShaderProgram | null = null;

  // Ping-pong render targets for compositing
  private rtA: RenderTarget | null = null;
  private rtB: RenderTarget | null = null;

  // Track the canvas we initialized on to detect changes
  private boundCanvas: HTMLCanvasElement | null = null;

  constructor(canvasFactory?: CanvasFactory) {
    this.fallback = new Canvas2DRenderer(canvasFactory);
  }

  /**
   * Render the full document to the target canvas.
   * Initializes WebGL on first call; falls back to Canvas 2D on failure.
   */
  render(
    document: Document,
    canvas: HTMLCanvasElement,
    options: RenderOptions,
  ): void {
    // Try to initialize WebGL if needed
    if (!this.gl || this.boundCanvas !== canvas) {
      if (!this.initWebGL(canvas)) {
        this.fallback.render(document, canvas, options);
        return;
      }
    }

    const gl = this.gl!;
    const { width, height } = canvas;

    // Ensure render targets match canvas size
    this.ensureRenderTargets(width, height);
    if (!this.rtA || !this.rtB) {
      this.fallback.render(document, canvas, options);
      return;
    }

    // Clear RT-A (accumulator)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtA.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw background to RT-A
    this.drawBackground(width, height, options.background);

    // Apply viewport transform and render layers
    const vp = options.viewport;
    this.renderGroup(document.rootGroup, options, width, height, vp.zoom, vp.offset.x, vp.offset.y);

    // Blit RT-A to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    this.blitToScreen(this.rtA.texture);
  }

  /**
   * Render a single layer thumbnail. Delegates to Canvas 2D fallback.
   */
  renderLayerThumbnail(
    document: Document,
    layerId: string,
    size: Size,
  ): HTMLCanvasElement | null {
    return this.fallback.renderLayerThumbnail(document, layerId, size);
  }

  /** Release all GPU resources. */
  dispose(): void {
    if (this.gl) {
      if (this.rtA) { this.texturePool?.release(this.rtA); this.rtA = null; }
      if (this.rtB) { this.texturePool?.release(this.rtB); this.rtB = null; }
      this.texturePool?.dispose();
      this.texturePool = null;

      this.deleteProgram(this.compositeProgram);
      this.deleteProgram(this.copyProgram);
      this.deleteProgram(this.checkerboardProgram);
      this.deleteProgram(this.solidProgram);
      this.deleteProgram(this.blurProgram);

      if (this.quadVAO) {
        this.gl.deleteVertexArray(this.quadVAO);
        this.quadVAO = null;
      }

      this.gl = null;
      this.boundCanvas = null;
    }
    this.fallback.dispose();
  }

  /** Whether WebGL 2 was successfully initialized. */
  get isWebGLActive(): boolean {
    return this.gl !== null;
  }

  // ── Initialization ─────────────────────────────────────────────

  private initWebGL(canvas: HTMLCanvasElement): boolean {
    // Clean up previous context if any
    if (this.gl) this.dispose();

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: false,
    });
    if (!gl) return false;

    this.gl = gl;
    this.boundCanvas = canvas;
    this.texturePool = new TexturePool(gl);

    // Enable blending for premultiplied alpha
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Compile shaders
    try {
      this.compositeProgram = this.compileProgram(VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER);
      this.copyProgram = this.compileProgram(VERTEX_SHADER, COPY_FRAGMENT_SHADER);
      this.checkerboardProgram = this.compileProgram(VERTEX_SHADER, CHECKERBOARD_FRAGMENT_SHADER);
      this.solidProgram = this.compileProgram(VERTEX_SHADER, SOLID_FRAGMENT_SHADER);
      this.blurProgram = this.compileProgram(VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    } catch {
      this.dispose();
      return false;
    }

    // Create fullscreen quad VAO
    this.quadVAO = this.createQuadVAO();
    if (!this.quadVAO) {
      this.dispose();
      return false;
    }

    return true;
  }

  private createQuadVAO(): WebGLVertexArrayObject | null {
    const gl = this.gl!;
    const vao = gl.createVertexArray();
    if (!vao) return null;

    gl.bindVertexArray(vao);

    // Position + texcoord interleaved: [x,y, u,v]
    const vertices = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // a_position (location 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

    // a_texCoord (location 1)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);
    return vao;
  }

  // ── Shader compilation ─────────────────────────────────────────

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${log}`);
    }
    return shader;
  }

  private compileProgram(vertSrc: string, fragSrc: string): ShaderProgram {
    const gl = this.gl!;
    const vert = this.compileShader(vertSrc, gl.VERTEX_SHADER);
    const frag = this.compileShader(fragSrc, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      throw new Error('Failed to create program');
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${log}`);
    }

    // Cache uniform locations
    const uniforms = new Map<string, WebGLUniformLocation>();
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const loc = gl.getUniformLocation(program, info.name);
        if (loc) uniforms.set(info.name, loc);
      }
    }

    return { program, uniforms };
  }

  private deleteProgram(sp: ShaderProgram | null): void {
    if (sp && this.gl) {
      this.gl.deleteProgram(sp.program);
    }
  }

  private useProgram(sp: ShaderProgram): void {
    this.gl!.useProgram(sp.program);
  }

  private setUniform1i(sp: ShaderProgram, name: string, value: number): void {
    const loc = sp.uniforms.get(name);
    if (loc) this.gl!.uniform1i(loc, value);
  }

  private setUniform1f(sp: ShaderProgram, name: string, value: number): void {
    const loc = sp.uniforms.get(name);
    if (loc) this.gl!.uniform1f(loc, value);
  }

  private setUniform2f(sp: ShaderProgram, name: string, x: number, y: number): void {
    const loc = sp.uniforms.get(name);
    if (loc) this.gl!.uniform2f(loc, x, y);
  }

  private setUniform4f(sp: ShaderProgram, name: string, x: number, y: number, z: number, w: number): void {
    const loc = sp.uniforms.get(name);
    if (loc) this.gl!.uniform4f(loc, x, y, z, w);
  }

  private setUniformMatrix3fv(sp: ShaderProgram, name: string, value: Float32Array): void {
    const loc = sp.uniforms.get(name);
    if (loc) this.gl!.uniformMatrix3fv(loc, false, value);
  }

  // ── Render targets ─────────────────────────────────────────────

  private ensureRenderTargets(width: number, height: number): void {
    if (this.rtA && this.rtA.width >= width && this.rtA.height >= height) return;

    // Release old
    if (this.rtA) this.texturePool!.release(this.rtA);
    if (this.rtB) this.texturePool!.release(this.rtB);

    this.rtA = this.texturePool!.acquire(width, height);
    this.rtB = this.texturePool!.acquire(width, height);
  }

  // ── Background rendering ───────────────────────────────────────

  private drawBackground(width: number, height: number, bg: 'checkerboard' | 'white' | 'black' | 'transparent'): void {
    if (bg === 'transparent') return;

    const gl = this.gl!;
    gl.bindVertexArray(this.quadVAO);

    if (bg === 'checkerboard') {
      this.useProgram(this.checkerboardProgram!);
      this.setUniformMatrix3fv(this.checkerboardProgram!, 'u_transform', IDENTITY_MATRIX);
      this.setUniform2f(this.checkerboardProgram!, 'u_resolution', width, height);
      this.setUniform1f(this.checkerboardProgram!, 'u_tileSize', 8);
    } else {
      this.useProgram(this.solidProgram!);
      this.setUniformMatrix3fv(this.solidProgram!, 'u_transform', IDENTITY_MATRIX);
      if (bg === 'white') {
        this.setUniform4f(this.solidProgram!, 'u_color', 1, 1, 1, 1);
      } else {
        this.setUniform4f(this.solidProgram!, 'u_color', 0, 0, 0, 1);
      }
    }

    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);

    gl.bindVertexArray(null);
  }

  // ── Layer rendering ────────────────────────────────────────────

  private renderGroup(
    group: LayerGroup,
    options: RenderOptions,
    width: number,
    height: number,
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    for (const layer of group.children) {
      if (!layer.visible) continue;

      if (layer.type === 'group') {
        this.renderGroupAsComposite(layer, options, width, height, zoom, offsetX, offsetY);
      } else {
        this.renderLayer(layer, options, width, height, zoom, offsetX, offsetY);
      }
    }
  }

  private renderGroupAsComposite(
    group: LayerGroup,
    options: RenderOptions,
    width: number,
    height: number,
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const gl = this.gl!;

    // Render group children to a temporary RT
    const tempRT = this.texturePool!.acquire(width, height);
    if (!tempRT) return;

    // Save current RT-A, swap in temp
    const savedA = this.rtA!;
    this.rtA = tempRT;

    gl.bindFramebuffer(gl.FRAMEBUFFER, tempRT.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render children
    this.renderGroup(group, options, width, height, zoom, offsetX, offsetY);

    // Restore RT-A and composite temp on top
    this.rtA = savedA;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtA.framebuffer);
    gl.viewport(0, 0, width, height);

    this.compositeTexture(
      tempRT.texture,
      this.rtA.texture,
      this.rtB!,
      width,
      height,
      group.opacity,
      group.blendMode,
    );

    // Swap: result is in rtB, make it rtA
    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;

    this.texturePool!.release(tempRT);
  }

  private renderLayer(
    layer: RasterLayer | TextLayer,
    options: RenderOptions,
    width: number,
    height: number,
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    if (layer.type === 'text') {
      // Text layers are handled by UI framework; skip in WebGL
      return;
    }

    const raster = layer as RasterLayer;
    if (!raster.imageData) return;

    const { width: lw, height: lh } = raster.bounds;
    if (lw <= 0 || lh <= 0) return;

    // Render effects behind (e.g. drop shadow)
    if (options.renderEffects && layer.effects.length > 0) {
      this.renderEffectsBehind(raster, width, height, zoom, offsetX, offsetY);
    }

    // Upload layer as texture
    const layerTex = this.uploadImageData(raster.imageData, lw, lh);
    if (!layerTex) return;

    const gl = this.gl!;

    // Render layer texture to RT-B, compositing with RT-A
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtB!.framebuffer);
    gl.viewport(0, 0, width, height);

    // Build transform: identity -> viewport transform -> layer position/size
    const transform = this.buildLayerTransform(
      raster.position.x, raster.position.y, lw, lh,
      width, height, zoom, offsetX, offsetY,
    );

    // Draw layer to a temporary RT first (to isolate it for compositing)
    const layerRT = this.texturePool!.acquire(width, height);
    if (!layerRT) {
      gl.deleteTexture(layerTex);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerRT.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Copy layer texture with transform
    this.useProgram(this.copyProgram!);
    this.setUniformMatrix3fv(this.copyProgram!, 'u_transform', transform);
    this.setUniform1f(this.copyProgram!, 'u_opacity', 1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layerTex);
    this.setUniform1i(this.copyProgram!, 'u_src', 0);

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);

    // Composite layerRT onto rtA -> rtB
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtB!.framebuffer);
    gl.viewport(0, 0, width, height);

    this.compositeTexture(
      layerRT.texture,
      this.rtA!.texture,
      this.rtB!,
      width,
      height,
      raster.opacity,
      raster.blendMode,
    );

    // Swap A and B
    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;

    // Cleanup
    gl.deleteTexture(layerTex);
    this.texturePool!.release(layerRT);

    // Render effects in front (e.g. stroke)
    if (options.renderEffects && layer.effects.length > 0) {
      this.renderEffectsInFront(raster, width, height, zoom, offsetX, offsetY);
    }
  }

  // ── Compositing ────────────────────────────────────────────────

  private compositeTexture(
    srcTex: WebGLTexture,
    dstTex: WebGLTexture,
    outputRT: RenderTarget,
    width: number,
    height: number,
    opacity: number,
    blendMode: string,
  ): void {
    const gl = this.gl!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, outputRT.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.useProgram(this.compositeProgram!);
    this.setUniformMatrix3fv(this.compositeProgram!, 'u_transform', IDENTITY_MATRIX);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    this.setUniform1i(this.compositeProgram!, 'u_src', 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, dstTex);
    this.setUniform1i(this.compositeProgram!, 'u_dst', 1);

    this.setUniform1f(this.compositeProgram!, 'u_opacity', opacity);
    this.setUniform1i(this.compositeProgram!, 'u_blendMode', BLEND_MODE_MAP[blendMode] ?? 0);

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // ── Effects ────────────────────────────────────────────────────

  private renderEffectsBehind(
    layer: RasterLayer,
    width: number,
    height: number,
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    for (const effect of layer.effects) {
      if (!effect.enabled) continue;
      if (effect.type === 'drop-shadow') {
        this.renderDropShadow(layer, effect, width, height, zoom, offsetX, offsetY);
      }
      // outer-glow: similar pattern, omitted for brevity (uses blur shader)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private renderEffectsInFront(_layer: RasterLayer, _w: number, _h: number, _z: number, _ox: number, _oy: number): void {
    // Stroke: would render layer silhouette with offset.
    // Placeholder — requires shape extraction from alpha channel.
  }

  private renderDropShadow(
    layer: RasterLayer,
    effect: DropShadowEffect,
    width: number,
    height: number,
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    if (!layer.imageData) return;
    const gl = this.gl!;

    const { color, opacity, angle, distance, blur } = effect;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * distance;
    const dy = -Math.sin(rad) * distance;

    // Upload shadow as a solid-color texture with layer alpha
    const { width: lw, height: lh } = layer.bounds;
    const shadowData = this.createShadowImageData(layer.imageData, lw, lh, color);
    if (!shadowData) return;

    const shadowTex = this.uploadImageData(shadowData, lw, lh);
    if (!shadowTex) return;

    // Draw shadow to temp RT with offset
    const shadowRT = this.texturePool!.acquire(width, height);
    if (!shadowRT) {
      gl.deleteTexture(shadowTex);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowRT.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const transform = this.buildLayerTransform(
      layer.position.x + dx, layer.position.y + dy, lw, lh,
      width, height, zoom, offsetX, offsetY,
    );

    this.useProgram(this.copyProgram!);
    this.setUniformMatrix3fv(this.copyProgram!, 'u_transform', transform);
    this.setUniform1f(this.copyProgram!, 'u_opacity', 1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    this.setUniform1i(this.copyProgram!, 'u_src', 0);

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);

    // Apply blur if needed
    let finalShadowTex = shadowRT.texture;
    let blurRT: RenderTarget | null = null;

    if (blur > 0) {
      blurRT = this.applyBlur(shadowRT, width, height, blur);
      if (blurRT) finalShadowTex = blurRT.texture;
    }

    // Composite shadow onto rtA -> rtB
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtB!.framebuffer);
    gl.viewport(0, 0, width, height);

    this.compositeTexture(
      finalShadowTex,
      this.rtA!.texture,
      this.rtB!,
      width, height,
      opacity,
      'normal',
    );

    // Swap
    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;

    // Cleanup
    gl.deleteTexture(shadowTex);
    this.texturePool!.release(shadowRT);
    if (blurRT) this.texturePool!.release(blurRT);
  }

  private createShadowImageData(
    srcData: ImageData,
    width: number,
    height: number,
    color: { r: number; g: number; b: number; a: number },
  ): ImageData | null {
    const data = new Uint8ClampedArray(width * height * 4);
    const src = srcData.data;
    for (let i = 0; i < width * height; i++) {
      const alpha = src[i * 4 + 3];
      data[i * 4] = color.r;
      data[i * 4 + 1] = color.g;
      data[i * 4 + 2] = color.b;
      data[i * 4 + 3] = Math.round(alpha * color.a);
    }
    return new ImageData(data, width, height);
  }

  private applyBlur(
    srcRT: RenderTarget,
    width: number,
    height: number,
    radius: number,
  ): RenderTarget | null {
    const gl = this.gl!;
    const passes = Math.ceil(radius / 2);

    const tempRT = this.texturePool!.acquire(width, height);
    if (!tempRT) return null;

    let readRT = srcRT;
    let writeRT = tempRT;

    for (let p = 0; p < passes; p++) {
      // Horizontal pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeRT.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      this.useProgram(this.blurProgram!);
      this.setUniformMatrix3fv(this.blurProgram!, 'u_transform', IDENTITY_MATRIX);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readRT.texture);
      this.setUniform1i(this.blurProgram!, 'u_src', 0);
      this.setUniform2f(this.blurProgram!, 'u_direction', 1, 0);
      this.setUniform2f(this.blurProgram!, 'u_texelSize', 1 / width, 1 / height);

      gl.bindVertexArray(this.quadVAO);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.BLEND);
      gl.bindVertexArray(null);

      // Swap for vertical pass
      const t = readRT;
      readRT = writeRT;
      writeRT = t;

      // Vertical pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeRT.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readRT.texture);
      this.setUniform2f(this.blurProgram!, 'u_direction', 0, 1);

      gl.bindVertexArray(this.quadVAO);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.BLEND);
      gl.bindVertexArray(null);

      const t2 = readRT;
      readRT = writeRT;
      writeRT = t2;
    }

    // Result is in readRT; if it's tempRT, return it; else swap
    if (readRT === tempRT) {
      return tempRT;
    }
    // Copy result to tempRT
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempRT.framebuffer);
    gl.viewport(0, 0, width, height);

    this.useProgram(this.copyProgram!);
    this.setUniformMatrix3fv(this.copyProgram!, 'u_transform', IDENTITY_MATRIX);
    this.setUniform1f(this.copyProgram!, 'u_opacity', 1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readRT.texture);
    this.setUniform1i(this.copyProgram!, 'u_src', 0);

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);

    return tempRT;
  }

  // ── Texture upload ─────────────────────────────────────────────

  private uploadImageData(
    imageData: ImageData,
    width: number,
    height: number,
  ): WebGLTexture | null {
    const gl = this.gl!;
    const tex = gl.createTexture();
    if (!tex) return null;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8,
      width, height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      imageData.data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return tex;
  }

  // ── Blit to screen ─────────────────────────────────────────────

  private blitToScreen(texture: WebGLTexture): void {
    const gl = this.gl!;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.useProgram(this.copyProgram!);
    this.setUniformMatrix3fv(this.copyProgram!, 'u_transform', IDENTITY_MATRIX);
    this.setUniform1f(this.copyProgram!, 'u_opacity', 1.0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setUniform1i(this.copyProgram!, 'u_src', 0);

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // ── Transform helpers ──────────────────────────────────────────

  /**
   * Build a 3x3 column-major transform matrix that maps a layer rect
   * (position + size in document space) to clip space (-1..1),
   * applying viewport zoom and offset.
   */
  private buildLayerTransform(
    posX: number, posY: number,
    layerW: number, layerH: number,
    canvasW: number, canvasH: number,
    zoom: number,
    offsetX: number, offsetY: number,
  ): Float32Array {
    // Document -> screen: screenX = docX * zoom + offsetX
    // Screen -> clip: clipX = screenX / canvasW * 2 - 1
    //
    // For the quad (-1..1 -> 0..1 UV), we need to map it to the layer rect:
    // quadX in [-1,1] -> layerX in [posX, posX + layerW] (document space)
    // -> screenX = layerX * zoom + offsetX
    // -> clipX = screenX / canvasW * 2 - 1
    //
    // Combined: clipX = ((quadX*0.5+0.5)*layerW + posX) * zoom/canvasW * 2 + offsetX/canvasW*2 - 1
    //         = quadX * (layerW*zoom)/(canvasW*2) * 2 + ...

    const sx = (layerW * zoom) / canvasW;
    const sy = (layerH * zoom) / canvasH;
    const tx = (posX * zoom + offsetX) / canvasW * 2 - 1 + sx;
    const ty = (posY * zoom + offsetY) / canvasH * 2 - 1 + sy;

    // Column-major 3x3
    return new Float32Array([
      sx, 0, 0,
      0, sy, 0,
      tx, ty, 1,
    ]);
  }
}

/** Identity 3x3 matrix (column-major). */
const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
]);
