/**
 * Plants of the open vocabulary (PLAN.md#13.15a): trees, bushes, grass, flowers, cacti, seaweed
 * and coral, mushrooms, leaves. Silhouette first (a pine is a jagged triangle, an oak a lumpy
 * ball on a forked trunk), crayon fill out of the lines, never two alike (seeded).
 */
import { Draft, fill, thin } from './draft.js';
import { arcFlat, family, leafPts, starFlat, wavyFlat, type Knobs, type Maker } from './family.js';

const trunk = (d: Draft, x: number, top: number, bottom: number, w: number): void => {
  d.poly(
    [
      x - w / 2 - d.r(0, 2),
      bottom,
      x - w / 2 + d.r(0, 2),
      top,
      x + w / 2 + d.r(-1, 1),
      top - d.r(0, 3),
      x + w / 2 + d.r(0, 3),
      bottom,
    ],
    fill('kraftDark'),
  );
};

const pine: Maker = (d, k) => {
  const tiers = d.r(0, 1) > 0.5 ? 4 : 3;
  trunk(d, 50, 130, 160, 9);
  const at = (i: number): [number, number, number] => {
    const y = 6 + (124 * i) / tiers + d.r(-3, 3);
    const half = 12 + (36 * i) / tiers;
    return [y, half, half * d.r(0.35, 0.55)];
  };
  const tiersAt = Array.from({ length: tiers }, (_, i) => at(i + 1));
  const right: number[] = [];
  const left: number[] = [];
  tiersAt.forEach(([y, half, inner], i) => {
    right.push(50 + half + d.r(-4, 4), y);
    if (i < tiers - 1) right.push(50 + inner, y + d.r(-2, 2));
  });
  for (let i = tiers - 1; i >= 0; i -= 1) {
    const [y, half] = tiersAt[i] ?? [0, 0];
    left.push(50 - half + d.r(-4, 4), y + d.r(-2, 2));
    const above = tiersAt[i - 1];
    if (above) left.push(50 - above[2], above[0]);
  }
  d.poly([50 + d.r(-2, 2), 2, ...right, ...left], fill(k.color ?? 'green'));
  return d.done([100, 160], [50, 150]);
};

const crowned = (d: Draft, k: Knobs, fruit: boolean): ReturnType<Maker> => {
  d.poly(
    [44, 160, 46, 102, 36, 84, 42, 84, 50, 96, 57, 80, 62, 84, 55, 102, 58, 160],
    fill('kraftDark'),
  );
  d.blob(50, 54, 46 + d.r(-4, 4), 40 + d.r(-4, 4), { ...fill(k.color ?? 'green'), lumps: 0.26 });
  for (let i = 0; i < 3; i += 1)
    d.arc(30 + i * 18 + d.r(-4, 4), 40 + d.r(-6, 18), 7, 200, 330, thin);
  if (fruit)
    d.dots(
      [28, 58, 52, 34, 70, 62, 44, 72, 62, 44].map((v) => v + d.r(-3, 3)),
      5,
      { color: 'margin' },
    );
  return d.done([100, 160], [50, 150]);
};

const birch: Maker = (d, k) => {
  d.rect(45, 50, 10, 110);
  for (let i = 0; i < 5; i += 1) {
    const y = 64 + i * 18 + d.r(-4, 4);
    d.sharp([d.r(45, 49), y, d.r(50, 55), y + d.r(-1, 2)], { width: 3 });
  }
  d.blob(42, 36, 28, 30, { ...fill(k.color ?? 'green', 'light'), lumps: 0.3 });
  d.blob(64, 52, 24, 22, { ...fill(k.color ?? 'green', 'light'), lumps: 0.3 });
  return d.done([100, 160], [50, 150]);
};

const palm: Maker = (d, k) => {
  const bend = d.r(8, 18);
  d.line([44, 160, 46 + bend * 0.3, 110, 50 + bend * 0.7, 70, 52 + bend, 36]);
  d.line([54, 160, 55 + bend * 0.3, 110, 58 + bend * 0.7, 70, 60 + bend, 38]);
  for (let i = 0; i < 6; i += 1) {
    const y = 150 - i * 20;
    const x = 49 + bend * ((160 - y) / 124);
    d.sharp([x - 3, y, x + 6, y - 3], thin);
  }
  const [tx, ty] = [56 + bend, 34];
  for (let i = 0; i < 6; i += 1) {
    const deg = -170 + i * 34 + d.r(-8, 8);
    const a = (deg * Math.PI) / 180;
    const length = d.r(48, 62);
    d.poly(
      leafPts(
        tx + Math.cos(a) * length * 0.5,
        ty + Math.sin(a) * length * 0.5 + 10,
        length,
        15,
        deg + 14,
      ),
      fill(k.color ?? 'green'),
    );
  }
  d.circle(tx - 4, ty + 8, 4, fill('coffee', 'dense'));
  d.circle(tx + 4, ty + 9, 4, fill('coffee', 'dense'));
  return d.done([120, 160], [55, 150]);
};

const dead: Maker = (d) => {
  trunk(d, 50, 84, 160, 11);
  const branch = (x: number, y: number, deg: number, length: number, depth: number): void => {
    const a = (deg * Math.PI) / 180;
    const [ex, ey] = [x + Math.cos(a) * length, y + Math.sin(a) * length];
    d.line([x, y, (x + ex) / 2 + d.r(-3, 3), (y + ey) / 2 + d.r(-3, 3), ex, ey], {
      width: depth > 1 ? 3 : depth > 0 ? 2 : 1,
    });
    if (depth > 0) {
      branch(ex, ey, deg - d.r(20, 38), length * 0.74, depth - 1);
      branch(ex, ey, deg + d.r(18, 34), length * 0.68, depth - 1);
    }
  };
  branch(50, 86, -90 + d.r(-10, 10), 34, 3);
  return d.done([100, 160], [50, 150]);
};

const willow: Maker = (d, k) => {
  trunk(d, 50, 60, 160, 12);
  d.arc(50, 70, 44, 195, 345, {});
  for (let i = 0; i < 11; i += 1) {
    const x = 12 + i * 7.6 + d.r(-2, 2);
    const top = 70 - Math.sin((Math.PI * (x - 6)) / 88) * 40;
    d.line([x, top + 4, x + d.r(-4, 4), top + 40, x + d.r(-6, 6), top + d.r(60, 84)], {
      color: k.color ?? 'green',
    });
  }
  return d.done([100, 160], [50, 150]);
};

const stump: Maker = (d) => {
  d.poly([20, 60, 22, 22, 78, 22, 82, 60], fill('kraftDark'));
  d.blob(50, 22, 29, 8, { ...fill('kraft'), lumps: 0.05 });
  d.blob(50, 22, 14, 4, { lumps: 0.05, nib: 'fine' });
  d.line([24, 60, 12, 66], {});
  d.line([76, 60, 90, 67], {});
  return d.done([100, 70]);
};

const bush: Maker = (d, k) => {
  d.blob(60, 42, 54, 28, { ...fill(k.color ?? 'green'), lumps: 0.3 });
  for (let i = 0; i < 3; i += 1)
    d.arc(30 + i * 28 + d.r(-5, 5), 34 + d.r(-6, 8), 7, 200, 330, thin);
  if (k.type === 'berry')
    d.dots(
      [34, 40, 58, 30, 80, 46, 46, 54, 70, 36].map((v) => v + d.r(-3, 3)),
      5,
      { color: 'margin' },
    );
  return d.done([120, 72]);
};

const grass: Maker = (d, k) => {
  const blades = k.count ?? (k.type === 'reeds' ? 5 : 7);
  const tall = k.type === 'tall' || k.type === 'reeds' ? 2 : 1;
  for (let i = 0; i < blades; i += 1) {
    const spread = (i / Math.max(1, blades - 1) - 0.5) * 2;
    const x = 20 + spread * 4;
    const tip = [20 + spread * 18 + d.r(-3, 3), 30 - tall * 26 * d.r(0.6, 1)];
    d.line([x, 30, (x + (tip[0] ?? 0)) / 2 + d.r(-2, 2), 30 - tall * 12, ...tip], {
      color: k.color ?? 'green',
    });
    if (k.type === 'reeds' && i % 2 === 0)
      d.blob(tip[0] ?? 20, (tip[1] ?? 0) + 8, 3, 8, fill('coffee', 'dense'));
  }
  return d.done([40, 30 + (tall - 1) * 26]);
};

const flower: Maker = (d, k) => {
  const sway = d.r(-5, 5);
  d.line([15, 80, 15 + sway / 2, 50, 15 + sway, 28], { color: 'green' });
  d.poly(leafPts(15 + sway / 4 + 7, 60, 16, 7, -30), fill('green'));
  const [cx, cy] = [15 + sway, 22];
  if (k.type === 'tulip') {
    d.poly(
      [
        cx - 8,
        cy - 8,
        cx - 4,
        cy - 2,
        cx,
        cy - 10,
        cx + 4,
        cy - 2,
        cx + 8,
        cy - 8,
        cx + 7,
        cy + 5,
        cx - 7,
        cy + 5,
      ],
      fill(k.color ?? 'margin', 'dense'),
    );
  } else if (k.type === 'sunflower') {
    d.poly(starFlat(cx, cy, 8, 15, 11), fill(k.color ?? 'sticky', 'dense'));
    d.circle(cx, cy, 6, fill('coffee', 'dense'));
  } else {
    for (let i = 0; i < 7; i += 1) {
      const deg = i * (360 / 7) + d.r(-10, 10);
      const a = (deg * Math.PI) / 180;
      d.poly(leafPts(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 10, 6, deg), { nib: 'fine' });
    }
    d.circle(cx, cy, 4, fill(k.color ?? 'sticky', 'dense'));
  }
  return d.done([30, 80]);
};

const cactus: Maker = (d, k) => {
  const g = fill(k.color ?? 'green');
  if (k.type === 'barrel') {
    d.blob(50, 60, 34, 40, { ...g, lumps: 0.08 });
    for (const x of [34, 50, 66]) d.line([x, 24, x + (x - 50) * 0.3, 60, x, 98], thin);
    d.circle(50, 20, 6, fill('margin', 'dense'));
    return d.done([100, 100]);
  }
  d.poly([40, 140, 40, 30, ...arcFlat(51, 30, 11, 12, 180, 360, 5), 62, 140], g);
  d.poly([40, 86, 22, 86, 22, 56, ...arcFlat(27, 56, 5, 6, 180, 360, 3), 32, 76, 40, 76], g);
  d.poly([62, 70, 78, 70, 78, 40, ...arcFlat(83, 40, 5, 6, 180, 360, 3), 88, 80, 62, 80], g);
  for (let i = 0; i < 8; i += 1)
    d.sharp([44 + d.r(0, 14), 40 + i * 12, 40 + d.r(0, 22), 42 + i * 12], {
      nib: 'fine',
      width: 1,
    });
  return d.done([100, 140]);
};

const seaweed: Maker = (d, k) => {
  if (k.type === 'coral') {
    const color = k.color ?? 'orange';
    const grow = (x: number, y: number, deg: number, length: number, depth: number): void => {
      const a = (deg * Math.PI) / 180;
      const [ex, ey] = [x + Math.cos(a) * length, y + Math.sin(a) * length];
      d.line([x, y, ex, ey], { nib: 'marker', color });
      if (depth > 0) {
        grow(ex, ey, deg - d.r(20, 35), length * 0.75, depth - 1);
        grow(ex, ey, deg + d.r(20, 35), length * 0.7, depth - 1);
      } else d.dots([ex, ey], 6, { color });
    };
    grow(40, 120, -90, 34, 2);
    return d.done([80, 120]);
  }
  const strands = k.count ?? 3;
  for (let i = 0; i < strands; i += 1) {
    const x = 20 + i * (40 / Math.max(1, strands - 1)) + d.r(-4, 4);
    const top = d.r(10, 40);
    d.line(wavyFlat(x, 120, top, 6, 1.6, d.r(0, 3)), { color: k.color ?? 'green', width: 3 });
    d.poly(leafPts(x + 6, top + 30, 18, 8, -60), fill(k.color ?? 'green'));
  }
  return d.done([80, 120]);
};

const mushroom: Maker = (d, k) => {
  const one = (x: number, base: number, size: number, color: string): void => {
    d.rect(x - size * 0.22, base - size * 0.9, size * 0.44, size * 0.9);
    d.poly(
      [...arcFlat(x, base - size * 0.85, size * 0.62, size * 0.55, 180, 360, 6)],
      fill(color === 'margin' ? 'margin' : 'coffee', 'dense'),
    );
    if (color === 'margin')
      d.dots(
        [
          x - size * 0.3,
          base - size * 1.1,
          x + size * 0.15,
          base - size * 1.25,
          x + size * 0.35,
          base - size * 0.98,
        ],
        4,
        { color: 'paper' },
      );
  };
  if (k.type === 'cluster') {
    one(36, 80, 36, 'brown');
    one(64, 80, 26, 'brown');
    one(52, 80, 18, 'brown');
    return d.done([100, 80]);
  }
  one(50, 80, 56, k.color === undefined ? 'margin' : 'brown');
  return d.done([100, 80]);
};

const leaf: Maker = (d, k) => {
  if (k.type === 'maple') {
    d.poly(starFlat(40, 44, 16, 36, 5), fill(k.color ?? 'margin'));
    d.line([40, 50, 40, 96], {});
    return d.done([80, 100]);
  }
  d.poly(leafPts(40, 46, 80, 40, -80), fill(k.color ?? 'green'));
  d.line([42, 96, 41, 50, 40, 10], thin);
  for (let i = 0; i < 4; i += 1) {
    const y = 26 + i * 14;
    d.line([40, y + 8, 28 - i, y], thin);
    d.line([40, y + 10, 53 + i, y + 2], thin);
  }
  return d.done([80, 100]);
};

export const PLANT_FAMILIES = [
  family({
    kind: 'tree',
    group: 'plant',
    summary: 'pine, oak, apple, birch, palm, dead, willow, stump',
    types: {
      pine,
      oak: (d, k) => crowned(d, k, false),
      apple: (d, k) => crowned(d, k, true),
      birch,
      palm,
      dead,
      willow,
      stump,
    },
    height: 220,
    heights: { stump: 60 },
  }),
  family({
    kind: 'bush',
    group: 'plant',
    summary: 'round, berry',
    types: { round: bush, berry: bush },
    height: 70,
  }),
  family({
    kind: 'grass',
    group: 'plant',
    summary: 'tuft, tall, reeds (count = blades)',
    types: { tuft: grass, tall: grass, reeds: grass },
    height: 34,
  }),
  family({
    kind: 'flower',
    group: 'plant',
    summary: 'daisy, tulip, sunflower',
    types: { daisy: flower, tulip: flower, sunflower: flower },
    height: 80,
  }),
  family({
    kind: 'cactus',
    group: 'plant',
    summary: 'saguaro, barrel',
    types: { saguaro: cactus, barrel: cactus },
    height: 160,
  }),
  family({
    kind: 'seaweed',
    group: 'plant',
    summary: 'kelp (count = strands), coral',
    types: { kelp: seaweed, coral: seaweed },
    height: 130,
  }),
  family({
    kind: 'mushroom',
    group: 'plant',
    summary: 'toadstool, cluster',
    types: { toadstool: mushroom, cluster: mushroom },
    height: 80,
  }),
  family({
    kind: 'leaf',
    group: 'plant',
    summary: 'plain, maple',
    types: { plain: leaf, maple: leaf },
    height: 100,
  }),
];
