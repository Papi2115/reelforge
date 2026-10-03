/**
 * Environments under ambient variation (PLAN.md#12.8): with no variation or a neutral one (scale
 * 0) every environment is built exactly as before; with a variation each applies its axes.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import { ambientVariation } from '../variation/ambient.js';
import type { AmbientVariation, VariationBudget } from '../variation/types.js';

const BUDGET: VariationBudget = {
  tones: { navy: ['indigo'], slateBlue: ['teal'] },
  toneShare: 0.35,
  steps: 5,
  cell: [0.8, 1.25],
  horizon: [-0.06, 0.08],
  fade: [0.85, 1.2],
  lightAzimuth: [-24, 24],
  lightElevation: [-8, 8],
  debris: [0.75, 1.3],
  cameraDrift: [1.2, 0.5],
};

const NEUTRAL = ambientVariation({
  seed: 1,
  shotId: 's01',
  index: 3,
  actIndex: 0,
  budgetKey: 'voxel',
  budget: BUDGET,
  scale: 0,
});

/** A hand-picked variation, so every axis has a known value. */
const VARIED: AmbientVariation = {
  ...NEUTRAL,
  scale: 1,
  tones: { navy: 'indigo', magenta: 'pink', slateBlue: 'teal', indigo: 'purple' },
  cell: 1.25,
  horizon: 0.05,
  fade: 1.2,
  lightAzimuth: 20,
  lightElevation: 6,
  debris: 1.3,
  layout: 17,
};

type EnvFactory = (params?: unknown) => THREE.Object3D & { update(t: number): void };

const SETUPS: readonly (readonly [string, unknown])[] = [
  ['sky', { style: 'dusk', stars: 40 }],
  ['sky', { style: 'night' }],
  ['neonGrid', { variant: 'violet', scroll: 1 }],
  ['neonGrid', { variant: 'teal', cell: 3 }],
  ['lights', { preset: 'neon' }],
  ['lights', { preset: 'dramatic', azimuth: 10 }],
  ['desk', {}],
  ['bench', {}],
  ['room', {}],
  ['blockCity', { seed: 4, blocks: 2 }],
  ['floatingCubes', { count: 20, seed: 2 }],
  ['void', { seed: 3 }],
];

function build(name: string, params: unknown, variation?: AmbientVariation) {
  const { api } = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(9), variation });
  const factory = (api.env as Record<string, EnvFactory>)[name];
  if (!factory) throw new Error(`no env ${name}`);
  const env = factory(params);
  env.update(1.25);
  return env;
}

function uniformValue(value: unknown): unknown {
  if (value instanceof THREE.Color) return value.getHexString();
  if (Array.isArray(value)) return value.map(uniformValue);
  return value;
}

/** Everything an environment renders from: geometry, instances, colours, uniforms, lights. */
function snapshot(root: THREE.Object3D): unknown[] {
  const parts: unknown[] = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    parts.push(child.name, child.type, child.matrixWorld.toArray());
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      const geometry = child.geometry as THREE.BufferGeometry;
      for (const [key, attribute] of Object.entries(geometry.attributes)) {
        parts.push(key, [...attribute.array]);
      }
      const material = child.material as THREE.Material;
      if (material instanceof THREE.ShaderMaterial) {
        for (const [key, { value }] of Object.entries(material.uniforms)) {
          parts.push(key, uniformValue(value));
        }
      }
    }
    if (child instanceof THREE.InstancedMesh) {
      parts.push(
        child.count,
        [...child.instanceMatrix.array],
        [...(child.instanceColor?.array ?? [])],
      );
    }
    if (child instanceof THREE.Light) parts.push(child.color.getHexString(), child.intensity);
  });
  return parts;
}

function shader(root: THREE.Object3D, name: string): THREE.ShaderMaterial {
  const mesh = root.getObjectByName(name);
  if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.ShaderMaterial) {
    return mesh.material;
  }
  throw new Error(`no shader mesh ${name}`);
}

function hex(material: THREE.ShaderMaterial, name: string): string {
  const value = material.uniforms[name]?.value as THREE.Color | THREE.Color[];
  return `#${(Array.isArray(value) ? (value[0] ?? new THREE.Color()) : value).getHexString()}`;
}

describe('environments under ambient variation', () => {
  it.each(SETUPS)('builds %s %j exactly as before with a neutral variation', (name, params) => {
    expect(snapshot(build(name, params, NEUTRAL))).toEqual(snapshot(build(name, params)));
  });

  it.each(SETUPS.filter(([name]) => !['desk', 'bench'].includes(name)))(
    'varies %s %j',
    (name, params) => {
      expect(snapshot(build(name, params, VARIED))).not.toEqual(snapshot(build(name, params)));
    },
  );

  it('shifts the sky horizon and tones its default stops, keeping explicit colours', () => {
    const dome = shader(build('sky', { style: 'dusk' }, VARIED), 'skyDome');
    expect(dome.uniforms['horizon']?.value).toBeCloseTo(0.05, 12);
    expect(dome.uniforms['top']?.value).toBeCloseTo(0.55, 12);
    expect(hex(dome, 'colors')).toBe(CRISP_PALETTE['indigo']);
    const explicit = shader(build('sky', { colors: ['navy', 'magenta'] }, VARIED), 'skyDome');
    expect(hex(explicit, 'colors')).toBe(CRISP_PALETTE['navy']);
  });

  it('scales the grid density and fade distance and tones default colours only', () => {
    const grid = shader(build('neonGrid', { variant: 'violet', cell: 2 }, VARIED), 'neonGridFloor');
    expect(grid.uniforms['cell']?.value).toBe(2.5);
    expect(grid.uniforms['radius']?.value).toBe(72);
    expect(hex(grid, 'lineColor')).toBe(CRISP_PALETTE['pink']);
    expect(hex(grid, 'floorColor')).toBe(CRISP_PALETTE['purple']);
    const explicit = shader(
      build('neonGrid', { variant: 'violet', lineColor: 'magenta' }, VARIED),
      'neonGridFloor',
    );
    expect(hex(explicit, 'lineColor')).toBe(CRISP_PALETTE['magenta']);
  });

  it('turns and raises the key light', () => {
    const key = (variation?: AmbientVariation): THREE.Vector3 => {
      const light = build('lights', { preset: 'default' }, variation).getObjectByName('keyLight');
      if (!light) throw new Error('no key light');
      return light.position;
    };
    const base = key();
    const turned = key(VARIED);
    const azimuth = (vector: THREE.Vector3): number =>
      (Math.atan2(vector.x, vector.z) * 180) / Math.PI;
    const elevation = (vector: THREE.Vector3): number =>
      (Math.asin(vector.y / vector.length()) * 180) / Math.PI;
    expect(azimuth(turned) - azimuth(base)).toBeCloseTo(20, 6);
    expect(elevation(turned) - elevation(base)).toBeCloseTo(6, 6);
  });

  it('scales the debris and re-rolls its layout', () => {
    const cubes = (variation?: AmbientVariation): number => {
      let count = 0;
      build('floatingCubes', { count: 20 }, variation).traverse((child) => {
        if (child instanceof THREE.InstancedMesh) count += child.count;
      });
      return count;
    };
    expect(cubes()).toBe(20);
    expect(cubes(VARIED)).toBe(26);
  });
});
