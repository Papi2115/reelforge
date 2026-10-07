/**
 * The wow-transition budget under a genre preset's multiplier (ADR-035): scale 1 / absent = the
 * checks as before; a livelier genre allows closer and more wow moments, a calmer one warns
 * earlier but never adds hard errors.
 */
import { storyboardShotSchema, type StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkStoryboard } from './storyboard.js';
import { checkWowTransitions } from './wow.js';

const STYLES = ['paper-roll', 'cube-smash', 'sponge-wipe', 'page-turn', 'shatter', 'enter-window'];

/** Contiguous 5-s shots up to `end`; a wow style into the shots at `wows` (all different). */
function film(end: number, wows: readonly number[]): StoryboardShot[] {
  const shots: StoryboardShot[] = [];
  for (let t0 = 0; t0 < end; t0 += 5) {
    const id = `s${String(t0 / 5).padStart(2, '0')}`;
    const at = wows.indexOf(t0);
    shots.push(
      storyboardShotSchema.parse({
        id,
        t0,
        t1: t0 + 5,
        treatment: 'map',
        intent: 'x',
        scene: `scenes/${id}.js`,
        ...(at === -1
          ? {}
          : { transitionIn: { type: 'wipe', duration: 1, style: STYLES[at] ?? 'shatter' } }),
      }),
    );
  }
  return shots;
}

const codes = (shots: readonly StoryboardShot[], scale?: number): string[] =>
  checkWowTransitions(shots, scale).map((entry) => `${entry.severity}:${entry.code}`);

/** Five wow moments 30 s apart in a 3-minute film. */
const EVERY_30_S = film(180, [20, 50, 80, 110, 140]);

describe('wow budget by genre multiplier', () => {
  const fourGaps = Array.from({ length: 4 }, () => 'warning:wow-spacing');
  it('checks exactly as before at scale 1', () => {
    expect(codes(EVERY_30_S, 1)).toEqual(codes(EVERY_30_S));
    expect(codes(EVERY_30_S)).toEqual([...fourGaps, 'warning:wow-budget']);
    const plain = checkWowTransitions(EVERY_30_S).find((entry) => entry.code === 'wow-spacing');
    expect(plain?.message).toContain('keep them about 40–90 s apart');
  });

  it.each([
    // [scale, issues of five moments 30 s apart in 180 s]
    [1.5, []],
    [1.25, fourGaps],
    [0.5, [...fourGaps, 'warning:wow-budget']],
  ])('scale %s: %j', (scale, expected) => {
    expect(codes(EVERY_30_S, scale)).toEqual(expected);
  });

  it('names the scaled pace and budget in its messages', () => {
    const calm = checkWowTransitions(EVERY_30_S, 0.5);
    expect(calm.find((entry) => entry.code === 'wow-spacing')?.message).toContain(
      'keep them about 80–180 s apart',
    );
    expect(calm.find((entry) => entry.code === 'wow-budget')?.message).toContain(
      'at most 2 (about one per 80 s)',
    );
  });

  it('lets a lively genre come closer but keeps a hard floor', () => {
    const close = film(120, [20, 40, 60]);
    expect(codes(close)).toContain('error:wow-spacing');
    expect(codes(close, 1.5)).toEqual(['warning:wow-spacing', 'warning:wow-spacing']);
    expect(codes(film(120, [20, 30]), 2)).toContain('error:wow-spacing');
  });

  it('reaches the validator through the storyboard options', () => {
    const storyboard = { version: 1 as const, shots: EVERY_30_S };
    const wowCodes = (wowScale?: number): string[] =>
      checkStoryboard(storyboard, wowScale === undefined ? {} : { wowScale })
        .filter((entry) => entry.code.startsWith('wow-'))
        .map((entry) => `${entry.severity}:${entry.code}`);
    expect(wowCodes()).toEqual(codes(EVERY_30_S));
    expect(wowCodes(1.5)).toEqual([]);
  });
});
