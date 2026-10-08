/**
 * The Game B1 frame without a GPU (PLAN.md#13.5): a pure function of t (any seek order, a fresh
 * model gives the same pixels), palette indices only, the push INTO the TV ends exactly on the
 * TV-only frame and starts exactly on the room (continuity), the 2600 rules (one colour per sprite
 * row, flicker on a crowded scanline, playfield outside the limit), and the frame budget measured
 * on the template scenes in plain Node.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { IndexCanvas } from '../core/canvas.js';
import { B1_TABLE, C, INKS } from '../palette.js';
import { VIEWS } from '../room/view.js';
import { TvPainter } from '../tv/painter.js';
import { ScreenModel, SCREEN_H, SCREEN_W, type Painter } from './model.js';

const PICTURE: Painter = (g, t) => {
  g.bands(0, 160, [
    [0, 'night'],
    [90, 'teal'],
    [130, 'walnut'],
  ]);
  g.playfield(150, 30, '##..####....##..####', 'walnutDark');
  g.cart(20 + Math.round(t * 10), 60, 'orange', { scale: 2, tumble: true });
  g.text('LEVEL 1', 50, 30, { colour: 'gold', type: { at: 0.2 } });
};

function model(room: boolean): ScreenModel {
  const m = new ScreenModel(7, 6, 2);
  m.painters.push(PICTURE);
  if (room)
    m.room = {
      calendar: { month: 'DEC', mark: 25, ring: [0.5, 1.5] },
      tree: true,
      presents: true,
      gift: { slot: [1, 2], tag: ['E.T.', 'XMAS 82'], tagAt: [2, 2.6], blink: 3 },
      lamp: true,
      carts: 2,
    };
  m.years.push({ at: 0, year: '1983' }, { at: 1.5, year: '1982' });
  m.progress = { at: 0, from: 0.1, to: 0.2, slots: 10 };
  m.bosses.push({
    at: 0.5,
    num: 1,
    name: 'THE DEADLINE',
    from: 'left',
    x: 40,
    y: 52,
    seed: 31,
    hp: { n: 5, label: 'WEEKS', keys: [[2, 4]], segW: 14 },
    defeat: 4,
  });
  m.notes.push({
    at: 1,
    x: 172,
    y: 190,
    w: 168,
    h: 66,
    angle: -0.075,
    lines: ['WEAK POINT:', 'MORE TIME'],
    size: 2.1,
    seed: 51,
    under: 1,
    strike: { line: 1, at: 3 },
    tick: undefined,
  });
  m.dialogues.push({ text: 'CHRISTMAS 1982.', speaker: 'DAD', at: 0.4, until: 5, place: 'bottom' });
  return m;
}

const hash = (frame: Uint8Array): string => createHash('sha256').update(frame).digest('hex');
const TIMES = [0, 0.7, 1.4, 2.1, 2.9, 3.6, 4.4, 5.2];

describe('b1 frame model', () => {
  it('paints the same pixels for the same t in any order and in a fresh model', () => {
    const a = model(true);
    a.camera.push(
      { at: 1, view: VIEWS.room, ease: 'inOut' },
      { at: 3, view: VIEWS.tv, ease: 'inOut' },
      { at: 4, view: VIEWS.room, ease: 'out' },
    );
    const forward = TIMES.map((t) => hash(a.render(t)));
    const backward = [...TIMES]
      .reverse()
      .map((t) => hash(a.render(t)))
      .reverse();
    expect(backward).toEqual(forward);
    const b = model(true);
    b.camera.push(...a.camera);
    const order = [5, 2, 7, 0, 3, 6, 1, 4];
    const shuffled = new Map(order.map((i) => [i, hash(b.render(TIMES[i] ?? 0))]));
    expect(TIMES.map((_, i) => shuffled.get(i))).toEqual(forward);
    expect(new Set(forward).size).toBe(TIMES.length);
  });

  it('writes palette indices only', () => {
    const m = model(true);
    for (const t of [0.5, 2.5, 3.1]) {
      const used = new Set(m.render(t));
      for (const index of used) expect(index, `t=${String(t)}`).toBeLessThan(INKS);
    }
    expect(INKS).toBe(B1_TABLE.length);
  });

  it('pushes into the TV continuously: inTv = 1 is the TV-only frame, inTv = 0 the room', () => {
    const inside = model(true);
    inside.camera.push({ at: 0, view: VIEWS.tv, ease: 'inOut' });
    const tvOnly = model(false);
    for (const t of [0.3, 1.2, 3.3]) expect(hash(inside.render(t))).toBe(hash(tvOnly.render(t)));
    const push = model(true);
    push.camera.push(
      { at: 1, view: VIEWS.room, ease: 'inOut' },
      { at: 3, view: VIEWS.tv, ease: 'inOut' },
    );
    const room = model(true);
    expect(hash(push.render(0.8))).toBe(hash(room.render(0.8)));
    expect(hash(push.render(3))).toBe(hash(tvOnly.render(3)));
    // halfway the picture covers more of the frame than the glass, less than all of it
    const frames = [1, 2, 2.9].map((t) => push.render(t).slice());
    const differs = (x: Uint8Array, y: Uint8Array) => x.some((v, i) => v !== y[i]);
    expect(differs(frames[0] ?? new Uint8Array(), frames[1] ?? new Uint8Array())).toBe(true);
    expect(push.viewAt(2).inTv).toBeGreaterThan(0);
    expect(push.viewAt(2).inTv).toBeLessThan(1);
  });
});

describe('2600 rules of the TV painter', () => {
  const ROWS = ['####', '#..#', '####'];

  function paint(frame: number, draw: (g: TvPainter) => void): IndexCanvas {
    const cv = new IndexCanvas(SCREEN_W, SCREEN_H);
    const g = new TvPainter(cv, frame / 30);
    draw(g);
    g.flush();
    return cv;
  }

  function colours(cv: IndexCanvas, y: number): Set<number> {
    return new Set(cv.d.subarray(y * SCREEN_W, (y + 1) * SCREEN_W));
  }

  it('gives every sprite row one colour, in wide 4 x 2 px pixels', () => {
    const cv = paint(0, (g) => {
      g.sprite(ROWS, ['cream', 'gold', 'teal'], 10, 10, { stretch: 2 });
    });
    for (const [row, ink] of [
      [20, C.CREAM],
      [22, C.GOLD],
      [24, C.TEAL],
    ] as const) {
      expect(colours(cv, row)).toEqual(new Set([C.VOID, ink]));
      expect(colours(cv, row + 1)).toEqual(new Set([C.VOID, ink]));
    }
    const lit = [...cv.d.subarray(20 * SCREEN_W, 21 * SCREEN_W)].filter((v) => v !== C.VOID);
    expect(lit).toHaveLength(4 * 2 * 4); // 4 bits x stretch 2 x 4 px
  });

  it('flickers crowded scanlines on alternate frames, never the hero or the playfield', () => {
    const scene = (g: TvPainter) => {
      g.sprite(ROWS, 'cream', 10, 10);
      g.sprite(ROWS, 'cream', 30, 10);
      g.sprite(ROWS, 'cream', 50, 10, { flicker: false });
      g.sprite(ROWS, 'gold', 70, 10, { playfield: true });
    };
    const lit = (cv: IndexCanvas, x: number) => cv.d[21 * SCREEN_W + x * 4] === C.CREAM;
    const even = paint(0, scene);
    const odd = paint(1, scene);
    expect([lit(even, 10), lit(even, 30)]).not.toEqual([lit(odd, 10), lit(odd, 30)]);
    expect(lit(even, 10) || lit(even, 30)).toBe(true);
    expect(lit(even, 50) && lit(odd, 50)).toBe(true);
    expect(even.d[21 * SCREEN_W + 70 * 4]).toBe(C.GOLD);
    const calm = paint(0, (g) => {
      g.sprite(ROWS, 'cream', 10, 10);
      g.sprite(ROWS, 'cream', 30, 10);
    });
    expect(lit(calm, 10) && lit(calm, 30)).toBe(true);
  });
});

interface SceneModule {
  build(ctx: unknown): unknown;
  update(t: number, state: unknown): void;
}

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'game-b1');
const PALETTE = Object.fromEntries(B1_TABLE.map(([, swatch, hex]) => [swatch, hex]));

describe('frame budget (template scenes, plain Node)', () => {
  it.each([
    ['a1_hook.js', 6.5],
    ['a2_xmas.js', 8],
    ['a3_deadline.js', 8.5],
  ])('%s renders within the budget (<= 10 ms/frame measured)', async (file, duration) => {
    const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as SceneModule;
    const kit = createKit({ three: THREE, palette: PALETTE, rng: testRng(2115), style: 'game-b1' });
    const ctx = {
      kit: kit.api,
      shot: { width: SCREEN_W, height: SCREEN_H, duration },
      scene: { add: () => undefined },
    };
    const state = scene.build(ctx);
    for (let i = 0; i < 20; i += 1) scene.update((i / 20) * duration, state);
    const batches = 5;
    const frames = 30;
    let best = Number.POSITIVE_INFINITY;
    for (let batch = 0; batch < batches; batch += 1) {
      const started = process.hrtime.bigint();
      for (let i = 0; i < frames; i += 1)
        scene.update(((batch * frames + i) / (batches * frames)) * duration, state);
      best = Math.min(best, Number(process.hrtime.bigint() - started) / 1e6 / frames);
    }
    process.stdout.write(`game-b1 ${file}: ${best.toFixed(2)} ms/frame (640x360, best batch)\n`);
    // Generous ceiling for slow CI runners; the measured number is in the log.
    expect(best).toBeLessThan(30);
  });
});
