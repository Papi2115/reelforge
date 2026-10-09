/** Portrait (9:16) render size, ctx.shot and camera aspect (PLAN.md#13.18). */
import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from './anchors.js';
import type { SceneContext, ShotInfo } from './contract.js';
import { defaultLowerThirdScale, defaultTitleScale, shortEdge } from './text/cards.js';
import { buildShot } from './shot.js';
import { resolveStyle } from './style.js';

describe('resolveStyle format', () => {
  it('keeps the landscape size of every built-in style without a format', () => {
    expect(resolveStyle({})).toMatchObject({ format: 'landscape', width: 640, height: 360 });
    expect(resolveStyle({ style: 'soft-480', format: 'landscape' })).toMatchObject({
      width: 480,
      height: 270,
    });
  });

  it('turns the style upright in portrait', () => {
    expect(resolveStyle({ format: 'portrait' })).toMatchObject({
      format: 'portrait',
      width: 360,
      height: 640,
    });
    expect(resolveStyle({ style: 'soft-480', format: 'portrait' })).toMatchObject({
      width: 270,
      height: 480,
    });
  });

  it('checks a pinned size against the oriented size', () => {
    expect(resolveStyle({ format: 'portrait', width: 360, height: 640 }).height).toBe(640);
    expect(() => resolveStyle({ format: 'portrait', width: 640, height: 360 })).toThrow(
      /do not match style/,
    );
  });
});

describe('portrait shots', () => {
  function shotContext(width: number, height: number): { info: ShotInfo; aspect: number } {
    let seen: ShotInfo | undefined;
    const built = buildShot({
      shot: { id: 's01', t0: 0, duration: 2, width, height, fps: 30 },
      module: {
        meta: { id: 's01' },
        build: (ctx: SceneContext) => {
          seen = ctx.shot;
          return {};
        },
        update: () => undefined,
      },
      projectSeed: 1,
      palette: resolveStyle({}).palette,
      resolveAnchor: NO_ANCHORS,
    });
    if (seen === undefined) throw new Error('build() was not called');
    return { info: seen, aspect: built.camera.aspect };
  }

  it('gives scenes the aspect and format, and the camera the portrait aspect', () => {
    const portrait = shotContext(360, 640);
    expect(portrait.info).toMatchObject({ width: 360, height: 640, format: 'portrait' });
    expect(portrait.info.aspect).toBeCloseTo(0.5625);
    expect(portrait.aspect).toBeCloseTo(0.5625);
    const landscape = shotContext(640, 360);
    expect(landscape.info.format).toBe('landscape');
    expect(landscape.aspect).toBeCloseTo(640 / 360);
  });

  it('sizes default text by the short edge (portrait = landscape sizes)', () => {
    expect(shortEdge({ width: 360, height: 640 })).toBe(360);
    expect(defaultTitleScale(shortEdge({ width: 360, height: 640 }))).toBe(defaultTitleScale(360));
    expect(defaultLowerThirdScale(shortEdge({ width: 640, height: 360 }))).toBe(2);
  });
});
