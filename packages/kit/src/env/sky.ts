/**
 * `kit.env.sky`: a backdrop dome with a banded, ordered-dithered gradient (the shader picks one
 * of two palette colours per pixel with a 4x4 Bayer threshold, so the pattern is exact palette
 * colours and survives the post pass) plus optional 1-px twinkling stars.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { createKitObject, type Disposable } from '../object.js';
import { defineEnv, type KitTools } from '../registry.js';
import { asEnv, colorOf, emptyBounds, pickColor, type EnvObject } from './shared.js';

/** Colour chains per style, top of the sky -> horizon (see pickColor). */
export const SKY_STYLES = {
  dusk: [
    ['navy', 'ink', 'dusk', 'sky'],
    ['purple', 'charcoal', 'plum', 'ground'],
    ['violet', 'slate', 'mauve', 'groundAlt'],
    ['magenta', 'blood', 'rose', 'accent4'],
  ],
  night: [
    ['black', 'night', 'shadow'],
    ['navy', 'ink', 'sky'],
    ['slateBlue', 'tealDark', 'dusk', 'groundAlt'],
    ['teal', 'cornflower', 'accent3'],
  ],
  dawn: [
    ['indigo', 'charcoal', 'dusk', 'shadow'],
    ['violet', 'slate', 'mauve', 'ground'],
    ['pink', 'ember', 'coral', 'accent2'],
    ['lightOrange', 'amber', 'peach', 'keyLight'],
  ],
  void: [
    ['black', 'night', 'shadow'],
    ['navy', 'ink', 'night', 'sky'],
    ['indigo', 'charcoal', 'plum', 'groundAlt'],
  ],
} as const satisfies Record<string, readonly (readonly string[])[]>;

export type SkyStyle = keyof typeof SKY_STYLES;

const MAX_COLORS = 6;
/** How much faster the gradient returns to the top colour below the horizon (GLSL float). */
const BELOW_SPEED = '2.5';
/** Sky objects draw first and write no depth: they never occlude, outline or shade anything. */
export const SKY_RENDER_ORDER = -3;
const STAR_RENDER_ORDER = -2.5;

export const skyParams = z.object({
  style: z
    .enum(['dusk', 'night', 'dawn', 'void'])
    .default('dusk')
    .describe(
      'dusk: navy->violet->magenta; night: black->navy->teal; dawn: indigo->pink->orange; void: near-black',
    ),
  colors: z
    .array(z.string())
    .min(2)
    .max(MAX_COLORS)
    .optional()
    .describe('Palette names from the top of the sky to the horizon; overrides style'),
  stars: z
    .number()
    .int()
    .min(0)
    .max(2000)
    .default(0)
    .describe('Number of 1-px stars (seeded); they twinkle with update(t)'),
  starColor: z.string().default('text').describe('Palette name of lit stars'),
  dither: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe(
      'Width of the dithered transition between two bands (0 = hard bands, 1 = all dither)',
    ),
  horizon: z
    .number()
    .min(-0.5)
    .max(0.5)
    .default(0)
    .describe(
      'Elevation (sine of the angle) of the last colour; below it the sky stays that colour',
    ),
  top: z
    .number()
    .min(0.1)
    .max(1)
    .default(0.5)
    .describe('Elevation where the first colour starts (higher = taller gradient)'),
  radius: z
    .number()
    .min(10)
    .max(900)
    .default(300)
    .describe('Dome radius in units (camera far is 1000)'),
});

export type SkyParams = z.output<typeof skyParams>;

const VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 colors[${String(MAX_COLORS)}];
uniform int count;
uniform float horizon;
uniform float top;
uniform float dither;
varying vec3 vDirection;
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
void main() {
  float elevation = normalize(vDirection).y;
  // Above the horizon: top colour -> horizon colour; below it the gradient mirrors back
  // (BELOW_SPEED times faster), so a sky without a floor does not flood with the horizon colour.
  float above = (elevation - horizon) / max(top - horizon, 0.001);
  float u = clamp(above >= 0.0 ? above : -above * ${BELOW_SPEED}, 0.0, 1.0);
  float band = (1.0 - u) * float(count - 1);
  int index = min(int(floor(band)), count - 2);
  float f = clamp((band - float(index) - 0.5) / max(dither, 0.001) + 0.5, 0.0, 1.0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  float threshold = (BAYER[(p.y % 4) * 4 + (p.x % 4)] + 0.5) / 16.0;
  gl_FragColor = vec4(f > threshold ? colors[index + 1] : colors[index], 1.0);
}`;

function skyColors(tools: KitTools, params: SkyParams): string[] {
  if (params.colors) return params.colors;
  return SKY_STYLES[params.style].map((chain) => pickColor(tools.palette, chain));
}

function createDome(
  tools: KitTools,
  params: SkyParams,
): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const { three } = tools;
  const names = skyColors(tools, params);
  const colors = Array.from({ length: MAX_COLORS }, (_, index) =>
    colorOf(tools, names[Math.min(index, names.length - 1)] ?? 'sky'),
  );
  const geometry = tools.track(new three.SphereGeometry(params.radius, 48, 24));
  const material = tools.track(
    new three.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        colors: { value: colors },
        count: { value: names.length },
        horizon: { value: params.horizon },
        top: { value: Math.max(params.top, params.horizon + 0.05) },
        dither: { value: params.dither },
      },
      side: three.BackSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  const dome = new three.Mesh(geometry, material);
  dome.name = 'skyDome';
  dome.renderOrder = SKY_RENDER_ORDER;
  return dome;
}

interface Stars {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  readonly resources: readonly Disposable[];
  pose(t: number): void;
}

function createStars(tools: KitTools, params: SkyParams): Stars | undefined {
  if (params.stars === 0) return undefined;
  const { three, rng } = tools;
  const count = params.stars;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const radius = params.radius * 0.97;
  for (let index = 0; index < count; index += 1) {
    const elevation = rng.range(Math.max(params.horizon + 0.06, 0.04), 0.98);
    const azimuth = rng.range(0, Math.PI * 2);
    const ring = Math.sqrt(1 - elevation * elevation);
    positions.set(
      [Math.cos(azimuth) * ring * radius, elevation * radius, Math.sin(azimuth) * ring * radius],
      index * 3,
    );
    phases[index] = rng.range(0, Math.PI * 2);
    speeds[index] = rng() < 0.35 ? rng.range(1.5, 4) : 0;
  }
  const lit = colorOf(tools, params.starColor);
  const dim = colorOf(tools, pickColor(tools.palette, ['textDim', 'text']));
  const colors = new Float32Array(count * 3);
  const geometry = tools.track(new three.BufferGeometry());
  geometry.setAttribute('position', new three.BufferAttribute(positions, 3));
  const colorAttribute = new three.BufferAttribute(colors, 3);
  geometry.setAttribute('color', colorAttribute);
  const material = tools.track(
    new three.PointsMaterial({
      size: 1,
      sizeAttenuation: false,
      vertexColors: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
    }),
  );
  const points = new three.Points(geometry, material);
  points.name = 'skyStars';
  points.renderOrder = STAR_RENDER_ORDER;
  const pose = (t: number): void => {
    for (let index = 0; index < count; index += 1) {
      const twinkle = Math.sin(t * (speeds[index] ?? 0) + (phases[index] ?? 0));
      const color = twinkle > -0.2 ? lit : dim;
      colors.set([color.r, color.g, color.b], index * 3);
    }
    colorAttribute.needsUpdate = true;
  };
  pose(0);
  return { points, pose, resources: [geometry, material] };
}

/** Builds a sky (also used by kit.env.void). */
export function buildSky(params: SkyParams, tools: KitTools): EnvObject {
  const dome = createDome(tools, params);
  const stars = createStars(tools, params);
  const object = createKitObject(tools.three, {
    kitType: 'sky',
    bounds: emptyBounds(tools),
    resources: [dome.geometry, dome.material, ...(stars?.resources ?? [])],
  });
  object.add(dome);
  if (stars) object.add(stars.points);
  return asEnv(object, (t) => stars?.pose(t));
}

export const sky = defineEnv({
  name: 'sky',
  description:
    'Backdrop sky dome with a banded, Bayer-dithered gradient in palette colours and optional twinkling stars. Draws behind everything (no depth); centred on its position, so keep the camera well inside the radius. Call sky.update(t) when it has stars.',
  params: skyParams,
  build: buildSky,
});
