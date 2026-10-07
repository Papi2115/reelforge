/**
 * Icons and effects of the open vocabulary (PLAN.md#13.15a). Icons: small symbols with one
 * strong shape (heart, bolt, pin, lock, ...) - never letters or digits (those are page.write).
 * Effects: what happens around a subject (motion lines, sweat, sparkle, steam, rain, snow,
 * fire, an explosion scribble, smoke, splash, impact, wind, bubbles), placed next to it.
 */
import type { SwatchName } from '../../inks.js';
import { Draft, fill, thin } from './draft.js';
import { arcFlat, family, leafPts, starFlat, wavyFlat, type Knobs, type Maker } from './family.js';

type Item = (d: Draft, c: (fallback: SwatchName) => SwatchName, k: Knobs) => ReturnType<Maker>;

const flame = (d: Draft, x: number, y: number, s: number, color: SwatchName): void => {
  d.poly(
    [
      x - s * 0.5,
      y,
      x - s * 0.55,
      y - s * 0.6,
      x - s * 0.2,
      y - s * 0.9,
      x - s * 0.05,
      y - s * 1.6,
      x + s * 0.25,
      y - s * 0.95,
      x + s * 0.5,
      y - s * 0.6,
      x + s * 0.45,
      y,
    ],
    fill(color, 'dense'),
  );
};

const ICONS: Readonly<Record<string, Item>> = {
  heart: (d, c) =>
    d
      .poly([20, 36, 4, 18, 4, 9, 11, 3, 20, 10, 29, 3, 36, 9, 36, 18], fill(c('red'), 'dense'))
      .done([40, 40]),
  star: (d, c) => d.poly(starFlat(20, 21, 8, 19, 5), fill(c('sticky'), 'dense')).done([40, 40]),
  check: (d, c) =>
    d.sharp([4, 22, 15, 34, 37, 5], { nib: 'marker', color: c('green') }).done([40, 40]),
  cross: (d, c) =>
    d
      .sharp([6, 6, 34, 34], { nib: 'marker', color: c('red') })
      .sharp([34, 6, 6, 34], { nib: 'marker', color: c('red') })
      .done([40, 40]),
  bolt: (d, c) =>
    d
      .poly([24, 2, 8, 22, 18, 22, 14, 38, 32, 15, 21, 15], fill(c('sticky'), 'dense'))
      .done([40, 40]),
  warning: (d, c) =>
    d
      .poly([20, 3, 38, 36, 2, 36], fill(c('sticky'), 'dense'))
      .sharp([20, 13, 20, 26], { width: 3 })
      .dots([20, 31], 3)
      .done([40, 40]),
  clock: (d) =>
    d
      .circle(20, 20, 17, {})
      .sharp([20, 20, 20, 8], { width: 2 })
      .sharp([20, 20, 29, 23], {})
      .done([40, 40]),
  pin: (d, c) =>
    d
      .poly(
        [20, 39, 8, 20, ...arcFlat(20, 15, 12, 12, 160, 380, 6), 32, 20],
        fill(c('red'), 'dense'),
      )
      .circle(20, 15, 4, {})
      .done([40, 40], [20, 39]),
  eye: (d, c) =>
    d
      .poly([2, 20, 20, 8, 38, 20, 20, 32], {})
      .circle(20, 20, 7, fill(c('bic'), 'dense'))
      .done([40, 40]),
  bulb: (d, c) =>
    d
      .blob(20, 16, 11, 12, { ...fill(c('sticky'), 'light'), lumps: 0.04 })
      .rect(14, 27, 12, 8, {})
      .rays(20, 16, 15, 20, 5, { from: 200, to: 340, nib: 'fine' })
      .done([40, 40]),
  search: (d) => d.circle(16, 16, 11, {}).sharp([24, 24, 37, 37], { width: 4 }).done([40, 40]),
  gear: (d, c) =>
    d
      .poly(starFlat(20, 20, 14, 19, 8, 0), fill(c('graphiteLight')))
      .circle(20, 20, 5, {})
      .done([40, 40]),
  home: (d, c) =>
    d
      .poly([4, 20, 20, 4, 36, 20, 32, 20, 32, 37, 8, 37, 8, 20], fill(c('red'), 'light'))
      .done([40, 40]),
  cycle: (d, c) =>
    d
      .line(arcFlat(20, 20, 14, 14, 200, 340, 6), { arrow: true, color: c('green') })
      .line(arcFlat(20, 20, 14, 14, 20, 160, 6), { arrow: true, color: c('green') })
      .done([40, 40]),
  plus: (d, c) =>
    d
      .sharp([20, 5, 20, 35], { nib: 'marker', color: c('green') })
      .sharp([5, 20, 35, 20], { nib: 'marker', color: c('green') })
      .done([40, 40]),
  minus: (d, c) => d.sharp([5, 20, 35, 21], { nib: 'marker', color: c('red') }).done([40, 40]),
  note: (d) =>
    d
      .sharp([14, 30, 14, 6, 32, 2, 32, 26], { width: 2 })
      .blob(10, 31, 5, 4, { ...fill('ink', 'dense'), lumps: 0 })
      .blob(28, 27, 5, 4, { ...fill('ink', 'dense'), lumps: 0 })
      .done([40, 40]),
  drop: (d, c) =>
    d
      .poly(
        [20, 3, 30, 22, ...arcFlat(20, 25, 10, 11, 0, 180, 5), 10, 22],
        fill(c('skyPencil'), 'dense'),
      )
      .done([40, 40]),
  leaf: (d, c) =>
    d
      .poly(leafPts(20, 20, 34, 18, -45), fill(c('green')))
      .line([6, 34, 30, 10], thin)
      .done([40, 40]),
  fire: (d, c) => {
    flame(d, 20, 38, 22, c('orange'));
    flame(d, 20, 38, 11, 'sticky');
    return d.done([40, 40]);
  },
  skull: (d) =>
    d
      .blob(20, 16, 14, 13, { lumps: 0.05 })
      .circle(14, 16, 4, fill('ink', 'dense'))
      .circle(26, 16, 4, fill('ink', 'dense'))
      .rect(13, 28, 14, 9, {})
      .sharp([20, 28, 20, 37], thin)
      .done([40, 40]),
  lock: (d, c) =>
    d
      .arc(20, 16, 10, 180, 360, { width: 3 })
      .rect(8, 16, 24, 20, fill(c('sticky'), 'dense'))
      .done([40, 40]),
  bell: (d, c) =>
    d
      .poly(
        [6, 30, 10, 26, 10, 14, ...arcFlat(20, 14, 10, 10, 180, 360, 4), 30, 26, 34, 30],
        fill(c('sticky')),
      )
      .circle(20, 34, 3, {})
      .done([40, 40]),
  flag: (d, c) =>
    d
      .sharp([8, 38, 8, 3], { width: 2 })
      .poly([8, 4, 34, 9, 8, 20], fill(c('red'), 'dense'))
      .done([40, 40]),
  sun: (d, c) =>
    d
      .circle(20, 20, 9, fill(c('orange')))
      .rays(20, 20, 12, 18, 8, {})
      .done([40, 40]),
  moon: (d, c) =>
    d
      .poly(
        [...arcFlat(20, 20, 16, 16, 60, 300, 8), ...arcFlat(26, 20, 12, 13, 290, 70, 6)],
        fill(c('sticky'), 'dense'),
      )
      .done([40, 40]),
  snowflake: (d, c) =>
    d
      .sharp([20, 3, 20, 37], { color: c('bic') })
      .sharp([5, 11, 35, 29], { color: c('bic') })
      .sharp([5, 29, 35, 11], { color: c('bic') })
      .done([40, 40]),
  cloud: (d, c) =>
    d
      .poly(
        [4, 30, 6, 20, 14, 18, 18, 9, 28, 10, 32, 18, 38, 22, 36, 30],
        fill(c('skyPencil'), 'light'),
      )
      .done([40, 40]),
  up: (d, c) =>
    d
      .line([4, 34, 14, 22, 22, 26, 36, 6], { arrow: true, color: c('green'), width: 3 })
      .done([40, 40]),
  down: (d, c) =>
    d
      .line([4, 6, 14, 18, 22, 14, 36, 34], { arrow: true, color: c('red'), width: 3 })
      .done([40, 40]),
  target: (d, c) =>
    d
      .circle(20, 20, 17, {})
      .circle(20, 20, 10, fill(c('red'), 'light'))
      .dots([20, 20], 5, { color: 'red' })
      .done([40, 40]),
  globe: (d, c) =>
    d
      .circle(20, 20, 17, fill(c('skyPencil'), 'light'))
      .arc(20, 20, 9, 270, 450, thin)
      .arc(20, 20, 9, 90, 270, thin)
      .sharp([3, 20, 37, 20], thin)
      .done([40, 40]),
  trophy: (d, c) =>
    d
      .poly([10, 4, 30, 4, 28, 20, 20, 26, 12, 20], fill(c('sticky'), 'dense'))
      .arc(10, 11, 6, 90, 270, {})
      .arc(30, 11, 6, -90, 90, {})
      .sharp([20, 26, 20, 32], {})
      .rect(12, 32, 16, 6, {})
      .done([40, 40]),
};

const EFFECTS: Readonly<Record<string, Item>> = {
  motion: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 3); i += 1)
      d.sharp([80 - d.r(0, 10), 8 + i * 12, d.r(10, 30), 8 + i * 12 + d.r(-1, 1)], {
        color: c('ink'),
        nib: 'fine',
      });
    return d.done([80, 40]);
  },
  sweat: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 2); i += 1)
      d.poly(
        [
          12 + i * 16,
          4 + i * 6,
          18 + i * 16,
          16 + i * 6,
          ...arcFlat(13 + i * 16, 17 + i * 6, 5, 5, 0, 180, 3),
        ],
        fill(c('skyPencil'), 'dense'),
      );
    return d.done([40, 40]);
  },
  sparkle: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 3); i += 1)
      d.poly(starFlat(d.r(8, 72), d.r(8, 52), 1.5, d.r(5, 10), 4, 0), fill(c('sticky'), 'dense'));
    return d.done([80, 60]);
  },
  steam: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 3); i += 1)
      d.line(wavyFlat(14 + i * 14, 60, 6 + d.r(0, 10), 4, 1.2, i), {
        color: c('graphiteLight'),
        nib: 'pencil',
      });
    return d.done([60, 60]);
  },
  rain: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 24); i += 1) {
      const [x, y] = [d.r(10, 190), d.r(6, 150)];
      d.sharp([x, y, x - 5, y + 12], { color: c('bic'), nib: 'fine' });
    }
    return d.done([200, 160]);
  },
  snow: (d, c, k) => {
    const flakes: number[] = [];
    for (let i = 0; i < (k.count ?? 26); i += 1) flakes.push(d.r(6, 194), d.r(6, 154));
    return d.dots(flakes, 3, { color: c('skyPencil') }).done([200, 160]);
  },
  fire: (d, c) => {
    flame(d, 40, 80, 50, c('orange'));
    flame(d, 26, 80, 30, 'red');
    flame(d, 52, 80, 26, 'red');
    flame(d, 40, 80, 22, 'sticky');
    return d.done([80, 80]);
  },
  explosion: (d, c) =>
    d
      .poly(starFlat(50, 50, 22, 48, 9, d.r(0, 30)), fill(c('orange'), 'dense'))
      .poly(starFlat(50, 50, 10, 24, 7, d.r(0, 30)), fill('sticky', 'dense'))
      .scribble([30, 40, 70, 36, 66, 66, 34, 64], { nib: 'red', spacing: 8 })
      .done([100, 100]),
  smoke: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 4); i += 1)
      d.blob(30 + Math.sin(i * 1.3) * 8, 90 - i * 22, 10 + i * 4, 8 + i * 3, {
        ...fill(c('graphiteLight'), 'light'),
        nib: 'pencil',
        lumps: 0.3,
      });
    return d.done([60, 110]);
  },
  splash: (d, c) => {
    for (const [x, y] of [
      [14, 20],
      [30, 8],
      [50, 6],
      [66, 18],
    ] as const)
      d.poly([x, y, x + 4, y + 8, x - 4, y + 8], fill(c('skyPencil'), 'dense'));
    return d
      .arc(40, 60, 34, 200, 340, { color: c('bic') })
      .wave(4, 60, 76, 4, 6, { color: c('bic') })
      .done([80, 64]);
  },
  shine: (d) => d.rays(20, 20, 8, 18, 3, { from: 200, to: 290 }).done([40, 40]),
  impact: (d, c) =>
    d
      .rays(40, 40, 18, 38, 10, { color: c('ink') })
      .poly(starFlat(40, 40, 6, 14, 6), fill('sticky', 'dense'))
      .done([80, 80]),
  dust: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 3); i += 1)
      d.blob(14 + i * 22, 30 - (i % 2) * 6, 10 + d.r(0, 4), 7, {
        ...fill(c('kraft'), 'light'),
        nib: 'pencil',
        lumps: 0.3,
      });
    return d.done([80, 40]);
  },
  wind: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 3); i += 1) {
      const y = 12 + i * 16;
      d.line([4, y, 50, y + d.r(-2, 2), 68, y - 2, 72, y - 10, 64, y - 12, 60, y - 6], {
        color: c('graphite'),
        nib: 'pencil',
      });
    }
    return d.done([80, 56]);
  },
  bubbles: (d, c, k) => {
    for (let i = 0; i < (k.count ?? 5); i += 1)
      d.circle(20 + d.r(-12, 12), 110 - i * 22, 3 + i * 1.5, { color: c('bic'), nib: 'fine' });
    return d.done([40, 120]);
  },
  zap: (d, c) =>
    d
      .sharp([4, 30, 16, 18, 22, 26, 34, 8], { color: c('sticky'), width: 3 })
      .sharp([30, 34, 40, 26, 44, 34], { color: c('sticky'), width: 2 })
      .done([48, 40]),
};

const makers = (items: Readonly<Record<string, Item>>): Record<string, Maker> =>
  Object.fromEntries(
    Object.entries(items).map(([name, item]) => [
      name,
      (d: Draft, k: Knobs) => item(d, (fallback) => k.color ?? fallback, k),
    ]),
  );

export const ICON_FAMILIES = [
  family({
    kind: 'icon',
    group: 'icon',
    summary: Object.keys(ICONS).join(', '),
    types: makers(ICONS),
    height: 36,
  }),
];

export const EFFECT_FAMILIES = [
  family({
    kind: 'effect',
    group: 'effect',
    summary: `${Object.keys(EFFECTS).join(', ')} (count)`,
    types: makers(EFFECTS),
    height: 60,
    heights: {
      rain: 160,
      snow: 160,
      motion: 40,
      sweat: 30,
      fire: 80,
      explosion: 100,
      smoke: 110,
      bubbles: 110,
      impact: 70,
    },
  }),
];
