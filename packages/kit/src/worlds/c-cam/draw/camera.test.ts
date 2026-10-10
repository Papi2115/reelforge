import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { H, W, ease } from '../core.js';
import { blob } from './shapes.js';
import { makeEnv, type BrushEnv } from './brushes.js';
import {
  FG_INK,
  FRAME,
  ROT_MAX,
  SCREEN_ENV,
  ZOOM_MAX,
  ZOOM_MIN,
  applyCamera,
  clampFraming,
  cutFramingAt,
  fgScreen,
  fgWorld,
  resolveCut,
  screenToWorld,
  silhouette,
  visibleRect,
  worldToScreen,
  type CameraState,
  type Cut,
} from './camera.js';
import { RecordingPaint, type PaintCall } from './recording-paint.js';

/** Replays the transform calls of a recording into a 2D affine matrix [a, b, c, d, e, f]. */
function replayTransform(calls: readonly PaintCall[]): (x: number, y: number) => [number, number] {
  let [a, b, c, d, e, f] = [1, 0, 0, 1, 0, 0];
  const n = (call: PaintCall, i: number): number => Number(call.args[i]);
  for (const call of calls) {
    if (call.op === 'setTransform') {
      [a, b, c, d, e, f] = [n(call, 0), n(call, 1), n(call, 2), n(call, 3), n(call, 4), n(call, 5)];
    }
    if (call.op === 'translate') {
      e += a * n(call, 0) + c * n(call, 1);
      f += b * n(call, 0) + d * n(call, 1);
    }
    if (call.op === 'scale')
      [a, b, c, d] = [a * n(call, 0), b * n(call, 0), c * n(call, 1), d * n(call, 1)];
    if (call.op === 'rotate') {
      const cos = Math.cos(n(call, 0));
      const sin = Math.sin(n(call, 0));
      [a, b, c, d] = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin];
    }
  }
  return (x, y) => [a * x + c * y + e, b * x + d * y + f];
}

const WIDE: Cut = { at: 0, name: 'wide', x: 960, y: 540, z: 1 };
const CU: Cut = { at: 1.03, name: 'cu', x: 700, y: 400, z: 2.2, rot: -4 };
const PUSH: Cut = {
  at: 2.5,
  x: 500,
  y: 500,
  z: 1.5,
  end: 4.5,
  to: { x: 600, y: 450, z: 2, rot: 6 },
};
const TABLE: readonly Cut[] = [WIDE, CU, PUSH];

describe('resolveCut: selection', () => {
  it('holds the first cut before it starts and throws on an empty table', () => {
    const late: Cut[] = [{ ...WIDE, at: 1 }, CU];
    expect(resolveCut(late, 0).index).toBe(0);
    expect(resolveCut(late, -3, 'raw').cut).toBe(late[0]);
    expect(() => resolveCut([], 0)).toThrow(RangeError);
  });

  it('picks the last cut whose `at` has passed (exact boundary included) on raw t', () => {
    expect(resolveCut(TABLE, 1.03, 'raw').index).toBe(1);
    expect(resolveCut(TABLE, 1.0299, 'raw').index).toBe(0);
    expect(resolveCut(TABLE, 2.5, 'raw').index).toBe(2);
    expect(resolveCut(TABLE, 99, 'raw').index).toBe(2);
  });

  it('quantises selection on twos: a cut at 1.03 first shows at 13/12 s', () => {
    expect(resolveCut(TABLE, 1.03).index).toBe(0);
    expect(resolveCut(TABLE, 13 / 12 - 1e-4).index).toBe(0);
    expect(resolveCut(TABLE, 13 / 12).index).toBe(1);
    expect(resolveCut(TABLE, 1.03, 'raw').index).toBe(1);
  });

  it('lands exactly on cuts written as multiples of 1/12 (on twos)', () => {
    const cuts: Cut[] = [WIDE, { ...CU, at: 29 / 12 }];
    expect(resolveCut(cuts, 29 / 12).index).toBe(1);
    expect(resolveCut(cuts, 29 / 12 - 1e-3).index).toBe(0);
  });

  it('returns the cut name and start (film 2 `{ name, t0 }`) and the framing', () => {
    const r = resolveCut(TABLE, 1.5);
    expect([r.cut.name, r.cut.at]).toEqual(['cu', 1.03]);
    expect([r.x, r.y, r.z, r.rot]).toEqual([700, 400, 2.2, -4]);
    expect(resolveCut(TABLE, 0.5).rot).toBe(0);
  });
});

describe('resolveCut / cutFramingAt: moves', () => {
  it('holds the start before `at` and exactly `to` after `end`', () => {
    expect(cutFramingAt(PUSH, 2)).toEqual({ x: 500, y: 500, z: 1.5, rot: 0 });
    expect(cutFramingAt(PUSH, 2.5)).toEqual({ x: 500, y: 500, z: 1.5, rot: 0 });
    expect(cutFramingAt(PUSH, 4.5)).toEqual({ x: 600, y: 450, z: 2, rot: 6 });
    expect(resolveCut(TABLE, 10)).toMatchObject({ x: 600, y: 450, z: 2, rot: 6 });
  });

  it('reads raw t for the move while selection is on twos', () => {
    const t = 3.51;
    const r = resolveCut(TABLE, t);
    const u = ease.inOut((t - 2.5) / 2);
    expect(r.z).toBeCloseTo(1.5 + 0.5 * u, 12);
    expect(r.z).not.toBeCloseTo(cutFramingAt(PUSH, 3.5).z, 6);
  });

  it('default ease inOut passes 0.5 at the midpoint', () => {
    expect(cutFramingAt(PUSH, 3.5).x).toBeCloseTo(550, 12);
    expect(cutFramingAt(PUSH, 3.5).rot).toBeCloseTo(3, 12);
  });

  for (const name of ['lin', 'inOut', 'out', 'back'] as const) {
    it(`ease ${name}: endpoints 0 and 1, interior follows core.ease`, () => {
      const cut: Cut = { ...PUSH, ease: name };
      expect(cutFramingAt(cut, 2.5).z).toBe(1.5);
      expect(cutFramingAt(cut, 2.5 + 1e-12).z).toBeCloseTo(1.5, 9);
      expect(cutFramingAt(cut, 4.5 - 1e-12).z).toBeCloseTo(2, 9);
      expect(cutFramingAt(cut, 4.5).z).toBe(2);
      expect(cutFramingAt(cut, 3).z).toBeCloseTo(1.5 + 0.5 * ease[name](0.25), 12);
    });
  }

  it('does not move on ease "cut", without `to`, or without a valid `end`', () => {
    const still = { x: 500, y: 500, z: 1.5, rot: 0 };
    expect(cutFramingAt({ ...PUSH, ease: 'cut' }, 3.5)).toEqual(still);
    expect(cutFramingAt({ at: 2.5, x: 500, y: 500, z: 1.5, end: 4.5 }, 3.5)).toEqual(still);
    expect(cutFramingAt({ ...PUSH, end: 2.5 }, 3.5)).toEqual(still);
  });

  it('a `to` without rot moves the roll to 0 (film 1 `|| 0`)', () => {
    const cut: Cut = { at: 0, x: 0, y: 0, z: 1, rot: 4, end: 1, to: { x: 0, y: 0, z: 1 } };
    expect(cutFramingAt(cut, 1).rot).toBe(0);
    expect(cutFramingAt(cut, 0.5).rot).toBeCloseTo(2, 12);
  });
});

describe('clamping', () => {
  it('exports the guide ranges', () => {
    expect([ZOOM_MIN, ZOOM_MAX, ROT_MAX]).toEqual([0.8, 5.4, 7]);
  });

  it('clamps zoom and roll, defaults roll to 0', () => {
    expect(clampFraming({ x: 1, y: 2, z: 0.1, rot: -30 })).toEqual({ x: 1, y: 2, z: 0.8, rot: -7 });
    expect(clampFraming({ x: 1, y: 2, z: 9, rot: 8 })).toEqual({ x: 1, y: 2, z: 5.4, rot: 7 });
    expect(clampFraming({ x: 1, y: 2, z: 2 })).toEqual({ x: 1, y: 2, z: 2, rot: 0 });
  });

  it('applyCamera applies the clamped camera (a back overshoot cannot exceed ZOOM_MAX)', () => {
    const cut: Cut = { at: 0, x: 0, y: 0, z: 4, end: 1, ease: 'back', to: { x: 0, y: 0, z: 5.4 } };
    const peak = cutFramingAt(cut, 0.8);
    expect(peak.z).toBeGreaterThan(ZOOM_MAX);
    const g = new RecordingPaint();
    const rig = applyCamera(g, peak);
    expect(rig.cam.z).toBe(ZOOM_MAX);
    expect(rig.env).toEqual(makeEnv(ZOOM_MAX));
    expect(g.toLines()).toContain(`scale ${String(ZOOM_MAX)} ${String(ZOOM_MAX)}`);
  });
});

describe('mapping', () => {
  const cams: CameraState[] = [
    { x: 960, y: 540, z: 1, rot: 0 },
    { x: 1820, y: 160, z: 1.5, rot: -7 },
    { x: 300, y: 1330, z: 5.4, rot: 7 },
    { x: 0, y: 0, z: 0.8, rot: 3.5 },
  ];

  it('the frame centre shows the camera point', () => {
    for (const cam of cams) {
      const p = worldToScreen(cam, cam.x, cam.y);
      expect(p.x).toBeCloseTo(W / 2, 9);
      expect(p.y).toBeCloseTo(H / 2, 9);
      expect(screenToWorld(cam, W / 2, H / 2)).toEqual({ x: cam.x, y: cam.y });
    }
  });

  it('round-trips world -> screen -> world within 1e-9', () => {
    for (const cam of cams) {
      for (const [x, y] of [
        [0, 0],
        [1920, 1080],
        [-300, 2300],
        [733.3, 12.5],
      ] as const) {
        const s = worldToScreen(cam, x, y);
        const w = screenToWorld(cam, s.x, s.y);
        expect(Math.abs(w.x - x)).toBeLessThan(1e-9);
        expect(Math.abs(w.y - y)).toBeLessThan(1e-9);
      }
    }
  });

  it('matches the Paint2D transform that applyCamera records', () => {
    for (const cam of cams) {
      const g = new RecordingPaint();
      const rig = applyCamera(g, cam);
      const apply = replayTransform(g.calls);
      for (const [x, y] of [
        [0, 0],
        [1500, 900],
        [-120, 1300],
      ] as const) {
        const [ex, ey] = apply(x, y);
        expect(rig.toScreen(x, y).x).toBeCloseTo(ex, 7);
        expect(rig.toScreen(x, y).y).toBeCloseTo(ey, 7);
        expect(rig.toWorld(ex, ey).x).toBeCloseTo(x, 7);
      }
    }
  });

  it('positive rot turns the frame clockwise on screen', () => {
    const p = worldToScreen({ x: 0, y: 0, z: 1, rot: 90 }, 100, 0);
    expect(p.x).toBeCloseTo(W / 2, 9);
    expect(p.y).toBeCloseTo(H / 2 + 100, 9);
  });

  it('visibleRect follows the guide formula and bounds the rolled frame corners', () => {
    for (const cam of cams) {
      const r = (cam.rot * Math.PI) / 180;
      const halfW = (960 * Math.abs(Math.cos(r)) + 540 * Math.abs(Math.sin(r))) / cam.z;
      const halfH = (960 * Math.abs(Math.sin(r)) + 540 * Math.abs(Math.cos(r))) / cam.z;
      const rect = visibleRect(cam);
      expect(rect.x0).toBeCloseTo(cam.x - halfW, 9);
      expect(rect.x1).toBeCloseTo(cam.x + halfW, 9);
      expect(rect.y0).toBeCloseTo(cam.y - halfH, 9);
      expect(rect.y1).toBeCloseTo(cam.y + halfH, 9);
      const corners = [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ].map(([x, y]) => screenToWorld(cam, x ?? 0, y ?? 0));
      expect(Math.min(...corners.map((p) => p.x))).toBeCloseTo(rect.x0, 9);
      expect(Math.max(...corners.map((p) => p.y))).toBeCloseTo(rect.y1, 9);
    }
    // camera guide §1 example: film 2's looking-up framing sees x ~ 1141-2499, y ~ -275-595
    const up = visibleRect({ x: 1820, y: 160, z: 1.5, rot: -7 });
    expect([Math.round(up.x0), Math.round(up.x1), Math.round(up.y0), Math.round(up.y1)]).toEqual([
      1141, 2499, -275, 595,
    ]);
    expect(applyCamera(new RecordingPaint(), { x: 960, y: 540, z: 1 }).visibleRect()).toEqual(
      visibleRect({ x: 960, y: 540, z: 1, rot: 0 }, FRAME),
    );
  });
});

describe('Paint2D call sequences', () => {
  it('applyCamera: setTransform, translate, rotate, scale, translate', () => {
    const g = new RecordingPaint();
    const rig = applyCamera(g, { x: 700, y: 400, z: 2, rot: -4 });
    expect(g.toLines()).toEqual([
      'setTransform 1 0 0 1 0 0',
      'translate 960 540',
      `rotate ${String((-4 * Math.PI) / 180)}`,
      'scale 2 2',
      'translate -700 -400',
    ]);
    expect(rig.env).toEqual(makeEnv(2));
    expect(rig.cam).toEqual({ x: 700, y: 400, z: 2, rot: -4 });
  });

  it('applyCamera omits rotate when the roll is 0 or missing', () => {
    for (const rot of [0, undefined]) {
      const g = new RecordingPaint();
      applyCamera(g, rot === undefined ? { x: 960, y: 540, z: 1 } : { x: 960, y: 540, z: 1, rot });
      expect(g.toLines()).toEqual([
        'setTransform 1 0 0 1 0 0',
        'translate 960 540',
        'scale 1 1',
        'translate -960 -540',
      ]);
    }
  });

  it('fgScreen draws under the identity transform with the screen env', () => {
    const g = new RecordingPaint();
    let seen: BrushEnv | undefined;
    fgScreen(g, (env) => {
      seen = env;
      g.fillRect(0, 0, 10, 10);
    });
    expect(seen).toBe(SCREEN_ENV);
    expect(SCREEN_ENV).toEqual({ zoom: 1, lw: 1.4 });
    expect(g.toLines()).toEqual([
      'save',
      'setTransform 1 0 0 1 0 0',
      'fillRect 0 0 10 10',
      'restore',
    ]);
  });

  it('fgWorld re-establishes the rig camera and passes its env', () => {
    const g = new RecordingPaint();
    const rig = applyCamera(g, { x: 500, y: 300, z: 3, rot: 2 });
    const cameraLines = g.toLines();
    g.calls.length = 0;
    let seen: BrushEnv | undefined;
    fgWorld(g, rig, (env) => {
      seen = env;
      blob(g, env, [0, 0, 10, 0, 10, 10], FG_INK.world, { lw: 0 });
    });
    expect(seen).toEqual(rig.env);
    const lines = g.toLines();
    expect(lines[0]).toBe('save');
    expect(lines.slice(1, 1 + cameraLines.length)).toEqual(cameraLines);
    expect(lines.at(-1)).toBe('restore');
  });

  it('silhouette is a path fill under the current transform, film 1 ink by default', () => {
    const g = new RecordingPaint();
    silhouette(g, [0, 0, 100, 0, 50, 80]);
    expect(g.toLines()).toEqual([
      'save',
      'beginPath',
      'moveTo 0 0',
      'lineTo 100 0',
      'lineTo 50 80',
      'closePath',
      'set:fillStyle #1c1715',
      'fill nonzero',
      'restore',
    ]);
    const custom = new RecordingPaint();
    silhouette(custom, [0, 0, 1, 1, 2, 0], FG_INK.screen);
    expect(custom.toLines()).toContain('set:fillStyle #14110e');
    expect(custom.calls.some((call) => call.op === 'setTransform')).toBe(false);
  });

  it('is deterministic: the same input draws the same calls', () => {
    const run = (): string[] => {
      const g = new RecordingPaint();
      const rig = applyCamera(g, resolveCut(TABLE, 3.2));
      silhouette(g, [400, 400, 600, 380, 560, 700]);
      fgWorld(g, rig, (env) => blob(g, env, [0, 0, 40, 0, 40, 40], FG_INK.world, { lw: 0 }));
      fgScreen(g, (env) => blob(g, env, [0, 900, 300, 1080, 0, 1080], FG_INK.screen, { lw: 0 }));
      return g.toLines();
    };
    expect(run()).toEqual(run());
  });
});

describe('camera module hygiene', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const files = ['camera.ts', 'camera-schema.ts', 'camera-coverage.ts'];
  const forbidden =
    /\b(Date|performance|requestAnimationFrame|setTimeout|setInterval|fetch|document|window|createElement|drawImage|console)\b|Math\.random/;

  it('has no forbidden identifiers (comments excluded)', () => {
    for (const file of files) {
      const code = readFileSync(`${dir}${file}`, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(forbidden.exec(code)?.[0], file).toBeUndefined();
    }
  });

  it('keeps every camera file within 400 lines', () => {
    for (const file of [...files, 'camera.test.ts', 'camera-schema.test.ts']) {
      expect(readFileSync(`${dir}${file}`, 'utf8').split('\n').length, file).toBeLessThanOrEqual(
        400,
      );
    }
  });
});
