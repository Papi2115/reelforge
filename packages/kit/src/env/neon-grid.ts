/**
 * `kit.env.neonGrid`: the synthwave floor - a disc whose fragment shader draws an analytic grid
 * (lines widened to >= 1 px and energy-preserved, so distant lines average out instead of
 * breaking into dashes or moire) that fades into the horizon colour with distance.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { KitError } from '../errors.js';
import { createKitObject } from '../object.js';
import { defineEnv, type KitTools } from '../registry.js';
import { asEnv, colorOf, colorParam } from './shared.js';

/** Colour chains per variant: floor, lines, horizon (fade target). */
export const GRID_VARIANTS = {
  violet: {
    floor: ['indigo', 'black', 'night', 'shadow'],
    line: ['magenta', 'blood', 'rose', 'accent4'],
    horizon: ['violet', 'bloodDark', 'mauve', 'ground'],
  },
  teal: {
    floor: ['navy', 'ink', 'night', 'sky'],
    line: ['brightTeal', 'teal', 'sage', 'accent1'],
    horizon: ['teal', 'tealDark', 'olive', 'accent3'],
  },
  navy: {
    floor: ['black', 'ink', 'night', 'shadow'],
    line: ['teal', 'steel', 'cornflower', 'accent3'],
    horizon: ['navy', 'charcoal', 'dusk', 'sky'],
  },
} as const satisfies Record<string, Record<'floor' | 'line' | 'horizon', readonly string[]>>;

/** Drawn after the sky, before everything else; writes no depth (a backdrop, see sky.ts). */
export const GRID_RENDER_ORDER = -2;

type ScrollFunction = (t: number) => number;

const scrollFunction = z.custom<ScrollFunction>((value) => typeof value === 'function', {
  message: 'scroll must be a number (units per second) or a function (t) => offset',
});

export const neonGridParams = z.object({
  variant: z
    .enum(['violet', 'teal', 'navy'])
    .default('violet')
    .describe('violet: magenta lines on indigo; teal: teal lines on navy; navy: dim teal on black'),
  scroll: z
    .union([z.number(), scrollFunction])
    .default(0)
    .describe(
      'Lines moving towards +z: a speed in units per second, or a pure function (t) => offset in units. Applied by grid.update(t)',
    ),
  horizon: z
    .number()
    .min(5)
    .max(500)
    .default(60)
    .describe(
      'Radius of the grid disc in units; lines are fully faded into the horizon colour at this distance',
    ),
  fog: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe(
      'Share of the horizon distance (from the camera) over which lines fade out; 0 = no fade',
    ),
  cell: z.number().min(0.25).max(20).default(2).describe('Grid spacing in units'),
  lineWidth: z
    .number()
    .min(0.01)
    .max(1)
    .default(0.08)
    .describe('Line width in units (near the camera)'),
  floorColor: z.string().optional().describe('Palette name of the floor (default: by variant)'),
  lineColor: z.string().optional().describe('Palette name of the lines (default: by variant)'),
  horizonColor: z
    .string()
    .optional()
    .describe('Palette name the grid fades into; match it to the lowest sky colour'),
});

export type NeonGridParams = z.output<typeof neonGridParams>;

const VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 floorColor;
uniform vec3 lineColor;
uniform vec3 horizonColor;
uniform float cell;
uniform float lineWidth;
uniform float scroll;
uniform float fadeStart;
uniform float fadeEnd;
uniform float radius;
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vec2 coord = vec2(vLocal.x, vLocal.z - scroll) / cell;
  vec2 deriv = max(fwidth(coord), vec2(0.000001));
  float width = lineWidth / cell;
  vec2 distanceToLine = abs(fract(coord + 0.5) - 0.5);
  vec2 drawWidth = max(vec2(width), deriv);
  vec2 lines = 1.0 - smoothstep(0.5 * (drawWidth - deriv), 0.5 * (drawWidth + deriv), distanceToLine);
  lines *= clamp(width / drawWidth, 0.0, 1.0);
  lines = mix(lines, vec2(width), clamp(deriv * 2.0 - 1.0, 0.0, 1.0));
  vec3 color = mix(floorColor, lineColor, max(lines.x, lines.y));
  float cameraFade = smoothstep(fadeStart, fadeEnd, distance(vWorld, cameraPosition));
  float edgeFade = smoothstep(radius * 0.8, radius, length(vLocal.xz));
  gl_FragColor = vec4(mix(color, horizonColor, max(cameraFade, edgeFade)), 1.0);
}`;

function scrollAt(scroll: NeonGridParams['scroll'], t: number): number {
  const offset = typeof scroll === 'number' ? scroll * t : scroll(t);
  if (typeof offset !== 'number' || !Number.isFinite(offset)) {
    throw new KitError(
      'invalid-params',
      `neonGrid scroll(${String(t)}) must return a finite number of units (got ${String(offset)})`,
    );
  }
  return offset;
}

function createGridMaterial(tools: KitTools, params: NeonGridParams): THREE.ShaderMaterial {
  const variant = GRID_VARIANTS[params.variant];
  const { palette } = tools;
  return tools.track(
    new tools.three.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        floorColor: {
          value: colorOf(tools, colorParam(palette, params.floorColor, variant.floor)),
        },
        lineColor: { value: colorOf(tools, colorParam(palette, params.lineColor, variant.line)) },
        horizonColor: {
          value: colorOf(tools, colorParam(palette, params.horizonColor, variant.horizon)),
        },
        cell: { value: params.cell },
        lineWidth: { value: params.lineWidth },
        scroll: { value: 0 },
        fadeStart: { value: params.horizon * (1 - params.fog) },
        fadeEnd: { value: params.horizon * 1.0001 },
        radius: { value: params.horizon },
      },
      depthWrite: false,
    }),
  );
}

export const neonGrid = defineEnv({
  name: 'neonGrid',
  description:
    'Synthwave neon grid floor at y = 0 stretching to the horizon, lines fading into the horizon colour; pair it with kit.env.sky. A backdrop: draws before other objects and writes no depth, so props stand on it without outlines from the floor. Call grid.update(t) to apply scroll.',
  params: neonGridParams,
  anchors: { top: 'the floor at the origin (y = 0), so kit props .on(grid) stand on it' },
  build(params, tools) {
    const { three } = tools;
    const geometry = tools.track(new three.CircleGeometry(params.horizon, 96));
    geometry.rotateX(-Math.PI / 2);
    const material = createGridMaterial(tools, params);
    const floor = new three.Mesh(geometry, material);
    floor.name = 'neonGridFloor';
    floor.renderOrder = GRID_RENDER_ORDER;
    const object = createKitObject(three, {
      kitType: 'neonGrid',
      anchors: { top: [0, 0, 0] },
      resources: [geometry, material],
    });
    object.add(floor);
    const scroll = material.uniforms['scroll'];
    return asEnv(object, (t) => {
      if (scroll) scroll.value = scrollAt(params.scroll, t);
    });
  },
});
