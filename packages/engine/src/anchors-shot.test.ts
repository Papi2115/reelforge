import { describe, expect, it } from 'vitest';
import {
  createExactAnchorResolver,
  pickShotOccurrence,
  shotAnchorResolver,
  type AnchorResolver,
} from './anchors.js';
import type { SceneContext } from './contract.js';
import { buildShot } from './shot.js';
import { resolveStyle } from './style.js';

/** Real run Comic 1, s08 (32.47–36.23 s): "in" is the film's first word and spoken in the shot. */
const words = [
  { text: 'In', t: 0.61, tEnd: 0.8 },
  { text: '1912', t: 0.8, tEnd: 1.4 },
  { text: 'in', t: 20.1, tEnd: 20.2 },
  { text: 'was', t: 33.0, tEnd: 33.2 },
  { text: 'in', t: 33.2, tEnd: 33.35 },
  { text: 'in', t: 35.0, tEnd: 35.1 },
  { text: 'boom', t: 40.0, tEnd: 40.3 },
  { text: 'boom', t: 50.0, tEnd: 50.3 },
];
const shot = { t0: 32.47, t1: 36.23 };
const occurrences = [{ t: 1 }, { t: 20 }, { t: 33 }, { t: 35 }, { t: 40 }];

describe('pickShotOccurrence', () => {
  it('keeps the film-wide occurrence when it lies inside the shot (scenes resolve as before)', () => {
    expect(pickShotOccurrence(occurrences, 3, shot)).toEqual({ t: 33 });
    expect(pickShotOccurrence(occurrences, 4, shot)).toEqual({ t: 35 });
  });

  it('otherwise counts nth from the shot start', () => {
    expect(pickShotOccurrence(occurrences, 1, shot)).toEqual({ t: 33 });
    expect(pickShotOccurrence(occurrences, 2, shot)).toEqual({ t: 35 });
  });

  it('falls back to the nearest following one, then to the film-wide one', () => {
    expect(pickShotOccurrence([{ t: 1 }, { t: 40 }], 1, shot)).toEqual({ t: 40 });
    expect(pickShotOccurrence([{ t: 1 }, { t: 2 }], 2, shot)).toEqual({ t: 2 });
    expect(pickShotOccurrence([{ t: 1 }], 2, shot)).toBeUndefined();
  });

  it('counts a word that starts just before the cut as spoken in the shot', () => {
    expect(pickShotOccurrence([{ t: 1 }, { t: 32.4 }], 1, shot)).toEqual({ t: 32.4 });
  });
});

describe('shotAnchorResolver', () => {
  it('resolves "in" inside the shot, not at 0.61 s', () => {
    const resolve = shotAnchorResolver(createExactAnchorResolver(words), shot);
    expect(resolve('in', 1)).toEqual({ t: 33.2, tEnd: 33.35 });
    expect(resolve('in', 2)).toEqual({ t: 35.0, tEnd: 35.1 });
    expect(resolve('boom', 1)).toEqual({ t: 40.0, tEnd: 40.3 });
    expect(resolve('was in', 1)).toEqual({ t: 33.0, tEnd: 33.35 });
    expect(resolve('nothing', 1)).toBeUndefined();
  });

  it('asks the film-wide resolver once per phrase when the first answer is inside', () => {
    const calls: string[] = [];
    const base = createExactAnchorResolver(words);
    const counting: AnchorResolver = (phrase, nth) => {
      calls.push(`${phrase}#${String(nth)}`);
      return base(phrase, nth);
    };
    const resolve = shotAnchorResolver(counting, shot);
    resolve('was', 1);
    resolve('was', 1);
    expect(calls).toEqual(['was#1']);
  });
});

describe('ctx.anchor in a shot', () => {
  it('returns local time of the occurrence spoken in the shot', () => {
    let hit: { t: number; tEnd: number } | undefined;
    const built = buildShot({
      shot: {
        id: 's08',
        t0: shot.t0,
        duration: shot.t1 - shot.t0,
        width: 640,
        height: 360,
        fps: 30,
      },
      module: {
        meta: { id: 's08' },
        build: (ctx: SceneContext) => {
          hit = ctx.anchor('in');
          return {};
        },
        update: () => undefined,
      },
      projectSeed: 1,
      palette: resolveStyle({}).palette,
      resolveAnchor: createExactAnchorResolver(words),
    });
    expect(hit?.t).toBeCloseTo(33.2 - shot.t0, 6);
    expect(built.anchors).toEqual([{ shotId: 's08', phrase: 'in', nth: 1, t: 33.2, tEnd: 33.35 }]);
  });
});
