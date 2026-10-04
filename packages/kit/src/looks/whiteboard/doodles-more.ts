/**
 * More whiteboard doodles: symbols (heart, question mark, check, cross, star) and small things
 * (clock, target, smiley, lock, phone, book, trophy, globe), in the same 100 x 100 box as doodles.ts.
 */
import { bezier, ellipse, type Point, type Polyline } from './geometry.js';

/* Pen helpers shared with doodles.ts (degrees, y down, 100 x 100 box). */
export const DEG = Math.PI / 180;

export const arc = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number): Point[] =>
  ellipse(cx, cy, r, r, fromDeg * DEG, toDeg * DEG, 3);

/** A full circle starting at `startDeg`, overshooting a little like a hand-drawn loop. */
export const loop = (cx: number, cy: number, r: number, startDeg = -100): Point[] =>
  arc(cx, cy, r, startDeg, startDeg + 372);

export const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0 - 1],
];

function star(): Polyline[] {
  const points: Point[] = [];
  for (let corner = 0; corner <= 10; corner += 1) {
    const radius = corner % 2 === 0 ? 44 : 18;
    const angle = (corner / 10) * Math.PI * 2 - Math.PI / 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius + 4]);
  }
  return [points];
}

export const MORE_DOODLES = {
  heart: () => [
    [
      ...bezier([
        [0, 36],
        [-44, 4],
        [-34, -36],
        [0, -16],
      ]),
      ...bezier([
        [0, -16],
        [34, -36],
        [44, 4],
        [0, 36],
      ]).slice(1),
    ],
  ],
  question: () => [
    [
      ...arc(0, -20, 18, 190, 405),
      ...bezier([
        [12.7, -7.3],
        [0, 2],
        [0, 14],
      ]).slice(1),
    ],
    loop(0, 32, 2.5),
  ],
  check: () => [
    [
      [-32, 0],
      [-10, 26],
      [34, -32],
    ],
  ],
  cross: () => [
    [
      [-28, -28],
      [28, 28],
    ],
    [
      [28, -28],
      [-28, 28],
    ],
  ],
  star,
  clock: () => [
    loop(0, 0, 40),
    ...[0, 90, 180, 270].map((angle): Point[] => [
      [Math.cos(angle * DEG) * 32, Math.sin(angle * DEG) * 32],
      [Math.cos(angle * DEG) * 38, Math.sin(angle * DEG) * 38],
    ]),
    [
      [0, -26],
      [0, 0],
      [18, 9],
    ],
  ],
  target: () => [
    loop(0, 0, 40),
    loop(0, 0, 26),
    loop(0, 0, 11),
    [
      [40, -40],
      [3, -3],
    ],
    [
      [32, -44],
      [40, -40],
      [44, -32],
    ],
  ],
  smiley: () => [
    loop(0, 0, 38),
    [
      [-12, -16],
      [-12, -6],
    ],
    [
      [12, -16],
      [12, -6],
    ],
    arc(0, 2, 20, 20, 160),
  ],
  lock: () => [
    [[-16, 0], [-16, -14], ...arc(0, -14, 16, 180, 360), [16, 0]],
    rect(-26, 0, 26, 40),
    loop(0, 16, 4),
    [
      [0, 20],
      [0, 29],
    ],
  ],
  phone: () => [rect(-21, -43, 21, 43), rect(-15, -33, 15, 27), loop(0, 35, 2.5)],
  book: () => [
    [
      [0, -26],
      [0, 36],
    ],
    [
      ...bezier([
        [0, -26],
        [-16, -36],
        [-42, -30],
      ]),
      [-42, 30],
      ...bezier([
        [-42, 30],
        [-18, 25],
        [0, 36],
      ]).slice(1),
    ],
    [
      ...bezier([
        [0, -26],
        [16, -36],
        [42, -30],
      ]),
      [42, 30],
      ...bezier([
        [42, 30],
        [18, 25],
        [0, 36],
      ]).slice(1),
    ],
    [
      [-34, -16],
      [-8, -16],
    ],
    [
      [-34, -4],
      [-10, -4],
    ],
    [
      [8, -16],
      [34, -16],
    ],
    [
      [8, -4],
      [30, -4],
    ],
  ],
  trophy: () => [
    [
      [-24, -38],
      ...bezier([
        [-24, -38],
        [-24, -6],
        [-10, 6],
        [0, 6],
      ]).slice(1),
      ...bezier([
        [0, 6],
        [10, 6],
        [24, -6],
        [24, -38],
      ]).slice(1),
      [-24, -38],
    ],
    arc(-24, -24, 10, 90, 270),
    arc(24, -24, 10, -90, 90),
    [
      [0, 6],
      [0, 22],
    ],
    rect(-16, 22, 16, 32),
  ],
  globe: () => [
    loop(0, 0, 40),
    ellipse(0, 0, 16, 40, -Math.PI / 2, Math.PI * 1.5, 3),
    [
      [-38, -13],
      [38, -13],
    ],
    [
      [-38, 13],
      [38, 13],
    ],
  ],
} as const satisfies Readonly<Record<string, () => Polyline[]>>;
