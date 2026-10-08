/**
 * The Game B1 toolkits without a GPU (PLAN.md#13.5 part b): readable errors that say what to
 * change (intent, the beat of silence, the 4 s hold, locked heroes, a correction without room,
 * a locked level target, overlapping cartridge swaps), the craft beats in the pixels (the empty
 * slot before the slam, the HUD in paper ink, the ring only after its time), the continuity seams
 * pixel for pixel (the cartridge pull-back starts on the TV-only frame and the push ends on it;
 * the calendar redraw starts on the room at the calendar and ends inside the TV), and every frame
 * a pure function of t in palette indices only.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { C, INKS } from '../palette.js';
import { VIEWS } from '../room/view.js';
import { ScreenModel, SCREEN_H, SCREEN_W, type Painter } from './model.js';
import { toolkits } from './toolkits.js';

const at = (when: number | string): number => Number(when);
const PICTURE: Painter = (g, t) => {
  g.bands(0, 160, [
    [0, 'night'],
    [100, 'walnut'],
  ]);
  g.cart(30 + Math.round(t * 8), 70, 'orange', { scale: 2 });
};

function setup(duration = 8) {
  const model = new ScreenModel(5, duration, 2);
  model.painters.push(PICTURE);
  return { model, kit: toolkits(model, at, duration) };
}

const hash = (frame: Uint8Array): string => createHash('sha256').update(frame).digest('hex');
const count = (frame: Uint8Array, ink: number) =>
  frame.reduce((n, v) => n + (v === ink ? 1 : 0), 0);

const TABLE = {
  intent: 'only the boom year has happened, the crash is still locked',
  at: 0,
  until: 7,
  rows: [{ who: 'E.T', score: 1982 }, { score: 1983 }, { score: 1985 }],
  print: 0.7,
  slam: { at: 2.8 },
  ring: { at: 4, note: 'BOOM!' },
  prompt: { text: 'INSERT COIN', at: 5 },
};

const MANUAL = {
  intent: 'a flood of look-alikes teaches buyers to stop buying any game',
  at: 0,
  until: 6,
  steps: ['A HIT GAME SELLS.', 'SO THEY\nSTOP BUYING BAD GAMES.'],
  figure: { caption: 'THE SHELF', shape: 'cartridge', count: 5, hit: 4 },
  ticks: [1, 2],
  correction: { step: 2, strike: 'BAD', write: 'ANY', at: 3 },
};

describe('scoreTable', () => {
  it('names what to change', () => {
    const { kit } = setup();
    expect(() => kit.scoreTable({ ...TABLE, intent: undefined })).toThrow(/intent/);
    expect(() => kit.scoreTable({ ...TABLE, slam: { at: 1.5 } })).toThrow(/beat of silence/);
    expect(() => kit.scoreTable({ ...TABLE, until: 12 })).toThrow(
      /holds [0-9.]+ s after its last beat \(max 4 s\)/,
    );
    expect(() => kit.scoreTable({ ...TABLE, hero: 1 })).toThrow(/rows\[1\]: give who/);
    expect(() =>
      kit.scoreTable({ ...TABLE, rows: [{ who: 'E.T', score: 1982, locked: true }, { score: 1 }] }),
    ).toThrow(/cannot be locked/);
    expect(() => kit.scoreTable({ ...TABLE, rows: [{ who: 'E.T', score: '1,982' }, {}] })).toThrow(
      /1-7 digits/,
    );
    const nine = Array.from({ length: 9 }, () => ({ score: 1 }));
    expect(() => kit.scoreTable({ ...TABLE, rows: nine })).toThrow(/rows/);
  });

  it('leaves the slot empty for a beat, slams the gold score, rings it only later', () => {
    const { model, kit } = setup();
    const r = kit.scoreTable(TABLE);
    expect(r.cues.find((cue) => cue.name === 'hit')?.t).toBe(2.8);
    expect(r.cues.some((cue) => cue.t > 2.0 && cue.t < 2.8)).toBe(false); // the silence
    expect(count(model.render(2.75), C.GOLD)).toBe(0);
    expect(count(model.render(3.4), C.GOLD)).toBeGreaterThan(400);
    const before = count(model.render(3.9), C.WHITE);
    expect(count(model.render(4.7), C.WHITE)).toBeGreaterThan(before + 100);
  });
});

describe('manual', () => {
  it('names what to change', () => {
    const { kit } = setup();
    const six = Array.from({ length: 6 }, () => 'A RULE.');
    expect(() => kit.manual({ ...MANUAL, steps: six })).toThrow(/steps/);
    expect(() =>
      kit.manual({ ...MANUAL, correction: { step: 2, strike: 'GOOD', write: 'ANY', at: 3 } }),
    ).toThrow(/not a word of rule 2/);
    expect(() =>
      kit.manual({
        ...MANUAL,
        steps: ['A HIT GAME SELLS TO ALL.', 'BAD COPIES FOLLOW FAST.'],
        correction: { step: 2, strike: 'BAD', write: 'ANY', at: 3 },
      }),
    ).toThrow(/no room above or after/);
    expect(() => kit.manual({ ...MANUAL, ticks: [1, 2, 3] })).toThrow(/3 ticks for 2 rules/);
    expect(() =>
      kit.manual({ ...MANUAL, steps: ['A RULE THAT RUNS ON FAR TOO LONG FOR THE PAGE'] }),
    ).toThrow(/break it with/);
    expect(() => kit.manual({ ...MANUAL, until: 0.8 })).toThrow(/needs >= /);
  });

  it('covers the frame with the printed page and prints the HUD in paper ink there', () => {
    const { model, kit } = setup();
    model.years.push({ at: -1, year: '1983' });
    kit.manual({ ...MANUAL, enter: 'cut' });
    const frame = model.render(0.5);
    expect(count(frame, C.CREAM)).toBeGreaterThan(SCREEN_W * SCREEN_H * 0.4);
    // the year sits at 40, 22: dark key ink on paper, never the glass tan
    const yearBox = [];
    for (let y = 22; y < 32; y += 1)
      for (let x = 40; x < 100; x += 1) yearBox.push(frame[y * SCREEN_W + x]);
    expect(yearBox).toContain(C.WALNUT_D);
    expect(yearBox).not.toContain(C.TAN);
    expect(count(model.render(3.6), C.CRIMSON)).toBeGreaterThan(
      count(model.render(2.9), C.CRIMSON),
    );
  });
});

describe('continuity helpers', () => {
  it('pulls back from and pushes into the TV-only frame (cartridge insert)', () => {
    const { model, kit } = setup();
    const r = kit.cartridge({
      intent: 'the new game goes in, everyone wanted in',
      action: 'insert',
      at: 1,
      label: 'XMAS 82',
    });
    const plain = new ScreenModel(5, 8, 2);
    plain.painters.push(PICTURE);
    expect(hash(model.render(1))).toBe(hash(plain.render(1)));
    expect(hash(model.render(r.end - 0.0001))).toBe(hash(plain.render(r.end - 0.0001)));
    expect(hash(model.render(2.2))).not.toBe(hash(plain.render(2.2)));
    expect(r.cues.map((cue) => cue.name)).toEqual(['swoosh-out', 'click', 'glitch', 'swoosh-in']);
    expect(() =>
      kit.cartridge({ intent: 'a second swap at once', action: 'pull', at: 1.5 }),
    ).toThrow(/overlap/);
    expect(() =>
      kit.cartridge({ intent: 'a cartridge in pink', action: 'pull', at: 6, stripe: 'pink' }),
    ).toThrow(/not a game-b1 colour/);
  });

  it('zooms into the wall calendar and redraws the frame as the TV picture', () => {
    const { model, kit } = setup();
    expect(() => kit.calendarZoom({ intent: 'christmas is the deadline', at: 1 })).toThrow(
      /room\(/,
    );
    model.room = {
      calendar: { month: 'DEC', mark: 25, ring: [-2, -1] },
      tree: false,
      presents: false,
      gift: undefined,
      lamp: false,
      carts: 0,
    };
    const r = kit.calendarZoom({ intent: 'christmas is the deadline', at: 1, push: 1, wipe: 0.6 });
    expect(r.landing).toEqual({ x: 96, y: 22, w: 46, h: 130 });
    expect(r.end).toBeCloseTo(2.6);
    const onCalendar = new ScreenModel(5, 8, 2);
    onCalendar.painters.push(PICTURE);
    onCalendar.room = model.room;
    onCalendar.camera.push({ at: 0, view: VIEWS.calendar, ease: 'inOut' });
    const start = model.render(2).slice();
    const still = onCalendar.render(2);
    // the redraw's first frame is the room on the calendar (below the beam rows)
    expect(hash(start.subarray(2 * SCREEN_W))).toBe(hash(still.subarray(2 * SCREEN_W)));
    const inside = new ScreenModel(5, 8, 2);
    inside.painters.push(PICTURE);
    expect(hash(model.render(2.7))).toBe(hash(inside.render(2.7)));
  });

  it('checks the level-select map', () => {
    const { kit } = setup();
    const nodes = [
      { label: 'XMAS 82', icon: 'home', x: 24, y: 118 },
      { label: 'STORES 83', icon: 'store', x: 62, y: 80 },
      { icon: 'lock', x: 136, y: 70 },
    ];
    const spec = {
      intent: 'back a year to christmas',
      at: 0,
      until: 3,
      nodes,
      route: { from: 1, to: 0, at: 0.3 },
    };
    expect(kit.levelSelect(spec).cues.at(-1)?.name).toBe('success');
    expect(() => kit.levelSelect({ ...spec, route: { from: 0, to: 2, at: 0.3 } })).toThrow(
      /locked/,
    );
    expect(() =>
      kit.levelSelect({
        ...spec,
        nodes: [...nodes.slice(0, 2), { label: 'X', icon: 'lock', x: 9, y: 70 }],
      }),
    ).toThrow();
    expect(() => kit.levelSelect({ ...spec, route: { from: 1, to: 1, at: 0.3 } })).toThrow(
      /same node/,
    );
  });
});

describe('every toolkit together', () => {
  it('paints the same palette-index pixels for the same t in any order', () => {
    const { model, kit } = setup(12);
    kit.scoreTable({ ...TABLE, at: 0, until: 6 });
    kit.cartridge({
      intent: 'the new game goes in, everyone wanted in',
      action: 'insert',
      at: 6,
      enter: 'cut',
    });
    kit.manual({
      ...MANUAL,
      at: 8,
      until: 11.5,
      ticks: [9],
      correction: { ...MANUAL.correction, at: 10 },
      exit: 'turn',
    });
    kit.gameOver({ at: 11.5, count: [[11.6, 9]] });
    const times = [0.3, 2.9, 4.4, 6.5, 7.3, 8.3, 10.6, 11.2, 11.7];
    const forward = times.map((t) => hash(model.render(t)));
    const backward = [...times]
      .reverse()
      .map((t) => hash(model.render(t)))
      .reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    for (const t of times) for (const v of new Set(model.render(t))) expect(v).toBeLessThan(INKS);
  });
});
