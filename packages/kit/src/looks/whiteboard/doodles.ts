/**
 * Built-in whiteboard doodles: small explainer icons drawn from pen strokes (a stick figure, a
 * light bulb, a gear, a house...). Each doodle is a list of pen paths in a 100 x 100 box centred
 * on the origin (y down), in the order a hand would draw them; `dsl.ts` scales and places them.
 */
import { arc, DEG, loop, MORE_DOODLES, rect } from './doodles-more.js';
import { arrowHead, bezier, type Point, type Polyline } from './geometry.js';

function gear(): Polyline[] {
  const teeth = 8;
  const outline: Point[] = [];
  for (let tooth = 0; tooth <= teeth; tooth += 1) {
    const angle = (tooth / teeth) * Math.PI * 2 - Math.PI / 2;
    for (const [offset, radius] of [
      [-0.2, 30],
      [-0.12, 41],
      [0.12, 41],
      [0.2, 30],
    ] as const) {
      if (tooth === teeth && offset > -0.2) break;
      outline.push([Math.cos(angle + offset) * radius, Math.sin(angle + offset) * radius]);
    }
  }
  return [outline, loop(0, 0, 11)];
}

/** Outline of a union of bumps seen from (0, 6), with a flat bottom. */
function cloud(): Polyline[] {
  const bumps = [
    [-30, 4, 12],
    [-12, -8, 17],
    [12, -10, 16],
    [31, 3, 12],
  ] as const;
  const points: Point[] = [];
  for (let step = 0; step <= 120; step += 1) {
    const angle = Math.PI / 2 + (step / 120) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let reach = 0;
    for (const [bx, by, r] of bumps) {
      // Far intersection of the ray (0, 6) + k (dx, dy) with the bump.
      const ox = -bx;
      const oy = 6 - by;
      const b = ox * dx + oy * dy;
      const disc = b * b - (ox * ox + oy * oy - r * r);
      if (disc >= 0) reach = Math.max(reach, -b + Math.sqrt(disc));
    }
    points.push([dx * reach, Math.min(16, 6 + dy * reach)]);
  }
  return [points];
}

const trend: Point[] = [
  [-34, 28],
  [-20, 12],
  [-6, 18],
  [8, -2],
  [20, 4],
  [38, -28],
];

/** Diagram and object doodles (the symbols and small things are in doodles-more.ts). */
const OBJECTS = {
  person: () => [
    loop(0, -34, 11),
    [
      [0, -23],
      [0, 12],
    ],
    [
      [-20, -2],
      [0, -14],
      [20, -2],
    ],
    [
      [-16, 44],
      [0, 12],
      [16, 44],
    ],
  ],
  bulb: () => [
    [[-9, 20], ...arc(0, -12, 24, 126, 414), [9, 20]],
    [
      [-5, 19],
      [-5, 4],
      ...arc(-2.5, 0, 2.5, 180, 360),
      [0, 2],
      ...arc(2.5, 0, 2.5, 180, 360),
      [5, 4],
      [5, 19],
    ],
    [
      [-10, 21],
      [10, 21],
    ],
    [
      [-9, 27],
      [9, 27],
    ],
    [
      [-5, 33],
      [5, 33],
    ],
    ...[200, 240, 270, 300, 340].map((angle): Point[] => [
      [Math.cos(angle * DEG) * 31, -12 + Math.sin(angle * DEG) * 31],
      [Math.cos(angle * DEG) * 41, -12 + Math.sin(angle * DEG) * 41],
    ]),
  ],
  gear,
  house: () => [
    [
      [-30, -5],
      [-30, 40],
      [30, 40],
      [30, -5],
    ],
    [
      [-40, -1],
      [0, -38],
      [40, -1],
    ],
    [
      [-8, 40],
      [-8, 18],
      [8, 18],
      [8, 40],
    ],
    rect(14, 4, 24, 14),
    [
      [17, -24],
      [17, -38],
      [26, -38],
      [26, -16],
    ],
  ],
  computer: () => [
    rect(-42, -36, 42, 18),
    rect(-35, -29, 35, 11),
    [
      [-26, -19],
      [10, -19],
    ],
    [
      [-26, -10],
      [20, -10],
    ],
    [
      [-26, -1],
      [0, -1],
    ],
    [
      [-7, 18],
      [-9, 31],
    ],
    [
      [7, 18],
      [9, 31],
    ],
    [
      [-22, 32],
      [22, 32],
    ],
  ],
  axes: () => [
    [
      [-40, -44],
      [-40, 40],
      [46, 40],
    ],
    arrowHead([-40, 0], [-40, -44], 8),
    arrowHead([0, 40], [46, 40], 8),
    trend,
    arrowHead(trend[4] ?? [0, 0], trend[5] ?? [0, 0], 9),
  ],
  bars: () => [
    [
      [-44, -42],
      [-44, 40],
      [46, 40],
    ],
    ...(
      [
        [-36, -22, 22],
        [-16, -2, 40],
        [4, 18, 30],
        [24, 38, 64],
      ] as const
    ).map(([x0, x1, height]): Point[] => [
      [x0, 40],
      [x0, 40 - height],
      [x1, 40 - height],
      [x1, 40],
    ]),
  ],
  pie: () => [
    loop(0, 0, 40),
    [
      [0, -40],
      [0, 0],
      [38, 12],
    ],
    [
      [0, 0],
      [-28, 29],
    ],
  ],
  cloud,
  magnifier: () => [
    loop(-8, -8, 25),
    [
      [9, 13],
      [33, 37],
      [37, 33],
      [13, 9],
    ],
    arc(-8, -8, 16, 200, 250),
  ],
  rocket: () => [
    [
      [-10, 30],
      [-10, -14],
      ...bezier([
        [-10, -14],
        [-10, -32],
        [0, -44],
      ]).slice(1),
      ...bezier([
        [0, -44],
        [10, -32],
        [10, -14],
      ]).slice(1),
      [10, 30],
      [-10, 30],
    ],
    loop(0, -12, 5),
    [
      [-10, 12],
      [-23, 32],
      [-10, 27],
    ],
    [
      [10, 12],
      [23, 32],
      [10, 27],
    ],
    [
      [-7, 34],
      [-4, 46],
      [0, 38],
      [4, 48],
      [7, 34],
    ],
  ],
  coin: () => [
    loop(0, 0, 36),
    loop(0, 0, 28, -80),
    [
      ...bezier([
        [10, -11],
        [2, -18],
        [-13, -14],
        [-9, -3],
      ]),
      ...bezier([
        [-9, -3],
        [-5, 4],
        [12, 1],
        [9, 10],
      ]).slice(1),
      ...bezier([
        [9, 10],
        [6, 17],
        [-7, 16],
        [-11, 10],
      ]).slice(1),
    ],
    [
      [0, -21],
      [0, 21],
    ],
  ],
} as const satisfies Readonly<Record<string, () => Polyline[]>>;

export const DOODLES = { ...OBJECTS, ...MORE_DOODLES } as const;

export type DoodleName = keyof typeof DOODLES;

export const DOODLE_NAMES = Object.keys(DOODLES) as DoodleName[];

export function isDoodle(name: string): name is DoodleName {
  return name in DOODLES;
}
