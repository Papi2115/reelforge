import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeEnv } from './brushes.js';
import { pose, type PoseName, type Vec3 } from './poses.js';
import { RecordingPaint } from './recording-paint.js';
import { solve } from './rig-layers.js';
import {
  FOOT_TILT,
  armStyleSchema,
  drawArm,
  drawFoot,
  drawLeg,
  legStyleSchema,
  type ArmStyle,
  type LegStyle,
} from './rig-limbs.js';
import { viewState } from './rig-views.js';
import {
  BARE_ARM,
  BARE_LEG,
  COMMANDER,
  SHIRT_ARM,
  SUIT_ARM,
  SUIT_LEG,
  YAWS,
  expectSameDrawing,
  loadRigOriginal,
  origFn,
} from './rig-test-support.js';

const original = loadRigOriginal();
const orig = (name: string): ((...args: unknown[]) => unknown) => origFn(original, name);

const POSES: readonly [PoseName, number][] = [
  ['stand', 0],
  ['armsUp', 0],
  ['walk', 0.3],
  ['akimbo', 0],
];

const ARMS: readonly ArmStyle[] = [
  SUIT_ARM,
  BARE_ARM,
  SHIRT_ARM,
  { ...SUIT_ARM, hand: 'open', seed: 391 },
  { ...BARE_ARM, hand: 'point', hair: false },
  { ...SHIRT_ARM, hand: 'none' },
];
const LEGS: readonly LegStyle[] = [
  SUIT_LEG,
  BARE_LEG,
  { ...BARE_LEG, skin: undefined, seed: 400 },
].map((leg) => legStyleSchema.parse(JSON.parse(JSON.stringify(leg))));

describe('drawArm / drawLeg / drawFoot (vs the original recordings)', () => {
  it('drawArm matches for every view, mirror, pose and arm style', () => {
    for (const yaw of YAWS) {
      const V = viewState(yaw);
      for (const [name, ph] of POSES) {
        const J = solve(V, COMMANDER, pose(name, COMMANDER, ph));
        for (const st of ARMS) {
          for (const j of [J.aL, J.aR]) {
            expectSameDrawing(
              original,
              (g) => orig('drawArm')(g, j, st),
              (g, env) => {
                drawArm(g, env, j, st);
              },
            );
          }
        }
      }
    }
  });

  it('drawLeg matches for every view, mirror, pose and leg style', () => {
    for (const yaw of YAWS) {
      const V = viewState(yaw);
      const legacyV = orig('view')(yaw);
      for (const [name, ph] of POSES) {
        const J = solve(V, COMMANDER, pose(name, COMMANDER, ph));
        for (const st of LEGS) {
          for (const [j, sgn] of [
            [J.lL, 1],
            [J.lR, -1],
          ] as const) {
            expectSameDrawing(
              original,
              (g) => orig('drawLeg')(g, legacyV, j, sgn, st),
              (g, env) => {
                drawLeg(g, env, V, j, sgn, st);
              },
            );
          }
        }
      }
    }
  });

  it('matches at other zooms (ink width follows the env)', () => {
    const V = viewState(1);
    const J = solve(V, COMMANDER, pose('armsUp', COMMANDER));
    for (const zoom of [0.5, 2.4]) {
      expectSameDrawing(
        original,
        (g) => orig('drawArm')(g, J.aL, BARE_ARM),
        (g, env) => {
          drawArm(g, env, J.aL, BARE_ARM);
        },
        zoom,
      );
      expectSameDrawing(
        original,
        (g) => orig('drawLeg')(g, orig('view')(1), J.lR, -1, SUIT_LEG),
        (g, env) => {
          drawLeg(g, env, V, J.lR, -1, SUIT_LEG);
        },
        zoom,
      );
    }
  });

  it('drawFoot matches on its own and tilts forward-pointing feet down', () => {
    const A: Vec3 = [30, -10, 20];
    for (const yaw of YAWS) {
      for (const sgn of [1, -1]) {
        expectSameDrawing(
          original,
          (g) => orig('drawFoot')(g, orig('view')(yaw), A, sgn, BARE_LEG),
          (g, env) => {
            drawFoot(g, env, viewState(yaw), A, sgn, BARE_LEG);
          },
        );
      }
    }
    expect(FOOT_TILT).toBe(0.16);
  });

  it('a bare shin without skinD skips the shadow crescent instead of an undefined fill', () => {
    const V = viewState(0);
    const J = solve(V, COMMANDER, pose('stand', COMMANDER));
    const noShade = legStyleSchema.parse(
      JSON.parse(JSON.stringify({ ...BARE_LEG, skinD: undefined })),
    );
    const g = new RecordingPaint();
    drawLeg(g, makeEnv(1), V, J.lL, 1, noShade);
    expect(g.toLines().some((line) => line.includes('undefined'))).toBe(false);
    expect(g.calls.length).toBeGreaterThan(0);
  });
});

describe('styles', () => {
  it('the schemas accept the film styles and reject broken ones', () => {
    for (const st of [SUIT_ARM, BARE_ARM, SHIRT_ARM]) expect(armStyleSchema.parse(st)).toEqual(st);
    for (const st of [SUIT_LEG, BARE_LEG]) expect(legStyleSchema.parse(st)).toEqual(st);
    expect(armStyleSchema.safeParse({ ...SUIT_ARM, w: [1, 2] }).success).toBe(false);
    expect(armStyleSchema.safeParse({ ...SUIT_ARM, bare: 1.5 }).success).toBe(false);
    expect(armStyleSchema.safeParse({ ...SUIT_ARM, hand: 'thumb' }).success).toBe(false);
    expect(armStyleSchema.safeParse({ ...SUIT_ARM, hsz: 0 }).success).toBe(false);
    expect(legStyleSchema.safeParse({ ...SUIT_LEG, len: Number.NaN }).success).toBe(false);
    expect(legStyleSchema.safeParse({ ...SUIT_LEG, shoe: undefined }).success).toBe(false);
  });
});

describe('determinism', () => {
  it('the same call twice gives the same recording', () => {
    const run = (): string[] => {
      const g = new RecordingPaint();
      const env = makeEnv(1.3);
      const V = viewState(-1);
      const J = solve(V, COMMANDER, pose('jig', COMMANDER, 0.4));
      drawArm(g, env, J.aL, BARE_ARM);
      drawArm(g, env, J.aR, SUIT_ARM);
      drawLeg(g, env, V, J.lL, 1, SUIT_LEG);
      drawLeg(g, env, V, J.lR, -1, BARE_LEG);
      return g.toLines();
    };
    const first = run();
    expect(first.length).toBeGreaterThan(50);
    expect(run()).toEqual(first);
  });
});

describe('module hygiene of the 14.5 files', () => {
  const files = ['rig-views.ts', 'rig-ik.ts', 'rig-layers.ts', 'rig-limbs.ts', 'character.ts'];
  const forbidden =
    /\b(Date|performance|document|window|requestAnimationFrame|setTimeout|setInterval|fillText|strokeText|filter|fetch)\b|Math\.random/;

  it('has no forbidden identifiers (comments excluded) and stays within 400 lines', () => {
    for (const name of files) {
      const source = readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(forbidden.exec(code)?.[0], name).toBeUndefined();
      expect(source.split('\n').length, name).toBeLessThanOrEqual(400);
    }
  });
});
