/**
 * One writing hand per page (hand-queue.ts, hand-plan.ts, hand.ts, hand-room.ts): overlapping
 * far-apart tasks are serialised in anchor order (the later one waits; the hero only wins a tie;
 * secondary text that would wait too long soaks in whole by itself, never written without the
 * hand), the hand never
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
import { HandQueue, MAX_SLIP } from './hand-queue.js';
import { heroTask, planHand, type HandTask } from './hand-plan.js';

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

const task = (marks: readonly Mark[], text = 0): HandTask => ({
  marks,
  timing: 'queue',
  hero: false,
  text,
});

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

  it('keeps the time of secondary text that would wait too long: it appears by itself', () => {
    const target = page();
    const top = target.write('A LONG TITLE', {
      x: 200,
      y: 90,
      size: 30,
      at: 1,
      until: 2.4,
      hero: true,
    });
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

  it('plans every held mark with the hand: the later far task waits (never ink by itself)', () => {
    const word = [0, 1, 2, 3].map((i) =>
      strokeMark([100 + i * 20, 100, 110 + i * 20, 80], { t0: 1 + i * 0.25, dur: 0.2, seed: i }),
    );
    const other = [0, 1, 2, 3].map((i) =>
      strokeMark([100 + i * 20, 480, 110 + i * 20, 460], { t0: 1.5 + i * 0.25, dur: 0.2, seed: i }),
    );
    const plan = planHand([task(word), task(other)], []);
    expect(word.every((mark) => plan.drawn.has(mark))).toBe(true);
    const moved = other.map((mark) => plan.moved.get(mark) ?? mark);
    expect(moved.every((mark) => plan.drawn.has(mark))).toBe(true);
    // The word ends at 1.95; the hand needs ~0.24 s to get down there.
    expect(moved[0]?.t0).toBeGreaterThan(1.95 + 0.2);
  });

  it('never lets the hero displace a task timed before it (s04): the hero waits', () => {
    const note = [0, 1, 2, 3, 4].map((i) =>
      strokeMark([600 + i * 20, 100, 610 + i * 20, 80], { t0: 1 + i * 0.2, dur: 0.15, seed: i }),
    );
    const hero = [0, 1].map((i) =>
      strokeMark([100 + i * 60, 450, 140 + i * 60, 350], { t0: 2 + i * 0.3, dur: 0.25, seed: i }),
    );
    const plan = planHand([task(note), { ...task(hero), hero: true }], []);
    expect(note.every((mark) => plan.drawn.has(mark) && !plan.moved.has(mark))).toBe(true);
    const times = hero.map((mark) => (plan.moved.get(mark) ?? mark).t0);
    // The note ends at 1.95; the hand needs ~0.38 s to get from the note down to the hero.
    expect(times[0]).toBeGreaterThan(1.95 + 0.3);
    expect(hero.every((mark) => plan.drawn.has(plan.moved.get(mark) ?? mark))).toBe(true);
  });

  it('lets the hero wait at most MAX_SLIP: a longer earlier task appears by itself instead', () => {
    const note = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
      strokeMark([600 + i * 20, 100, 610 + i * 20, 80], { t0: 1 + i * 0.2, dur: 0.15, seed: i }),
    );
    const hero = [strokeMark([100, 450, 140, 350], { t0: 2, dur: 0.3, seed: 1 })];
    const plan = planHand([task(note), { ...task(hero), hero: true }], []);
    expect(plan.moved.has(hero[0] as Mark)).toBe(false);
    const shown = note.map((mark) => plan.moved.get(mark));
    expect(shown.every((mark) => mark?.reveal === 'bloom' && mark.t0 === 1)).toBe(true);
  });

  it('gives the hero only a tie: of two tasks timed together it goes first', () => {
    const near = [strokeMark([600, 100, 700, 80], { t0: 1, dur: 0.3, seed: 1 })];
    const hero = [strokeMark([100, 450, 140, 350], { t0: 1, dur: 0.3, seed: 2 })];
    const plan = planHand([task(near), { ...task(hero), hero: true }], []);
    expect(plan.moved.has(hero[0] as Mark)).toBe(false);
    expect(plan.moved.get(near[0] as Mark)?.t0).toBeGreaterThan(1.3);
  });

  it('takes tasks by their own time, not by where the call-time queue put them', () => {
    // A was asked for 0.1 but already queued to 0.5; B (asked for 0.3) must not start before it.
    const a = [strokeMark([100, 100, 200, 100], { t0: 0.5, dur: 0.3, seed: 1 })];
    const b = [strokeMark([700, 450, 800, 450], { t0: 0.3, dur: 0.1, seed: 2 })];
    const plan = planHand(
      [
        { ...task(a), at: 0.1 },
        { ...task(b), at: 0.3 },
      ],
      [],
    );
    expect(plan.moved.has(a[0] as Mark)).toBe(false);
    expect(plan.moved.get(b[0] as Mark)?.t0).toBeGreaterThan(0.8);
  });

  it('never queues a task behind one the scene timed later (call order is not time order)', () => {
    const queue = new HandQueue();
    const later = [strokeMark([100, 100, 200, 100], { t0: 1, dur: 0.4, seed: 1 })];
    const earlier = [strokeMark([700, 450, 800, 450], { t0: 0.9, dur: 0.3, seed: 2 })];
    expect(queue.place(later, false)[0]?.t0).toBe(1);
    expect(queue.place(earlier, false)[0]?.t0).toBe(0.9);
  });

  it('defaults the hero to the largest in-shot text (the later one on a tie)', () => {
    const at = (t0: number) => [strokeMark([0, 0, 10, 10], { t0, dur: 0.1, seed: 1 })];
    expect(heroTask([task(at(1), 20), task(at(2), 90), task(at(3)), task(at(-1), 200)])).toBe(1);
    expect(heroTask([task(at(1), 40), task(at(2), 40)])).toBe(1);
  });

  it('lets secondary text the hand cannot reach in time appear by itself, on time', () => {
    const hero = [0, 1, 2, 3, 4, 5].map((i) =>
      strokeMark([100 + i * 30, 450, 120 + i * 30, 350], { t0: 1 + i * 0.25, dur: 0.22, seed: i }),
    );
    const label = [0, 1].map((i) =>
      strokeMark([700 + i * 15, 80, 710 + i * 15, 60], { t0: 1.3 + i * 0.1, dur: 0.08, seed: i }),
    );
    const plan = planHand([{ ...task(hero), hero: true }, task(label, 14)], []);
    const shown = label.map((mark) => plan.moved.get(mark));
    expect(shown.map((mark) => mark?.reveal)).toEqual(['bloom', 'bloom']);
    expect(shown.map((mark) => mark?.held)).toEqual([false, false]);
    // Whole at once on its own time: never letter by letter in writing order (s03 WAVE).
    expect(shown.map((mark) => mark?.t0)).toEqual([1.3, 1.3]);
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
