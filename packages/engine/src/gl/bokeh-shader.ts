/**
 * GLSL of the ordered-dither bokeh (ADR-013), spliced into the post pass by post-shader.ts when a
 * shot has a focus (`ctx.camera.rackFocus`). Mirrors camera/bokeh.ts (CPU reference): integer
 * CoC radius from the view depth, one integer-pixel tap per pixel picked by its 4x4 Bayer rank,
 * taps clearly nearer and sharper than the pixel rejected. The tap is a full `shadeBase` pixel
 * (AO + outline), so the result goes through the same dither and palette LUT as everything else.
 */
import {
  BOKEH_DEPTH_TOLERANCE,
  BOKEH_TAPS_PER_RADIUS,
  bokehTapTable,
  MAX_BOKEH_RADIUS,
} from '../camera/bokeh.js';
import { BAYER_4X4 } from '../palette.js';

function glslFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/**
 * Bokeh functions; needs `width`, `height`, `viewDepth` and `shadeBase(scene, depth, clip, p)`
 * declared before. `focus` = (distance, aperture); aperture 0 = no bokeh.
 */
export function bokehSection(): string {
  const taps = bokehTapTable();
  const tapList = taps.map(([x, y]) => `ivec2(${String(x)}, ${String(y)})`).join(', ');
  const ranks = BAYER_4X4.map(String).join(', ');
  return /* glsl */ `
const ivec2 BOKEH_TAPS[${String(taps.length)}] = ivec2[${String(taps.length)}](${tapList});
const int BOKEH_RANK[${String(BAYER_4X4.length)}] = int[${String(BAYER_4X4.length)}](${ranks});

int bokehRadius(float z, vec2 focus) {
  return int(floor(min(${glslFloat(MAX_BOKEH_RADIUS)}, focus.y * abs(z - focus.x) / min(z, focus.x))));
}

vec3 shade(sampler2D scene, sampler2D depth, vec2 clip, vec2 focus, ivec2 p) {
  vec3 color = shadeBase(scene, depth, clip, p);
  if (focus.y <= 0.0) return color;
  float z = viewDepth(depth, clip, p);
  int radius = bokehRadius(z, focus);
  if (radius < 1) return color;
  ivec2 offset = BOKEH_TAPS[(radius - 1) * ${String(BOKEH_TAPS_PER_RADIUS)} + BOKEH_RANK[(p.y % 4) * 4 + (p.x % 4)]];
  ivec2 q = clamp(p + offset, ivec2(0), ivec2(width - 1, height - 1));
  float zq = viewDepth(depth, clip, q);
  int reach = max(abs(q.x - p.x), abs(q.y - p.y));
  if (zq < z * ${glslFloat(BOKEH_DEPTH_TOLERANCE)} && bokehRadius(zq, focus) < reach) return color;
  return shadeBase(scene, depth, clip, q);
}`;
}
