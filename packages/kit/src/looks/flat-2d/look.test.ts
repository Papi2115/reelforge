import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../kit.js';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { extraLookDefinitions, lookDefinitions, lookMetaSchema, voxelLook } from '../index.js';
import { flat2dLook } from './index.js';
import { hexPixel } from './raster.js';
import { createTheme, TONE_NAMES } from './theme.js';

type Board = THREE.Group & {
  update(t: number): void;
  target(name: string): { screen: readonly [number, number]; size: readonly [number, number] };
  targetNames(): string[];
};
type Factory = (params?: unknown) => Board;

const SIZE = [640, 360] as const;
const SPOKEN: Readonly<Record<string, number>> = { idea: 1, everything: 2, ship: 3 };
const anchor = (phrase: string) => ({ t: SPOKEN[phrase] ?? 0 });

function kit() {
  const { api } = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(5),
    looks: [voxelLook, flat2dLook],
  });
  return {
    fx: api.fx as unknown as Readonly<Record<string, Factory>>,
    env: api.env as unknown as Readonly<Record<string, Factory>>,
  };
}

function build(kind: 'fx' | 'env', name: string, params: Record<string, unknown>): Board {
  const board = kit()[kind][name]?.({ size: SIZE, ...params });
  if (!board) throw new Error(`${name} is not bound`);
  return board;
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

const CREAM = CRISP_PALETTE['cream'] ?? '';
const INDIGO = CRISP_PALETTE['indigo'] ?? '';

const MINIMAL: Readonly<Record<string, readonly ['fx' | 'env', Record<string, unknown>]>> = {
  flatStage: ['env', { decor: 4 }],
  flatShapes: ['fx', { shapes: [{ kind: 'star', label: '1' }] }],
  flatIcons: ['fx', { icons: [{ name: 'rocket', label: 'SHIP' }] }],
  flatInfographic: ['fx', { items: [{ label: 'IDEA', icon: 'lightbulb' }] }],
  flatKinetic: ['fx', { text: 'HELLO *WORLD*' }],
  flatLowerThird: ['fx', { name: 'ADA LOVELACE', caption: 'MATHEMATICIAN', icon: 'person' }],
};

describe('look flat-2d', () => {
  it('is an available B/C look with taxonomy treatments and its own kit names', () => {
    expect(lookMetaSchema.safeParse(flat2dLook).success).toBe(true);
    expect(flat2dLook.available).toBe(true);
    expect(flat2dLook.rolls).toEqual(['B', 'C']);
    expect(flat2dLook.soundPalette).toBe('flat-2d');
    expect(flat2dLook.variationBudget).toBe('flat-2d');
    // The voxel look lists the whole PLAN.md §4.3 taxonomy.
    for (const treatment of flat2dLook.treatments) {
      expect(voxelLook.treatments, treatment).toContain(treatment);
    }
    const names = lookDefinitions(flat2dLook).map((definition) => definition.name);
    expect([...names].sort()).toEqual(Object.keys(MINIMAL).sort());
    for (const name of names) expect(flat2dLook.docs).toContain(name);
    const extra = extraLookDefinitions([voxelLook, flat2dLook]);
    expect(extra.fx).toHaveLength(5);
    expect(extra.env.map((entry) => entry.definition.name)).toEqual(['flatStage']);
  });

  it('resolves every colour role in every tone, also with semantic tokens only', () => {
    for (const palette of [CRISP_PALETTE, TOKENS_ONLY_PALETTE]) {
      for (const tone of TONE_NAMES) {
        const theme = createTheme(palette, tone);
        expect(theme.field, tone).not.toBe(theme.ink);
        expect(theme.series).toHaveLength(5);
      }
    }
    expect(createTheme(CRISP_PALETTE, 'cream').ink).toBe(hexPixel(CRISP_PALETTE['navy'] ?? ''));
  });

  it('builds every template with minimal params and paints a full-frame raster', () => {
    for (const [name, [kind, params]] of Object.entries(MINIMAL)) {
      const pixels = pixelsAt(build(kind, name, params), 3);
      expect(pixels.length, name).toBe(640 * 360 * 4);
      expect(countColor(pixels, CREAM), name).toBeGreaterThan(name === 'flatStage' ? -1 : 100);
    }
    // Full-frame stages by default; the lower third is a transparent overlay.
    const solid = build('env', 'flatStage', { stage: 'solid', decor: 0 });
    expect(countColor(pixelsAt(solid, 1), INDIGO)).toBe(640 * 360);
    const lower = pixelsAt(build('fx', 'flatLowerThird', MINIMAL['flatLowerThird']?.[1] ?? {}), 3);
    expect(lower[3]).toBe(0);
  });

  it('is a pure function of t (seek order does not matter)', () => {
    const params = {
      anchor,
      shapes: [
        { kind: 'circle', at: 'idea', morph: [{ at: 'everything', kind: 'star', color: 'good' }] },
        {
          kind: 'arrow',
          points: [
            [100, 300],
            [500, 300],
          ],
          at: 0.5,
          idle: 'float',
        },
      ],
    };
    const a = build('fx', 'flatShapes', params);
    const b = build('fx', 'flatShapes', params);
    const times = [0.4, 1.2, 2.2, 3.5];
    const forward = times.map((t) => pixelsAt(a, t));
    const backward = [...times]
      .reverse()
      .map((t) => pixelsAt(b, t))
      .reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward.map((pixels) => pixels.join(','))).size).toBe(times.length);
  });

  it('lands words, shapes and items on their spoken phrases', () => {
    const words = build('fx', 'flatKinetic', {
      anchor,
      words: [
        { text: 'BIG', at: 'idea' },
        { text: 'IDEA', at: 'everything', effect: 'none' },
      ],
    });
    const cream = [0.9, 1.6, 2.1].map((t) => countColor(pixelsAt(words, t), CREAM));
    expect(cream[0]).toBe(0);
    expect(cream[1]).toBeGreaterThan(0);
    expect(cream[2]).toBeGreaterThan(cream[1] ?? 0);
    const steps = build('fx', 'flatInfographic', {
      anchor,
      items: [
        { label: 'A', icon: 'gear', at: 'idea' },
        { label: 'B', icon: 'rocket', at: 'ship' },
      ],
    });
    const teal = CRISP_PALETTE['brightTeal'] ?? '';
    expect(countColor(pixelsAt(steps, 2.9), teal)).toBe(0);
    expect(countColor(pixelsAt(steps, 3.5), teal)).toBeGreaterThan(500);
  });

  it('names annotate targets in frame shares and rejects unknown ones', () => {
    const icons = build('fx', 'flatIcons', {
      region: [0.5, 0, 0.5, 1],
      icons: [{ name: 'heart', x: 160, y: 180, scale: 4, badge: 'none' }],
    });
    const target = icons.target('icon:0');
    expect(target.screen[0]).toBeCloseTo(0.75, 2);
    expect(target.screen[1]).toBeCloseTo(0.5, 2);
    expect(target.size[1]).toBeCloseTo(64 / 360, 2);
    expect(icons.target('icon:heart')).toEqual(target);
    expect(() => icons.target('icon:9')).toThrow(/no such anchor \(anchors: icon:0, icon:heart\)/);
    const words = build('fx', 'flatKinetic', { text: 'ONE / TWO THREE' });
    expect(words.targetNames()).toEqual(['word:0', 'line:0', 'word:1', 'line:1', 'word:2']);
    const two = words.target('line:1');
    expect(two.size[0]).toBeGreaterThan(words.target('word:1').size[0]);
  });

  it("explains bad input in the scene author's terms", () => {
    expect(() => build('fx', 'flatKinetic', { words: [{ text: 'HI', at: 'idea' }] })).toThrow(
      /"idea" is a spoken phrase; pass anchor: ctx\.anchor/,
    );
    expect(() => build('fx', 'flatIcons', { icons: [{ name: 'unicorn' }] })).toThrow(/name/);
    expect(() => build('fx', 'flatInfographic', { kind: 'versus', items: [{ value: 1 }] })).toThrow(
      /kind "versus" takes 2 items, got 1/,
    );
    expect(() => build('fx', 'flatIcons', {})).toThrow(/give icons \[\.\.\.\] or sheet: true/);
  });

  it('scales to other frame sizes', () => {
    const small = build('fx', 'flatInfographic', {
      size: [480, 270],
      kind: 'stat',
      items: [{ label: 'SOLD', value: 126 }],
    });
    expect(pixelsAt(small, 3).length).toBe(480 * 270 * 4);
  });
});
