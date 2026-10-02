import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { KitError } from './errors.js';
import { createKitContext } from './context.js';
import { createKit, kitCatalog } from './kit.js';
import { isKitObject } from './object.js';
import { bindRegistry, catalogEntries, defineProp, kitOriginOf } from './registry.js';
import { CRISP_PALETTE } from './testing/palettes.js';
import { testRng } from './testing/rng.js';
import { KIT_VERSION } from './version.js';
import { createVoxelApi } from './voxel/api.js';

const PALETTE = {
  hero: '#ff8c42',
  heroTrim: '#f4e9d8',
  ground: '#2d1b69',
  groundAlt: '#1a1446',
  accent1: '#2ec4b6',
};

function kit() {
  return createKit({ three: THREE, palette: PALETTE, rng: testRng(11) });
}

function firstMesh(object: THREE.Object3D): THREE.Mesh {
  const mesh = object.children.find(
    (child): child is THREE.Mesh => (child as Partial<THREE.Mesh>).isMesh === true,
  );
  if (!mesh) throw new Error('no mesh child');
  return mesh;
}

describe('createKit', () => {
  it('exposes the voxel toolbox and the registries', () => {
    const { api } = kit();
    expect(api.version).toBe(KIT_VERSION);
    expect(Object.keys(api.env)).toContain('neonGrid');
    expect(Object.keys(api.props)).toContain('calculator');
    expect(Object.keys(api.fx)).toContain('counter');
    expect(Object.isFrozen(api.voxel)).toBe(true);
  });

  it('meshes a model with palette colours resolved from the style', () => {
    const { api } = kit();
    const object = api.voxel.mesh(api.voxel.box([2, 2, 2], 'hero'));
    expect(isKitObject(object)).toBe(true);
    expect(object.mode).toBe('greedy');
    const mesh = firstMesh(object);
    const colors = mesh.geometry.getAttribute('color');
    const hero = new THREE.Color(PALETTE.hero);
    // Corners of an isolated box are open (no AO): exact palette colour.
    expect(colors.getX(0)).toBeCloseTo(hero.r, 6);
    expect(colors.getY(0)).toBeCloseTo(hero.g, 6);
    expect(colors.getZ(0)).toBeCloseTo(hero.b, 6);
    expect(mesh.geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1]);
    expect(() => api.voxel.mesh(api.voxel.box([1, 1, 1], 'chartreuse'))).toThrow(
      /colour "chartreuse" is not in the style palette.*hero/,
    );
  });

  it('derives standard anchors from the filled bounds and converts custom grid anchors', () => {
    const { api } = kit();
    const desk = api.voxel.mesh(api.voxel.box([4, 2, 4], 'ground'), {
      voxelSize: 0.5,
      anchors: { lamp: [1, 2, 1] },
    });
    expect(desk.anchor('top').toArray()).toEqual([0, 1, 0]);
    expect(desk.anchor('bottom').toArray()).toEqual([0, 0, 0]);
    expect(desk.anchor('front').toArray()).toEqual([0, 0.5, 1]);
    expect(desk.anchor('lamp').toArray()).toEqual([-0.5, 1, -0.5]);
    expect(desk.anchorNames()).toContain('lamp');
    expect(() => desk.anchor('handle')).toThrow(/no anchor "handle".*lamp/);
  });

  it('places objects on surfaces and mounts them at anchors', () => {
    const { api } = kit();
    const desk = api.voxel.mesh(api.voxel.box([8, 4, 4], 'ground'), {
      voxelSize: 0.25,
      anchors: { corner: [8, 4, 4] },
    });
    const box = api.voxel.mesh(api.voxel.box([2, 2, 2], 'hero'), { pivot: 'center' });
    box.scale.setScalar(2);
    expect(box.on(desk)).toBe(box);
    expect(box.parent).toBe(desk);
    // Desk top at y = 1; the box's bottom is 0.125 below its centre, scaled x2.
    expect(box.position.toArray()).toEqual([0, 1.25, 0]);
    const lamp = api.voxel.mesh(api.voxel.box([1, 3, 1], 'accent1'));
    desk.mount(lamp, 'corner', { offset: [0, 0.5, 0] });
    expect(lamp.position.toArray()).toEqual([1, 1.5, 0.5]);
    expect(() => box.on(desk.children[0] as never)).toThrow(KitError);
  });

  it('groups compose objects and report bounds that follow their children', () => {
    const { api } = kit();
    const group = api.voxel.group({ anchors: { door: [0, 0, 2] } });
    const left = api.voxel.mesh(api.voxel.box([8, 8, 8], 'ground'));
    const right = api.voxel.mesh(api.voxel.box([8, 16, 8], 'hero'));
    left.position.x = -1;
    right.position.x = 1;
    group.add(left, right);
    expect(group.anchor('top').toArray()).toEqual([0, 2, 0]);
    expect(group.anchor('right').x).toBe(1.5);
    expect(group.anchor('door').toArray()).toEqual([0, 0, 2]);
  });

  it('animates single voxels in instanced mode', () => {
    const { api } = kit();
    const cubes = api.voxel.mesh(api.voxel.box([2, 1, 1], 'accent1'), { mode: 'instanced' });
    expect(cubes.mode).toBe('instanced');
    expect(cubes.instanceCount).toBe(2);
    expect(cubes.instanceCell(1)).toEqual([1, 0, 0]);
    cubes.setVoxelTransform(1, { offset: [0, 1, 0], scale: 2 });
    const instanced = cubes.children[0];
    if (!(instanced instanceof THREE.InstancedMesh)) throw new Error('expected an InstancedMesh');
    const matrix = new THREE.Matrix4();
    instanced.getMatrixAt(1, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.toArray()).toEqual([0.0625, 1.0625, 0]);
    expect(instanced.frustumCulled).toBe(false);
    const solid = api.voxel.mesh(api.voxel.box([1, 1, 1], 'hero'));
    expect(() => {
      solid.setVoxelTransform(0, {});
    }).toThrow(/needs mode 'instanced'/);
  });

  it('refuses to create objects after seal() (update phase), pure helpers still work', () => {
    const handle = kit();
    handle.seal();
    const model = handle.api.voxel.box([1, 1, 1], 'hero');
    expect(handle.api.voxel.count(model)).toBe(1);
    expect(() => handle.api.voxel.mesh(model)).toThrow(
      /kit\.voxel\.mesh\(\) was called in update\(\)/,
    );
    expect(() => handle.api.voxel.group()).toThrow(KitError);
  });

  it('disposes the geometries of an object and detaches it', () => {
    const { api } = kit();
    const parent = api.voxel.group();
    const object = api.voxel.mesh(api.voxel.box([1, 1, 1], 'hero'));
    parent.add(object);
    let disposed = 0;
    firstMesh(object).geometry.addEventListener('dispose', () => {
      disposed += 1;
    });
    parent.dispose();
    expect(disposed).toBe(1);
    expect(object.parent).toBeNull();
  });
});

describe('registry', () => {
  const crate = defineProp({
    name: 'crate',
    description: 'A wooden crate.',
    params: z.object({ size: z.number().int().min(1).default(2).describe('Edge in voxels') }),
    anchors: { lid: 'top of the crate' },
    build: (params, tools) => {
      const object = tools.voxel.mesh(
        tools.voxel.box([params.size, params.size, params.size], 'ground'),
      );
      object.userData['roll'] = tools.rng();
      return object;
    },
  });

  function bound() {
    const context = createKitContext(THREE, PALETTE, testRng(3));
    return { context, props: bindRegistry(context, createVoxelApi(context), [crate] as const) };
  }

  it('validates params, applies defaults and gives every call its own seeded stream', () => {
    const { props } = bound();
    const first = props.crate();
    const second = props.crate({ size: 3 });
    expect(first.kitType).toBe('voxel');
    expect(first.anchor('top').y).toBeCloseTo(0.25);
    expect(second.anchor('top').y).toBeCloseTo(0.375);
    expect(first.userData['roll']).not.toBe(second.userData['roll']);
    expect(bound().props.crate().userData['roll']).toBe(first.userData['roll']);
    expect(() => props.crate({ size: 0 })).toThrow(/kit\.props\.crate\(\): invalid params \(size:/);
  });

  it('stamps every result with its origin (call and per-shot call index)', () => {
    const { props } = bound();
    const first = props.crate();
    const second = props.crate();
    expect(kitOriginOf(first)).toEqual({
      kind: 'prop',
      name: 'crate',
      index: 0,
      call: 'kit.props.crate()',
    });
    expect(kitOriginOf(second)?.index).toBe(1);
    expect(kitOriginOf(new THREE.Group())).toBeUndefined();
    first.userData['reelforgeKitOrigin'] = { kind: 'nope' };
    expect(kitOriginOf(first)).toBeUndefined();
    const crisp = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(1) });
    expect(kitOriginOf(crisp.api.props.calculator())?.call).toBe('kit.props.calculator()');
  });

  it('is sealed together with the kit', () => {
    const { context, props } = bound();
    context.seal();
    expect(() => props.crate()).toThrow(/kit\.props\.crate\(\) was called in update\(\)/);
  });

  it('describes definitions as JSON Schema for kit-docs', () => {
    const [entry] = catalogEntries([crate]);
    expect(entry).toMatchObject({
      kind: 'prop',
      name: 'crate',
      anchors: { lid: 'top of the crate' },
      params: {
        type: 'object',
        properties: { size: { type: 'integer', default: 2, description: 'Edge in voxels' } },
      },
    });
  });
});

describe('kitCatalog', () => {
  it('documents every kit.voxel function', () => {
    expect(Object.keys(kitCatalog().voxel).sort()).toEqual(Object.keys(kit().api.voxel).sort());
  });

  it('carries KIT_VERSION, kept equal to the package version', () => {
    const packageJson: unknown = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    expect(packageJson).toMatchObject({ version: KIT_VERSION });
    expect(kitCatalog().version).toBe(KIT_VERSION);
  });
});
