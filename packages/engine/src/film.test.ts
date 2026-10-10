import { describe, expect, it } from 'vitest';
import { createExactAnchorResolver } from './anchors.js';
import type { FilmInfo, SceneContext, SceneModule } from './contract.js';
import { EngineError } from './errors.js';
import { filmPlaceOf } from './film.js';
import { buildShot, type ShotInput } from './shot.js';
import { resolveStyle } from './style.js';

const palette = resolveStyle({}).palette;
const shot = { id: 's03', t0: 10, duration: 4, width: 640, height: 360, fps: 30 };
const WORDS = [
  { text: 'gum', t: 2, tEnd: 2.4 },
  { text: 'pop', t: 31, tEnd: 31.3 },
];

function input(module: SceneModule, overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    shot,
    module,
    projectSeed: 5,
    palette,
    resolveAnchor: createExactAnchorResolver(WORDS),
    ...overrides,
  };
}

/** A scene that records what it saw of ctx.film in build and in every update. */
function recorder(): { module: SceneModule; seen: FilmInfo[] } {
  const seen: FilmInfo[] = [];
  const module: SceneModule = {
    meta: { id: 's03' },
    build: (ctx: SceneContext) => {
      seen.push(ctx.film);
      return null;
    },
    update: (_t, _state, ctx) => {
      seen.push(ctx.film);
    },
  };
  return { module, seen };
}

describe('ctx.film (PLAN.md#14.19)', () => {
  it('gives film time, progress and the place of the shot', () => {
    const { module, seen } = recorder();
    const film = { duration: 40, shotIndex: 2, shotCount: 9 };
    const built = buildShot(input(module, { film }));
    built.update(1.5);
    const [atBuild, atUpdate] = seen;
    expect(atBuild).toMatchObject({ t: 10, shotT0: 10, shotIndex: 2, shotCount: 9, duration: 40 });
    expect(atUpdate?.t).toBe(11.5);
    expect(atUpdate?.progress).toBeCloseTo(11.5 / 40);
    expect(built.info.t0).toBe(10);
  });

  it('resolves anchors anywhere in the film in film seconds, and throws when not spoken', () => {
    const { module, seen } = recorder();
    buildShot(input(module, { film: { duration: 40, shotIndex: 2, shotCount: 9 } }));
    const film = seen[0];
    expect(film?.anchor('pop')).toEqual({ t: 31, tEnd: 31.3 });
    expect(film?.anchor('gum')).toEqual({ t: 2, tEnd: 2.4 });
    expect(() => film?.anchor('never said')).toThrow(EngineError);
  });

  it('treats a shot without a film place as the whole film', () => {
    const { module, seen } = recorder();
    buildShot(input(module)).update(4);
    expect(seen[1]).toMatchObject({ duration: 14, shotIndex: 0, shotCount: 1, progress: 1 });
  });

  it('reads the place from the manifest, or the isolated manifest overrides', () => {
    const first = { id: 'a', t0: 0, t1: 3 };
    const second = { id: 'b', t0: 3, t1: 8 };
    expect(filmPlaceOf({ shots: [first, second] }, 1)).toEqual({
      duration: 8,
      shotIndex: 1,
      shotCount: 2,
    });
    const isolated = {
      film: { duration: 60, shotCount: 12 },
      shots: [first, { ...second, filmIndex: 7 }],
    };
    expect(filmPlaceOf(isolated, 1)).toEqual({ duration: 60, shotIndex: 7, shotCount: 12 });
  });

  it('is the same value for the same time (determinism)', () => {
    const first = recorder();
    const second = recorder();
    const film = { duration: 40, shotIndex: 2, shotCount: 9 };
    buildShot(input(first.module, { film })).update(2.25);
    buildShot(input(second.module, { film })).update(2.25);
    const strip = (info: FilmInfo | undefined): unknown => ({ ...info, anchor: undefined });
    expect(strip(first.seen[1])).toEqual(strip(second.seen[1]));
  });
});
