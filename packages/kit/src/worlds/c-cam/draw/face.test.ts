import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { C, twos } from '../core.js';
import { makeEnv, type BrushEnv } from './brushes.js';
import {
  EXPR,
  EXPR_NAMES,
  exprAt,
  face,
  isExprName,
  pores,
  stubble,
  wart,
  type ExprCue,
  type FaceOptions,
  type FaceState,
} from './face.js';
import { brow, eye, mouth, type MouthOptions, type TeethSet } from './face-parts.js';
import { HAND_KINDS, hand } from './hand.js';
import { LegacyRecordingPaint, loadOriginal } from './original.js';
import type { Paint2D } from './paint.js';
import { RecordingPaint } from './recording-paint.js';

const original = loadOriginal(['face.js']);
type Fn = (...args: unknown[]) => unknown;
const orig = (name: string): Fn => original[name] as unknown as Fn;

/** Draws the same thing with the original (globals) and the port (explicit env); compares the calls. */
function both(
  legacy: (g: LegacyRecordingPaint) => unknown,
  port: (g: Paint2D, env: BrushEnv) => unknown,
  zoom = 1,
): void {
  const a = new LegacyRecordingPaint();
  const b = new RecordingPaint();
  original.LW = Math.pow(zoom, -0.55);
  original.camZ = zoom;
  const legacyReturn = legacy(a);
  const portReturn = port(b, makeEnv(zoom));
  expect(b.toLines()).toEqual(a.toLines());
  expect(a.calls.length).toBeGreaterThan(0);
  expect(portReturn).toEqual(legacyReturn);
}

const SKIN = C.SKIN_RUDDY;
const TALK: FaceOptions = { talk: [[0.2, 1.4]], talkAmp: 0.6 };

describe('expression table', () => {
  it('has exactly the 14 named expressions of the original, value for value', () => {
    expect(EXPR_NAMES).toHaveLength(14);
    expect(Object.keys(EXPR)).toEqual([...EXPR_NAMES]);
    expect(EXPR).toEqual(original['EXPR']);
    for (const name of EXPR_NAMES) expect(isExprName(name)).toBe(true);
  });

  it('resolves the face state like the original (blink, talk, overrides)', () => {
    const options: (FaceOptions | undefined)[] = [
      undefined,
      TALK,
      { noBlink: true, look: [0.4, -0.2] },
      { talk: [[0, 3]] },
    ];
    for (const name of EXPR_NAMES) {
      for (const o of options) {
        for (let t = 0; t < 4; t += 0.13) {
          expect(face(t, 11, name, o)).toEqual(orig('face')(t, 11, name, o));
        }
      }
    }
  });

  it('falls back to deadpan for unknown names, including inherited keys', () => {
    const unknown = face(0, 3, 'grumpy', { noBlink: true });
    expect(unknown).toEqual({ ...face(0, 3, 'deadpan', { noBlink: true }), name: 'grumpy' });
    expect(isExprName('constructor')).toBe(false);
    expect(face(0, 3, 'constructor', { noBlink: true }).lid).toBe(EXPR.deadpan.lid);
  });

  it('talking opens flat and frown mouths and drops the jaw', () => {
    const quiet = face(0.5, 4, 'deadpan', { noBlink: true });
    let open: FaceState | undefined;
    for (let t = 0.2; t < 1.4 && !open; t += 1 / 12) {
      const f = face(t, 4, 'deadpan', { ...TALK, noBlink: true });
      if (f.jaw > 0) open = f;
    }
    expect(quiet.mouth).toBe('flat');
    expect(open?.mouth).toBe('open');
  });
});

describe('expression track (exprAt)', () => {
  const cues: ExprCue[] = [
    [0, 'miserable'],
    [2.4, 'shock'],
    [3.1, 'deadpan'],
  ];

  it('is deadpan for an empty track and holds the first cue before its time', () => {
    expect(exprAt([], 5)).toBe('deadpan');
    expect(exprAt([[1, 'rage']], 0.2)).toBe('rage');
  });

  it('snaps on the acting clock (twos), never between two twos frames', () => {
    expect(exprAt(cues, 2.3)).toBe('miserable');
    // 2.41 s is still on the twos frame 28/12 = 2.333 s; the change lands on 29/12 = 2.4167 s.
    expect(exprAt(cues, 2.41)).toBe('miserable');
    expect(exprAt(cues, 29 / 12)).toBe('shock');
    expect(exprAt(cues, 3.5)).toBe('deadpan');
    for (let frame = 0; frame < 24 * 4; frame += 1) {
      const t = frame / 24;
      expect(exprAt(cues, t)).toBe(exprAt(cues, twos(t)));
    }
  });
});

describe('equivalence with the original face.js (same zoom -> same calls)', () => {
  const states = (t: number): FaceState[] =>
    EXPR_NAMES.flatMap((name) => [face(t, 7, name), face(t, 7, name, TALK)]);

  for (const zoom of [1, 2.5]) {
    it(`eye at zoom ${String(zoom)}`, () => {
      for (const f of states(0.6)) {
        both(
          (g) => orig('eye')(g, 40, 50, 11, 12, f, { skin: SKIN, seed: 4, side: 0, bags: 2 }),
          (g, env) => {
            eye(g, env, 40, 50, 11, 12, f, { skin: SKIN, seed: 4, side: 0, bags: 2 });
          },
          zoom,
        );
        const extra = { skin: SKIN, side: 1, lidAdd: 0.3, bag: false, white: C.LINEN, lw: 4 };
        both(
          (g) => orig('eye')(g, 0, 0, 9, 10, f, extra),
          (g, env) => {
            eye(g, env, 0, 0, 9, 10, f, { ...extra, side: 1 });
          },
          zoom,
        );
      }
    });

    it(`brow at zoom ${String(zoom)}`, () => {
      for (const f of states(0.6)) {
        for (const side of [-1, 1] as const) {
          both(
            (g) => orig('brow')(g, 20, -30, 34, side, f, {}),
            (g, env) => {
              brow(g, env, 20, -30, 34, side, f);
            },
            zoom,
          );
          const o = { u: 14, thick: 12, color: '#2e241c', seed: 3, arch: 0, droop: 4 };
          both(
            (g) => orig('brow')(g, 20, -30, 34, side, f, o),
            (g, env) => {
              brow(g, env, 20, -30, 34, side, f, o);
            },
            zoom,
          );
        }
      }
    });

    it(`mouth (closed and open, every teeth set) at zoom ${String(zoom)}`, () => {
      const teethSets: (TeethSet | undefined)[] = [undefined, 'snag', 'gap', 'row', 'none'];
      for (const f of states(0.75)) {
        for (const [i, teeth] of teethSets.entries()) {
          const o: MouthOptions = {
            seed: 5 + i,
            open: i === 4 ? 6 : 26,
            under: i % 2 ? [[-0.4, 9]] : [],
            ...(teeth === undefined ? {} : { teeth }),
          };
          both(
            (g) => orig('mouth')(g, 0, 40, 46, f, o),
            (g, env) => mouth(g, env, 0, 40, 46, f, o),
            zoom,
          );
        }
      }
    });

    it(`hand (every kind) and skin marks at zoom ${String(zoom)}`, () => {
      for (const kind of HAND_KINDS) {
        both(
          (g) => orig('hand')(g, 10, 20, 35, 40, SKIN, kind, undefined),
          (g, env) => {
            hand(g, env, 10, 20, 35, 40, SKIN, kind);
          },
          zoom,
        );
        const o = { seed: 3, shade: C.SKIN_RUDDY_D, lw: 4 };
        both(
          (g) => orig('hand')(g, -5, 0, -120, 110, SKIN, kind, o),
          (g, env) => {
            hand(g, env, -5, 0, -120, 110, SKIN, kind, o);
          },
          zoom,
        );
      }
      const region = [-56, -60, -50, 4, 0, 18, 50, 4, 58, -60, 30, -44, -30, -44];
      both(
        (g) => orig('stubble')(g, region, 8, 120, undefined),
        (g, env) => {
          stubble(g, env, region, 8, 120);
        },
        zoom,
      );
      both(
        (g) => orig('stubble')(g, region, 9, 40, 'rgba(30,22,18,0.65)'),
        (g, env) => {
          stubble(g, env, region, 9, 40, 'rgba(30,22,18,0.65)');
        },
        zoom,
      );
      both(
        (g) => orig('wart')(g, 30, -40, 6, C.SKIN_CLAY_D, undefined, true),
        (g, env) => {
          wart(g, env, 30, -40, 6, C.SKIN_CLAY_D, undefined, true);
        },
        zoom,
      );
      both(
        (g) => orig('wart')(g, 30, -40, 4, C.SKIN_CLAY_D, 12, false),
        (g, env) => {
          wart(g, env, 30, -40, 4, C.SKIN_CLAY_D, 12, false);
        },
        zoom,
      );
      both(
        (g) => orig('pores')(g, -40, -80, 60, 30, 9, 3, undefined),
        (g) => {
          pores(g, -40, -80, 60, 30, 9, 3);
        },
        zoom,
      );
    });
  }
});

describe('determinism', () => {
  it('same call twice = same recording', () => {
    const run = (): string[] => {
      const g = new RecordingPaint();
      const env = makeEnv(1.4);
      const f = face(1.3, 9, 'rage', TALK);
      eye(g, env, -24, -90, 11, 12, f, { skin: SKIN, seed: 2, bags: 2 });
      brow(g, env, -24, -110, 34, -1, f, { u: 14 });
      mouth(g, env, 0, -24, 46, f, { open: 26, teeth: 'gap', under: [[0.3, 8]] });
      hand(g, env, 80, 0, 20, 40, SKIN, 'point');
      stubble(g, env, [-50, -60, 0, 18, 50, -60, 0, -44], 3, 60);
      return g.toLines();
    };
    expect(run()).toEqual(run());
  });
});

describe('module hygiene of the 14.4 files', () => {
  const files = ['face.ts', 'face-parts.ts', 'hand.ts', 'grime.ts', 'poses.ts'];
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
