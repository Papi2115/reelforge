/**
 * The Sketchbook page (kit.fx.sketchPage) without a browser: a pure function of t (same t -> same
 * pixels, in any seek order), line boil on its cadence, palette colours only, build-only methods,
 * explicit errors, and the hand's rest rule.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { createKit } from '../../../kit.js';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { hexPixel } from '../../../looks/blueprint/raster.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { createHandTrack, type HandRules } from '../draw/hand.js';
import { strokeMark } from '../draw/marks.js';
import { identity } from '../draw/paths.js';
import { SKETCHBOOK_STYLE } from '../style.js';
import type { PageApi } from './api.js';
import { expressionTrack, poseTrack } from './motion.js';

type Page = THREE.Group & PageApi & { update(t: number): void };

const SIZE = [480, 270] as const;

function page(params: Record<string, unknown> = {}): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: SIZE, page: 3, seed: 11, ...params });
}

/** A small story: a figure, a label, an arrow, a fill, a red correction, tape. */
function story(target: Page): Page {
  const fig = target.figure({ x: 200, y: 450, h: 220, at: 0.2, until: 1.4 });
  target.stroke([-10, -100, 0, 0, 6, 70], { attach: fig.joint('handL') });
  target.write('365 days', { x: 500, y: 140, size: 28, hand: 'scrawl' });
  target.arrow([480, 200, 420, 260, 330, 300]);
  target.fill([600, 300, 700, 300, 700, 380, 600, 380], { color: 'orange' });
  target.write('+1 DAY', { x: 560, y: 450, size: 40, tool: 'red', at: 4.5, until: 5 });
  target.tape(650, 280, 70, 18, 8);
  return target;
}

function pixelsAt(target: Page, t: number): Uint8Array {
  target.update(t);
  const mesh = target.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const texture = mesh.material.uniforms['map']?.value as THREE.DataTexture;
  return Uint8Array.from(texture.image.data as Uint8Array);
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

describe('kit.fx.sketchPage', () => {
  it('is a pure function of t: same t twice and in any seek order give the same pixels', () => {
    const a = story(page());
    const b = story(page());
    const forward = [0.5, 2.2, 4.8, 7].map((t) => pixelsAt(a, t));
    const backward = [7, 4.8, 2.2, 0.5].map((t) => pixelsAt(b, t)).reverse();
    forward.forEach((frame, index) => {
      expect(same(frame, backward[index] ?? new Uint8Array()), `t#${String(index)}`).toBe(true);
    });
    expect(same(pixelsAt(a, 2.2), forward[1] ?? new Uint8Array())).toBe(true);
    expect(same(forward[0] ?? new Uint8Array(), forward[1] ?? new Uint8Array())).toBe(false);
  });

  it('boils the lines on its cadence: held within one boil frame, redrawn on the next', () => {
    const target = story(page({ boilFps: 12, pen: false }));
    const first = pixelsAt(target, 8.0);
    expect(same(first, pixelsAt(target, 8.06))).toBe(true);
    expect(same(first, pixelsAt(target, 8.1))).toBe(false);
  });

  it('paints only palette colours', () => {
    const target = story(page());
    const palette = new Set(Object.values(SKETCHBOOK_STYLE.palette).map(hexPixel));
    for (const t of [0.6, 3, 4.7]) {
      const view = new Uint32Array(pixelsAt(target, t).buffer);
      expect(
        view.every((pixel) => palette.has(pixel)),
        `t=${String(t)}`,
      ).toBe(true);
    }
  });

  it('takes marks only in build(): the first update seals the page', () => {
    const target = story(page());
    target.update(1);
    expect(() => target.write('late', { x: 10, y: 10 })).toThrow(KitError);
    expect(() => target.write('late', { x: 10, y: 10 })).toThrow(/before the first update/);
  });

  it('fails with messages written for the scene author', () => {
    const target = page();
    expect(() => target.write('', { x: 1, y: 1 })).toThrow(/text must be a string/);
    expect(() => target.write('a', { y: 1 })).toThrow(/sketchPage\(\)\.write\(\): x/);
    expect(() => target.stroke([1, 2, 3])).toThrow(/two \[x, y\] pairs/);
    expect(() => target.fill([0, 0, 1, 1], { color: 'neon' })).toThrow(/color/);
    expect(() => target.figure({ x: 1, y: 2 }).joint('tail' as never)).toThrow(/joints are/);
    expect(() => target.write('x', { x: 1, y: 1, at: 'the year' })).toThrow(/anchor: ctx.anchor/);
  });

  it('chains marks: defaults start right after the previous one, until squeezes the pace', () => {
    const target = page();
    const first = target.write('one', { x: 100, y: 100 });
    const second = target.write('two', { x: 100, y: 150 });
    expect(first.at).toBeCloseTo(0.3, 5);
    expect(second.at).toBeCloseTo(first.end + 0.12, 5);
    const timed = target.write('budget', { x: 100, y: 200, at: 3, until: 3.4 });
    expect([timed.at, timed.end]).toEqual([3, 3.4]);
  });
});

describe('the hand rest rule', () => {
  const rules = (keepClear: HandRules['keepClear']): HandRules => ({
    keepClear,
    rest: null,
    restGap: 1.5,
    scale: 1,
    width: 960,
  });
  const label = (x: number, y: number, t0: number) =>
    strokeMark([x, y, x + 40, y], { t0, dur: 0.3, seed: 1 });

  it('turns the wrist so the hand keeps off the subject while writing next to it', () => {
    const mark = label(300, 200, 1);
    const free = createHandTrack([mark], rules([]), identity).state(1.1, null);
    const subject = createHandTrack([mark], rules([[300, 250, 120, 200]]), identity).state(
      1.1,
      null,
    );
    expect(free?.angle).toBeCloseTo(50 + (340 / 960) * 14, 5);
    expect(subject?.angle).not.toBeCloseTo(free?.angle ?? 0, 1);
  });

  it('never hovers over the subject in a pause: the hand goes to rest and comes back', () => {
    const marks = [label(300, 200, 1), label(320, 230, 2.6)];
    const hover = createHandTrack(marks, rules([]), identity).state(2, null);
    expect(hover).not.toBeNull();
    const covered = rules([[260, 180, 400, 330]]);
    const away = createHandTrack(marks, covered, identity).state(2, null);
    expect(away).toBeNull();
    const resting = createHandTrack(marks, { ...covered, rest: [900, 520] }, identity);
    expect(resting.state(2, null)).toMatchObject({ x: 900, y: 520 });
  });

  it('leaves the page in long pauses and after the last mark', () => {
    const marks = [label(300, 200, 1), label(320, 230, 4)];
    const track = createHandTrack(marks, rules([]), identity);
    expect(track.state(0.2, null)).toBeNull();
    expect(track.state(2.5, null)).toBeNull();
    expect(track.state(3.8, null)).not.toBeNull();
    expect(track.state(6, null)).toBeNull();
  });
});

describe('figure motion', () => {
  const resolve = createResolver(undefined, 'test');

  it('eases pose keys from the pose so far, back keys overshoot', () => {
    const pose = poseTrack(
      [
        { at: 0, armR: [0, 0], ease: 'inOut', overshoot: 1.9 },
        { at: 1, to: 2, armR: [100, 50], ease: 'inOut', overshoot: 1.9 },
        { at: 3, to: 4, armR: [0, 0], ease: 'back', overshoot: 2.4 },
      ],
      resolve,
    );
    expect(pose(0.5).armR).toEqual([0, 0]);
    expect(pose(1.5).armR[0]).toBeCloseTo(50, 5);
    expect(pose(2.5).armR).toEqual([100, 50]);
    expect(pose(3.8).armR[0]).toBeLessThan(0);
    expect(pose(5).armR[0]).toBeCloseTo(0, 5);
    expect(pose(5).legL).toEqual([-12, -4]);
  });

  it('switches expression keys at their time', () => {
    const face = expressionTrack(
      [
        { at: 0, mouth: 'flat' },
        { at: 2, mouth: 'o', brow: -1 },
      ],
      resolve,
    );
    expect(face(1)).toMatchObject({ mouth: 'flat', brow: 0, eyes: 'dot' });
    expect(face(2)).toMatchObject({ mouth: 'o', brow: -1 });
  });
});
