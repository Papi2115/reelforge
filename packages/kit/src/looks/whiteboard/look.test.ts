import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../kit.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { extraLookDefinitions, lookDefinitions, lookMetaSchema, voxelLook } from '../index.js';
import { hexPixel } from '../blueprint/raster.js';
import { groupDigits } from './counter.js';
import { whiteboardLook } from './index.js';

interface Target {
  readonly screen: readonly [number, number];
  readonly size?: readonly [number, number];
}
type Board = THREE.Group & {
  update(t: number): void;
  stroke(i: number): Target;
  point(name: string): Target;
  strokeTime(i: number): { t: number; tEnd: number };
  doneAt(): number;
};
type Factory = (params?: unknown) => Board;

const SIZE = [640, 360] as const;
const SPOKEN: Readonly<Record<string, number>> = { idea: 2, money: 4 };
const anchor = (phrase: string) => ({ t: SPOKEN[phrase] ?? 0 });

function kit(seed = 5) {
  const { api } = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(seed),
    looks: [voxelLook, whiteboardLook],
  });
  return {
    fx: api.fx as unknown as Readonly<Record<string, Factory>>,
    env: api.env as unknown as Readonly<Record<string, Factory>>,
  };
}

function build(kind: 'fx' | 'env', name: string, params: unknown, seed?: number): Board {
  const board = kit(seed)[kind][name]?.(params);
  if (!board) throw new Error(`${name} is not bound`);
  return board;
}

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

const BLACK = CRISP_PALETTE['black'] ?? '';
const CREAM = CRISP_PALETTE['cream'] ?? '';

const MINIMAL: Readonly<Record<string, readonly ['fx' | 'env', unknown]>> = {
  whiteboardBoard: ['env', { size: SIZE, headline: 'TITLE' }],
  whiteboardSketch: ['fx', { size: SIZE, strokes: ['bulb 320 180 120'] }],
  whiteboardText: ['fx', { size: SIZE, lines: ['HELLO'] }],
  whiteboardDiagram: [
    'fx',
    {
      size: SIZE,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    },
  ],
  whiteboardCounter: ['fx', { size: SIZE, values: [10, 20] }],
};

describe('look whiteboard', () => {
  it('is an available B/C look with taxonomy treatments and its own kit names', () => {
    expect(lookMetaSchema.safeParse(whiteboardLook).success).toBe(true);
    expect(whiteboardLook.available).toBe(true);
    expect(whiteboardLook.rolls).toEqual(['B', 'C']);
    expect(whiteboardLook.soundPalette).toBe('whiteboard');
    expect(whiteboardLook.variationBudget).toBe('whiteboard');
    for (const treatment of whiteboardLook.treatments) {
      expect(voxelLook.treatments, treatment).toContain(treatment);
    }
    const names = lookDefinitions(whiteboardLook).map((definition) => definition.name);
    expect(names.sort()).toEqual(Object.keys(MINIMAL).sort());
    for (const name of names) expect(whiteboardLook.docs).toContain(name);
    const extra = extraLookDefinitions([voxelLook, whiteboardLook]);
    expect(extra.fx).toHaveLength(4);
    expect(extra.env.map((entry) => entry.definition.name)).toEqual(['whiteboardBoard']);
  });

  it('builds every template with minimal params: a board with marker ink', () => {
    for (const [name, [kind, params]] of Object.entries(MINIMAL)) {
      const board = build(kind, name, params);
      const pixels = pixelsAt(board, board.doneAt() + 1);
      expect(pixels.length, name).toBe(640 * 360 * 4);
      expect(countColor(pixels, CREAM), name).toBeGreaterThan(150_000);
      expect(countColor(pixels, BLACK), name).toBeGreaterThan(80);
    }
  });

  it('is a pure function of t (seek order does not matter)', () => {
    const params = {
      size: SIZE,
      anchor,
      strokes: [
        'person 200 180',
        { draw: 'arrow 260 180 380 180 red', at: 'idea' },
        'coin 450 180',
      ],
      erase: [{ at: 'money' }],
    };
    const a = build('fx', 'whiteboardSketch', params, 3);
    const b = build('fx', 'whiteboardSketch', params, 3);
    const times = [0.5, 2.3, 4.4, 6];
    const hash = (pixels: Uint8Array): string => createHash('sha1').update(pixels).digest('hex');
    const forward = times.map((t) => hash(pixelsAt(a, t)));
    const backward = [...times]
      .reverse()
      .map((t) => hash(pixelsAt(b, t)))
      .reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
  });

  it('draws strokes progressively and pins them to spoken phrases', () => {
    const board = build('fx', 'whiteboardSketch', {
      size: SIZE,
      anchor,
      pen: 'none',
      tray: false,
      strokes: ['box 100 100 120 80', { draw: 'circle 420 140 50 red', at: 'idea', duration: 1 }],
    });
    expect(board.strokeTime(1)).toEqual({ t: 2, tEnd: 3 });
    const red = CRISP_PALETTE['burntOrange'] ?? '';
    const reds = [1.95, 2.3, 2.6, 3.1].map((t) => countColor(pixelsAt(board, t), red));
    expect(reds[0]).toBe(0);
    expect(reds[1]).toBeGreaterThan(0);
    expect(reds[2]).toBeGreaterThan(reds[1] ?? 0);
    expect(reds[3]).toBeGreaterThan(reds[2] ?? 0);
  });

  it('wipes everything drawn before an erase pass, leaving later strokes', () => {
    const board = build('fx', 'whiteboardSketch', {
      size: SIZE,
      pen: 'none',
      frame: false,
      strokes: ['house 320 180 120', { draw: 'star 320 180 80 blue', at: 3 }],
      erase: [{ at: 1.8, duration: 0.8 }],
    });
    const before = countColor(pixelsAt(board, 1.7), BLACK);
    const during = countColor(pixelsAt(board, 2.2), BLACK);
    expect(before).toBeGreaterThan(300);
    expect(during).toBeLessThan(before);
    expect(countColor(pixelsAt(board, 2.7), BLACK)).toBe(0);
    expect(countColor(pixelsAt(board, 5), CRISP_PALETTE['teal'] ?? '')).toBeGreaterThan(200);
  });

  it('gives annotation targets and times for strokes and named points', () => {
    const board = build('fx', 'whiteboardDiagram', {
      size: SIZE,
      anchor,
      nodes: [
        { id: 'idea', label: 'IDEA', doodle: 'bulb' },
        { id: 'cash', label: 'CASH', at: 'money' },
      ],
    });
    const cash = board.point('cash');
    const idea = board.point('idea');
    expect(cash.screen[0]).toBeGreaterThan(idea.screen[0]);
    expect(board.point('cash.top').screen[1]).toBeLessThan(cash.screen[1]);
    expect(board.point('edge:idea>cash').screen[0]).toBeGreaterThan(idea.screen[0]);
    const first = board.stroke(0);
    expect(first.size?.[0]).toBeGreaterThan(0);
    expect(board.strokeTime(2).t).toBe(4);
    board.update(0.4);
    expect(board.point('pen').screen[0]).toBeGreaterThan(0);
    expect(() => board.point('nope')).toThrow(/unknown point; available: pen, idea/);
    expect(() => board.stroke(9)).toThrow(/there are 3 strokes/);
  });

  it('writes text lines on their phrases and emphasises words', () => {
    const board = build('fx', 'whiteboardText', {
      size: SIZE,
      anchor,
      lines: ['SMALL HABITS', { text: 'BIG RESULTS', at: 'idea' }],
      emphasis: [{ word: 'big', style: 'circle' }],
    });
    expect(board.strokeTime(1).t).toBe(2);
    expect(board.strokeTime(2).t).toBeGreaterThan(board.strokeTime(1).tEnd);
    expect(board.point('word:2').screen[1]).toBeGreaterThan(board.point('word:0').screen[1]);
    expect(() =>
      build('fx', 'whiteboardText', { size: SIZE, lines: ['A B'], emphasis: [{ word: 'zzz' }] }),
    ).toThrow(/emphasis word "zzz" is not in the lines/);
  });

  it("explains bad input in the scene author's terms", () => {
    expect(() =>
      build('fx', 'whiteboardSketch', {
        size: SIZE,
        strokes: [{ draw: 'box 1 1 9 9', at: 'idea' }],
      }),
    ).toThrow(/"idea" is a spoken phrase; pass anchor: ctx\.anchor/);
    expect(() => build('fx', 'whiteboardSketch', { size: SIZE, strokes: ['rocket'] })).toThrow(
      /stroke "rocket": expected rocket x y \[size\]/,
    );
    expect(() =>
      build('fx', 'whiteboardDiagram', {
        size: SIZE,
        nodes: [{ id: 'a' }],
        edges: [{ from: 'a', to: 'b' }],
      }),
    ).toThrow(/edge a>b refers to unknown node "b"/);
    expect(() => build('fx', 'whiteboardDiagram', { size: SIZE, kind: 'timeline' })).toThrow(
      /needs events/,
    );
  });

  it('scales to other frame sizes and makes transparent overlays', () => {
    const small = build('fx', 'whiteboardCounter', { size: [480, 270], values: [7] });
    expect(pixelsAt(small, 3).length).toBe(480 * 270 * 4);
    const overlay = build('fx', 'whiteboardSketch', {
      size: SIZE,
      region: [0.5, 0, 0.5, 1],
      board: false,
      strokes: ['check 160 180'],
    });
    const pixels = pixelsAt(overlay, 5);
    expect(pixels.length).toBe(320 * 360 * 4);
    expect(pixels[3]).toBe(0);
    expect(overlay.stroke(0).screen[0]).toBeGreaterThan(0.5);
  });

  it('groups digits without a locale', () => {
    expect(groupDigits(1250000, true)).toBe('1,250,000');
    expect(groupDigits('-12345.5', true)).toBe('-12,345.5');
    expect(groupDigits(999, true)).toBe('999');
    expect(groupDigits(1250000, false)).toBe('1250000');
  });
});
