/**
 * Four-legged beasts of the open vocabulary (PLAN.md#13.15a), side view facing right (`flip` for
 * left), from one proportion table (dog to elephant); birds, fish, sea life, insects and reptiles
 * are in creatures.ts. Crude on purpose: a blob body, stick legs, a dot eye - the
 * silhouette carries it (ears, antlers, a hump, a trunk).
 */
import type { SwatchName } from '../../inks.js';
import { Draft, fill } from './draft.js';
import { family, leafPts, type Knobs, type Maker } from './family.js';

interface Beast {
  /** Body half-size, leg length, neck length/angle (deg from up, + = forward), head radius. */
  readonly body: readonly [number, number];
  readonly leg: number;
  readonly neck: readonly [number, number];
  readonly head: number;
  readonly snout: number;
  readonly ears: 'point' | 'round' | 'long' | 'none' | 'flap';
  readonly tail: 'thin' | 'bushy' | 'short' | 'tuft' | 'none';
  readonly extra?: 'antlers' | 'horns' | 'hump' | 'trunk' | 'mane' | 'wool';
  readonly color: SwatchName;
}

const BEASTS: Readonly<Record<string, Beast>> = {
  dog: {
    body: [34, 15],
    leg: 26,
    neck: [14, 40],
    head: 11,
    snout: 10,
    ears: 'flap',
    tail: 'thin',
    color: 'coffee',
  },
  cat: {
    body: [30, 12],
    leg: 22,
    neck: [8, 30],
    head: 10,
    snout: 3,
    ears: 'point',
    tail: 'thin',
    color: 'orange',
  },
  fox: {
    body: [32, 12],
    leg: 22,
    neck: [10, 45],
    head: 10,
    snout: 10,
    ears: 'point',
    tail: 'bushy',
    color: 'orange',
  },
  wolf: {
    body: [36, 15],
    leg: 28,
    neck: [12, 50],
    head: 12,
    snout: 11,
    ears: 'point',
    tail: 'bushy',
    color: 'graphiteLight',
  },
  deer: {
    body: [38, 17],
    leg: 32,
    neck: [22, 30],
    head: 9,
    snout: 8,
    ears: 'long',
    tail: 'short',
    extra: 'antlers',
    color: 'kraftDark',
  },
  horse: {
    body: [40, 18],
    leg: 44,
    neck: [30, 35],
    head: 10,
    snout: 14,
    ears: 'point',
    tail: 'tuft',
    extra: 'mane',
    color: 'coffee',
  },
  cow: {
    body: [42, 22],
    leg: 30,
    neck: [10, 60],
    head: 12,
    snout: 8,
    ears: 'flap',
    tail: 'tuft',
    extra: 'horns',
    color: 'paper',
  },
  bear: {
    body: [40, 24],
    leg: 24,
    neck: [8, 60],
    head: 14,
    snout: 7,
    ears: 'round',
    tail: 'short',
    color: 'coffee',
  },
  rabbit: {
    body: [20, 14],
    leg: 10,
    neck: [6, 20],
    head: 10,
    snout: 3,
    ears: 'long',
    tail: 'short',
    color: 'graphiteLight',
  },
  pig: {
    body: [34, 20],
    leg: 14,
    neck: [4, 70],
    head: 13,
    snout: 6,
    ears: 'point',
    tail: 'thin',
    color: 'margin',
  },
  sheep: {
    body: [32, 20],
    leg: 22,
    neck: [8, 50],
    head: 9,
    snout: 6,
    ears: 'flap',
    tail: 'short',
    extra: 'wool',
    color: 'paper',
  },
  camel: {
    body: [40, 16],
    leg: 46,
    neck: [32, 55],
    head: 9,
    snout: 10,
    ears: 'round',
    tail: 'tuft',
    extra: 'hump',
    color: 'kraft',
  },
  elephant: {
    body: [48, 30],
    leg: 30,
    neck: [6, 40],
    head: 22,
    snout: 0,
    ears: 'flap',
    tail: 'thin',
    extra: 'trunk',
    color: 'graphiteLight',
  },
  lion: {
    body: [38, 16],
    leg: 28,
    neck: [12, 40],
    head: 12,
    snout: 6,
    ears: 'round',
    tail: 'tuft',
    extra: 'mane',
    color: 'sticky',
  },
};

/** Leg angles (deg from down, + = forward) of [front near, front far, back near, back far]. */
const GAITS: Readonly<Record<string, readonly number[]>> = {
  stand: [4, -6, 6, -8],
  walk: [22, -14, 14, -22],
  run: [55, 30, -40, -60],
  sit: [8, 0, 70, 80],
};

const beast = (d: Draft, k: Knobs): ReturnType<Maker> => {
  const b = BEASTS[k.type] ?? BEASTS['dog'];
  if (!b) throw new RangeError('no beast');
  const gait = GAITS[k.action ?? 'stand'] ?? GAITS['stand'] ?? [];
  const [bw, bh] = b.body;
  const ground = 140;
  const sit = k.action === 'sit';
  const cy = ground - b.leg - bh * 0.6 + (sit ? b.leg * 0.35 : 0);
  const cx = 80;
  const tilt = sit ? -14 : k.action === 'run' ? 4 : 0;
  const color = k.color ?? b.color;
  const extraFill = b.extra === 'wool' ? fill('paper') : fill(color, 'light');
  d.blob(cx, cy, bw, bh, { ...extraFill, lumps: b.extra === 'wool' ? 0.4 : 0.1, rot: tilt });
  if (k.type === 'cow')
    for (const [dx, dy] of [
      [-12, -4],
      [10, 6],
    ] as const)
      d.blob(cx + dx, cy + dy, 8, 6, { ...fill('ink', 'dense'), lumps: 0.3, outline: false });
  if (b.extra === 'hump')
    d.blob(cx + 2, cy - bh * 0.95, bw * 0.4, bh * 0.6, { ...fill(color, 'light'), lumps: 0.1 });
  const legX = [cx + bw * 0.62, cx + bw * 0.48, cx - bw * 0.6, cx - bw * 0.75];
  const legWidth = Math.max(3, Math.min(bh * 0.32, b.leg * 0.22));
  gait.forEach((deg, i) => {
    const x = legX[i] ?? cx;
    const top = cy + bh * 0.45 + (i >= 2 && sit ? -bh * 0.2 : 0);
    const a = (deg * Math.PI) / 180;
    const length = b.leg * (i >= 2 && sit ? 0.7 : 1) + bh * 0.3;
    const [kx, ky] = [x + Math.sin(a) * length * 0.5, top + Math.cos(a) * length * 0.5];
    const [fx, fy] = [x + Math.sin(a * 0.6) * length, top + Math.cos(a * 0.6) * length];
    const half = legWidth / 2;
    const far = i % 2 === 1;
    const leg = [
      x - half,
      top,
      kx - half * 0.8,
      ky,
      fx - half * 0.7,
      fy,
      fx + half * 1.1,
      fy,
      kx + half * 0.8,
      ky,
      x + half,
      top,
    ];
    d.poly(leg, far ? { nib: 'fine', ...fill(color, 'light') } : fill(color, 'light'));
  });
  const neckA = (b.neck[1] * Math.PI) / 180;
  const neckBase = [cx + bw * 0.8, cy - bh * 0.4];
  const hx = (neckBase[0] ?? 0) + Math.sin(neckA) * b.neck[0];
  const hy = (neckBase[1] ?? 0) - Math.cos(neckA) * b.neck[0] - (sit ? 4 : 0);
  if (b.neck[0] > 8) {
    const [nx, ny] = [neckBase[0] ?? 0, (neckBase[1] ?? 0) + bh * 0.3];
    const nw = Math.max(4, b.head * 0.55);
    d.poly(
      [
        nx - nw,
        ny + nw * 0.6,
        hx - nw * 0.7,
        hy + b.head * 0.2,
        hx + nw * 0.5,
        hy + b.head * 0.7,
        nx + nw * 0.8,
        ny + nw,
      ],
      fill(color, 'light'),
    );
  }
  if (b.extra === 'mane')
    d.zigzag(neckBase[0] ?? 0, (neckBase[1] ?? 0) - 2, hx - 2, hy - b.head * 0.6, 7, 6, {
      color: k.type === 'lion' ? 'orange' : 'ink',
    });
  d.blob(hx, hy, b.head * 1.05, b.head * 0.9, { ...fill(color, 'light'), lumps: 0.08 });
  if (b.snout > 0)
    d.blob(hx + b.head * 0.7 + b.snout * 0.4, hy + b.head * 0.3, b.snout * 0.7, b.head * 0.45, {
      lumps: 0.05,
    });
  d.dots([hx + b.head * 0.35, hy - b.head * 0.2], 3);
  if (b.snout > 0) d.dots([hx + b.head * 0.75 + b.snout * 0.9, hy + b.head * 0.15], 2);
  const ear = (dx: number): void => {
    const [ex, ey] = [hx + dx * b.head, hy - b.head * 0.8];
    if (b.ears === 'point') d.sharp([ex - 4, ey + 3, ex - 1, ey - 9, ex + 4, ey + 2]);
    else if (b.ears === 'round') d.arc(ex, ey, 4, 180, 360);
    else if (b.ears === 'long') d.poly(leafPts(ex - 2, ey - 9, 20, 7, -100), {});
    else if (b.ears === 'flap')
      d.poly(leafPts(ex - 3, ey + 6, b.head * 1.1, b.head * 0.6, 100), fill(color));
  };
  ear(-0.25);
  if (b.extra === 'antlers') {
    for (const dx of [-3, 5])
      d.sharp([
        hx + dx,
        hy - b.head,
        hx + dx - 4,
        hy - b.head - 14,
        hx + dx - 11,
        hy - b.head - 20,
        hx + dx - 4,
        hy - b.head - 14,
        hx + dx + 3,
        hy - b.head - 24,
      ]);
  }
  if (b.extra === 'horns')
    d.line([hx - 4, hy - b.head * 0.8, hx - 10, hy - b.head * 1.5, hx - 4, hy - b.head * 1.8]);
  if (b.extra === 'trunk')
    d.line(
      [
        hx + b.head * 0.9,
        hy,
        hx + b.head * 1.3,
        hy + b.head * 1.1,
        hx + b.head * 1.1,
        hy + b.head * 1.9,
        hx + b.head * 1.5,
        hy + b.head * 2.1,
      ],
      { width: 3 },
    );
  const tail = [cx - bw * 0.95, cy - bh * 0.2];
  const [tx, ty] = [tail[0] ?? 0, tail[1] ?? 0];
  if (b.tail === 'thin') d.line([tx, ty, tx - 14, ty - 8, tx - 18, ty - 16]);
  else if (b.tail === 'bushy') d.poly(leafPts(tx - 16, ty - 2, 34, 14, 200), fill(color));
  else if (b.tail === 'short') d.circle(tx - 2, ty - 2, 4, {});
  else if (b.tail === 'tuft') {
    d.line([tx, ty, tx - 8, ty + 18, tx - 8, ty + 30]);
    d.zigzag(tx - 12, ty + 28, tx - 4, ty + 36, 3, 6);
  }
  return d.done([170, 150]);
};

const beastTypes = Object.fromEntries(Object.keys(BEASTS).map((name) => [name, beast]));

export const ANIMAL_FAMILIES = [
  family({
    kind: 'beast',
    group: 'animal',
    summary: Object.keys(BEASTS).join(', '),
    types: beastTypes,
    actions: ['stand', 'walk', 'run', 'sit'],
    height: 80,
    heights: {
      elephant: 160,
      horse: 140,
      camel: 150,
      deer: 140,
      cow: 100,
      bear: 110,
      lion: 95,
      wolf: 85,
      dog: 70,
      fox: 60,
      sheep: 70,
      pig: 62,
      cat: 55,
      rabbit: 45,
    },
  }),
];
