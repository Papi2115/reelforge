// Spike 14.0 only: the test frame, a pure function of t at 1920x1080. Load comparable to a busy C-CAM set
// (films/03-apollo-11/js/lunar.js: 14 craters + 60 pebbles) plus a figure with tubes, ink ribbons, clips,
// evenodd crescents, translucent pools/gloom and a camera with cuts, zoom and Dutch tilt. No text.
import {
  bands,
  blob,
  camera,
  ellipseRing,
  gloom,
  hash,
  INK,
  inkLine,
  key,
  pool,
  stars,
  tube,
  twos,
  wobble,
} from './brushes.js';

const SKY = ['#1c1a24', '#26222c', '#302a30'];
const GROUND = '#6f6a58';
const CRATER = '#5a5546';

// camera cuts: [at, cx, cy, zoom keys, rot]
const CUTS = [
  [
    0,
    960,
    560,
    [
      [0, 1],
      [3, 1.15],
    ],
    0,
  ],
  [
    3,
    1240,
    700,
    [
      [3, 1.8],
      [7, 2.1],
    ],
    -4,
  ],
  [
    7,
    760,
    620,
    [
      [7, 1.3],
      [12, 1.05],
    ],
    3,
  ],
];

function cutAt(t) {
  const tt = twos(t);
  let cut = CUTS[0];
  for (const c of CUTS) if (tt >= c[0]) cut = c;
  return cut;
}

function set(g, s) {
  bands(g, -400, -300, 2400, 640, SKY, 2);
  stars(g, -400, -300, 2800, 900, 160, 11, '#b9b39a');
  blob(g, s, wobble([-500, 600, 2500, 560, 2500, 1500, -500, 1500], 6, 3), GROUND, {
    sharp: true,
    lw: 6,
    seed: 4,
    mottle: ['#646050', 18, 40],
    hatch: { n: 10, len: 34 },
  });
  for (let i = 0; i < 14; i++) {
    const cx = -200 + hash(31, i, 1) * 2300;
    const cy = 680 + hash(31, i, 2) * 380;
    const rx = 40 + hash(31, i, 3) * 120;
    blob(g, s, ellipseRing(cx, cy, rx, rx * 0.32, 9), CRATER, {
      seed: 40 + i,
      lw: 5,
      shade: ['#3e3a30', 0, rx * 0.12],
      light: ['#8a846c', 0, -rx * 0.06],
      mottle: ['#4c483c', 3, rx * 0.12],
    });
  }
  for (let i = 0; i < 60; i++) {
    const cx = -300 + hash(77, i, 1) * 2500;
    const cy = 640 + hash(77, i, 2) * 440;
    const r = 6 + hash(77, i, 3) * 14;
    blob(g, s, ellipseRing(cx, cy, r, r * 0.6, 6), '#7d7762', { seed: 90 + i, lw: 3 });
  }
}

function figure(g, s, t) {
  const tt = twos(t);
  const sway = Math.sin(tt * 2.1) * 18;
  const [hipX, hipY] = [1180, 760];
  const [neckX, neckY] = [1190 + sway * 0.4, 520];
  const reach = key(tt, [
    [0, 0],
    [4, 1],
    [8, 0.3],
    [12, 1],
  ]);
  tube(
    g,
    s,
    [hipX - 30, hipY, hipX - 50, hipY + 120, hipX - 40 + sway * 0.3, hipY + 240],
    [46, 40, 34],
    '#8b5a3c',
    {
      seed: 7,
      lw: 6,
      shade: ['#5e3a26', 8, 0],
    },
  );
  tube(
    g,
    s,
    [hipX + 30, hipY, hipX + 60, hipY + 120, hipX + 52, hipY + 240],
    [46, 40, 34],
    '#8b5a3c',
    { seed: 8, lw: 6 },
  );
  blob(
    g,
    s,
    [neckX - 90, neckY + 20, neckX + 95, neckY + 30, hipX + 80, hipY + 30, hipX - 85, hipY + 25],
    '#a39a62',
    {
      seed: 9,
      lw: 8,
      shade: ['#6f6a3e', 14, 0],
      light: ['#c4bb7c', -10, -6],
      hatch: { n: 5, len: 26 },
    },
  );
  const handX = neckX + 120 + reach * 160;
  const handY = neckY + 60 - reach * 140;
  tube(
    g,
    s,
    [neckX + 80, neckY + 40, neckX + 130 + reach * 40, neckY + 150 - reach * 40, handX, handY],
    [36, 30, 24],
    '#a39a62',
    {
      seed: 10,
      lw: 6,
    },
  );
  blob(g, s, ellipseRing(handX, handY, 22, 18, 7), '#d8a07c', { seed: 11, lw: 5 });
  const head = ellipseRing(neckX + 6, neckY - 80, 78, 92, 10);
  blob(g, s, head, '#d8a07c', {
    seed: 12,
    lw: 7,
    shade: ['#a8705a', 10, 4],
    mottle: ['#c48868', 4, 8],
  });
  const blink = hash(13, Math.floor(tt * 2)) < 0.15 ? 2 : 10;
  for (const ex of [-24, 30])
    blob(g, s, ellipseRing(neckX + ex, neckY - 96, 9, blink, 6), INK, { seed: 14, lw: 0 });
  inkLine(g, s, [neckX - 30, neckY - 40, neckX, neckY - 32 + reach * 6, neckX + 34, neckY - 42], {
    w: 5,
    seed: 15,
  });
}

export function paintTestFrame(g, t, width, height) {
  const s = { width, height, lw: 1, camZ: 1 };
  const [, cx, cy, zoom, rot] = cutAt(t);
  camera(g, s, cx, cy, key(t, zoom), rot);
  set(g, s);
  pool(g, 1180, 1000, 420, 120, '#e0b060', 0.18);
  figure(g, s, t);
  gloom(g, -600, -400, 3200, 2000, 1180, 620, 520, '#0c0a08', 0.35);
}
