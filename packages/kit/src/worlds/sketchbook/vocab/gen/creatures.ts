/**
 * Small creatures of the open vocabulary (PLAN.md#13.15a), side view facing right (`flip` for
 * left): birds, fish and whales, sea life, insects, reptiles. Crude on purpose: a blob body, a
 * dot eye, the silhouette carries it (a dorsal fin, a spout, eight legs).
 */
import { fill, thin } from './draft.js';
import { arcFlat, family, leafPts, starFlat, wavyFlat, type Maker } from './family.js';

const bird: Maker = (d, k) => {
  const color =
    k.color ??
    (k.type === 'crow'
      ? 'ink'
      : k.type === 'duck'
        ? 'green'
        : k.type === 'owl'
          ? 'kraftDark'
          : k.type === 'gull'
            ? 'paper'
            : k.type === 'eagle'
              ? 'coffee'
              : 'skyPencil');
  if (k.type === 'distant') {
    for (let i = 0; i < (k.count ?? 3); i += 1) {
      const [x, y, s] = [20 + i * 26 + d.r(-6, 6), 30 + d.r(-12, 12), d.r(7, 11)];
      d.line(
        [
          x - s,
          y - s * 0.3,
          x - s * 0.4,
          y - s * 0.55,
          x,
          y,
          x + s * 0.4,
          y - s * 0.6,
          x + s,
          y - s * 0.25,
        ],
        {},
      );
    }
    return d.done([100, 60]);
  }
  const fly = k.action === 'fly';
  const owl = k.type === 'owl';
  const [cx, cy] = [50, fly ? 46 : 56];
  d.blob(cx, cy, owl ? 20 : 26, owl ? 26 : 16, {
    ...fill(color, 'light'),
    lumps: 0.08,
    rot: owl || fly ? 0 : -12,
  });
  const [hx, hy] = owl ? [cx, cy - 26] : [cx + 24, cy - 16];
  d.circle(hx, hy, owl ? 14 : 10, fill(color, 'light'));
  d.dots(owl ? [hx - 5, hy - 2, hx + 5, hy - 2] : [hx + 3, hy - 2], owl ? 4 : 3);
  const beak = k.type === 'duck' ? 10 : k.type === 'eagle' ? 9 : 7;
  d.poly(
    owl
      ? [hx - 2, hy + 3, hx, hy + 9, hx + 2, hy + 3]
      : [hx + 8, hy - 2, hx + 8 + beak, hy + (k.type === 'eagle' ? 3 : 1), hx + 8, hy + 3],
    fill('orange', 'dense'),
  );
  if (fly) {
    d.poly([cx - 6, cy - 6, cx - 24, cy - 44 + d.r(-6, 6), cx + 10, cy - 8], fill(color, 'light'));
    d.poly([cx - 4, cy + 2, cx - 30, cy + 26, cx + 8, cy + 6], { nib: 'fine' });
  } else {
    d.arc(cx - 4, cy, 14, 160, 320, thin);
    const foot = 80;
    d.line([cx - 4, cy + 14, cx - 6, foot], {});
    d.line([cx + 6, cy + 14, cx + 6, foot], {});
    d.sharp([cx - 12, foot, cx - 6, foot - 1, cx, foot + 1], thin);
  }
  d.sharp([cx - 26, cy - 2, cx - 42, cy - 10, cx - 40, cy + 4, cx - 24, cy + 4], {});
  return d.done([100, 84]);
};

const fish: Maker = (d, k) => {
  const big = k.type === 'whale' || k.type === 'shark' || k.type === 'dolphin';
  const color =
    k.color ??
    (k.type === 'whale'
      ? 'bicLight'
      : k.type === 'shark' || k.type === 'dolphin'
        ? 'graphiteLight'
        : 'orange');
  const [cx, cy, rx, ry] =
    k.type === 'whale'
      ? [64, 40, 52, 24]
      : k.type === 'eel'
        ? [60, 30, 54, 6]
        : big
          ? [60, 34, 46, 13]
          : [50, 30, 30, 16];
  d.blob(cx, cy, rx, ry, { ...fill(color, k.type === 'whale' ? 'light' : 'hatch'), lumps: 0.06 });
  const tail = cx - rx;
  if (k.type === 'whale' || k.type === 'dolphin')
    d.poly([tail + 4, cy - 2, tail - 14, cy - 18, tail - 8, cy, tail - 16, cy + 12], fill(color));
  else d.poly([tail + 4, cy, tail - 14, cy - ry, tail - 10, cy, tail - 14, cy + ry], fill(color));
  if (big && k.type !== 'whale')
    d.poly([cx - 6, cy - ry + 2, cx - 2, cy - ry - 16, cx + 10, cy - ry + 1], fill(color));
  if (k.type === 'dolphin')
    d.poly([cx + rx - 6, cy - 3, cx + rx + 16, cy + 2, cx + rx - 4, cy + 6], fill(color));
  d.dots([cx + rx * 0.62, cy - ry * 0.3], 3);
  if (k.type === 'shark')
    d.zigzag(cx + rx * 0.5, cy + ry * 0.4, cx + rx * 0.85, cy + ry * 0.25, 5, 4);
  else if (k.type === 'whale') {
    d.line([cx + rx * 0.4, cy + ry * 0.4, cx + rx * 0.9, cy + ry * 0.2], {});
    d.rays(cx + 18, cy - ry - 4, 4, 16, 3, { from: 230, to: 310, color: 'bic' });
  } else d.arc(cx + rx * 0.35, cy, ry * 0.6, 290, 430, thin);
  if (k.type === 'fish')
    for (let i = 0; i < 2; i += 1) d.arc(cx - 6 - i * 10, cy, ry * 0.8, 300, 420, thin);
  return d.done([130, 70]);
};

const sea: Maker = (d, k) => {
  const color =
    k.color ??
    (k.type === 'crab'
      ? 'margin'
      : k.type === 'jellyfish'
        ? 'purple'
        : k.type === 'turtle'
          ? 'green'
          : 'orange');
  if (k.type === 'jellyfish') {
    d.poly(arcFlat(50, 36, 30, 24, 180, 360, 8), fill(color, 'light'));
    for (let i = 0; i < 5; i += 1) d.line(wavyFlat(26 + i * 12, 38, d.r(84, 100), 4, 1.2, i), thin);
    return d.done([100, 100]);
  }
  if (k.type === 'octopus') {
    d.blob(50, 30, 24, 26, { ...fill(color), lumps: 0.06 });
    d.dots([42, 32, 58, 32], 4);
    for (let i = 0; i < 6; i += 1) {
      const x = 30 + i * 8;
      const out = (i - 2.5) * 9;
      d.line([x, 50, x + out * 0.5, 66, x + out, 80, x + out * 1.4 + (out > 0 ? 6 : -6), 76], {
        width: 3,
        color,
      });
    }
    return d.done([100, 90]);
  }
  if (k.type === 'starfish') {
    d.poly(starFlat(40, 40, 14, 36, 5, -90 + d.r(-10, 10)), fill(color, 'dense'));
    return d.done([80, 80]);
  }
  if (k.type === 'turtle') {
    d.blob(50, 34, 30, 18, { ...fill(color), lumps: 0.05 });
    d.circle(86, 36, 8, {});
    for (const x of [30, 66]) d.poly(leafPts(x, 50, 18, 8, x > 50 ? 60 : 120), {});
    d.sharp([36, 22, 50, 30, 64, 22], thin);
    return d.done([100, 60]);
  }
  d.blob(50, 44, 24, 14, { ...fill(color), lumps: 0.06 });
  for (const side of [-1, 1]) {
    d.line([50 + side * 18, 36, 50 + side * 28, 18, 50 + side * 22, 12], {});
    d.poly([50 + side * 22, 12, 50 + side * 32, 2, 50 + side * 30, 14], fill(color));
    for (let i = 0; i < 3; i += 1)
      d.sharp(
        [50 + side * (16 + i * 4), 52, 50 + side * (30 + i * 4), 60, 50 + side * (32 + i * 4), 66],
        thin,
      );
  }
  d.dots([44, 34, 56, 34], 3);
  return d.done([100, 70]);
};

const insect: Maker = (d, k) => {
  const color =
    k.color ??
    (k.type === 'bee'
      ? 'sticky'
      : k.type === 'butterfly'
        ? 'orange'
        : k.type === 'beetle'
          ? 'green'
          : 'ink');
  if (k.type === 'butterfly') {
    for (const side of [-1, 1]) {
      d.blob(40 + side * 16, 26, 15, 13, { ...fill(color), lumps: 0.15 });
      d.blob(40 + side * 12, 46, 10, 9, { ...fill(k.color ?? 'purple'), lumps: 0.15 });
    }
    d.line([40, 20, 40, 56], { width: 3 });
    d.line([40, 20, 34, 6], thin);
    d.line([40, 20, 46, 6], thin);
    return d.done([80, 64]);
  }
  if (k.type === 'spider') {
    d.circle(40, 34, 12, fill('ink', 'dense'));
    d.circle(56, 30, 7, {});
    for (let i = 0; i < 4; i += 1)
      for (const side of [-1, 1])
        d.sharp(
          [40 + i * 4 - 6, 34, 40 + side * (16 + i * 3), 20 + i * 4, 40 + side * (24 + i * 4), 46],
          thin,
        );
    return d.done([80, 60]);
  }
  const ant = k.type === 'ant';
  const segments = ant
    ? [
        [22, 34, 9, 7],
        [40, 32, 6, 5],
        [56, 28, 7, 6],
      ]
    : [
        [34, 32, 20, 13],
        [60, 28, 8, 8],
      ];
  segments.forEach(([x, y, rx, ry]) =>
    d.blob(x ?? 0, y ?? 0, rx ?? 0, ry ?? 0, {
      ...fill(color, ant ? 'dense' : 'hatch'),
      lumps: 0.05,
    }),
  );
  if (k.type === 'bee') {
    for (const x of [26, 36]) d.line([x, 20, x + 2, 44], { width: 3 });
    d.blob(30, 14, 10, 7, { lumps: 0.1 });
    d.blob(42, 12, 9, 7, { lumps: 0.1 });
    d.sharp([14, 32, 8, 33], {});
  }
  if (k.type === 'beetle') d.line([30, 20, 32, 44], {});
  for (let i = 0; i < 3; i += 1)
    d.sharp(
      [ant ? 40 : 30 + i * 8, 36, (ant ? 34 : 24) + i * 10, 50, (ant ? 30 : 20) + i * 12, 52],
      thin,
    );
  const [hx, hy] = ant ? [56, 28] : [60, 28];
  d.line([hx + 3, hy - 5, hx + 8, hy - 16, hx + 14, hy - 18], thin);
  d.dots([hx + 3, hy - 1], 2);
  return d.done([80, 60]);
};

const reptile: Maker = (d, k) => {
  const color =
    k.color ?? (k.type === 'frog' ? 'green' : k.type === 'snake' ? 'green' : 'kraftDark');
  if (k.type === 'snake') {
    const top: number[] = [];
    for (let i = 0; i <= 16; i += 1) top.push(10 + i * 7, 40 + Math.sin(i * 0.8) * 12);
    d.line(top, { width: 6, color });
    d.line(top, { nib: 'fine' });
    d.circle(126, 34 + Math.sin(12.8) * 12, 7, fill(color));
    d.sharp([133, 36, 142, 36, 146, 32, 142, 36, 146, 40], { color: 'margin', nib: 'fine' });
    return d.done([150, 64]);
  }
  if (k.type === 'frog') {
    d.blob(40, 40, 26, 18, { ...fill(color), lumps: 0.06 });
    for (const x of [30, 50]) d.circle(x, 22, 7, {});
    d.dots([30, 22, 50, 22], 4);
    d.arc(40, 40, 12, 20, 160, {});
    d.sharp([16, 50, 6, 60, 22, 60], {});
    d.sharp([60, 50, 74, 60, 58, 60], {});
    return d.done([80, 64]);
  }
  const croc = k.type === 'crocodile';
  const length = croc ? 120 : 90;
  const x0 = 34;
  d.poly(
    [
      x0,
      44,
      x0 + 30,
      36,
      x0 + length * 0.6,
      34,
      x0 + length,
      40,
      x0 + length * 0.6,
      50,
      x0 + 30,
      50,
    ],
    fill(color),
  );
  d.line([x0, 44, x0 - 16, 46, x0 - 30, 40], {});
  if (croc) {
    d.zigzag(x0 + 30, 34, x0 + length * 0.55, 32, 9, 6);
    d.line([x0 + length * 0.7, 44, x0 + length, 42], {});
  }
  d.dots([x0 + length * 0.78, 38], 3);
  for (const x of [x0 + 24, x0 + 24 + length * 0.4]) {
    d.sharp([x, 48, x - 8, 60, x - 14, 58], {});
    d.sharp([x + 4, 48, x + 12, 58, x + 18, 58], thin);
  }
  return d.done([length + 40, 64]);
};

export const CREATURE_FAMILIES = [
  family({
    kind: 'bird',
    group: 'animal',
    summary: 'songbird, crow, owl, duck, gull, eagle, distant (count = birds)',
    types: {
      songbird: bird,
      crow: bird,
      owl: bird,
      duck: bird,
      gull: bird,
      eagle: bird,
      distant: bird,
    },
    actions: ['perch', 'fly'],
    height: 60,
    heights: { distant: 30, owl: 70, eagle: 70 },
  }),
  family({
    kind: 'fish',
    group: 'animal',
    summary: 'fish, shark, whale, dolphin, eel',
    types: { fish, shark: fish, whale: fish, dolphin: fish, eel: fish },
    height: 40,
    heights: { whale: 110, shark: 60, dolphin: 55, eel: 25 },
  }),
  family({
    kind: 'sealife',
    group: 'animal',
    summary: 'octopus, jellyfish, crab, starfish, turtle',
    types: { octopus: sea, jellyfish: sea, crab: sea, starfish: sea, turtle: sea },
    height: 70,
    heights: { crab: 45, starfish: 45, turtle: 50 },
  }),
  family({
    kind: 'insect',
    group: 'animal',
    summary: 'bee, ant, butterfly, beetle, spider',
    types: { bee: insect, ant: insect, butterfly: insect, beetle: insect, spider: insect },
    height: 36,
  }),
  family({
    kind: 'reptile',
    group: 'animal',
    summary: 'lizard, crocodile, snake, frog',
    types: { lizard: reptile, crocodile: reptile, snake: reptile, frog: reptile },
    height: 34,
    heights: { crocodile: 44, frog: 45 },
  }),
];
