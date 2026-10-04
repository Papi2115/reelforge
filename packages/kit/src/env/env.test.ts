import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { voxelLook } from '../looks/index.js';
import { createKit, kitCatalog } from '../kit.js';
import { isKitObject } from '../object.js';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import type { KitPalette } from '../types.js';
import { hashCell, pickColor } from './shared.js';

const ENV_NAMES = [
  'sky',
  'neonGrid',
  'lights',
  'desk',
  'bench',
  'room',
  'blockCity',
  'floatingCubes',
  'void',
];

function kit(palette: KitPalette = CRISP_PALETTE, seed = 5) {
  return createKit({ three: THREE, palette, rng: testRng(seed) });
}

function voxelKit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(5), looks: [voxelLook] });
}

function find(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`no child named ${name}`);
  return found;
}

function shaderOf(root: THREE.Object3D, name: string): THREE.ShaderMaterial {
  const found = find(root, name);
  if (found instanceof THREE.Mesh && found.material instanceof THREE.ShaderMaterial) {
    return found.material;
  }
  throw new Error(`${name} is not a shader mesh`);
}

function directionalOf(root: THREE.Object3D, name: string): THREE.DirectionalLight {
  const found = find(root, name);
  if (found instanceof THREE.DirectionalLight) return found;
  throw new Error(`${name} is not a directional light`);
}

function uniform(material: THREE.ShaderMaterial, name: string): unknown {
  return material.uniforms[name]?.value;
}

function instanceMatrices(root: THREE.Object3D): number[] {
  const values: number[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) values.push(...child.instanceMatrix.array);
  });
  return values;
}

function geometryPositions(root: THREE.Object3D): number[] {
  const values: number[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) {
      values.push(...(child.geometry as THREE.BufferGeometry).getAttribute('position').array);
    }
  });
  return values;
}

describe('kit.env registry', () => {
  it('registers every environment with complete catalog metadata', () => {
    expect(Object.keys(voxelKit().api.env)).toEqual(ENV_NAMES);
    const entries = kitCatalog([], [voxelLook]).env;
    expect(entries.map((entry) => entry.name)).toEqual(ENV_NAMES);
    // With every available look, the voxel kit comes first and the rest belong to other looks.
    const all = kitCatalog().env;
    expect(Object.keys(kit().api.env)).toEqual(all.map((entry) => entry.name));
    expect(all.slice(0, ENV_NAMES.length)).toEqual(entries);
    for (const entry of all.slice(ENV_NAMES.length))
      expect(entry.look, entry.name).not.toBe('voxel');
    for (const entry of entries) {
      expect(entry.kind).toBe('env');
      expect(entry.description.length, entry.name).toBeGreaterThan(40);
      const properties = (entry.params['properties'] ?? {}) as Record<
        string,
        { description?: string }
      >;
      expect(Object.keys(properties).length, entry.name).toBeGreaterThan(0);
      for (const [key, schema] of Object.entries(properties)) {
        expect(schema.description, `${entry.name}.${key}`).toBeTruthy();
      }
    }
  });

  it.each([
    ['Crisp 640 swatches', CRISP_PALETTE],
    ['semantic tokens only', TOKENS_ONLY_PALETTE],
  ])('builds every environment with defaults from %s', (_label, palette) => {
    const { api } = kit(palette);
    for (const name of ENV_NAMES) {
      const factory = (api.env as Record<string, (params?: unknown) => unknown>)[name];
      const env = factory?.();
      expect(isKitObject(env), name).toBe(true);
      const object = env as THREE.Object3D & { kitType: string; update(t: number): void };
      expect(object.kitType).toBe(name);
      object.update(1.5);
    }
  });

  it('validates params and update(t), and refuses to build in update()', () => {
    const handle = kit();
    const { env } = handle.api;
    expect(() => env.neonGrid({ variant: 'pink' as never })).toThrow(
      /kit\.env\.neonGrid\(\): invalid params \(variant:/,
    );
    expect(() => {
      env.sky().update(Number.NaN);
    }).toThrow(/sky\.update\(t\): t must be a finite/);
    expect(() => env.desk({ wood: 'mahogany' })).toThrow(/colour "mahogany" is not in the style/);
    handle.seal();
    expect(() => env.sky()).toThrow(/kit\.env\.sky\(\) was called in update\(\)/);
  });
});

describe('kit.env.sky / neonGrid', () => {
  it('resolves the style colours top -> horizon and twinkles stars as a pure function of t', () => {
    const sky = kit().api.env.sky({ style: 'dusk', stars: 50 });
    const domeMaterial = shaderOf(sky, 'skyDome');
    const colors = uniform(domeMaterial, 'colors') as THREE.Color[];
    expect(colors.slice(0, 4).map((color) => `#${color.getHexString()}`)).toEqual([
      CRISP_PALETTE['navy'],
      CRISP_PALETTE['purple'],
      CRISP_PALETTE['violet'],
      CRISP_PALETTE['magenta'],
    ]);
    expect(uniform(domeMaterial, 'count')).toBe(4);
    expect(domeMaterial.depthWrite).toBe(false);
    expect(sky.anchor('top').toArray()).toEqual([0, 0, 0]);
    const stars = find(sky, 'skyStars') as THREE.Points;
    const starColors = (): number[] => [...stars.geometry.getAttribute('color').array];
    sky.update(1);
    const atOne = starColors();
    sky.update(2.7);
    const atLater = starColors();
    sky.update(1);
    expect(starColors()).toEqual(atOne);
    expect(atLater).not.toEqual(atOne);
  });

  it('scrolls the grid from a speed or a function of t', () => {
    const { env } = kit().api;
    const grid = env.neonGrid({ variant: 'teal', scroll: 2, horizon: 50, fog: 0.5 });
    const material = shaderOf(grid, 'neonGridFloor');
    grid.update(3);
    expect(uniform(material, 'scroll')).toBe(6);
    expect(uniform(material, 'fadeStart')).toBe(25);
    expect(`#${(uniform(material, 'lineColor') as THREE.Color).getHexString()}`).toBe(
      CRISP_PALETTE['brightTeal'],
    );
    const custom = env.neonGrid({ scroll: (t: number) => t * t });
    const customMaterial = shaderOf(custom, 'neonGridFloor');
    custom.update(3);
    expect(uniform(customMaterial, 'scroll')).toBe(9);
    const broken = env.neonGrid({ scroll: () => Number.NaN });
    expect(() => {
      broken.update(1);
    }).toThrow(KitError);
    expect(grid.anchor('top').toArray()).toEqual([0, 0, 0]);
  });
});

describe('kit.env furniture, room and city', () => {
  it('puts props on the desk top, the bench top and the room floor', () => {
    const { api } = kit();
    const crate = (): ReturnType<typeof api.voxel.mesh> =>
      api.voxel.mesh(api.voxel.box([4, 4, 4], 'hero'));
    const desk = api.env.desk({ height: 1 });
    expect(desk.anchor('top').y).toBeCloseTo(1);
    expect(crate().on(desk).position.y).toBeCloseTo(1);
    expect(desk.anchor('spotRight').x).toBeCloseTo(1);
    const bench = api.env.bench();
    expect(bench.anchor('top').y).toBeCloseTo(1.125);
    const room = api.env.room();
    expect(room.anchor('top').toArray()).toEqual([0, 0.25, 0]);
    expect(crate().on(room).position.y).toBeCloseTo(0.25);
    expect(room.bounds().max.y).toBeGreaterThan(4);
    expect(room.anchor('window').z).toBeCloseTo(-2.75);
  });

  it('builds the same city from the same seed and another from a different seed', () => {
    const first = geometryPositions(kit(CRISP_PALETTE, 1).api.env.blockCity({ seed: 4 }));
    const again = geometryPositions(kit(CRISP_PALETTE, 1).api.env.blockCity({ seed: 4 }));
    const other = geometryPositions(kit(CRISP_PALETTE, 1).api.env.blockCity({ seed: 5 }));
    expect(first.length).toBeGreaterThan(1000);
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
    const sparse = kit().api.env.blockCity({ density: 0 });
    expect(sparse.bounds().max.y).toBeLessThan(1.5);
  });
});

describe('kit.env floating cubes, void and lights', () => {
  it('poses floating debris absolutely from t (seek order does not matter)', () => {
    const cubes = kit().api.env.floatingCubes({ count: 12, seed: 3 });
    cubes.update(2);
    const atTwo = instanceMatrices(cubes);
    cubes.update(5);
    cubes.update(0.5);
    cubes.update(2);
    expect(instanceMatrices(cubes)).toEqual(atTwo);
    const twin = kit().api.env.floatingCubes({ count: 12, seed: 3 });
    twin.update(2);
    expect(instanceMatrices(twin)).toEqual(atTwo);
    const voidStage = kit().api.env.void({ seed: 1 });
    voidStage.update(3);
    const voidAtThree = instanceMatrices(voidStage);
    voidStage.update(0);
    expect(instanceMatrices(voidStage)).not.toEqual(voidAtThree);
    voidStage.update(3);
    expect(instanceMatrices(voidStage)).toEqual(voidAtThree);
  });

  it('keeps debris out of the clear radius', () => {
    const cubes = kit().api.env.floatingCubes({ count: 60, area: [10, 4, 10], clear: 3 });
    cubes.update(4);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    cubes.traverse((child) => {
      if (!(child instanceof THREE.InstancedMesh)) return;
      for (let index = 0; index < child.count; index += 1) {
        child.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        expect(Math.hypot(position.x, position.z)).toBeGreaterThan(2.9);
      }
    });
  });

  it('builds lighting rigs from palette tokens', () => {
    const { env } = kit().api;
    const lightsOf = (object: THREE.Object3D): THREE.Light[] =>
      object.children.filter((child): child is THREE.Light => child instanceof THREE.Light);
    const rig = env.lights();
    expect(lightsOf(rig).map((light) => [light.type, light.intensity])).toEqual([
      ['HemisphereLight', 2.2],
      ['DirectionalLight', 2.6],
    ]);
    const key = directionalOf(rig, 'keyLight');
    expect(`#${key.color.getHexString()}`).toBe(CRISP_PALETTE['keyLight']);
    expect(key.target.parent).toBe(rig);
    const dramatic = env.lights({ preset: 'dramatic', intensity: 0.5 });
    expect(lightsOf(dramatic).map((light) => light.intensity)).toEqual([0.45, 1.6, 0.7]);
    const turned = env.lights({ azimuth: -90 });
    expect(directionalOf(turned, 'keyLight').position.x).toBeLessThan(-6);
  });
});

describe('env helpers', () => {
  it('picks the first colour the palette has and hashes cells deterministically', () => {
    expect(pickColor(CRISP_PALETTE, ['brown', 'lightOrange', 'keyLight'])).toBe('lightOrange');
    expect(pickColor(TOKENS_ONLY_PALETTE, ['brown', 'lightOrange', 'keyLight'])).toBe('keyLight');
    expect(() => pickColor(TOKENS_ONLY_PALETTE, ['brown'])).toThrow(KitError);
    expect(hashCell(1, 2, 3, 9)).toBe(hashCell(1, 2, 3, 9));
    expect(hashCell(1, 2, 3, 9)).not.toBe(hashCell(1, 2, 4, 9));
    expect(hashCell(7, 7, 7, 7)).toBeGreaterThanOrEqual(0);
    expect(hashCell(7, 7, 7, 7)).toBeLessThan(1);
  });
});
