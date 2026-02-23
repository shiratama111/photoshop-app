/**
 * @module texture-pool
 * GPU texture and framebuffer pool for WebGL 2 compositing.
 *
 * Allocating and deleting WebGL textures/framebuffers is expensive.
 * This pool recycles them to minimize GPU memory churn during rendering.
 *
 * @see {@link @photoshop-app/types!Renderer}
 */

/** WebGL2 rendering context interface subset used by the pool. */
export interface GL2Context {
  createTexture(): WebGLTexture | null;
  deleteTexture(texture: WebGLTexture | null): void;
  bindTexture(target: number, texture: WebGLTexture | null): void;
  texImage2D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    pixels: ArrayBufferView | null,
  ): void;
  texParameteri(target: number, pname: number, param: number): void;
  createFramebuffer(): WebGLFramebuffer | null;
  deleteFramebuffer(framebuffer: WebGLFramebuffer | null): void;
  bindFramebuffer(target: number, framebuffer: WebGLFramebuffer | null): void;
  framebufferTexture2D(
    target: number,
    attachment: number,
    textarget: number,
    texture: WebGLTexture | null,
    level: number,
  ): void;
  readonly TEXTURE_2D: number;
  readonly RGBA: number;
  readonly RGBA8: number;
  readonly UNSIGNED_BYTE: number;
  readonly TEXTURE_MIN_FILTER: number;
  readonly TEXTURE_MAG_FILTER: number;
  readonly TEXTURE_WRAP_S: number;
  readonly TEXTURE_WRAP_T: number;
  readonly LINEAR: number;
  readonly CLAMP_TO_EDGE: number;
  readonly FRAMEBUFFER: number;
  readonly COLOR_ATTACHMENT0: number;
}

/** A pooled render target consisting of a texture and its framebuffer. */
export interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

const MAX_POOL_SIZE = 16;

/**
 * Pool for reusing WebGL textures and framebuffers.
 */
export class TexturePool {
  private pool: RenderTarget[] = [];
  private gl: GL2Context;

  constructor(gl: GL2Context) {
    this.gl = gl;
  }

  /** Acquire a render target of at least the given dimensions. */
  acquire(width: number, height: number): RenderTarget | null {
    // Find a suitable target in the pool
    for (let i = 0; i < this.pool.length; i++) {
      const rt = this.pool[i];
      if (rt.width >= width && rt.height >= height) {
        this.pool.splice(i, 1);
        return rt;
      }
    }
    // Create new
    return this.createRenderTarget(width, height);
  }

  /** Return a render target to the pool for reuse. */
  release(target: RenderTarget): void {
    if (this.pool.length < MAX_POOL_SIZE) {
      this.pool.push(target);
    } else {
      this.destroyRenderTarget(target);
    }
  }

  /** Delete all pooled GPU resources. */
  dispose(): void {
    for (const rt of this.pool) {
      this.destroyRenderTarget(rt);
    }
    this.pool.length = 0;
  }

  private createRenderTarget(width: number, height: number): RenderTarget | null {
    const gl = this.gl;

    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8,
      width, height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      gl.deleteTexture(texture);
      return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, texture, 0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { texture, framebuffer, width, height };
  }

  private destroyRenderTarget(target: RenderTarget): void {
    this.gl.deleteFramebuffer(target.framebuffer);
    this.gl.deleteTexture(target.texture);
  }
}
