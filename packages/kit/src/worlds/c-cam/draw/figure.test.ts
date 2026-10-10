import { describe, expect, it } from 'vitest';
import { DEFAULT_ENV, makeEnv } from './brushes.js';
import type { Character } from './character.js';
import { drawFigure, resolveView, solvePose, type DrawFigureOptions } from './figure.js';
import { pose, type Pose, type PoseName } from './poses.js';
import { RecordingPaint } from './recording-paint.js';
import { proj, viewState, type View } from './rig-views.js';
import { armLayer, solve, FIGURE_ORDER } from './rig-layers.js';
import { TEST_CHARACTER, WARDEN_DIMS as D } from './test-character.js';

const PLACE = { x: 960, y: 980, s: 0.8 };

/** The test character with marker colours, so the recording shows which part was drawn when. */
const SPY: Character = {
  ...TEST_CHARACTER,
  tones: { skin: 'neck', skinD: 'neck-shade' },
  arm: {
    cloth: 'arm',
    clothD: 'arm-shade',
    w: [34, 30, 26],
    skin: 'hand',
    skinD: 'hand-shade',
    hsz: 38,
  },
  leg: { ...TEST_CHARACTER.leg, cloth: 'leg' },
  torso: (g) => {
    g.fillStyle = 'torso';
  },
  head: (g) => {
    g.fillStyle = 'head';
  },
};

const MARKERS = new Set(['neck', 'arm', 'leg', 'torso', 'head', 'before', 'after']);

const hooks: DrawFigureOptions = {
  beforeHand: () => undefined,
  after: () => undefined,
};

/** The marker sequence of one drawFigure call. */
function events(P: Pose, yaw: number, opts: DrawFigureOptions = {}): string[] {
  const g = new RecordingPaint();
  drawFigure(g, DEFAULT_ENV, SPY, PLACE, P, yaw, undefined, 0, {
    ...opts,
    beforeHand: () => {
      g.fillStyle = 'before';
    },
    after: () => {
      g.fillStyle = 'after';
    },
  });
  const out: string[] = [];
  for (const c of g.calls) {
    const v = c.args[0];
    if (c.op === 'set:fillStyle' && typeof v === 'string' && MARKERS.has(v)) out.push(v);
  }
  return out;
}

describe('resolveView / solvePose', () => {
  it('reads view names as unmirrored and numbers as signed yaws', () => {
    const names: readonly View[] = ['front', 'three-quarter', 'profile', 'back'];
    names.forEach((name, v) => {
      expect(resolveView(name)).toEqual(viewState(v));
    });
    expect(resolveView(-2)).toEqual(viewState(-2));
  });

  it('solvePose is the rig solve for the character', () => {
    const P = pose('walk', D, 0.3);
    expect(solvePose(TEST_CHARACTER, P, 'profile')).toEqual(solve(viewState(2), D, P));
    expect(solvePose(TEST_CHARACTER, P, -1)).toEqual(solve(viewState(-1), D, P));
  });
});

describe('drawFigure', () => {
  it('follows FIGURE_ORDER: far arm, legs, neck + torso, raised arms, head, hook, near arms, hook', () => {
    expect(FIGURE_ORDER).toEqual([
      'arms-behind',
      'legs',
      'torso',
      'arms-raised',
      'head',
      'before-hand',
      'arms-front',
      'after',
    ]);
    const stand = pose('stand', D);
    // front: both arms in front of everything
    expect(events(stand, 0)).toEqual([
      'leg',
      'leg',
      'neck',
      'torso',
      'head',
      'before',
      'arm',
      'arm',
      'after',
    ]);
    // profile: the far (left) arm behind the body, the near one in front
    expect(events(stand, 2)).toEqual([
      'arm',
      'leg',
      'leg',
      'neck',
      'torso',
      'head',
      'before',
      'arm',
      'after',
    ]);
    // both arms raised: over the torso, under the head
    const up = pose('armsUp', D);
    expect(events(up, 0)).toEqual([
      'leg',
      'leg',
      'neck',
      'torso',
      'arm',
      'arm',
      'head',
      'before',
      'after',
    ]);
    // a forced layer moves one raised arm in front of the face
    expect(events(up, 0, { layer: { L: 2 } })).toEqual([
      'leg',
      'leg',
      'neck',
      'torso',
      'arm',
      'head',
      'before',
      'arm',
      'after',
    ]);
  });

  it('draws each arm in the layer armLayer gives it', () => {
    const poses: readonly PoseName[] = ['stand', 'akimbo', 'point', 'armsUp', 'walk', 'clasp'];
    for (const name of poses) {
      for (const yaw of [0, 1, 2, 3, -1, -2, -3]) {
        const P = pose(name, D, 1);
        const V = viewState(yaw);
        const J = solve(V, D, P);
        const neckY = TEST_CHARACTER.neck[V.v][1] + J.bob;
        const layers = [armLayer(J.aL, neckY), armLayer(J.aR, neckY)];
        const count = (l: number): number =>
          layers.reduce<number>((n, x) => n + (x === l ? 1 : 0), 0);
        const expected = [
          ...Array<string>(count(0)).fill('arm'),
          'leg',
          'leg',
          'neck',
          'torso',
          ...Array<string>(count(1)).fill('arm'),
          'head',
          'before',
          ...Array<string>(count(2)).fill('arm'),
          'after',
        ];
        expect(events(P, yaw), `${name} yaw ${String(yaw)}`).toEqual(expected);
      }
    }
  });

  it('is deterministic: the same call twice records the same drawing', () => {
    const P = pose('walk', D, 0.4);
    const draw = (): string[] => {
      const g = new RecordingPaint();
      // prettier-ignore
      drawFigure(g, makeEnv(1.3), TEST_CHARACTER, { ...PLACE, lean: 4, bow: 12 }, P, -1, 'smug', 2.5, { headYaw: -2, headDy: 6, talk: [[2, 3]], ...hooks });
      return g.toLines();
    };
    const a = draw();
    expect(a.length).toBeGreaterThan(500);
    expect(draw()).toEqual(a);
  });

  it('applies bow, head scale / flip and the head jolt', () => {
    const P = pose('stand', D);
    const lines = (
      place: typeof PLACE & { bow?: number },
      opts: DrawFigureOptions = {},
    ): string[] => {
      const g = new RecordingPaint();
      drawFigure(g, DEFAULT_ENV, TEST_CHARACTER, place, P, 2, undefined, 0, opts);
      return g.toLines();
    };
    const bowRad = `rotate ${String((20 * Math.PI) / 180)}`;
    expect(lines(PLACE)).not.toContain(bowRad);
    expect(lines({ ...PLACE, bow: 20 })).toContain(bowRad);
    const k = TEST_CHARACTER.headScale;
    expect(lines(PLACE)).toContain(`scale ${String(k)} ${String(k)}`);
    expect(lines(PLACE, { headYaw: -1 })).toContain(`scale ${String(-k)} ${String(k)}`);
    const [hx, hy] = [TEST_CHARACTER.neck[2][2] ?? 0, TEST_CHARACTER.neck[2][3] ?? 0];
    expect(lines(PLACE, { headDy: 9 })).toContain(`translate ${String(hx)} ${String(hy + 9)}`);
  });

  it('keeps hands off the face through the guard in every view', () => {
    const head = D.head;
    if (!head) throw new Error('test character needs a head box');
    for (const yaw of [0, 1, 2, 3, -1, -2, -3]) {
      const V = viewState(yaw);
      // aim both hands straight at the middle of the face
      const onFace: Pose = { ...pose('stand', D), hL: [0, -690, 40], hR: [-4, -700, 40] };
      const J = drawFigure(
        new RecordingPaint(),
        DEFAULT_ENV,
        TEST_CHARACTER,
        PLACE,
        onFace,
        yaw,
        undefined,
        0,
      );
      for (const j of [J.aL, J.aR]) {
        const inBand = j.h[1] >= head.top + J.bob && j.h[1] <= head.bottom + J.bob;
        // the guard slides the target to hw + 34; the IK may stop the wrist a little short of it
        if (inBand) expect(Math.abs(j.h[0] - head.x[V.v])).toBeGreaterThan(head.hw);
      }
      // without the guard (no head box) the same target would sit on the face
      const free = solve(V, { ...D, head: undefined }, onFace).aL.h;
      expect(Math.abs(free[0] - head.x[V.v])).toBeLessThan(head.hw + 34);
      expect(proj(V, onFace.hL)[1]).toBeLessThan(head.bottom);
    }
  });
});
