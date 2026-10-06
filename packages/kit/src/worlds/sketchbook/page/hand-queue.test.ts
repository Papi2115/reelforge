/**
 * One writing hand per page (hand-queue.ts, hand.ts, hand-room.ts): overlapping far-apart tasks
 * are serialised (the later one waits <= MAX_SLIP s, or goes without the hand), the hand never
 * jumps or shows two nibs, glides bend around a subject, pauses and the shot's end never leave
 * the hand resting on the subject; all pure in t.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { hexPixel } from '../../../looks/blueprint/raster.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { createHandTrack, type HandRules } from '../draw/hand.js';
import { cover, naturalAngle } from '../draw/hand-room.js';
import { strokeMark, type Mark } from '../draw/marks.js';
import { identity, type Point } from '../draw/paths.js';
import type { PageApi } from './api.js';
import { handDrawn, HandQueue, MAX_SLIP } from './hand-queue.js';

type Page = THREE.Group & PageApi & { update(t: number): void };

/** Frame size: 0.5 screen px per page px. */
const SIZE = [480, 270] as const;
const SKIN = hexPixel(SKETCHBOOK_PALETTE['coffeeLight'] ?? '#dcbf98');

function page(params: Record<string, unknown> = {}): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: SIZE, seed: 11, ...params });
}

function pixelsAt(target: Page, t: number): Uint32Array {
  target.update(t);
  const mesh = target.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const texture = mesh.material.uniforms['map']?.value as THREE.DataTexture;
  return new Uint32Array(Uint8Array.from(texture.image.data as Uint8Array).buffer);
}

interface Sprite {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The hand sprite at t: centre and size of its skin pixels (null = no hand). */
function handAt(target: Page, t: number): Sprite | null {
  const pixels = pixelsAt(target, t);
  let [n, sx, sy] = [0, 0, 0];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  pixels.forEach((pixel, index) => {
    if (pixel !== SKIN) return;
    const [x, y] = [index % SIZE[0], Math.floor(index / SIZE[0])];
    [n, sx, sy] = [n + 1, sx + x, sy + y];
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  });
  return n < 20 ? null : { x: sx / n, y: sy / n, w: x1 - x0, h: y1 - y0 };
}

/** Samples the hand every 1/60 s over [from, to]. */
function film(target: Page, from: number, to: number): (Sprite | null)[] {
  const frames: (Sprite | null)[] = [];
  for (let t = from; t <= to + 1e-9; t += 1 / 60) frames.push(handAt(target, t));
  return frames;
}

/** Largest move of the hand between two samples (screen px); Infinity if it vanished between. */
function largestStep(frames: readonly (Sprite | null)[]): number {
  let largest = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const [a, b] = [frames[i - 1], frames[i]];
    if (!a || !b) return Infinity;
    largest = Math.max(largest, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return largest;
}

/** Two words far apart (top and bottom of the page) that the scene starts at the same time. */
function topAndBottom(target: Page, bottom: Record<string, unknown> = {}) {
  const top = target.write('TOP', { x: 300, y: 90, size: 30, at: 1, until: 1.2 });
  const low = target.write('BOTTOM', {
    x: 300,
    y: 470,
    size: 30,
    at: 1.05,
    until: 1.45,
    ...bottom,
  });
  return { top, low };
}

describe('one hand per page: the queue', () => {
  it('serialises top and bottom writes that start together: the later waits, the hand travels', () => {
    const target = page();
    const { top, low } = topAndBottom(target);
    expect(low.at).toBeGreaterThan(top.end + 0.12);
    expect(low.at - 1.05).toBeLessThanOrEqual(MAX_SLIP);
    expect(low.end - low.at).toBeCloseTo(0.4, 5);
    const frames = film(target, top.at + 0.02, low.end - 0.02);
    // Always one hand (never two nibs: one hand-sized sprite), never a jump between the words.
    for (const frame of frames) expect(frame && frame.w < 170 && frame.h < 170).toBe(true);
    expect(largestStep(frames)).toBeLessThan(40);
    const [first, last] = [frames[0], frames.at(-1)];
    expect(first && last && last.y - first.y).toBeGreaterThan(120);
  });

  it('keeps the time of a task that would wait too long: it appears without the hand', () => {
    const target = page();
    const top = target.write('A LONG TITLE', { x: 200, y: 90, size: 30, at: 1, until: 2.4 });
    const low = target.write('BOTTOM', { x: 300, y: 470, size: 30, at: 1.2, until: 1.8 });
    expect(low.at).toBe(1.2);
    const frames = film(target, top.at + 0.05, top.end - 0.05);
    expect(largestStep(frames)).toBeLessThan(40);
    for (const frame of frames) expect(frame?.y ?? Infinity).toBeLessThan(SIZE[1] / 2);
  });

  it('never moves a parallel mark', () => {
    const { low } = topAndBottom(page(), { parallel: true });
    expect(low.at).toBe(1.05);
  });

  it('lets nearby overlaps be (a twitch, not a glitch) and moves tasks as a whole', () => {
    const queue = new HandQueue();
    const leaf = (x: number, y: number, t0: number): Mark =>
      strokeMark([x, y, x + 8, y - 10], { t0, dur: 0.05, seed: 1 });
    expect(queue.place([leaf(300, 200, 1)], false)[0]?.t0).toBe(1);
    expect(queue.place([leaf(306, 200, 1.03)], false)[0]?.t0).toBe(1.03);
    const far = queue.place([leaf(300, 480, 1.02), leaf(320, 480, 1.1)], false);
    const shift = (far[0]?.t0 ?? 0) - 1.02;
    expect(shift).toBeGreaterThan(0);
    expect((far[1]?.t0 ?? 0) - 1.1).toBeCloseTo(shift, 9);
  });

  it('draws with the hand only what it can reach: never two tasks at once', () => {
    const word = [0, 1, 2, 3].map((i) =>
      strokeMark([100 + i * 20, 100, 110 + i * 20, 80], { t0: 1 + i * 0.25, dur: 0.2, seed: i }),
    );
    const other = [0, 1, 2, 3].map((i) =>
      strokeMark([100 + i * 20, 480, 110 + i * 20, 460], { t0: 1.5 + i * 0.25, dur: 0.2, seed: i }),
    );
    const drawn = handDrawn([word, other], identity, 1);
    expect(word.every((mark) => drawn.has(mark))).toBe(true);
    // The word ends at 1.95; the hand then needs ~0.24 s to get down: 2.0 and 2.25 go without it.
    expect(other.map((mark) => drawn.has(mark))).toEqual([false, false, false, true]);
  });
});

describe('one hand per page: subject safety', () => {
  const rules = (keepClear: HandRules['keepClear']): HandRules => ({
    keepClear,
    rest: null,
    restGap: 1.5,
    scale: 1,
    width: 960,
  });
  const mark = (x: number, y: number, t0: number) =>
    strokeMark([x, y, x + 40, y], { t0, dur: 0.3, seed: 1 });
  const at = (p: { x: number; y: number } | null): Point => [p?.x ?? NaN, p?.y ?? NaN];

  it('holds of >= 0.4 s park the hand on a clear margin spot, not on the subject', () => {
    const box = [260, 180, 420, 300] as const;
    const track = createHandTrack([mark(300, 200, 1), mark(320, 230, 1.9)], rules([box]), identity);
    const middle = track.state(1.6, null);
    expect(cover(at(middle), naturalAngle(middle?.x ?? 0, 960), [box], 1)).toBe(0);
    expect(middle?.y === 522 || middle?.x === 932).toBe(true);
    // Out and back without a jump.
    let step = 0;
    for (let t = 1.3; t + 1 / 120 < 1.9; t += 1 / 120) {
      const [a, b] = [at(track.state(t, null)), at(track.state(t + 1 / 120, null))];
      step = Math.max(step, Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    expect(step).toBeLessThan(30);
  });

  it('bends a glide around a subject it is not drawing', () => {
    const box = [380, 300, 160, 220] as const;
    const marks = [mark(150, 120, 1), mark(700, 260, 1.75)];
    const straight = createHandTrack(marks, rules([]), identity).state(1.525, null);
    const routed = createHandTrack(marks, rules([box]), identity).state(1.525, null);
    expect(cover(at(straight), straight?.angle ?? 0, [box], 1)).toBeGreaterThan(0);
    expect(cover(at(routed), routed?.angle ?? 0, [box], 1)).toBeLessThan(
      cover(at(straight), straight?.angle ?? 0, [box], 1),
    );
  });

  it('clears the subject for the last 0.4 s of the shot, same pixels in any seek order', () => {
    const shot = () => {
      const target = page({ duration: 3 });
      target.figure({ x: 480, y: 470, h: 300, at: 0.3, until: 1.4 });
      target.write('HELLO', { x: 430, y: 300, size: 30, at: 2.2, until: 2.9 });
      return target;
    };
    const a = shot();
    expect(handAt(a, 2.5)).not.toBeNull();
    expect(handAt(a, 2.97)).toBeNull();
    const without = page();
    without.figure({ x: 480, y: 470, h: 300, at: 0.3, until: 1.4 });
    without.write('HELLO', { x: 430, y: 300, size: 30, at: 2.2, until: 2.9 });
    expect(handAt(without, 2.97)).not.toBeNull();
    const b = shot();
    const times = [2.5, 2.7, 2.97, 1.0];
    const forward = times.map((t) => pixelsAt(a, t).join());
    const backward = [...times]
      .reverse()
      .map((t) => pixelsAt(b, t).join())
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('rests on a clear spot at the end when the scene rest spot is on the subject', () => {
    const target = page({ duration: 3, rest: [470, 300] });
    target.figure({ x: 480, y: 470, h: 300, at: 0.3, until: 1.4 });
    target.write('HELLO', { x: 430, y: 300, size: 30, at: 2.2, until: 2.9 });
    // Without the end rule the hand sits on the figure (writing on it, then resting there).
    const inFigure = (t: number): number => {
      const pixels = pixelsAt(target, t);
      let count = 0;
      for (let y = 85; y < 240; y += 1)
        for (let x = 195; x < 285; x += 1) if (pixels[y * SIZE[0] + x] === SKIN) count += 1;
      return count;
    };
    expect(inFigure(2.5)).toBeGreaterThan(20);
    expect(inFigure(2.99)).toBe(0);
  });
});
