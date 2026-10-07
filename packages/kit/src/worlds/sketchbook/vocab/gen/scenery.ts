/**
 * Backdrops of the open vocabulary (PLAN.md#13.15a): hills, mountains, sea, dunes, a forest
 * row, a city skyline, a room corner, sky, space, ground, road, river. A backdrop is drawn in
 * page px (`w` x `h`, anchored at its bottom centre by default) with pale nibs (pencil, fine) and
 * light crayon, so the hero in front of it stays the focal point.
 */
import { Draft, fill, pale, thin } from './draft.js';
import { arcFlat, family, starFlat, type Knobs, type Maker } from './family.js';

const size = (k: Knobs, h: number): [number, number] => [k.w ?? 700, k.h ?? h];

/** A ridge across the band: `bumps` hills between y0 (top) and the base. */
function ridge(d: Draft, w: number, base: number, top: number, bumps: number): number[] {
  const pts: number[] = [0, base - d.r(0, (base - top) * 0.3)];
  const steps = bumps * 4;
  const phase = d.r(0, 6.28);
  for (let i = 1; i <= steps; i += 1) {
    const k = i / steps;
    const hill = 0.5 + 0.5 * Math.sin(phase + k * bumps * Math.PI * 2);
    pts.push(w * k, base - (base - top) * (0.25 + 0.75 * hill * d.r(0.75, 1)));
  }
  return pts;
}

const hills: Maker = (d, k) => {
  const [w, h] = size(k, 160);
  const far = ridge(d, w, h * 0.7, 0, 2);
  d.line(far, pale);
  const near = ridge(d, w, h, h * 0.35, 3);
  d.poly([...near, w, h, 0, h], { ...pale, ...fill(k.color ?? 'green', 'light') });
  return d.done([w, h]);
};

const mountains: Maker = (d, k) => {
  const [w, h] = size(k, 200);
  const peaks = k.count ?? Math.max(2, Math.round(w / 220));
  const pts: number[] = [0, h];
  for (let i = 0; i < peaks; i += 1) {
    const x = ((i + 0.5) / peaks) * w + d.r(-30, 30);
    const top = d.r(0, h * 0.35);
    pts.push(x - w / peaks / 2 + d.r(0, 20), h * d.r(0.5, 0.75), x, top);
    d.sharp(
      [
        x - h * 0.12,
        top + h * 0.18,
        x - h * 0.04,
        top + h * 0.12,
        x + h * 0.03,
        top + h * 0.2,
        x + h * 0.1,
        top + h * 0.15,
      ],
      pale,
    );
  }
  pts.push(w, h * d.r(0.4, 0.7), w, h);
  d.poly(pts, { ...thin, ...fill(k.color ?? 'graphiteLight', 'light') });
  return d.done([w, h]);
};

const sea: Maker = (d, k) => {
  const [w, h] = size(k, 140);
  d.line([0, 4, w * 0.5, 3 + d.r(-2, 2), w, 5], { nib: 'ballpoint' });
  d.hatch([0, 6, w, 6, w, h, 0, h], k.color ?? 'skyPencil', { shade: 'light' });
  const rows = k.count ?? 4;
  for (let row = 0; row < rows; row += 1) {
    const y = 14 + ((h - 14) * (row + 0.6)) / rows;
    const amp = 3 + row * 2.5;
    const n = Math.max(2, Math.round((w / 70) * (0.6 + row * 0.25)));
    const span = w / n;
    for (let i = 0; i < n; i += 1) {
      if (d.r(0, 1) < 0.3) continue;
      const x = i * span + d.r(0, span * 0.4);
      d.wave(x, y + d.r(-4, 4), x + span * d.r(0.35, 0.6), 2, amp, { nib: 'ballpoint' });
    }
  }
  return d.done([w, h]);
};

const dunes: Maker = (d, k) => {
  const [w, h] = size(k, 140);
  d.line(ridge(d, w, h * 0.6, 0, 2), pale);
  const near = ridge(d, w, h, h * 0.3, 2);
  d.poly([...near, w, h, 0, h], { ...thin, ...fill(k.color ?? 'kraft', 'light') });
  const sand: number[] = [];
  for (let i = 0; i < 18; i += 1) sand.push(d.r(10, w - 10), d.r(h * 0.7, h - 4));
  d.dots(sand, 1, pale);
  return d.done([w, h]);
};

const forest: Maker = (d, k) => {
  const [w, h] = size(k, 160);
  const trees = Math.min(40, k.count ?? Math.max(4, Math.round(w / 42)));
  for (let i = 0; i < trees; i += 1) {
    const x = ((i + 0.5) / trees) * w + d.r(-10, 10);
    const tall = h * d.r(0.55, 1);
    const style = { ...pale, ...(d.r(0, 1) < 0.45 ? fill(k.color ?? 'green', 'light') : {}) };
    if (d.r(0, 1) < 0.6) {
      d.poly(
        [
          x,
          h - tall,
          x + tall * 0.22,
          h - tall * 0.45,
          x + tall * 0.1,
          h - tall * 0.45,
          x + tall * 0.28,
          h - 8,
          x - tall * 0.28,
          h - 8,
          x - tall * 0.1,
          h - tall * 0.45,
          x - tall * 0.22,
          h - tall * 0.45,
        ],
        style,
      );
    } else d.blob(x, h - tall * 0.62, tall * 0.26, tall * 0.34, { ...style, lumps: 0.25 });
    d.sharp([x, h - 8, x + d.r(-1, 1), h], pale);
  }
  d.line([0, h, w * 0.5, h - d.r(0, 3), w, h], pale);
  return d.done([w, h]);
};

const skyline: Maker = (d, k) => {
  const [w, h] = size(k, 200);
  let x = d.r(0, 12);
  while (x < w - 30) {
    const bw = d.r(40, 80);
    const bh = h * d.r(0.35, 1);
    d.rect(x, h - bh, bw, bh, { ...thin, ...fill(k.color ?? 'graphiteLight', 'light') });
    const win: number[] = [];
    for (let row = 1; row * 24 < bh - 10; row += 1)
      for (let col = 1; col * 16 < bw - 6; col += 1)
        if (d.r(0, 1) < 0.3) win.push(x + col * 16, h - bh + row * 24);
    d.dots(win, 3, { nib: 'pencil' });
    if (d.r(0, 1) < 0.3) d.sharp([x + bw / 2, h - bh, x + bw / 2, h - bh - 24], thin);
    x += bw + d.r(-6, 8);
  }
  return d.done([w, h]);
};

const room: Maker = (d, k) => {
  const [w, h] = size(k, 400);
  const [cx, floor] = [w * d.r(0.25, 0.35), h * 0.78];
  d.sharp([cx, 0, cx, floor], pale);
  d.sharp([0, floor + h * 0.12, cx, floor, w, floor + 6], thin);
  d.sharp([cx + 6, floor - 14, w, floor - 10], pale);
  const [wx, wy] = [cx + (w - cx) * 0.45, h * 0.18];
  d.rect(wx, wy, w * 0.2, h * 0.28, { ...thin, ...fill(k.color ?? 'skyPencil', 'light') });
  d.sharp([wx + w * 0.1, wy, wx + w * 0.1, wy + h * 0.28], thin);
  d.sharp([wx, wy + h * 0.14, wx + w * 0.2, wy + h * 0.14], thin);
  d.rect(cx * 0.3, h * 0.22, cx * 0.4, h * 0.18, pale);
  return d.done([w, h]);
};

const cloud = (d: Draft, x: number, y: number, s: number): void => {
  d.poly(
    [
      x - s,
      y,
      ...arcFlat(x - s * 0.55, y - s * 0.05, s * 0.45, s * 0.42, 180, 290, 4),
      ...arcFlat(x + s * 0.05, y - s * 0.22, s * 0.48, s * 0.5, 205, 335, 5),
      ...arcFlat(x + s * 0.6, y - s * 0.02, s * 0.4, s * 0.38, 250, 360, 4),
      x + s,
      y,
    ],
    { ...thin, ...fill('skyPencil', 'light') },
  );
};

const sky: Maker = (d, k) => {
  const [w, h] = size(k, 180);
  const night = k.type === 'night';
  if (k.type !== 'clouds') {
    const [sx, sy] = [w * d.r(0.65, 0.85), h * d.r(0.25, 0.4)];
    if (night) {
      d.poly(
        [...arcFlat(sx, sy, 22, 22, 60, 300, 8), ...arcFlat(sx + 10, sy, 17, 18, 290, 70, 6)],
        fill('sticky', 'dense'),
      );
    } else {
      d.circle(sx, sy, 22, fill(k.color ?? 'orange'));
      d.rays(sx, sy, 28, 40, 9, {});
    }
  }
  if (night) {
    for (let i = 0; i < (k.count ?? 9); i += 1)
      d.poly(starFlat(d.r(10, w - 10), d.r(8, h - 8), 2, 7, 4), {
        nib: 'fine',
        ...fill('sticky', 'dense'),
      });
  } else
    for (let i = 0; i < (k.count ?? 3); i += 1)
      cloud(d, d.r(40, w - 40), d.r(h * 0.35, h * 0.9), d.r(26, 44));
  return d.done([w, h]);
};

const space: Maker = (d, k) => {
  const [w, h] = size(k, 300);
  for (let i = 0; i < (k.count ?? 16); i += 1) {
    const [x, y] = [d.r(8, w - 8), d.r(8, h - 8)];
    if (d.r(0, 1) < 0.4) d.poly(starFlat(x, y, 1.5, d.r(4, 7), 4), thin);
    else d.dots([x, y], 2, pale);
  }
  if (k.type === 'planets') {
    const [px, py, r] = [w * d.r(0.15, 0.3), h * d.r(0.3, 0.6), d.r(26, 40)];
    d.circle(px, py, r, fill(k.color ?? 'orange'));
    d.arc(px, py, r * 1.6, 160, 380, { wobble: 1.4 });
    d.circle(w * d.r(0.75, 0.9), h * d.r(0.15, 0.35), d.r(10, 16), fill('purple'));
  }
  return d.done([w, h]);
};

const ground: Maker = (d, k) => {
  const [w, h] = size(k, 40);
  d.line(
    [0, h * 0.4, w * 0.3, h * 0.4 + d.r(-3, 3), w * 0.65, h * 0.4 + d.r(-3, 3), w, h * 0.4],
    {},
  );
  if (k.type === 'grass') d.hatch([0, h * 0.4, w, h * 0.4, w, h, 0, h], k.color ?? 'green');
  const bits = k.count ?? Math.round(w / 90);
  for (let i = 0; i < bits; i += 1) {
    const x = d.r(10, w - 10);
    if (k.type === 'rocky')
      d.blob(x, h * 0.7, d.r(5, 12), d.r(3, 6), { ...thin, ...fill('graphiteLight', 'light') });
    else
      d.sharp([x - 5, h * 0.4, x - 3, h * 0.1, x, h * 0.4, x + 3, h * 0.05, x + 5, h * 0.4], {
        color: 'green',
        nib: 'fine',
      });
  }
  return d.done([w, h]);
};

const road: Maker = (d, k) => {
  const [w, h] = size(k, 200);
  const vx = w * d.r(0.45, 0.6);
  d.line([w * 0.05, h, vx - 6, 0], thin);
  d.line([w * 0.95, h, vx + 6, 0], thin);
  for (let i = 0; i < 5; i += 1) {
    const k0 = 0.12 + i * 0.19;
    const k1 = k0 + 0.08;
    d.sharp([vx + (w * 0.5 - vx) * k0, h * k0, vx + (w * 0.5 - vx) * k1, h * k1], {
      width: 1 + Math.round(i / 2),
    });
  }
  if (k.color)
    d.hatch([w * 0.05, h, vx - 6, 0, vx + 6, 0, w * 0.95, h], k.color, { shade: 'light' });
  return d.done([w, h]);
};

const river: Maker = (d, k) => {
  const [w, h] = size(k, 80);
  const top = ridge(d, w, h * 0.3, h * 0.15, 2);
  const bottom = ridge(d, w, h, h * 0.8, 2);
  d.line(top, thin);
  d.line(bottom, thin);
  const back: number[] = [];
  for (let i = bottom.length - 2; i >= 0; i -= 2) back.push(bottom[i] ?? 0, bottom[i + 1] ?? 0);
  d.hatch([...top, ...back], k.color ?? 'skyPencil', { shade: 'light' });
  for (let i = 0; i < 5; i += 1) {
    const [x, y] = [d.r(10, w - 50), h * d.r(0.45, 0.7)];
    d.sharp([x, y, x + d.r(16, 34), y], { nib: 'ballpoint' });
  }
  return d.done([w, h]);
};

export const SCENERY_FAMILIES = [
  family({
    kind: 'hills',
    group: 'backdrop',
    summary: 'rolling (w x h band)',
    types: { rolling: hills },
    height: 160,
  }),
  family({
    kind: 'mountains',
    group: 'backdrop',
    summary: 'peaks (count)',
    types: { peaks: mountains },
    height: 200,
  }),
  family({
    kind: 'sea',
    group: 'backdrop',
    summary: 'waves to the horizon (count = rows)',
    types: { waves: sea },
    height: 140,
  }),
  family({
    kind: 'dunes',
    group: 'backdrop',
    summary: 'sand',
    types: { sand: dunes },
    height: 140,
  }),
  family({
    kind: 'forest',
    group: 'backdrop',
    summary: 'a row of trees (count)',
    types: { row: forest },
    height: 160,
  }),
  family({
    kind: 'skyline',
    group: 'backdrop',
    summary: 'city blocks with windows',
    types: { city: skyline },
    height: 200,
  }),
  family({
    kind: 'room',
    group: 'backdrop',
    summary: 'interior corner, window, frame',
    types: { corner: room },
    height: 400,
  }),
  family({
    kind: 'sky',
    group: 'backdrop',
    summary: 'day (sun + clouds), night (moon + stars), clouds',
    types: { day: sky, night: sky, clouds: sky },
    height: 180,
  }),
  family({
    kind: 'space',
    group: 'backdrop',
    summary: 'stars, planets',
    types: { stars: space, planets: space },
    height: 300,
  }),
  family({
    kind: 'ground',
    group: 'backdrop',
    summary: 'tufts, grass, rocky',
    types: { tufts: ground, grass: ground, rocky: ground },
    height: 40,
  }),
  family({
    kind: 'road',
    group: 'backdrop',
    summary: 'into the distance',
    types: { perspective: road },
    height: 200,
  }),
  family({
    kind: 'river',
    group: 'backdrop',
    summary: 'banks and water',
    types: { banks: river },
    height: 80,
  }),
];
