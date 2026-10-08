/**
 * The HUD screens of part b (PLAN.md#13.4): the intermission tally (counters land exactly on the
 * story's numbers in its formats, an uneven cadence, a stamp after a still beat, the 4 s hold rule,
 * readable errors), the game menu, stingers and damage numbers, and the narration box that never
 * shows empty; every frame a pure function of t in palette indices.
 */
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { compileLevel } from '../level/compile.js';
import { builtInLevel } from '../level/examples.js';
import { checkLevel } from '../level/schema.js';
import { B2_TABLE, T } from '../palette.js';
import { createPath } from '../ray/camera.js';
import { B2World } from '../view/world.js';
import { HudModel } from './model.js';
import { planTally, tallySchema, type TallyInput } from './tally-plan.js';

const fail = (message: string): never => {
  throw new Error(message);
};
const time = (when: number | string): number => (typeof when === 'number' ? when : 0);

const TALLY: TallyInput = {
  intent: 'millions made, far fewer sold, in about five weeks',
  at: 0,
  until: 9.5,
  title: 'CHRISTMAS 1982',
  sub: 'FINISHED',
  rows: [
    { label: 'MADE', value: 4000000, est: true },
    { label: 'SOLD', value: 1500000, est: true, underline: true },
    { label: 'TIME', value: 5, format: 'unit', unit: ['WEEK', 'WEEKS'], approx: true },
    { label: 'PAR', value: 26, format: 'percent', role: 'par' },
    { label: 'BEST', value: 102, format: 'time', role: 'best' },
  ],
  stamp: { text: 'UNSOLD' },
};

function plan(input: TallyInput = TALLY) {
  return planTally(tallySchema.parse(input), time, 7, fail);
}

type Api = Record<string, (...args: unknown[]) => unknown>;

function hudApi(): Api {
  const palette = Object.fromEntries(B2_TABLE.map(([, swatch, hex]) => [swatch, hex]));
  const fx: Readonly<Record<string, unknown>> = createKit({
    three: THREE,
    palette,
    rng: testRng(3),
    style: 'game-b2',
  }).api.fx;
  return (fx['b2Hud'] as (params: Record<string, unknown>) => Api)({ duration: 8, seed: 2 });
}

describe('intermission tally', () => {
  it('counts each row up to its formatted number on an uneven cadence', () => {
    const p = plan();
    expect(p.rows.map((row) => row.final)).toEqual([
      '4,000,000',
      '1,500,000',
      '~5 WEEKS',
      '26%',
      '1:42',
    ]);
    for (const row of p.rows) {
      const gaps = row.times.slice(1).map((t, k) => t - (row.times[k] ?? 0));
      expect(new Set(gaps.map((gap) => gap.toFixed(3))).size).toBeGreaterThan(1);
      expect(row.landed).toBe(row.times.at(-1));
    }
    const made = p.rows[0];
    const values = (made?.texts ?? []).map((text) => Number(text.replace(/,/g, '')));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
    const last = Math.max(...p.rows.map((row) => row.landed));
    expect(p.stamp?.at).toBeCloseTo(last + 0.86, 5);
  });

  it('rejects a hold over 4 s, numbers that land too late and text the face cannot draw', () => {
    expect(() => plan({ ...TALLY, until: 18 })).toThrow(/holds .* hold at most 4 s/);
    expect(() => plan({ ...TALLY, until: 4 })).toThrow(/give it more time/);
    expect(() => plan({ ...TALLY, title: 'NOËL' })).toThrow(/cannot draw: Ë/);
    expect(() => plan({ ...TALLY, rows: [{ label: 'TIME', value: 5, format: 'unit' }] })).toThrow(
      /needs unit/,
    );
    expect(() => tallySchema.parse({ ...TALLY, intent: undefined })).toThrow();
    expect(() => tallySchema.parse({ ...TALLY, rows: [] })).toThrow();
  });

  it('is drawn the same for the same t, melting in from the frame before it', () => {
    const checked = checkLevel(builtInLevel('office'));
    if (!checked.ok) throw new Error('office level');
    const path = createPath(
      [{ at: 0, x: 16, y: 6.5, yaw: -40, pitch: 0, eye: 0.5, ease: 'lin' }],
      1,
    );
    const make = () => {
      const world = new B2World(compileLevel(checked.level), path, 1, 1);
      const hud = new HudModel(1, 9.5);
      hud.tally(plan());
      return { world, hud };
    };
    const times = [0.2, 0.9, 2.2, 4.4, 6.2, 7.6, 9.0, 9.4];
    const hash = ({ world, hud }: ReturnType<typeof make>, t: number) =>
      createHash('sha256')
        .update(hud.draw(t, world.camera(t), world).d)
        .digest('hex');
    const a = make();
    const forward = times.map((t) => hash(a, t));
    const b = make();
    expect(
      [...times]
        .reverse()
        .map((t) => hash(b, t))
        .reverse(),
    ).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    const still = a.hud.draw(4.4, a.world.camera(4.4), a.world).d;
    for (const c of new Set(still)) expect(c === T || c < 32, String(c)).toBe(true);
    expect(still.filter((c) => c === T).length).toBe(0);
  });

  it('needs the view to melt in from a frozen frame', () => {
    expect(() => hudApi()['tally']?.(TALLY)).toThrow(/need the view/);
    const cues = hudApi()['tally']?.({ ...TALLY, backdrop: 'dark', enter: 'cut' }) as {
      cues: { t: number; name: string }[];
    };
    expect(cues.cues.at(-1)?.name).toBe('stamp');
  });
});

describe('menu, stinger, damage and the narration box', () => {
  it('reject a menu without content, two left columns and a cursor on no item', () => {
    const hud = hudApi();
    expect(() => hud['menu']?.({ at: 0, until: 4 })).toThrow(/give a quest/);
    const quest = { now: 'CHRISTMAS 1982', objective: 'SELL E.T.' };
    const stats = { title: 'E.T.', rows: [{ label: 'DEV TIME', value: '~5 WEEKS' }] };
    expect(() => hud['menu']?.({ at: 0, until: 4, quest, stats })).toThrow(/pick one/);
    expect(() =>
      hud['menu']?.({
        at: 0,
        until: 4,
        quest,
        inventory: { items: [{ icon: 'key', label: 'KEY' }], select: [{ at: 1, index: 2 }] },
      }),
    ).toThrow(/no item 2/);
    expect(() => hud['stinger']?.('THIS IS FAR TOO LONG', { at: 0 })).toThrow();
  });

  it('draw a stinger, a damage number and a menu deterministically', () => {
    const hud = new HudModel(4, 8);
    hud.meter({
      label: 'MARKET',
      at: 0,
      until: 8,
      segments: 12,
      keys: [
        [0, 12],
        [2, 8],
      ],
    });
    const [x] = hud.anchorOf('meter', 3);
    expect(x).toBeLessThan(25 + 36 + 6 + 12 * 8);
    hud.damage({ text: '-2', at: 2, x, y: 50, colour: 30 });
    hud.stinger({
      text: 'TOO MANY',
      x: 64,
      y: 112,
      scale: 5,
      lands: [3, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8],
      until: 5,
      seed: 1,
    });
    hud.shake({ at: 3, amp: 2 });
    const hash = (t: number) =>
      createHash('sha256')
        .update(hud.draw(t, undefined, undefined).d)
        .digest('hex');
    const times = [2.1, 3.05, 3.9, 4.8];
    const forward = times.map(hash);
    expect([...times].reverse().map(hash).reverse()).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
  });

  it('never shows an empty narration box: it opens as the first letter lands', () => {
    const hud = new HudModel(5, 8);
    const span = hud.say('ATARI BETS ON A HIT', '', 1, 4);
    const empty = (t: number) => hud.draw(t, undefined, undefined).d.every((c) => c === T);
    expect(empty(1.05)).toBe(true);
    expect(empty(span.end)).toBe(false);
  });
});
