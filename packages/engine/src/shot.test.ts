import { describe, expect, it } from 'vitest';
import { createExactAnchorResolver, NO_ANCHORS } from './anchors.js';
import type { SceneContext, SceneModule } from './contract.js';
import { EngineError } from './errors.js';
import { toSceneModule } from './scene-module.js';
import { buildShot, type ShotInput } from './shot.js';
import { resolveStyle } from './style.js';

const palette = resolveStyle({}).palette;

const shot = { id: 's02', t0: 10, duration: 4, width: 640, height: 360, fps: 30 };

function input(module: SceneModule, overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    shot,
    module,
    projectSeed: 5,
    palette,
    resolveAnchor: createExactAnchorResolver([{ text: 'boom', t: 11.5, tEnd: 12 }]),
    ...overrides,
  };
}

function scene(
  build: (ctx: SceneContext) => unknown,
  update: SceneModule['update'] = () => undefined,
): SceneModule {
  return { meta: { id: 's02' }, build, update };
}

describe('toSceneModule', () => {
  it('accepts a module namespace that follows the contract', () => {
    const namespace = {
      meta: { id: 's01', treatment: 'title-card' },
      build: () => ({}),
      update: () => undefined,
    };
    expect(toSceneModule(namespace, 'scenes/s01.js', 's01').meta).toEqual({
      id: 's01',
      treatment: 'title-card',
    });
  });

  it('lists every contract violation in one error', () => {
    const attempt = (): SceneModule =>
      toSceneModule({ meta: { title: 3 } }, 'scenes/bad.js', 'bad');
    expect(attempt).toThrow(EngineError);
    expect(attempt).toThrow(
      /scenes\/bad\.js: .*meta.*id.*missing "export function build\(ctx\)".*missing "export function update/,
    );
  });
});

describe('buildShot', () => {
  it('resolves anchors to local time and collects cues in global time', () => {
    const built = buildShot(
      input(
        scene((ctx) => {
          const hit = ctx.anchor('Boom');
          ctx.sfx.at(hit.t, 'hit');
          ctx.sfx.at(0, 'whoosh');
          return hit;
        }),
      ),
    );
    expect(built.cues).toEqual([
      { t: 11.5, name: 'hit', shotId: 's02' },
      { t: 10, name: 'whoosh', shotId: 's02' },
    ]);
  });

  it('records the anchors resolved in build() in global time, not those of update()', () => {
    const built = buildShot(
      input(
        scene(
          (ctx) => ctx.anchor('Boom', 1),
          (_t, _state, ctx) => {
            ctx.anchor('boom');
          },
        ),
      ),
    );
    built.update(0);
    expect(built.anchors).toEqual([{ shotId: 's02', phrase: 'Boom', nth: 1, t: 11.5, tEnd: 12 }]);
  });

  it('gives update() a fresh, seeded RNG on every call', () => {
    const seen: number[] = [];
    const module = scene(
      () => null,
      (_t, _state, ctx) => {
        seen.push(ctx.rng());
      },
    );
    const built = buildShot(input(module));
    built.update(0);
    built.update(1);
    buildShot(input(module)).update(2);
    expect(new Set(seen).size).toBe(1);
    buildShot(input(module, { projectSeed: 6 })).update(0);
    expect(new Set(seen).size).toBe(2);
  });

  it('rejects sfx.at in update and missing anchors with typed errors', () => {
    const sfxInUpdate = buildShot(
      input(
        scene(
          () => null,
          (_t, _s, ctx) => {
            ctx.sfx.at(0, 'hit');
          },
        ),
      ),
    );
    expect(() => {
      sfxInUpdate.update(0);
    }).toThrow(expect.objectContaining({ code: 'sfx-outside-build' }));
    const missingAnchor = (): unknown =>
      buildShot(
        input(
          scene((ctx) => ctx.anchor('boom')),
          { resolveAnchor: NO_ANCHORS },
        ),
      );
    expect(missingAnchor).toThrow(
      expect.objectContaining({ code: 'anchor-not-found', shotId: 's02' }),
    );
  });

  it('wraps scene exceptions and rejects async build', () => {
    const throwing = (): unknown =>
      buildShot(
        input(
          scene(() => {
            throw new TypeError('kaput');
          }),
        ),
      );
    expect(throwing).toThrow('[shot s02] build() threw TypeError: kaput');
    const asyncBuild = (): unknown => buildShot(input(scene(() => Promise.resolve(1))));
    expect(asyncBuild).toThrow(/must be synchronous/);
  });

  it('positions the default camera and lets scenes move it', () => {
    const built = buildShot(
      input(
        scene(
          () => null,
          (t, _s, ctx) => {
            ctx.camera.set({ position: [t, 1, 5], fov: 40 });
          },
        ),
      ),
    );
    expect(built.camera.position.toArray()).toEqual([0, 2, 8]);
    built.update(3);
    expect(built.camera.position.toArray()).toEqual([3, 1, 5]);
    expect(built.camera.fov).toBe(40);
    expect(built.camera.aspect).toBeCloseTo(16 / 9);
  });

  it('binds camera rigs to the shot camera with the shot length as default end', () => {
    const poses: unknown[] = [];
    const built = buildShot(
      input(
        scene(
          () => null,
          (t, _s, ctx) => {
            poses.push(
              ctx.camera.pushIn({ dist: [8, 4], direction: [0, 0, 1], ease: 'linear' })(t),
            );
          },
        ),
      ),
    );
    built.update(2);
    expect(poses).toEqual([{ position: [0, 0, 6], target: [0, 0, 0] }]);
    expect(built.camera.position.toArray()).toEqual([0, 0, 6]);
    built.update(4);
    expect(built.camera.position.toArray()).toEqual([0, 0, 4]);
  });

  it('seeds ctx.camera.shake from the shot and keeps it a pure function of t', () => {
    const positions = (projectSeed: number): number[][] => {
      const seen: number[][] = [];
      const built = buildShot(
        input(
          scene(
            () => null,
            (t, _s, ctx) => {
              ctx.camera.shake({ position: [0, 1, 5] }, { amplitude: 0.5 })(t);
              seen.push(ctx.camera.object.position.toArray());
            },
          ),
          { projectSeed },
        ),
      );
      for (const t of [0.3, 1.7, 0.3]) built.update(t);
      return seen;
    };
    const first = positions(5);
    expect(first[2]).toEqual(first[0]);
    expect(first[1]).not.toEqual(first[0]);
    expect(positions(5)).toEqual(first);
    expect(positions(6)).not.toEqual(first);
  });

  it('exposes palette tokens and easings', () => {
    let seen: { sky: string; navy: string | undefined; eased: number } | undefined;
    buildShot(
      input(
        scene((ctx) => {
          seen = {
            sky: ctx.palette.sky,
            navy: ctx.palette['navy'],
            eased: ctx.ease.easeInOutCubic(0.5),
          };
          return null;
        }),
      ),
    );
    expect(seen).toEqual({ sky: '#0b0f2a', navy: '#0b0f2a', eased: 0.5 });
  });

  it('gives build() a kit bound to the style and seals it for update()', () => {
    const built = buildShot(
      input(
        scene(
          (ctx) => {
            const model = ctx.kit.voxel.box([2, 2, 2], 'hero');
            const object = ctx.kit.voxel.mesh(model);
            ctx.scene.add(object);
            return { model };
          },
          (_t, state, ctx) => {
            const { model } = state as { model: Parameters<typeof ctx.kit.voxel.mesh>[0] };
            expect(ctx.kit.voxel.count(model)).toBe(8);
            ctx.kit.voxel.mesh(model);
          },
        ),
      ),
    );
    expect(built.scene.children).toHaveLength(1);
    expect(() => {
      built.update(0);
    }).toThrow(/update\(0\) threw .*kit\.voxel\.mesh\(\) was called in update\(\)/);
  });
});
