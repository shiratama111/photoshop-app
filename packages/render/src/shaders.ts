/**
 * @module shaders
 * GLSL shader source code for WebGL 2 compositing.
 *
 * Provides vertex and fragment shaders for:
 * - Layer compositing with Photoshop-compatible blend modes
 * - Post-processing effects (drop shadow, outer glow, stroke)
 * - Background rendering (checkerboard, solid color)
 *
 * All shaders target WebGL 2 (GLSL ES 3.00).
 *
 * @see {@link @photoshop-app/types!BlendMode}
 */

/** Shared fullscreen-quad vertex shader. Emits UV coords for fragment shaders. */
export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;

uniform mat3 u_transform;

out vec2 v_texCoord;

void main() {
  vec3 pos = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * Blend-mode composite fragment shader.
 *
 * Reads the source (layer) and destination (accumulated) textures,
 * applies the selected blend mode, then mixes by source opacity.
 */
export const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_src;
uniform sampler2D u_dst;
uniform float u_opacity;
uniform int u_blendMode;

out vec4 fragColor;

// --- Blend helper functions ---

vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(
    base.r < 0.5 ? 2.0 * base.r * blend.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r),
    base.g < 0.5 ? 2.0 * base.g * blend.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g),
    base.b < 0.5 ? 2.0 * base.b * blend.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b)
  );
}

vec3 blendDarken(vec3 base, vec3 blend) {
  return min(base, blend);
}

vec3 blendLighten(vec3 base, vec3 blend) {
  return max(base, blend);
}

vec3 blendColorDodge(vec3 base, vec3 blend) {
  return vec3(
    blend.r >= 1.0 ? 1.0 : min(1.0, base.r / (1.0 - blend.r)),
    blend.g >= 1.0 ? 1.0 : min(1.0, base.g / (1.0 - blend.g)),
    blend.b >= 1.0 ? 1.0 : min(1.0, base.b / (1.0 - blend.b))
  );
}

vec3 blendColorBurn(vec3 base, vec3 blend) {
  return vec3(
    blend.r <= 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.r) / blend.r),
    blend.g <= 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.g) / blend.g),
    blend.b <= 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.b) / blend.b)
  );
}

vec3 blendHardLight(vec3 base, vec3 blend) {
  return blendOverlay(blend, base);
}

vec3 blendSoftLight(vec3 base, vec3 blend) {
  return vec3(
    blend.r <= 0.5
      ? base.r - (1.0 - 2.0 * blend.r) * base.r * (1.0 - base.r)
      : base.r + (2.0 * blend.r - 1.0) * (sqrt(base.r) - base.r),
    blend.g <= 0.5
      ? base.g - (1.0 - 2.0 * blend.g) * base.g * (1.0 - base.g)
      : base.g + (2.0 * blend.g - 1.0) * (sqrt(base.g) - base.g),
    blend.b <= 0.5
      ? base.b - (1.0 - 2.0 * blend.b) * base.b * (1.0 - base.b)
      : base.b + (2.0 * blend.b - 1.0) * (sqrt(base.b) - base.b)
  );
}

vec3 blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

vec3 blendExclusion(vec3 base, vec3 blend) {
  return base + blend - 2.0 * base * blend;
}

// HSL helpers for Hue/Saturation/Color/Luminosity blend modes

float lum(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + ((c - l) * l) / (l - n);
  if (x > 1.0) c = l + ((c - l) * (1.0 - l)) / (x - l);
  return c;
}

vec3 setLum(vec3 c, float l) {
  float d = l - lum(c);
  return clipColor(c + d);
}

float sat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}

vec3 setSat(vec3 c, float s) {
  float cmin = min(min(c.r, c.g), c.b);
  float cmax = max(max(c.r, c.g), c.b);
  float delta = cmax - cmin;
  if (delta < 0.0001) return vec3(0.0);
  return (c - cmin) * s / delta;
}

vec3 blendHue(vec3 base, vec3 blend) {
  return setLum(setSat(blend, sat(base)), lum(base));
}

vec3 blendSaturation(vec3 base, vec3 blend) {
  return setLum(setSat(base, sat(blend)), lum(base));
}

vec3 blendColor(vec3 base, vec3 blend) {
  return setLum(blend, lum(base));
}

vec3 blendLuminosity(vec3 base, vec3 blend) {
  return setLum(base, lum(blend));
}

// --- Main blend dispatcher ---

vec3 applyBlend(vec3 base, vec3 blend, int mode) {
  if (mode == 0) return blend;                    // Normal
  if (mode == 1) return blendMultiply(base, blend);
  if (mode == 2) return blendScreen(base, blend);
  if (mode == 3) return blendOverlay(base, blend);
  if (mode == 4) return blendDarken(base, blend);
  if (mode == 5) return blendLighten(base, blend);
  if (mode == 6) return blendColorDodge(base, blend);
  if (mode == 7) return blendColorBurn(base, blend);
  if (mode == 8) return blendHardLight(base, blend);
  if (mode == 9) return blendSoftLight(base, blend);
  if (mode == 10) return blendDifference(base, blend);
  if (mode == 11) return blendExclusion(base, blend);
  if (mode == 12) return blendHue(base, blend);
  if (mode == 13) return blendSaturation(base, blend);
  if (mode == 14) return blendColor(base, blend);
  if (mode == 15) return blendLuminosity(base, blend);
  return blend;
}

void main() {
  vec4 src = texture(u_src, v_texCoord);
  vec4 dst = texture(u_dst, v_texCoord);

  // Premultiplied alpha handling: un-premultiply for blending
  vec3 srcRGB = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
  vec3 dstRGB = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);

  float srcA = src.a * u_opacity;

  vec3 blended = applyBlend(dstRGB, srcRGB, u_blendMode);

  // Porter-Duff source-over compositing
  float outA = srcA + dst.a * (1.0 - srcA);
  vec3 outRGB = outA > 0.0
    ? (blended * srcA + dstRGB * dst.a * (1.0 - srcA)) / outA
    : vec3(0.0);

  fragColor = vec4(outRGB * outA, outA);
}
`;

/** Simple pass-through fragment shader for copying textures. */
export const COPY_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_src;
uniform float u_opacity;

out vec4 fragColor;

void main() {
  vec4 c = texture(u_src, v_texCoord);
  fragColor = vec4(c.rgb, c.a * u_opacity);
}
`;

/** Checkerboard background fragment shader. */
export const CHECKERBOARD_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform vec2 u_resolution;
uniform float u_tileSize;

out vec4 fragColor;

void main() {
  vec2 pixel = v_texCoord * u_resolution;
  float checker = mod(floor(pixel.x / u_tileSize) + floor(pixel.y / u_tileSize), 2.0);
  float gray = checker < 0.5 ? 1.0 : 0.8;
  fragColor = vec4(gray, gray, gray, 1.0);
}
`;

/** Solid color background fragment shader. */
export const SOLID_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform vec4 u_color;

out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`;

/** Gaussian blur fragment shader (single-pass separable). */
export const BLUR_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_src;
uniform vec2 u_direction;
uniform vec2 u_texelSize;

out vec4 fragColor;

void main() {
  // 9-tap Gaussian kernel (sigma ~2.0)
  float weights[5] = float[](0.2270270, 0.1945945, 0.1216216, 0.0540540, 0.0162162);

  vec4 result = texture(u_src, v_texCoord) * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = u_direction * u_texelSize * float(i);
    result += texture(u_src, v_texCoord + offset) * weights[i];
    result += texture(u_src, v_texCoord - offset) * weights[i];
  }
  fragColor = result;
}
`;

/**
 * Map BlendMode string to shader integer constant.
 * Must match the if-chain in applyBlend().
 */
export const BLEND_MODE_MAP: Record<string, number> = {
  'normal': 0,
  'multiply': 1,
  'screen': 2,
  'overlay': 3,
  'darken': 4,
  'lighten': 5,
  'color-dodge': 6,
  'color-burn': 7,
  'hard-light': 8,
  'soft-light': 9,
  'difference': 10,
  'exclusion': 11,
  'hue': 12,
  'saturation': 13,
  'color': 14,
  'luminosity': 15,
};
