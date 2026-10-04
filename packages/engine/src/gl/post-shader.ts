/**
 * GLSL of the composite + pixel-art post pass, generated per style so disabled effects cost
 * nothing. Order: per-layer fake AO + depth outline -> (bokeh variant only: per-layer
 * ordered-dither depth of field, bokeh-shader.ts) -> per-layer pixel text (overlay) ->
 * transition (A/B) -> vignette -> scanlines -> ordered dither -> palette LUT. Every step before the LUT only changes the input colour, so each
 * output pixel is a palette colour. CPU references: palette.ts (dither, LUT), style.ts (vignette,
 * scanlines).
 */
import { bayerMatrix } from '../palette.js';
import type { PostFxSettings } from '../style.js';
import { bokehSection } from './bokeh-shader.js';

/** Number of discrete glitch states over a transition (stepped, pixel-art feel). */
const GLITCH_STEPS = 12;
/** Height of a glitch band in output pixels. */
const GLITCH_BAND_HEIGHT = 8;
/** Max horizontal band displacement as a fraction of the width (at mid-transition). */
const GLITCH_MAX_SHIFT = 0.1;
/** Min relative concavity (in 1/depth) that counts as an occluded crease; planes give 0. */
const AO_BIAS = 0.01;

export const POST_VERTEX_SHADER = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function glslFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/** True when the style needs scene depth textures (outline or AO). */
export function needsDepth(post: PostFxSettings): boolean {
  return post.outline !== undefined || post.ao !== undefined;
}

function depthSection(post: PostFxSettings): string {
  if (!needsDepth(post)) return '';
  const parts = [
    /* glsl */ `
uniform sampler2D dA;
uniform sampler2D dB;
uniform vec2 clipA;
uniform vec2 clipB;

bool inFrame(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height; }

// Perspective window depth (0..1) -> view-space distance; clip = (near, far).
float viewDepth(sampler2D depth, vec2 clip, ivec2 p) {
  ivec2 q = clamp(p, ivec2(0), ivec2(width - 1, height - 1));
  float d = texelFetch(depth, ivec2(q.x, height - 1 - q.y), 0).r;
  return clip.x * clip.y / (clip.y - d * (clip.y - clip.x));
}`,
  ];
  if (post.ao) {
    parts.push(/* glsl */ `
const ivec2 AO_DIRS[4] = ivec2[4](ivec2(1, 0), ivec2(0, 1), ivec2(1, 1), ivec2(1, -1));

// Share of 4 opposing sample pairs that see a concave crease (1/depth is affine on planes).
float occlusion(sampler2D depth, vec2 clip, ivec2 p) {
  float z = viewDepth(depth, clip, p);
  float occluded = 0.0;
  for (int i = 0; i < 4; i++) {
    ivec2 offset = AO_DIRS[i] * ${String(post.ao.radius)};
    if (!inFrame(p + offset) || !inFrame(p - offset)) continue;
    float z1 = viewDepth(depth, clip, p + offset);
    float z2 = viewDepth(depth, clip, p - offset);
    float concavity = z * 0.5 * (1.0 / z1 + 1.0 / z2) - 1.0;
    if (concavity > ${glslFloat(AO_BIAS)} && z - min(z1, z2) < ${glslFloat(post.ao.range)}) occluded += 1.0;
  }
  return occluded * 0.25;
}`);
  }
  if (post.outline) {
    const [r, g, b] = post.outline.color.map(glslFloat);
    parts.push(/* glsl */ `
const vec3 OUTLINE_COLOR = vec3(${String(r)}, ${String(g)}, ${String(b)});

// Outer outline: the pixel lies behind a 4-neighbour that is clearly closer.
bool silhouette(sampler2D depth, vec2 clip, ivec2 p) {
  float limit = viewDepth(depth, clip, p) * ${glslFloat(1 - post.outline.threshold)};
  return viewDepth(depth, clip, p + ivec2(1, 0)) < limit
    || viewDepth(depth, clip, p - ivec2(1, 0)) < limit
    || viewDepth(depth, clip, p + ivec2(0, 1)) < limit
    || viewDepth(depth, clip, p - ivec2(0, 1)) < limit;
}`);
  }
  return parts.join('\n');
}

function shadeSection(post: PostFxSettings, bokeh: boolean): string {
  const depthParams = needsDepth(post) ? ', sampler2D depth, vec2 clip' : '';
  const ao = post.ao
    ? `  color *= 1.0 - ${glslFloat(post.ao.strength)} * occlusion(depth, clip, p);\n`
    : '';
  const outline = post.outline ? '  if (silhouette(depth, clip, p)) color = OUTLINE_COLOR;\n' : '';
  // With bokeh, the AO/outline pixel is `shadeBase` and `shade` (bokeh-shader.ts) samples it.
  const focusArgA = bokeh ? ', focusA' : '';
  const focusArgB = bokeh ? ', focusB' : '';
  const depthArgsA = needsDepth(post) ? `, dA, clipA${focusArgA}` : '';
  const depthArgsB = needsDepth(post) ? `, dB, clipB${focusArgB}` : '';
  const shadeName = bokeh ? 'shadeBase' : 'shade';
  const bokehFunctions = bokeh ? bokehSection() : '';
  return /* glsl */ `
// p is in top-down image coordinates; scene textures are bottom-up, text overlays top-down.
vec3 ${shadeName}(sampler2D scene${depthParams}, ivec2 p) {
  vec3 color = texelFetch(scene, ivec2(p.x, height - 1 - p.y), 0).rgb;
${ao}${outline}  return color;
}${bokehFunctions}
// Text pixels are opaque (alpha 255) or absent (alpha 0): not touched by AO/outline, but blended
// by transitions and quantized by the post pass like the 3D image.
vec3 withText(sampler2D text, vec3 color, ivec2 p) {
  vec4 overlay = texelFetch(text, p, 0);
  return mix(color, overlay.rgb, overlay.a);
}
vec3 sceneA(ivec2 p) { return withText(xA, shade(tA${depthArgsA}, p), p); }
vec3 sceneB(ivec2 p) { return withText(xB, shade(tB${depthArgsB}, p), p); }`;
}

const COMPOSE_SECTION = /* glsl */ `
uint hash(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
float unit01(uint x) { return float(x >> 8u) / 16777216.0; }

vec3 glitch(ivec2 p) {
  uint stepIndex = uint(floor(progress * ${glslFloat(GLITCH_STEPS)}));
  uint band = uint(p.y / ${String(GLITCH_BAND_HEIGHT)});
  uint h = hash(uint(seed) ^ hash(band * 0x9e3779b9u ^ (stepIndex + 1u) * 0x85ebca6bu));
  float intensity = 1.0 - abs(2.0 * progress - 1.0);
  int shift = int(floor((unit01(h) - 0.5) * 2.0 * intensity * float(width) * ${glslFloat(GLITCH_MAX_SHIFT)}));
  bool fromB = unit01(hash(h)) < progress;
  ivec2 q = ivec2((p.x + shift + width) % width, p.y);
  ivec2 split = ivec2((q.x + shift / 3 + width) % width, p.y);
  vec3 color = fromB ? sceneB(q) : sceneA(q);
  color.r = fromB ? sceneB(split).r : sceneA(split).r;
  return color;
}

vec3 compose(ivec2 p) {
  if (mode == 1) return mix(sceneA(p), sceneB(p), progress);
  if (mode == 2) return p.x < int(floor(progress * float(width))) ? sceneB(p) : sceneA(p);
  if (mode == 3) return glitch(p);
  return sceneA(p);
}`;

function screenSection(post: PostFxSettings): string {
  const lines: string[] = [];
  if (post.vignette) {
    const { strength, radius, softness } = post.vignette;
    lines.push(/* glsl */ `
float vignette(ivec2 p) {
  float aspect = float(width) / float(height);
  vec2 d = (vec2(p) + 0.5) / vec2(float(width), float(height)) - 0.5;
  d.x *= aspect;
  float dist = length(d) / length(vec2(0.5 * aspect, 0.5));
  return 1.0 - ${glslFloat(strength)} * smoothstep(${glslFloat(radius)}, ${glslFloat(radius + softness)}, dist);
}`);
  }
  if (post.scanlines) {
    const { period, strength } = post.scanlines;
    lines.push(/* glsl */ `
float scanline(ivec2 p) {
  return p.y % ${String(period)} == ${String(period - 1)} ? ${glslFloat(1 - strength)} : 1.0;
}`);
  }
  return lines.join('\n');
}

export interface PostShaderOptions {
  /** Variant with the ordered-dither bokeh (needs depth: `needsDepth(post)`). Default false. */
  readonly bokeh?: boolean;
}

export function postFragmentShader(post: PostFxSettings, options: PostShaderOptions = {}): string {
  const bokeh = options.bokeh === true && needsDepth(post);
  const focusUniforms = bokeh ? 'uniform vec2 focusA;\nuniform vec2 focusB;\n' : '';
  const size = post.dither.size;
  const bayer = bayerMatrix(size).map(glslFloat).join(', ');
  const cells = size * size;
  const levels = post.lut.levels;
  const vignette = post.vignette ? '  color *= vignette(p);\n' : '';
  const scanline = post.scanlines ? '  color *= scanline(p);\n' : '';
  return /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tA;
uniform sampler2D tB;
uniform sampler2D xA;
uniform sampler2D xB;
uniform highp sampler3D lut;
uniform int mode;
uniform float progress;
uniform int seed;
uniform int width;
uniform int height;
${focusUniforms}const float BAYER[${String(cells)}] = float[${String(cells)}](${bayer});
${depthSection(post)}
${shadeSection(post, bokeh)}
${COMPOSE_SECTION}
${screenSection(post)}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 color = compose(p);
${vignette}${scanline}  float offset = ((BAYER[(p.y % ${String(size)}) * ${String(size)} + (p.x % ${String(size)})] + 0.5) / ${glslFloat(cells)} - 0.5) * ${glslFloat(post.dither.spread)};
  ivec3 cell = clamp(ivec3(floor((color + vec3(offset)) * ${glslFloat(levels)})), ivec3(0), ivec3(${String(levels - 1)}));
  gl_FragColor = vec4(texelFetch(lut, cell, 0).rgb, 1.0);
}`;
}
