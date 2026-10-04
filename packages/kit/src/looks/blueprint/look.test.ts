import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../kit.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { extraLookDefinitions, lookDefinitions, lookMetaSchema, voxelLook } from '../index.js';
import { blueprintLook } from './index.js';
import { hexPixel } from './raster.js';

type Board = THREE.Group & { update(t: number): void };
type Factory = (params?: unknown) => Board;

const SIZE = [640, 360] as const;
const CSV = 'year,units,say\n1998,12,ninety eight\n2000,40,two thousand\n2005,95,peak year';
const SPOKEN: Readonly<Record<string, number>> = {
  'ninety eight': 1,
  'two thousand': 2,
  'peak year': 3,
};

function kit() {
  const { api } = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(5),
    looks: [voxelLook, blueprintLook],
  });
  return {
    fx: api.fx as unknown as Readonly<Record<string, Factory>>,
    env: api.env as unknown as Readonly<Record<string, Factory>>,
  };
}

/** The raster a board shows (its DataTexture), copied at time t. */
function pixelsAt(board: Board, t: number): Uint8Array {
  board.update(t);
  const mesh = board.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const texture = mesh.material.uniforms['map']?.value as THREE.DataTexture;
  return Uint8Array.from(texture.image.data as Uint8Array);
}

function countColor(pixels: Uint8Array, hex: string): number {
  const target = hexPixel(hex);
  const view = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.length / 4);
  return view.reduce((sum, pixel) => sum + (pixel === target ? 1 : 0), 0);
}

const MINIMAL: Readonly<Record<string, readonly ['fx' | 'env', unknown]>> = {
  blueprintSheet: ['env', { size: SIZE, headline: 'TITLE' }],
  blueprintChart: ['fx', { size: SIZE, values: [1, 2, 3] }],
  blueprintCounter: ['fx', { size: SIZE, to: 42 }],
  blueprintGraph: ['fx', { size: SIZE, nodes: [{ id: 'a', label: 'A' }] }],
  blueprintTimeline: ['fx', { size: SIZE, events: [{ value: 1993, label: 'DOOM' }] }],
  blueprintMap: ['fx', { size: SIZE }],
  blueprintSchematic: [
    'fx',
    { size: SIZE, parts: [{ kind: 'circle', center: [320, 180], r: 40 }] },
  ],
  maskedRegion: ['fx', { size: SIZE, text: '1672' }],
};

describe('look blueprint', () => {
  it('is an available B/C look with taxonomy treatments and its own kit names', () => {
    expect(lookMetaSchema.safeParse(blueprintLook).success).toBe(true);
    expect(blueprintLook.available).toBe(true);
    expect(blueprintLook.rolls).toEqual(['B', 'C']);
    expect(blueprintLook.soundPalette).toBe('blueprint');
    expect(blueprintLook.variationBudget).toBe('blueprint');
    // The voxel look lists the whole PLAN.md §4.3 taxonomy.
    for (const treatment of blueprintLook.treatments) {
      expect(voxelLook.treatments, treatment).toContain(treatment);
    }
    const names = lookDefinitions(blueprintLook).map((definition) => definition.name);
    expect(names.sort()).toEqual(Object.keys(MINIMAL).sort());
    for (const name of names) expect(blueprintLook.docs).toContain(name);
    const extra = extraLookDefinitions([voxelLook, blueprintLook]);
    expect(extra.fx).toHaveLength(7);
    expect(extra.env.map((entry) => entry.definition.name)).toEqual(['blueprintSheet']);
  });

  it('builds every template with minimal params and paints a full-frame raster', () => {
    const api = kit();
    for (const [name, [kind, params]] of Object.entries(MINIMAL)) {
      const board = api[kind][name]?.(params);
      if (!board) throw new Error(`${name} is not bound`);
      const pixels = pixelsAt(board, 2);
      expect(pixels.length, name).toBe(640 * 360 * 4);
      expect(countColor(pixels, CRISP_PALETTE['slateBlue'] ?? ''), name).toBeGreaterThan(20_000);
      expect(countColor(pixels, CRISP_PALETTE['cream'] ?? ''), name).toBeGreaterThan(100);
    }
  });

  it('is a pure function of t (seek order does not matter)', () => {
    const api = kit();
    const params = {
      size: SIZE,
      csv: CSV,
      anchor: (phrase: string) => ({ t: SPOKEN[phrase] ?? 0 }),
    };
    const a = api.fx['blueprintChart']?.(params);
    const b = api.fx['blueprintChart']?.(params);
    if (!a || !b) throw new Error('blueprintChart is not bound');
    const forward = [0.5, 2.2, 4].map((t) => pixelsAt(a, t));
    const backward = [4, 2.2, 0.5].map((t) => pixelsAt(b, t)).reverse();
    expect(backward).toEqual(forward);
  });

  it('reveals CSV rows on their spoken phrases', () => {
    const api = kit();
    const chart = api.fx['blueprintChart']?.({
      size: SIZE,
      csv: CSV,
      anchor: (phrase: string) => ({ t: SPOKEN[phrase] ?? 0, tEnd: 0 }),
    });
    if (!chart) throw new Error('blueprintChart is not bound');
    const teal = CRISP_PALETTE['brightTeal'] ?? '';
    const shown = [0.9, 1.6, 2.6, 3.6].map((t) => countColor(pixelsAt(chart, t), teal));
    expect(shown[0]).toBe(0);
    expect(shown[1]).toBeGreaterThan(0);
    expect(shown[2]).toBeGreaterThan(shown[1] ?? 0);
    expect(shown[3]).toBeGreaterThan(shown[2] ?? 0);
  });

  it("explains bad input in the scene author's terms", () => {
    const api = kit();
    expect(() => api.fx['blueprintChart']?.({ size: SIZE, csv: CSV })).toThrow(
      /"ninety eight" is a spoken phrase; pass anchor: ctx\.anchor/,
    );
    expect(() =>
      api.fx['blueprintGraph']?.({
        size: SIZE,
        nodes: [{ id: 'a' }],
        edges: [{ from: 'a', to: 'b' }],
      }),
    ).toThrow(/edge a>b refers to unknown node "b"/);
    expect(() =>
      api.fx['blueprintMap']?.({ size: SIZE, highlights: [{ region: 'Mordor', at: 1 }] }),
    ).toThrow(/unknown region "Mordor"/);
    expect(() =>
      api.fx['blueprintChart']?.({ size: SIZE, values: [1], highlight: { item: 'X', at: 1 } }),
    ).toThrow(/highlight item "X" is not a datum/);
  });

  it('scales to other frame sizes and covers only its region', () => {
    const api = kit();
    const small = api.fx['blueprintCounter']?.({ size: [480, 270], to: 7 });
    if (!small) throw new Error('blueprintCounter is not bound');
    expect(pixelsAt(small, 3).length).toBe(480 * 270 * 4);
    const overlay = api.fx['blueprintChart']?.({
      size: SIZE,
      region: [0.5, 0, 0.5, 1],
      paper: false,
      values: [1, 2],
    });
    if (!overlay) throw new Error('blueprintChart is not bound');
    const pixels = pixelsAt(overlay, 3);
    expect(pixels.length).toBe(320 * 360 * 4);
    // Transparent where nothing is drawn (the quad discards those texels).
    expect(pixels[3]).toBe(0);
  });
});
