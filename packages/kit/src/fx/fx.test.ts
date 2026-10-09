import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { voxelLook } from '../looks/index.js';
import { createKit, kitCatalog, type KitApi } from '../kit.js';
import { isKitObject, type KitObject } from '../object.js';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import type { KitPalette } from '../types.js';
import { GLYPH_ROWS, glyphOf, hasGlyph, measureLine, normalizeText, wrapText } from './font.js';

const FX_NAMES = [
  'shardExplosion',
  'dissolve',
  'glitch',
  'flicker',
  'counter',
  'bars3d',
  'nodeGraph',
  'timeline3d',
  'mapAnimated',
  'typewriterBlock',
  'ticker',
  'screenGlitch',
  'label3d',
];

type Updatable = KitObject & { update(t: number, level?: number): void };

function kit(palette: KitPalette = CRISP_PALETTE, seed = 7) {
  return createKit({ three: THREE, palette, rng: testRng(seed) });
}

function voxelKit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(7), looks: [voxelLook] });
}

function crate(api: KitApi): KitObject {
  const parent = api.voxel.group();
  const object = api.voxel.mesh(api.voxel.box([4, 6, 4], 'hero'));
  object.position.set(1, 0, 0);
  parent.add(object);
  return object;
}

/** One representative call per effect (mirrors the example scenes). */
const BUILDERS: Readonly<Record<string, (api: KitApi) => Updatable>> = {
  shardExplosion: (api) => api.fx.shardExplosion({ at: 1, count: 40 }),
  dissolve: (api) => api.fx.dissolve({ object: crate(api), start: 0.5, end: 2 }),
  glitch: (api) => api.fx.glitch({ model: api.voxel.box([4, 6, 4], 'hero'), density: 1 }),
  flicker: (api) =>
    api.fx.flicker({ pattern: 'neon', light: { color: 'keyLight', intensity: 5, distance: 4 } }),
  counter: (api) => api.fx.counter({ from: 0, to: 12500.5, format: { decimals: 1, suffix: 'KB' } }),
  bars3d: (api) =>
    api.fx.bars3d({
      data: [
        { label: 'Doom', value: 3 },
        { label: 'Pregnancy test', value: 20 },
      ],
    }),
  nodeGraph: (api) =>
    api.fx.nodeGraph({
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'Bee' }, { id: 'c' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      highlights: [{ id: 'a>b', at: 1.5 }],
    }),
  timeline3d: (api) =>
    api.fx.timeline3d({ items: [{ label: 'One', caption: '1993' }, { label: 'Two' }] }),
  mapAnimated: (api) =>
    api.fx.mapAnimated({
      region: 'europe',
      coords: 'lonlat',
      columns: 40,
      route: [
        [2.35, 48.86],
        [13.4, 52.5],
      ],
      pins: [{ at: [13.4, 52.5], label: 'Berlin' }],
    }),
  typewriterBlock: (api) => api.fx.typewriterBlock({ lines: ['HELLO', 'WORLD'], prompt: '> ' }),
  ticker: (api) => api.fx.ticker({ text: 'BREAKING NEWS', width: 3 }),
  screenGlitch: (api) => api.fx.screenGlitch({ columns: 16, rows: 10, density: 1 }),
  label3d: (api) => api.fx.label3d({ text: 'OPEN\n24/7', plate: true, at: 0.5 }),
};

/** Everything that decides the picture: transforms, visibility, instances, colours, lights. */
function snapshot(root: THREE.Object3D): string {
  const scene = root.parent ?? root;
  scene.updateMatrixWorld(true);
  const values: string[] = [];
  const numbers = (array: ArrayLike<number>): string =>
    Array.from(array, (value) => value.toFixed(5)).join(',');
  scene.traverse((child) => {
    values.push(`${child.name}:${String(child.visible)}:${numbers(child.matrixWorld.elements)}`);
    if (child instanceof THREE.InstancedMesh) {
      values.push(`${String(child.count)}:${numbers(child.instanceMatrix.array)}`);
      if (child.instanceColor) values.push(numbers(child.instanceColor.array));
    }
    if (child instanceof THREE.Light) values.push(child.intensity.toFixed(5));
  });
  return values.join('|');
}

describe('kit.fx registry', () => {
  it('registers every effect with catalog metadata and described params', () => {
    // The app's own end card (PLAN.md#13.18) is bound last and never catalogued.
    expect(Object.keys(voxelKit().api.fx)).toEqual([...FX_NAMES, 'endCard']);
    const entries = kitCatalog([], [voxelLook]).fx;
    expect(entries.map((entry) => entry.name)).toEqual(FX_NAMES);
    // With every available look, the voxel kit comes first and the rest belong to other looks.
    const all = kitCatalog().fx;
    expect(Object.keys(kit().api.fx)).toEqual([...all.map((entry) => entry.name), 'endCard']);
    expect(all.slice(0, FX_NAMES.length)).toEqual(entries);
    for (const entry of all.slice(FX_NAMES.length))
      expect(entry.look, entry.name).not.toBe('voxel');
    for (const entry of entries) {
      expect(entry.kind).toBe('fx');
      expect(entry.description.length, entry.name).toBeGreaterThan(60);
      expect(entry.description, entry.name).toMatch(/update\(t/);
      expect(entry.params['type'], entry.name).toBe('object');
    }
    expect(Object.keys(BUILDERS)).toEqual(FX_NAMES);
  });

  it.each([
    ['Crisp 640', CRISP_PALETTE],
    ['tokens only', TOKENS_ONLY_PALETTE],
  ])('builds every effect in the %s palette', (_, palette) => {
    const { api } = kit(palette);
    for (const name of FX_NAMES) {
      const fx = BUILDERS[name]?.(api);
      expect(isKitObject(fx), name).toBe(true);
      expect(fx?.kitType, name).toBe(name);
    }
  });

  it('refuses to build effects in update() and validates params and t', () => {
    const handle = kit();
    const counter = handle.api.fx.counter();
    expect(() => handle.api.fx.counter({ from: 'zero' as unknown as number })).toThrow(
      /kit\.fx\.counter\(\): invalid params \(from:/,
    );
    expect(() => {
      counter.update(Number.NaN);
    }).toThrow(KitError);
    const glitch = handle.api.fx.glitch({ model: handle.api.voxel.box([2, 2, 2], 'hero') });
    expect(() => {
      glitch.update(1, 2);
    }).toThrow(/level must be 0\.\.1/);
    expect(() => handle.api.fx.dissolve({})).toThrow(/exactly one of object or model/);
    expect(() =>
      handle.api.fx.nodeGraph({ nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'z' }] }),
    ).toThrow(/unknown node "z"/);
    expect(() =>
      handle.api.fx.mapAnimated({ coords: 'lonlat', route: [[0, 0]], columns: 24 }),
    ).toThrow(/needs region 'europe'/);
    handle.seal();
    expect(() => handle.api.fx.counter()).toThrow(/kit\.fx\.counter\(\) was called in update\(\)/);
  });
});

describe('kit.fx determinism', () => {
  const TIMES = [0, 0.4, 1.3, 2.7, 5];

  it.each(FX_NAMES)('%s: same t -> same pose, in any scrub order', (name) => {
    const build = BUILDERS[name];
    if (!build) throw new Error(`no builder for ${name}`);
    const first = build(kit().api);
    const second = build(kit().api);
    const forward = TIMES.map((t) => {
      first.update(t);
      return snapshot(first);
    });
    const backward = [...TIMES].reverse().map((t) => {
      second.update(t);
      return snapshot(second);
    });
    expect(backward.reverse()).toEqual(forward);
    // Every builder animates (label3d pops in at 0.5): not every time looks the same.
    expect(new Set(forward).size, name).toBeGreaterThan(1);
  });

  it('level overrides drive the object effects', () => {
    const { api } = kit();
    const fx = api.fx.dissolve({ model: api.voxel.box([3, 3, 3], 'hero') });
    fx.update(0, 1);
    const gone = snapshot(fx);
    fx.update(10);
    expect(snapshot(fx)).toBe(gone);
    fx.update(10, 0);
    expect(snapshot(fx)).not.toBe(gone);
  });

  it('object effects take the place of their object', () => {
    const { api } = kit();
    const object = crate(api);
    const parent = object.parent;
    const fx = api.fx.glitch({ object });
    expect(object.visible).toBe(false);
    expect(fx.parent).toBe(parent);
    expect(fx.position.toArray()).toEqual([1, 0, 0]);
  });

  it('counter reports the shown value and text', () => {
    const { api } = kit();
    const counter = api.fx.counter({
      from: 0,
      to: 1024,
      start: 0,
      end: 2,
      format: { suffix: 'KB' },
    });
    expect(counter.textAt(5)).toBe('1,024 KB');
    expect(counter.valueAt(0)).toBe(0);
    const screen = api.fx.screenGlitch({ columns: 8, rows: 8 });
    expect(screen.pixels(1, 0).data).toHaveLength(64);
  });
});

describe('voxel font', () => {
  it('has 7-row glyphs and normalizes text', () => {
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?\'"-+=/()[]%$€£#&*<>_@·•×→←↑↓') {
      expect(hasGlyph(char), char).toBe(true);
      const glyph = glyphOf(char);
      expect(glyph?.bits.length, char).toBe((glyph?.width ?? 0) * GLYPH_ROWS);
    }
    expect(normalizeText('Łódź straße – ok')).toBe('LODZ STRASSE - OK');
    expect(glyphOf(' ')).toBeUndefined();
    expect(glyphOf('A', true)?.width).toBe(6);
    expect(measureLine('AB')).toBe(11);
    expect(wrapText('one two three', 40, 2)).toEqual(['ONE TWO', 'THREE']);
    expect(wrapText('a b c d', 1, 2)).toEqual(['A', 'B C D']);
  });
});
