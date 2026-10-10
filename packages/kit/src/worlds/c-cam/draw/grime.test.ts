import { describe, expect, it } from 'vitest';
import { C } from '../core.js';
import { DEFAULT_ENV, makeEnv, type BrushEnv } from './brushes.js';
import {
  cobbles,
  crack,
  flies,
  house,
  peel,
  puddle,
  stain,
  windowPane,
  type HouseFrame,
  type HouseOptions,
} from './grime.js';
import { loadOriginal } from './original.js';
import type { Paint2D } from './paint.js';
import { RecordingPaint } from './recording-paint.js';

const original = loadOriginal(['grime.js']);
type Fn = (...args: unknown[]) => unknown;
const orig = (name: string): Fn => original[name] as unknown as Fn;

/** Draws the same thing with the original (globals) and the port (explicit env); compares the calls. */
function both(
  legacy: (g: Paint2D) => unknown,
  port: (g: Paint2D, env: BrushEnv) => unknown,
  zoom = 1,
): void {
  const a = new RecordingPaint();
  const b = new RecordingPaint();
  original.LW = Math.pow(zoom, -0.55);
  original.camZ = zoom;
  legacy(a);
  port(b, makeEnv(zoom));
  expect(b.toLines()).toEqual(a.toLines());
  expect(a.calls.length).toBeGreaterThan(0);
}

/** One drawing call recorded on its own. */
function record(draw: (g: Paint2D) => void): string[] {
  const g = new RecordingPaint();
  draw(g);
  return g.toLines();
}

describe('equivalence with the original grime.js (same zoom -> same calls)', () => {
  for (const zoom of [1, 2.5, 0.4]) {
    it(`stain / peel / crack / puddle at zoom ${String(zoom)}`, () => {
      for (const seed of [1, 7, 42]) {
        both(
          (g) => orig('stain')(g, 100, 80, 60, 40, seed, undefined),
          (g, env) => {
            stain(g, env, 100, 80, 60, 40, seed);
          },
          zoom,
        );
        both(
          (g) => orig('stain')(g, 0, 0, 90, 50, seed, C.RUST_D),
          (g, env) => {
            stain(g, env, 0, 0, 90, 50, seed, C.RUST_D);
          },
          zoom,
        );
        both(
          (g) => orig('peel')(g, 30, 40, 80, 60, seed),
          (g, env) => {
            peel(g, env, 30, 40, 80, 60, seed);
          },
          zoom,
        );
        both(
          (g) => orig('crack')(g, 10, 10, 90, seed, undefined),
          (g, env) => {
            crack(g, env, 10, 10, 90, seed);
          },
          zoom,
        );
        both(
          (g) => orig('crack')(g, 10, 10, 60, seed, -0.4),
          (g, env) => {
            crack(g, env, 10, 10, 60, seed, -0.4);
          },
          zoom,
        );
        both(
          (g) => orig('puddle')(g, 300, 900, 120, seed, undefined),
          (g, env) => {
            puddle(g, env, 300, 900, 120, seed);
          },
          zoom,
        );
        both(
          (g) => orig('puddle')(g, 300, 900, 80, seed, C.GREYBLUE),
          (g, env) => {
            puddle(g, env, 300, 900, 80, seed, C.GREYBLUE);
          },
          zoom,
        );
      }
    });

    it(`cobbles / window / house at zoom ${String(zoom)}`, () => {
      both(
        (g) => orig('cobbles')(g, -50, 700, 900, 1080, 3, undefined, undefined),
        (g, env) => {
          cobbles(g, env, -50, 700, 900, 1080, 3);
        },
        zoom,
      );
      both(
        (g) => orig('cobbles')(g, 0, 600, 500, 760, 8, C.STONE, C.STONE_D),
        (g, env) => {
          cobbles(g, env, 0, 600, 500, 760, 8, C.STONE, C.STONE_D);
        },
        zoom,
      );
      for (const lit of [false, true]) {
        both(
          (g) => orig('window')(g, 200, 300, 50, 70, 4, lit),
          (g, env) => {
            windowPane(g, env, 200, 300, 50, 70, 4, lit);
          },
          zoom,
        );
      }
      const variants: HouseOptions[] = [
        { seed: 1 },
        { seed: 4, lean: 30, floors: 2, lit: true, peel: false, jetty: 20 },
        { seed: 9, beam: 14, plaster: C.PLASTER, roof: 120, roofLean: -15, roofCol: C.RUST_D },
      ];
      for (const o of variants) {
        let legacyFrame: HouseFrame | undefined;
        let portFrame: HouseFrame | undefined;
        both(
          (g) => {
            legacyFrame = orig('house')(g, 200, 900, 420, 600, o) as HouseFrame;
          },
          (g, env) => {
            portFrame = house(g, env, 200, 900, 420, 600, o);
          },
          zoom,
        );
        expect(portFrame?.top).toBe(legacyFrame?.top);
        expect(portFrame?.roofTop).toBe(legacyFrame?.roofTop);
        for (const y of [900, 700, 400]) {
          expect(portFrame?.left(y)).toBe(legacyFrame?.left(y));
          expect(portFrame?.right(y)).toBe(legacyFrame?.right(y));
        }
      }
    });
  }

  it('flies jitter like the original at every frame', () => {
    for (let frame = 0; frame < 48; frame += 1) {
      const t = frame / 24;
      both(
        (g) => orig('flies')(g, 500, 400, t, 6),
        (g) => {
          flies(g, 500, 400, t, 6);
        },
      );
    }
  });
});

describe('placement comes from the seed only', () => {
  const env = DEFAULT_ENV;
  const draws: [string, (g: Paint2D, seed: number) => void][] = [
    [
      'stain',
      (g, seed) => {
        stain(g, env, 0, 0, 80, 50, seed);
      },
    ],
    [
      'peel',
      (g, seed) => {
        peel(g, env, 0, 0, 80, 50, seed);
      },
    ],
    [
      'crack',
      (g, seed) => {
        crack(g, env, 0, 0, 80, seed);
      },
    ],
    [
      'cobbles',
      (g, seed) => {
        cobbles(g, env, 0, 600, 400, 800, seed);
      },
    ],
    ['house', (g, seed) => void house(g, env, 0, 800, 300, 400, { seed })],
    [
      'puddle',
      (g, seed) => {
        puddle(g, env, 0, 0, 90, seed);
      },
    ],
    [
      'flies',
      (g, seed) => {
        flies(g, 0, 0, 1, seed);
      },
    ],
  ];

  for (const [name, draw] of draws) {
    it(`${name}: stable for a seed, different across seeds`, () => {
      const a = record((g) => {
        draw(g, 5);
      });
      expect(
        record((g) => {
          draw(g, 5);
        }),
      ).toEqual(a);
      expect(
        record((g) => {
          draw(g, 6);
        }),
      ).not.toEqual(a);
    });
  }

  it('flies hold for a twos frame and move on the next one', () => {
    const at = (t: number): string[] =>
      record((g) => {
        flies(g, 0, 0, t, 2);
      });
    expect(at(1 + 1 / 24)).toEqual(at(1));
    expect(at(1 + 2 / 24)).not.toEqual(at(1));
  });
});
