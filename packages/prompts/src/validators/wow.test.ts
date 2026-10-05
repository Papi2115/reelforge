import {
  assignTransitionStyles,
  storyboardShotSchema,
  transitionHash,
  WOW_RULES,
  wowOccurrences,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { validateStoryboard } from './storyboard.js';
import { checkWowTransitions } from './wow.js';

interface Spec {
  readonly t0: number;
  readonly length?: number;
  readonly style?: string;
  readonly duration?: number;
  readonly focus?: { readonly x: number; readonly y: number };
  readonly hook?: boolean;
  readonly scaleSequence?: boolean;
}

/** Contiguous 5-s shots (unless `length`), the given transitions into them. */
function film(specs: readonly Spec[]): StoryboardShot[] {
  return specs.map((spec, index) => {
    const id = `s${String(index).padStart(2, '0')}`;
    const transitionIn =
      spec.style === undefined && spec.focus === undefined
        ? undefined
        : {
            type: 'wipe' as const,
            duration: spec.duration ?? 1,
            ...(spec.style === undefined ? {} : { style: spec.style }),
            ...(spec.focus === undefined ? {} : { focus: spec.focus }),
          };
    return storyboardShotSchema.parse({
      id,
      t0: spec.t0,
      t1: spec.t0 + (spec.length ?? 5),
      treatment: 'map',
      intent: 'x',
      scene: `scenes/${id}.js`,
      ...(transitionIn === undefined ? {} : { transitionIn }),
      ...(spec.hook === undefined ? {} : { hook: spec.hook }),
      ...(spec.scaleSequence === undefined ? {} : { scaleSequence: spec.scaleSequence }),
    });
  });
}

/** Shots every 5 s up to `end`, with the wow transitions of `wows` (t0 -> spec). */
function timeline(end: number, wows: Readonly<Record<number, Omit<Spec, 't0'>>>): StoryboardShot[] {
  const specs: Spec[] = [];
  for (let t0 = 0; t0 < end; t0 += 5) specs.push({ t0, ...(wows[t0] ?? {}) });
  return film(specs);
}

const codes = (shots: readonly StoryboardShot[]): string[] =>
  checkWowTransitions(shots).map((entry) => `${entry.severity}:${entry.code}`);

describe('wow transition checks', () => {
  it('accepts a well spaced film and says nothing without wow styles', () => {
    expect(codes(timeline(180, {}))).toEqual([]);
    expect(
      codes(
        timeline(180, {
          20: { style: 'enter-lens' },
          75: { style: 'shatter' },
          150: { style: 'dive-in' },
        }),
      ),
    ).toEqual([]);
  });

  it('keeps the first 6 s clear except an enter-* into a hook shot', () => {
    expect(codes(timeline(60, { 5: { style: 'shatter' } }))).toEqual(['error:wow-early']);
    expect(codes(timeline(60, { 5: { style: 'enter-keyhole', hook: true } }))).toEqual([]);
    expect(codes(timeline(60, { 5: { style: 'page-turn', hook: true } }))).toEqual([
      'error:wow-early',
    ]);
  });

  it('spaces wow moments: error under 25 s, warning under 40 s, with a film budget', () => {
    expect(codes(timeline(120, { 20: { style: 'enter-lens' }, 40: { style: 'shatter' } }))).toEqual(
      ['error:wow-spacing'],
    );
    expect(codes(timeline(120, { 20: { style: 'enter-lens' }, 50: { style: 'shatter' } }))).toEqual(
      ['warning:wow-spacing'],
    );
    const crowded = codes(timeline(60, { 10: { style: 'enter-lens' }, 40: { style: 'shatter' } }));
    expect(crowded).toEqual(['warning:wow-spacing', 'warning:wow-budget']);
    const packed = codes(
      timeline(60, {
        10: { style: 'enter-lens' },
        35: { style: 'shatter' },
        55: { style: 'page-turn' },
      }),
    );
    expect(packed).toEqual(['warning:wow-spacing', 'error:wow-spacing', 'error:wow-budget']);
  });

  it('never allows two in a row unless dives continue a scale sequence', () => {
    expect(codes(timeline(90, { 20: { style: 'dive-in' }, 25: { style: 'dive-in' } }))).toEqual([
      'error:wow-in-a-row',
      'error:wow-spacing',
      'warning:wow-repeat',
    ]);
    const sequence = timeline(90, {
      15: { scaleSequence: true },
      20: { style: 'dive-out', scaleSequence: true },
      25: { style: 'dive-out', scaleSequence: true },
      30: { style: 'dive-out', scaleSequence: true },
    });
    expect(wowOccurrences(sequence).map((moment) => moment.chained)).toEqual([false, true, true]);
    expect(codes(sequence)).toEqual([]);
    const long = timeline(90, {
      15: { scaleSequence: true },
      20: { style: 'dive-in', scaleSequence: true },
      25: { style: 'dive-in', scaleSequence: true },
      30: { style: 'dive-in', scaleSequence: true },
      35: { style: 'dive-in', scaleSequence: true },
      40: { style: 'dive-in', scaleSequence: true },
    });
    expect(codes(long)).toEqual(['warning:wow-scale-sequence']);
    expect(
      codes(
        timeline(90, {
          20: { style: 'enter-lens' },
          25: { style: 'dive-in', scaleSequence: true },
        }),
      ),
    ).toContain('error:wow-in-a-row');
  });

  it('flags the same style within 90 s, a transition longer than its shot and a stray focus', () => {
    expect(codes(timeline(200, { 20: { style: 'shatter' }, 100: { style: 'shatter' } }))).toEqual([
      'warning:wow-repeat',
    ]);
    expect(codes(timeline(200, { 20: { style: 'shatter' }, 115: { style: 'shatter' } }))).toEqual(
      [],
    );
    const short = film([
      { t0: 0, length: 10 },
      { t0: 10, length: 1, style: 'enter-window', duration: 1.2 },
      { t0: 11 },
    ]);
    expect(codes(short)).toEqual(['error:wow-too-long']);
    expect(
      codes(timeline(60, { 20: { style: 'iris', duration: 0.5, focus: { x: 0.3, y: 0.3 } } })),
    ).toEqual(['warning:transition-focus']);
    expect(codes(timeline(60, { 20: { style: 'enter-lens', focus: { x: 0.3, y: 0.3 } } }))).toEqual(
      [],
    );
  });

  it('is part of the storyboard validator; a focus outside the frame does not parse', () => {
    const shots = timeline(60, { 20: { style: 'enter-lens' }, 30: { style: 'shatter' } });
    const text = JSON.stringify({ version: 1, shots });
    expect(validateStoryboard(text).issues.map((entry) => entry.code)).toContain('wow-spacing');
    const outside = JSON.stringify({
      version: 1,
      shots: shots.map((shot, index) =>
        index === 4
          ? { ...shot, transitionIn: { type: 'wipe', duration: 1, focus: { x: 1.5, y: 0 } } }
          : shot,
      ),
    });
    expect(validateStoryboard(outside).valid).toBe(false);
  });

  it('holds over a synthetic 8-minute storyboard picked by content', () => {
    const intents = [
      'A detective searches the room for clues.',
      'The archive of old records.',
      'Someone watching the port from a distance.',
      'The secret behind the locked door.',
      'The system crash takes the bank down.',
      'A simple chart.',
      'The history books of the city.',
    ];
    const shots: StoryboardShot[] = [];
    let t = 0;
    for (let index = 0; t < 480; index += 1) {
      const length = 3 + (transitionHash(`len${String(index)}`) % 5);
      const id = `s${String(index).padStart(3, '0')}`;
      shots.push(
        storyboardShotSchema.parse({
          id,
          t0: t,
          t1: t + length,
          treatment: 'map',
          intent: intents[index % intents.length],
          scene: `scenes/${id}.js`,
          ...(index % 3 === 0 && index > 0
            ? { transitionIn: { type: 'crossfade', duration: 0.5 } }
            : {}),
        }),
      );
      t += length;
    }
    const { shots: assigned } = assignTransitionStyles(shots, 2115);
    const moments = wowOccurrences(assigned);
    expect(moments.length).toBeGreaterThanOrEqual(3);
    expect(moments.every((moment) => moment.t >= WOW_RULES.hookS)).toBe(true);
    expect(checkWowTransitions(assigned)).toEqual([]);
  });
});
