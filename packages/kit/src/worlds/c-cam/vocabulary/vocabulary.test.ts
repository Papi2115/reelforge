/**
 * Grim Ink vocabulary (PLAN.md#14.20): every drawing entry of props / instruments / crowd / fx
 * draws with its defaults and with every value of its kind / state / other word options; the same
 * options give the same strokes call for call and another seed different ones; options out of
 * range or unknown fail with the docs topic; effects draw nothing outside [t0, t0 + dur]; the
 * docs line of every entry names all of its options; no clock, randomness or network in the
 * sources; scenes reach the families on `env.ink`, modules on `ink` (bound).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { DEFAULT_ENV, makeEnv } from '../draw/brushes.js';
import { RecordingPaint } from '../draw/recording-paint.js';
import { inkTools } from '../modules/ink-tools.js';
import { STAGE_INK_NAMES, stageInk } from '../stage-ink.js';
import { ACTING_ITEMS } from './acting.js';
import type { DrawItem } from './common.js';
import { CROWD_ITEMS } from './crowd.js';
import { FX_DRAW_ITEMS, FX_RUN_ITEMS } from './fx.js';
import { VOCAB, VOCAB_FAMILIES, VOCAB_NAMES, vocabDocs } from './index.js';
import { INSTRUMENT_ITEMS } from './instruments.js';
import { PROPS_ITEMS } from './props.js';

type AnyDraw = (g: RecordingPaint, e: typeof DEFAULT_ENV, opts?: unknown) => unknown;

/** Options needed by entries that have no meaningful default (the console's elements). */
const REQUIRED: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  'instruments.console': {
    elements: [
      { type: 'gauge', value: 0.3 },
      { type: 'lever', pull: 1 },
    ],
  },
};

const DRAW_FAMILIES: Readonly<Record<string, Readonly<Record<string, DrawItem>>>> = {
  props: PROPS_ITEMS,
  instruments: INSTRUMENT_ITEMS,
  crowd: CROWD_ITEMS,
  fx: FX_DRAW_ITEMS,
};

function drawOf(family: string, name: string): AnyDraw {
  const ns = (VOCAB as unknown as Readonly<Record<string, Readonly<Record<string, AnyDraw>>>>)[
    family
  ];
  const fn = ns?.[name];
  if (!fn) throw new Error(`no ${family}.${name}`);
  return fn;
}

const isObject = (schema: z.ZodType): schema is z.ZodObject<Record<string, z.ZodType>> =>
  schema instanceof z.ZodObject;

/** Word options of a schema: key -> every allowed value (enums under defaults / optionals). */
function wordOptions(schema: z.ZodType): [string, readonly string[]][] {
  if (!isObject(schema)) return [];
  const out: [string, readonly string[]][] = [];
  for (const [key, field] of Object.entries(schema.shape)) {
    let inner: z.ZodType = field;
    while (inner instanceof z.ZodDefault || inner instanceof z.ZodOptional)
      inner = inner.unwrap() as z.ZodType;
    if (inner instanceof z.ZodEnum) out.push([key, inner.options.map(String)]);
  }
  return out;
}

const fills = (g: RecordingPaint): number => g.calls.filter((call) => call.op === 'fill').length;

function paint(
  family: string,
  name: string,
  opts: Readonly<Record<string, unknown>>,
): RecordingPaint {
  const g = new RecordingPaint();
  drawOf(family, name)(g, DEFAULT_ENV, { ...REQUIRED[`${family}.${name}`], ...opts });
  return g;
}

/** fx entries draw only inside [t0, t0 + dur]; the sheet times put them in the middle. */
const hasTime = (schema: z.ZodType): boolean => isObject(schema) && 't' in schema.shape;

describe('Grim Ink vocabulary: drawing entries', () => {
  for (const [family, items] of Object.entries(DRAW_FAMILIES)) {
    for (const [name, item] of Object.entries(items)) {
      it(`${family}.${name} draws its defaults and every word option`, () => {
        const timed = hasTime(item.schema) ? { t: 0.1 } : {};
        expect(fills(paint(family, name, timed)), 'defaults').toBeGreaterThan(0);
        for (const [key, values] of wordOptions(item.schema)) {
          for (const value of values) {
            const g = paint(family, name, { ...timed, [key]: value });
            expect(fills(g) + g.calls.length, `${key}: ${value}`).toBeGreaterThan(0);
          }
        }
      });

      it(`${family}.${name} is a pure function of its options (seeded)`, () => {
        const timed = hasTime(item.schema) ? { t: 0.1 } : {};
        const a = paint(family, name, { ...timed, seed: 77 });
        const b = paint(family, name, { ...timed, seed: 77 });
        expect(b.calls).toEqual(a.calls);
        const c = paint(family, name, { ...timed, seed: 78 });
        expect(c.calls).not.toEqual(a.calls);
      });

      it(`${family}.${name} documents every option`, () => {
        const keys = isObject(item.schema) ? Object.keys(item.schema.shape) : [];
        for (const key of keys)
          expect(item.params, key).toMatch(new RegExp(`\\b${key.replace('.', '\\.')}\\b`));
      });
    }
  }

  it('fails with the docs topic on a value out of range or an unknown option', () => {
    const g = new RecordingPaint();
    expect(() => VOCAB.props.door(g, DEFAULT_ENV, { wear: 2 })).toThrow(KitError);
    expect(() => VOCAB.props.door(g, DEFAULT_ENV, { wear: 2 })).toThrow(
      /env\.ink\.props\.door: wear.*kit-docs ink-props/,
    );
    expect(() => VOCAB.props.lamp(g, DEFAULT_ENV, { kind: 'neon' as 'bulb' })).toThrow(/kind/);
    expect(() => VOCAB.instruments.gauge(g, DEFAULT_ENV, { valu: 1 } as never)).toThrow(
      /kit-docs ink-instruments/,
    );
    expect(() => VOCAB.crowd.rows(g, DEFAULT_ENV, { rows: 40 })).toThrow(/kit-docs ink-crowd/);
    expect(() => VOCAB.props.weapon(g, DEFAULT_ENV, { tone: 'PINK' })).toThrow(/tone/);
    expect(() =>
      VOCAB.instruments.console(g, DEFAULT_ENV, { elements: [{ type: 'gauge', value: 3 }] }),
    ).toThrow(/elements\[0\] \(gauge\)/);
  });

  it('draws effects only inside [t0, t0 + dur] and offsets a shake only then', () => {
    for (const name of Object.keys(FX_DRAW_ITEMS)) {
      const before = paint('fx', name, { t: 0.9, t0: 1 });
      const after = paint('fx', name, { t: 9, t0: 1, dur: 2 });
      expect(before.calls, name).toEqual([]);
      expect(after.calls, name).toEqual([]);
      expect(fills(paint('fx', name, { t: 1.1, t0: 1, dur: 2 })) + 1, name).toBeGreaterThan(1);
    }
    expect(VOCAB.fx.shake({ t: 0.5, t0: 1 })).toEqual([0, 0]);
    expect(Math.abs(VOCAB.fx.shake({ t: 1.05, t0: 1, px: 8 })[0])).toBe(8);
    expect(Object.keys(FX_RUN_ITEMS)).toEqual(['shake']);
  });

  it('returns the points to put hands and things on', () => {
    const g = new RecordingPaint();
    const lever = VOCAB.instruments.lever(g, DEFAULT_ENV, { x: 500, y: 600, pull: 1 });
    const pulled = lever.points['grip'];
    const rest = VOCAB.instruments.lever(g, DEFAULT_ENV, { x: 500, y: 600, pull: 0 }).points[
      'grip'
    ];
    expect(pulled?.[0]).toBeGreaterThan(rest?.[0] ?? Infinity);
    const lamp = VOCAB.props.lamp(g, DEFAULT_ENV, { kind: 'candle', level: 0.2 });
    expect(lamp.light?.color).toBeDefined();
    expect(VOCAB.props.lamp(g, DEFAULT_ENV, { state: 'out' }).light).toBeUndefined();
    const keypad = VOCAB.instruments.keypad(g, DEFAULT_ENV, { cols: 3, rows: 4, press: 5 });
    expect(keypad.labels).toHaveLength(12);
    const board = VOCAB.props.paper(g, DEFAULT_ENV, { kind: 'book', state: 'open' });
    expect(board.label?.size).toBeGreaterThan(0);
    const console_ = VOCAB.instruments.console(
      g,
      DEFAULT_ENV,
      REQUIRED['instruments.console'] as never,
    );
    expect(Object.keys(console_.points)).toEqual(['e0', 'e1']);
  });
});

describe('Grim Ink vocabulary: docs, sources and wiring', () => {
  it('lists every entry of every family in its docs', () => {
    expect([...VOCAB_FAMILIES]).toEqual(['props', 'instruments', 'crowd', 'acting', 'fx']);
    for (const family of VOCAB_FAMILIES) {
      const docs = vocabDocs(family);
      expect(docs.map((entry) => entry.name)).toEqual(VOCAB_NAMES[family]);
      for (const entry of docs) expect(entry.doc.length, entry.name).toBeGreaterThan(20);
    }
    expect(VOCAB_NAMES.props.length).toBeGreaterThanOrEqual(20);
    expect(VOCAB_NAMES.acting).toEqual(Object.keys(ACTING_ITEMS));
  });

  it('has no clock, randomness, timers or network in its sources', () => {
    const dir = import.meta.dirname;
    for (const file of readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    )) {
      const source = readFileSync(path.join(dir, file), 'utf8');
      expect(source, file).not.toMatch(
        /\bDate\b|Math\.random|performance\.|requestAnimationFrame|setTimeout|setInterval|\bfetch\(/,
      );
      expect(source.split('\n').length, file).toBeLessThanOrEqual(400);
    }
  });

  it('is on env.ink for scenes and bound on ink for people / places modules', () => {
    for (const family of VOCAB_FAMILIES) expect(STAGE_INK_NAMES).toContain(family);
    const g = new RecordingPaint();
    const ink = stageInk(g);
    expect(ink.props).toBe(VOCAB.props);
    const bound = new RecordingPaint();
    const tools = inkTools(bound, makeEnv(2));
    tools.props.door({ x: 0, y: 0 });
    const direct = new RecordingPaint();
    VOCAB.props.door(direct, makeEnv(2), { x: 0, y: 0 });
    expect(bound.calls).toEqual(direct.calls);
    expect(tools.acting).toBe(VOCAB.acting);
    expect(tools.fx.shake({ t: 1.05, t0: 1 })).toEqual(VOCAB.fx.shake({ t: 1.05, t0: 1 }));
  });
});
