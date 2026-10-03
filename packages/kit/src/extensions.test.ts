import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from './errors.js';
import {
  checkExtensionNames,
  parsePropMeta,
  propDefinitionFromModule,
  propExtensionCatalogEntry,
} from './extensions.js';
import { createKit, kitCatalog } from './kit.js';
import { isKitObject, type KitObject } from './object.js';
import { CRISP_PALETTE } from './testing/palettes.js';
import { testRng } from './testing/rng.js';

const FRIDGE_FILE = path.resolve(import.meta.dirname, '..', 'examples', 'kit-ext', 'fridge.js');

async function fridgeNamespace(): Promise<unknown> {
  const namespace: unknown = await import(pathToFileURL(FRIDGE_FILE).href);
  return namespace;
}

type Factory = (params?: Record<string, unknown>) => KitObject & Record<string, unknown>;

async function kitWithFridge(seed = 4) {
  const definition = propDefinitionFromModule(await fridgeNamespace(), 'kit-ext/props/fridge.js');
  const kit = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(seed),
    extraProps: [definition],
  });
  const props = kit.api.props as unknown as Record<string, Factory | undefined>;
  const fridge = props['fridge'];
  if (fridge === undefined) throw new Error('fridge not registered');
  return { kit, fridge };
}

function meshBuffers(root: THREE.Object3D): number[][] {
  const buffers: number[][] = [];
  root.traverse((child) => {
    if ((child as Partial<THREE.Mesh>).isMesh === true) {
      const mesh = child as THREE.Mesh;
      buffers.push([...(mesh.geometry.getAttribute('position').array as Float32Array)]);
    }
  });
  return buffers;
}

describe('project-local props (kit-ext)', () => {
  it('registers a prop module as kit.props.<name> next to the kit props', async () => {
    const { kit, fridge } = await kitWithFridge();
    expect(Object.keys(kit.api.props)).toContain('calculator');
    const object = fridge();
    expect(isKitObject(object)).toBe(true);
    expect(object.anchorNames()).toContain('handle');
    expect(typeof object['open']).toBe('function');
    expect(typeof object['update']).toBe('function');
    const size = kit.api.voxel.inspect(object).size;
    expect(size[1]).toBeCloseTo(40 / 22, 3);
  });

  it('validates params strictly, applies scale and builds deterministically', async () => {
    const { kit, fridge } = await kitWithFridge();
    expect(() => fridge({ colour: 'accent1' })).toThrow(/invalid params .*Unrecognized key/);
    expect(() => fridge({ open: 2 })).toThrow(/open: Too big/);
    const big = fridge({ scale: 2 });
    expect(kit.api.voxel.inspect(big).size[1]).toBeCloseTo(80 / 22, 3);
    const again = (await kitWithFridge()).fridge({ scale: 2 });
    expect(meshBuffers(again)).toEqual(meshBuffers(big));
  });

  it('only creates objects in build() like every kit factory', async () => {
    const { kit, fridge } = await kitWithFridge();
    kit.seal();
    expect(() => fridge()).toThrow(KitError);
  });

  it('rejects a prop that shadows a kit prop or a reserved name', () => {
    expect(() => {
      checkExtensionNames(['calculator'], [{ name: 'calculator' }]);
    }).toThrow(/has the name of a kit prop/);
    expect(() => {
      checkExtensionNames([], [{ name: 'fridge' }, { name: 'fridge' }]);
    }).toThrow(/fridge/);
    expect(() =>
      parsePropMeta({ name: 'constructor', description: 'a reserved name' }, 'x.js'),
    ).toThrow(/reserved/);
  });

  it('explains invalid modules for the prop author', () => {
    expect(() => propDefinitionFromModule({}, 'kit-ext/props/a.js')).toThrow(
      /missing `export const prop/,
    );
    expect(() =>
      propDefinitionFromModule({ prop: { name: 'a', description: 'something long' } }, 'p.js'),
    ).toThrow(/prop.build must be a function/);
    const meta = { name: 'lamp', description: 'a desk lamp, bright', params: { scale: {} } };
    expect(() => parsePropMeta(meta, 'kit-ext/props/lamp.js')).toThrow(
      /scale is added to every prop automatically/,
    );
    const notObject = propDefinitionFromModule(
      { prop: { name: 'lamp', description: 'a desk lamp, bright', build: () => 42 } },
      'kit-ext/props/lamp.js',
    );
    const kit = createKit({
      three: THREE,
      palette: CRISP_PALETTE,
      rng: testRng(1),
      extraProps: [notObject],
    });
    const lamp = (kit.api.props as unknown as Record<string, Factory>)['lamp'];
    expect(() => lamp?.()).toThrow(/must return a kit object .*got number/);
  });

  it('lists project props in the catalog, marked project', async () => {
    const definition = propDefinitionFromModule(await fridgeNamespace(), 'kit-ext/props/fridge.js');
    const entry = propExtensionCatalogEntry(
      parsePropMeta(
        {
          name: definition.name,
          description: definition.description,
          anchors: definition.anchors,
          methods: definition.methods,
          params: { open: { type: 'number', default: 0, min: 0, max: 1, description: 'Opening' } },
        },
        'fridge.js',
      ),
    );
    expect(entry.origin).toBe('project');
    const properties = entry.params['properties'] as Record<string, unknown>;
    expect(Object.keys(properties)).toEqual(['open', 'scale']);
    const catalog = kitCatalog([entry]);
    expect(catalog.props.at(-1)?.name).toBe('fridge');
    expect(kitCatalog().props.some((candidate) => candidate.name === 'fridge')).toBe(false);
  });
});

describe('kit.voxel.inspect', () => {
  it('reports the size and finds floating parts and voxel islands', () => {
    const { api } = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(2) });
    const { voxel } = api;
    const group = voxel.group();
    const base = voxel.mesh(voxel.box([8, 2, 8], 'hero'), { voxelSize: 0.125 });
    const floating = voxel.mesh(voxel.box([2, 2, 2], 'accent1'), { voxelSize: 0.125 });
    floating.position.y = 2;
    group.add(base, floating);
    const report = voxel.inspect(group);
    expect(report.size[0]).toBeCloseTo(1, 5);
    expect(report.meshes).toBe(2);
    expect(report.voxels).toBe(8 * 2 * 8 + 8);
    expect(report.floatingParts).toHaveLength(1);
    expect(report.floatingParts[0]).toMatch(/floats at y=2\.00/);
    floating.position.y = 0.25;
    expect(voxel.inspect(group).floatingParts).toEqual([]);
    const island = voxel
      .sketch([4, 6, 4], { a: 'hero' })
      .box('a', [0, 0, 0], [4, 2, 4])
      .box('a', [1, 4, 1], [2, 5, 2])
      .model();
    const lonely = voxel.inspect(voxel.mesh(island));
    expect(lonely.floatingParts[0]).toMatch(/1 voxel island/);
  });

  it('validates sketch input', () => {
    const { api } = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(2) });
    expect(() => api.voxel.sketch([0, 1, 1], { a: 'hero' })).toThrow(/size.x must be an integer/);
    expect(() => api.voxel.sketch([1, 1, 1], {})).toThrow(/colors must map/);
  });
});
