import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { C } from '../core.js';
import {
  DEFAULT_ENV,
  bbox,
  brushStroke,
  camera,
  curve,
  figure,
  inkLine,
  makeEnv,
  type BrushEnv,
} from './brushes.js';
import { blob, ellipseRing, hatch, mottle, tube, type BlobOptions } from './shapes.js';
import { loadOriginal } from './original.js';
import { asPaint2D, type Paint2D } from './paint.js';
import { RecordingPaint } from './recording-paint.js';
import { beam, bands, bricks, gloom, pool, rect, rough, stars, wobble } from './scenery.js';

const original = loadOriginal();
type Fn = (...args: unknown[]) => unknown;
const orig = (name: string): Fn => original[name] as unknown as Fn;

/** Draws the same thing with the original (globals) and the port (explicit env) and compares the calls. */
function both(
  legacy: (g: Paint2D) => unknown,
  port: (g: Paint2D, env: BrushEnv) => unknown,
  zoom = 1,
): void {
  const a = new RecordingPaint();
  const b = new RecordingPaint();
  original.LW = Math.pow(zoom, -0.55);
  original.camZ = zoom;
  const legacyReturn = legacy(a);
  const portReturn = port(b, makeEnv(zoom));
  expect(b.toLines()).toEqual(a.toLines());
  expect(a.calls.length).toBeGreaterThan(0);
  if (Array.isArray(legacyReturn))
    expect(Array.from(portReturn as number[])).toEqual(Array.from(legacyReturn as number[]));
}

const POINTS = [10, 40, 80, 10, 150, 60, 230, 20, 300, 70, 380, 30];
const POLY = [100, 100, 220, 90, 260, 180, 180, 250, 90, 200];

describe('Paint2D / RecordingPaint', () => {
  it('asPaint2D hands the context back unchanged', () => {
    const ctx = {} as CanvasRenderingContext2D;
    expect(asPaint2D(ctx)).toBe(ctx);
  });

  it('records calls and property writes in order', () => {
    const g = new RecordingPaint();
    g.fillStyle = '#123456';
    g.beginPath();
    g.ellipse(1, 2, 3, 4, 0, 0, 6, true);
    g.fill();
    expect(g.toLines()).toEqual([
      'set:fillStyle #123456',
      'beginPath',
      'ellipse 1 2 3 4 0 0 6 true',
      'fill nonzero',
    ]);
    expect(g.fillStyle).toBe('#123456');
  });
});

describe('equivalence with the original brushes.js (same zoom -> same calls)', () => {
  for (const zoom of [1, 2.5, 0.4]) {
    it(`curve / inkLine / brushStroke at zoom ${String(zoom)}`, () => {
      expect(curve(POINTS, false, 4)).toEqual(
        Array.from(orig('curve')(POINTS, false, 4) as number[]),
      );
      expect(curve(POLY, true)).toEqual(Array.from(orig('curve')(POLY, true) as number[]));
      both(
        (g) => orig('inkLine')(g, POINTS, { seed: 3, w: 9 }),
        (g, env) => {
          inkLine(g, env, POINTS, { seed: 3, w: 9 });
        },
        zoom,
      );
      both(
        (g) => orig('inkLine')(g, POLY, { closed: true, color: C.RUST }),
        (g, env) => {
          inkLine(g, env, POLY, { closed: true, color: C.RUST });
        },
        zoom,
      );
      both(
        (g) => orig('stroke')(g, POINTS, { seed: 9 }),
        (g, env) => {
          brushStroke(g, env, POINTS, { seed: 9 });
        },
        zoom,
      );
    });

    it(`blob with every layer at zoom ${String(zoom)}`, () => {
      const options: BlobOptions = {
        seed: 4,
        shade: [C.CLAY_D, 8, 10],
        light: [C.PLASTER, -6, -7],
        patch: [C.MUSTARD, 5, 5, 0.4],
        mottle: [C.BROWN, 6, 12],
        hatch: { n: 3, k: 3, ang: 30 },
        lw: 6,
        lineColor: C.BLACK,
      };
      both(
        (g) => orig('blob')(g, POLY, C.CLAY, options),
        (g, env) => blob(g, env, POLY, C.CLAY, options),
        zoom,
      );
      both(
        (g) => orig('blob')(g, POLY, C.CLAY, { lw: 0, sharp: true }),
        (g, env) => blob(g, env, POLY, C.CLAY, { lw: 0, sharp: true }),
        zoom,
      );
    });

    it(`tube / hatch / mottle / bricks at zoom ${String(zoom)}`, () => {
      both(
        (g) => orig('tube')(g, [0, 0, 60, 30, 130, 20], [30, 24, 12], C.OLIVE, { seed: 2 }),
        (g, env) => tube(g, env, [0, 0, 60, 30, 130, 20], [30, 24, 12], C.OLIVE, { seed: 2 }),
        zoom,
      );
      const bb = bbox(POLY);
      both(
        (g) => orig('hatch')(g, bb, { c: 'red', n: 4, bend: 0 }, 6),
        (g, env) => {
          hatch(g, env, bb, { c: 'red', n: 4, bend: 0 }, 6);
        },
        zoom,
      );
      both(
        (g) => orig('mottle')(g, bb, [C.PLUM, 5, 9], 8),
        (g) => {
          mottle(g, bb, [C.PLUM, 5, 9], 8);
        },
        zoom,
      );
      both(
        (g) => orig('bricks')(g, 10, 20, 300, 120, { seed: 3, density: 0.3 }),
        (g, env) => {
          bricks(g, env, 10, 20, 300, 120, { seed: 3, density: 0.3 });
        },
        zoom,
      );
    });

    it(`architecture and sky at zoom ${String(zoom)}`, () => {
      expect(wobble(POLY, 4, 6, 40)).toEqual(
        Array.from(orig('wobble')(POLY, 4, 6, 40) as number[]),
      );
      both(
        (g) => orig('rough')(g, POLY, C.STONE, { amp: 5, seed: 2 }),
        (g, env) => rough(g, env, POLY, C.STONE, { amp: 5, seed: 2 }),
        zoom,
      );
      both(
        (g) => orig('rect')(g, 5, 6, 70, 40, C.PLASTER),
        (g, env) => rect(g, env, 5, 6, 70, 40, C.PLASTER),
        zoom,
      );
      both(
        (g) => orig('beam')(g, 0, 0, 90, 50, 14, 5),
        (g, env) => beam(g, env, 0, 0, 90, 50, 14, 5),
        zoom,
      );
      both(
        (g) => orig('bands')(g, 0, 0, 640, 300, [C.GREYBLUE, C.PLUM, C.RUST], 2),
        (g) => {
          bands(g, 0, 0, 640, 300, [C.GREYBLUE, C.PLUM, C.RUST], 2);
        },
        zoom,
      );
      both(
        (g) => orig('stars')(g, 0, 0, 500, 200, 25, 4),
        (g) => {
          stars(g, 0, 0, 500, 200, 25, 4);
        },
        zoom,
      );
      both(
        (g) => orig('pool')(g, 50, 60, 80, 30, C.FIRE, 0.3),
        (g) => {
          pool(g, 50, 60, 80, 30, C.FIRE, 0.3);
        },
        zoom,
      );
      both(
        (g) => orig('gloom')(g, 0, 0, 1920, 1080, 900, 500, 300, C.BLACK, 0.5),
        (g) => {
          gloom(g, 0, 0, 1920, 1080, 900, 500, 300, C.BLACK, 0.5);
        },
        zoom,
      );
    });
  }

  it('camera and figure thread the ink width through the explicit env', () => {
    const legacy = new RecordingPaint();
    const ported = new RecordingPaint();
    orig('camera')(legacy, 500, 400, 2.5, 6);
    const outer = camera(ported, 500, 400, 2.5, 6);
    expect(ported.toLines()).toEqual(legacy.toLines());
    expect(outer).toEqual({ zoom: 2.5, lw: Math.pow(2.5, -0.55) });
    expect(original.LW).toBe(outer.lw);

    const place = { x: 300, y: 700, s: 0.8, lean: 4 };
    const figLegacy = new RecordingPaint();
    const figPort = new RecordingPaint();
    orig('figure')(figLegacy, place, true, () => {
      orig('inkLine')(figLegacy, POINTS, { seed: 2 });
    });
    figure(figPort, outer, place, true, (inner) => {
      expect(inner.lw).toBe(Math.pow(0.8 * 2.5, -0.55));
      inkLine(figPort, inner, POINTS, { seed: 2 });
    });
    expect(figPort.toLines()).toEqual(figLegacy.toLines());
    // The original restores ST.LW after the figure; the port never mutates the outer env.
    expect(original.LW).toBe(outer.lw);
    expect(outer.lw).toBe(Math.pow(2.5, -0.55));
  });
});

describe('inkLine geometry', () => {
  /** Ribbon width at each point of an open line, from the recorded polygon. */
  function widths(opts: { taper?: boolean; w?: number; env?: BrushEnv }): number[] {
    const pts: number[] = [];
    for (let x = 0; x <= 600; x += 6) pts.push(x, 100);
    const g = new RecordingPaint();
    inkLine(g, opts.env ?? DEFAULT_ENV, pts, {
      seed: 5,
      w: opts.w ?? 10,
      ...(opts.taper === undefined ? {} : { taper: opts.taper }),
    });
    const n = pts.length / 2;
    const verts = g.calls
      .filter((c) => c.op === 'moveTo' || c.op === 'lineTo')
      .map((c) => [Number(c.args[0]), Number(c.args[1])] as const);
    expect(verts).toHaveLength(2 * n);
    return Array.from({ length: n }, (_, i) => {
      const l = verts[i];
      const r = verts[2 * n - 1 - i];
      return Math.hypot((l?.[0] ?? 0) - (r?.[0] ?? 0), (l?.[1] ?? 0) - (r?.[1] ?? 0));
    });
  }

  it('swells and pinches between 0.4x and 1.9x of the base width', () => {
    const w = widths({ taper: false, w: 10 });
    expect(Math.min(...w)).toBeGreaterThanOrEqual(10 * 0.4 - 1e-9);
    expect(Math.max(...w)).toBeLessThanOrEqual(10 * 1.9 + 1e-9);
    expect(Math.max(...w) / Math.min(...w)).toBeGreaterThan(2.5);
  });

  it('tapers open ends to 12% and leaves the middle untouched', () => {
    const plain = widths({ taper: false });
    const tapered = widths({});
    expect(tapered[0]).toBeCloseTo((plain[0] ?? 0) * 0.12, 9);
    expect(tapered[tapered.length - 1]).toBeLessThan((plain[plain.length - 1] ?? 0) * 0.13);
    const mid = Math.floor(plain.length / 2);
    expect(tapered[mid]).toBeCloseTo(plain[mid] ?? 0, 9);
  });

  it('scales with the env ink multiplier (close-ups thicken gently)', () => {
    const close = widths({ taper: false, env: makeEnv(0.25) });
    const base = widths({ taper: false });
    expect(close[10]).toBeCloseTo((base[10] ?? 0) * Math.pow(0.25, -0.55), 9);
  });

  it('draws nothing for fewer than two points', () => {
    const g = new RecordingPaint();
    inkLine(g, DEFAULT_ENV, [1, 2]);
    expect(g.calls).toHaveLength(0);
  });
});

describe('determinism', () => {
  it('same call twice = same recording', () => {
    const run = (): string[] => {
      const g = new RecordingPaint();
      const env = camera(g, 800, 500, 1.7);
      blob(g, env, POLY, C.OLIVE, { seed: 2, mottle: [C.BROWN, 4, 10], hatch: { n: 2 } });
      brushStroke(g, env, POINTS, { seed: 1 });
      bricks(g, env, 0, 0, 200, 100);
      return g.toLines();
    };
    expect(run()).toEqual(run());
  });

  it('ellipseRing returns n evenly spaced points', () => {
    const ring = ellipseRing(10, 20, 5, 3, 8);
    expect(ring).toHaveLength(16);
    expect(ring[0]).toBeCloseTo(15, 12);
    expect(ring[1]).toBeCloseTo(20, 12);
  });
});

describe('module hygiene', () => {
  const dir = fileURLToPath(new URL('..', import.meta.url));
  const sources = [
    ...readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => `${dir}${f}`),
    ...readdirSync(`${dir}draw`)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'original.ts')
      .map((f) => `${dir}draw/${f}`),
  ];
  const forbidden =
    /\b(Date|performance|document|window|requestAnimationFrame|setTimeout|setInterval|fillText|strokeText|filter|fetch)\b|Math\.random/;

  it('has no forbidden identifiers (comments excluded)', () => {
    expect(sources.length).toBeGreaterThanOrEqual(5);
    for (const file of sources) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(forbidden.exec(code)?.[0], file).toBeUndefined();
    }
  });

  it('keeps every file within 400 lines', () => {
    for (const file of sources) {
      expect(readFileSync(file, 'utf8').split('\n').length, file).toBeLessThanOrEqual(400);
    }
  });
});
