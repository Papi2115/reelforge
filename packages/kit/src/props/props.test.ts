import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { voxelLook } from '../looks/index.js';
import { createKit, kitCatalog } from '../kit.js';
import { isKitObject, type KitObject } from '../object.js';
import { fakeAsset } from '../testing/asset.js';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import type { KitPalette } from '../types.js';
import type { VoxelObject } from '../voxel/mesh.js';
import { voxelAt, type VoxelModel } from '../voxel/model.js';
import { PROP_DEFINITIONS } from './index.js';

const PROP_NAMES = [
  'calculator',
  'bench',
  'paper',
  'laptop',
  'monitor',
  'server',
  'phone',
  'folder',
  'documentStack',
  'cash',
  'suitcase',
  'lock',
  'key',
  'clock',
  'globe',
  'mapTable',
  'usbStick',
  'character',
  'crowd',
  'car',
  'van',
  'truck',
  'container',
  'warehouse',
  'building',
  'tower',
  'house',
  'drone',
  'photoFrame',
  'polaroid',
  'billboard',
  'assetScreen',
];

/** Asset props (PLAN.md#12.11) need a picture: tests pass a stand-in handle. */
const NEEDS_ASSET: ReadonlySet<string> = new Set([
  'photoFrame',
  'polaroid',
  'billboard',
  'assetScreen',
]);

function kit(palette: KitPalette = CRISP_PALETTE) {
  return createKit({ three: THREE, palette, rng: testRng(9) }).api;
}

function voxelKit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(9), looks: [voxelLook] })
    .api;
}

type Factory = (params?: Record<string, unknown>) => KitObject & { update(t: number): void };

function factory(name: string, palette?: KitPalette): Factory {
  const props = kit(palette).props as unknown as Record<string, Factory>;
  const make = props[name];
  if (!make) throw new Error(`no prop ${name}`);
  if (!NEEDS_ASSET.has(name)) return make;
  return (params = {}) => make({ asset: fakeAsset(), ...params });
}

function voxelMeshes(root: THREE.Object3D): VoxelObject[] {
  const meshes: VoxelObject[] = [];
  root.traverse((child) => {
    if (isKitObject(child) && 'model' in child) meshes.push(child as VoxelObject);
  });
  return meshes;
}

/** 6-connected components of a model; each as the lowest y it reaches. */
function componentFloors(model: VoxelModel): number[] {
  const [sx, sy, sz] = model.size;
  const seen = new Uint8Array(sx * sy * sz);
  const floors: number[] = [];
  const steps = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] === 1 || model.data[start] === 0) continue;
    let floor = Infinity;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      const x = index % sx;
      const y = Math.floor(index / sx) % sy;
      const z = Math.floor(index / (sx * sy));
      floor = Math.min(floor, y);
      for (const [dx, dy, dz] of steps) {
        const [nx, ny, nz] = [x + dx, y + dy, z + dz];
        if (voxelAt(model, nx, ny, nz) === 0) continue;
        const next = nx + sx * (ny + sy * nz);
        if (seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    floors.push(floor);
  }
  return floors;
}

function lowestFilledY(model: VoxelModel): number {
  for (let y = 0; y < model.size[1]; y += 1) {
    for (let z = 0; z < model.size[2]; z += 1) {
      for (let x = 0; x < model.size[0]; x += 1) if (voxelAt(model, x, y, z) !== 0) return y;
    }
  }
  return 0;
}

/** Every enum value of every param, one variant per value (plus the defaults). */
function variants(name: string): Record<string, unknown>[] {
  const entry = kitCatalog().props.find((candidate) => candidate.name === name);
  const properties = (entry?.params['properties'] ?? {}) as Record<string, { enum?: unknown[] }>;
  const list: Record<string, unknown>[] = [{}];
  for (const [key, schema] of Object.entries(properties)) {
    for (const value of schema.enum ?? []) list.push({ [key]: value });
  }
  return list;
}

describe('kit.props registry', () => {
  it('registers batches A and B with complete catalog metadata', () => {
    expect(Object.keys(voxelKit().props)).toEqual(PROP_NAMES);
    const entries = kitCatalog([], [voxelLook]).props;
    expect(entries.map((entry) => entry.name)).toEqual(PROP_NAMES);
    // With every available look, the voxel kit comes first and the rest belong to other looks.
    const all = kitCatalog().props;
    expect(Object.keys(kit().props)).toEqual(all.map((entry) => entry.name));
    expect(all.slice(0, PROP_NAMES.length)).toEqual(entries);
    for (const entry of all.slice(PROP_NAMES.length))
      expect(entry.look, entry.name).not.toBe('voxel');
    for (const entry of entries) {
      expect(entry.kind).toBe('prop');
      expect(entry.description.length, entry.name).toBeGreaterThan(60);
      const properties = (entry.params['properties'] ?? {}) as Record<
        string,
        { description?: string }
      >;
      expect(properties['scale'], entry.name).toBeDefined();
      for (const [key, schema] of Object.entries(properties)) {
        expect(schema.description, `${entry.name}.${key}`).toBeTruthy();
      }
    }
  });

  it('builds every variant of every prop in Crisp 640 and with only the semantic tokens', () => {
    for (const name of PROP_NAMES) {
      for (const palette of [CRISP_PALETTE, TOKENS_ONLY_PALETTE]) {
        for (const params of variants(name)) {
          const prop = factory(name, palette)(params);
          expect(prop.kitType, name).toBe(name);
          expect(prop.bounds().isEmpty(), name).toBe(false);
          prop.update(1.5);
        }
      }
    }
  });

  it('offers every documented anchor and method', () => {
    for (const definition of PROP_DEFINITIONS) {
      const prop = factory(definition.name)();
      for (const anchor of Object.keys(definition.anchors ?? {})) {
        if (anchor.includes('..')) continue;
        expect(() => prop.anchor(anchor), `${definition.name}.${anchor}`).not.toThrow();
      }
      for (const signature of Object.keys(definition.methods ?? {})) {
        const path = (signature.split('(')[0] ?? '').split('.');
        let target: unknown = prop;
        for (const part of path) target = (target as Record<string, unknown>)[part];
        expect(typeof target, `${definition.name}.${signature}`).toBe('function');
      }
    }
  });

  it('has no floating voxels: every part is connected or rests on its model floor', () => {
    for (const name of PROP_NAMES) {
      for (const params of variants(name)) {
        for (const mesh of voxelMeshes(factory(name)(params))) {
          const floors = componentFloors(mesh.model);
          if (floors.length === 1) continue;
          const bottom = lowestFilledY(mesh.model);
          expect(
            floors.every((floor) => floor === bottom),
            `${name} ${JSON.stringify(params)}`,
          ).toBe(true);
        }
      }
    }
  });

  it('builds identical models for identical params and varies seeded layouts by seed', () => {
    const data = (name: string, params: Record<string, unknown>) =>
      voxelMeshes(factory(name)(params)).map((mesh) => Array.from(mesh.model.data).join(''));
    for (const name of PROP_NAMES) expect(data(name, {}), name).toEqual(data(name, {}));
    for (const name of ['documentStack', 'cash', 'mapTable']) {
      expect(data(name, { seed: 1 }), name).not.toEqual(data(name, { seed: 2 }));
    }
  });

  it('validates params with LLM-readable errors', () => {
    expect(() => factory('calculator')({ screen: 'code' })).toThrow(
      /kit\.props\.calculator\(\): invalid params \(screen:/,
    );
    expect(() => factory('clock')({ time: '25 past' })).toThrow(/time: use "HH:MM"/);
    expect(() => factory('server')({ units: 40 })).toThrow(KitError);
  });
});

describe('props placement', () => {
  it('stands props on the school desk top, not on the chair back', () => {
    const api = kit();
    const desk = api.props.bench();
    const calc = api.props.calculator().on(desk);
    expect(calc.parent).toBe(desk);
    expect(calc.position.y).toBeCloseTo(14 / 16);
    expect(desk.bounds().max.y).toBeGreaterThan(14 / 16);
    const paper = api.props.paper();
    desk.mount(paper, 'spotLeft');
    expect(paper.position.x).toBeLessThan(0);
  });

  it('scales a prop uniformly and keeps on() exact', () => {
    const api = kit();
    const table = api.props.mapTable();
    const big = api.props.globe({ scale: 2 }).on(table, { at: 'map' });
    expect(big.scale.x).toBe(2);
    expect(big.position.y).toBeCloseTo(table.anchor('map').y - big.anchor('bottom').y * 2);
  });
});
