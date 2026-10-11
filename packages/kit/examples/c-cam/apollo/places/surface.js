// Apollo 11 (C-CAM concept film 3) place `surface`: the lunar surface by the lander. Black sky,
// Earth, the cratered grey ground, the sun as the one light (its halo is `light`), and the lander
// standing where the orbit shot puts it after touchdown. opts: lander ([x, y, scale], default
// [1200, 780, 0.95]; false = no lander), flame (0..1, the descent engine's flame under it).
// Ported from films/03-apollo-11/js/sets/sets-c.js (setSurface) + earth, moon ground, crater and
// lander of lunar.js.
const M = { GROUND: '#7a766a', GROUND_D: '#5d5a50', GROUND_L: '#99958a', FOIL: '#b88e34' };

export const place = {
  id: 'surface',
  name: 'The lunar surface by the lander',
  bounds: [1920, 1080],
  light: { x: 140, y: 120, rx: 150, ry: 150, color: '#e8dcb0', alpha: 0.07 },
  anchors: { footpad: [1000, 762], firstStep: [820, 800], print: [940, 812] },
  collide: [[1038, 381, 324, 361]],
  draw(g, ink, t, opts) {
    const { lander: at = [1200, 780, 0.95], flame = 0 } = opts;
    ink.rect(-400, -300, 2700, 1700, '#0b0c0f', { seed: 190, lw: 0 });
    earth(g, ink, 1600, 170, 54, 191);
    moonGround(g, ink, -400, 620, 2300, 1400, 192, { craters: 18 });
    ink.blob(ink.ellipseRing(140, 120, 40, 40, 12), '#e6dcb8', { lw: 0, seed: 194 });
    if (Array.isArray(at)) lander(ink, at[0], at[1], at[2], 193, flame);
  },
};

function earth(g, ink, x, y, r, seed) {
  const { C } = ink;
  ink.blob(ink.ellipseRing(x, y, r, r, 16), '#4f6670', {
    lw: 5,
    seed,
    shade: ['#1f262b', -r * 0.45, r * 0.1],
  });
  const disc = ink.curve(ink.ellipseRing(x, y, r, r, 16), true, 5);
  g.save();
  g.beginPath();
  g.moveTo(disc[0], disc[1]);
  for (let i = 2; i < disc.length; i += 2) g.lineTo(disc[i], disc[i + 1]);
  g.closePath();
  g.clip();
  const land = [x - r * 0.4, y - r * 0.5, x + r * 0.1, y - r * 0.6, x + r * 0.2, y];
  ink.blob([...land, x - r * 0.1, y + r * 0.4, x - r * 0.5, y], C.OLIVE, { lw: 0, seed: seed + 1 });
  [
    [0.3, -0.2],
    [-0.2, 0.5],
  ].forEach(([a, b], i) => {
    const cx = x + a * r;
    const cy = y + b * r;
    ink.brushStroke([cx - r * 0.3, cy, cx, cy - r * 0.12, cx + r * 0.3, cy], {
      w: r * 0.12,
      color: '#b9b49e',
      seed: seed + 2 + i,
    });
  });
  g.restore();
}

function crater(ink, x, y, rx, seed) {
  const ry = rx * 0.32;
  const lw = Math.min(6, 2 + rx / 30);
  const rim = ink.wobble(ink.ellipseRing(x, y, rx, ry, 14), rx * 0.015, seed, 60);
  ink.blob(rim, M.GROUND_L, { lw, seed });
  const bowl = ink.ellipseRing(x + rx * 0.04, y + ry * 0.1, rx * 0.84, ry * 0.72, 14);
  ink.blob(ink.wobble(bowl, rx * 0.015, seed + 1, 60), M.GROUND_D, {
    lw: lw * 0.7,
    seed: seed + 1,
    shade: ['#45433b', -rx * 0.22, ry * 0.12],
    hatch:
      rx > 60
        ? { c: 'rgba(30,28,24,0.4)', n: 4, len: rx * 0.25, gap: 7, k: 3, ang: 10, bend: 0.1 }
        : undefined,
  });
}

function moonGround(g, ink, x0, y0, x1, y1, seed, o) {
  const { time } = ink;
  const top = [x0, y0, x0 + (x1 - x0) * 0.4, y0 - 8, x1, y0 + 6];
  ink.rough([...top, x1, y1, x0, y1], o.col || M.GROUND, {
    seed,
    lw: 6,
    amp: 4,
    hatch: { c: 'rgba(40,38,32,0.35)', n: 14, len: 70, gap: 9, k: 2, ang: 4, bend: 0.05 },
    mottle: ['rgba(60,58,50,0.25)', 10, 80],
  });
  for (let i = 0; i < (o.craters || 14); i += 1) {
    const k = time.hash(seed, i, 1);
    const y = y0 + 20 + k * k * (y1 - y0 - 40);
    const x = x0 + time.hash(seed, i, 2) * (x1 - x0);
    crater(ink, x, y, 20 + 180 * k * k * (o.scale || 1), seed + 10 + i);
  }
  g.fillStyle = '#4c4a42';
  for (let i = 0; i < 60; i += 1) {
    const k = time.hash(seed, i, 5);
    g.fillRect(x0 + time.hash(seed, i, 6) * (x1 - x0), y0 + k * (y1 - y0), 3 + k * 8, 2 + k * 4);
  }
}

// The lander from outside: gold-foil descent stage on four legs, grey angular cabin. (x, y) = feet.
function lander(ink, x, y, k, seed, flame) {
  const { C } = ink;
  const P = (...ab) => ab.flatMap((v, i) => (i % 2 ? y + v * k : x + v * k));
  [
    [-1, 0],
    [1, 1],
  ].forEach(([s, i]) => {
    ink.tube(P(s * 120, -170, s * 210, -30), [14 * k, 12 * k], C.STONE, { lw: 5, seed: seed + i });
    ink.tube(P(s * 150, -110, s * 80, -60), [8 * k, 8 * k], C.STONE_D, {
      lw: 4,
      seed: seed + 2 + i,
    });
    ink.blob(ink.ellipseRing(x + s * 214 * k, y - 18 * k, 34 * k, 12 * k, 10), C.STONE, {
      lw: 5,
      seed: seed + 4 + i,
      shade: [C.STONE_D, 0, 4],
    });
  });
  const sharp = (pts, col, o) => ink.blob(pts, col, { sharp: true, ...o });
  sharp(P(-46, -110, 46, -110, 64, -40, -64, -40), '#3a3631', { lw: 5, seed: seed + 6 });
  sharp(P(-150, -270, 150, -270, 170, -200, 150, -120, -150, -120, -170, -200), M.FOIL, {
    lw: 7,
    seed: seed + 7,
    shade: [C.GOLD_D, -30, 0],
    light: ['rgba(240,210,140,0.35)', 20, -10],
    hatch: { c: 'rgba(70,40,10,0.5)', n: 10, len: 40 * k, gap: 7, k: 3, ang: 60, bend: 0.4 },
  });
  ink.rect(x - 60 * k, y - 250 * k, 50 * k, 110 * k, '#3a3631', { seed: seed + 8, lw: 4 });
  for (let i = 0; i < 5; i += 1) {
    const rung = P(-56, -240 + i * 22, -14, -240 + i * 22);
    ink.brushStroke(rung, { w: 4, color: C.STONE, seed: seed + 9 + i, taper: false });
  }
  sharp(P(-130, -270, -110, -380, -40, -420, 80, -420, 140, -370, 140, -270), '#8d8a7c', {
    lw: 7,
    seed: seed + 15,
    shade: ['#66645a', -24, 0],
    hatch: { c: 'rgba(30,28,24,0.45)', n: 6, len: 40 * k, gap: 7, k: 3, ang: 80 },
  });
  [
    [-90, -370, -50, -400, -40, -330],
    [-30, -400, 10, -400, -10, -330],
  ].forEach((w, i) => sharp(P(...w), '#1d1e20', { lw: 5, seed: seed + 16 + i }));
  ink.tube(P(100, -420, 130, -480), [6 * k, 6 * k], C.STONE_D, { lw: 4, seed: seed + 18 });
  const dish = ink.ellipseRing(x + 140 * k, y - 492 * k, 30 * k, 12 * k, 10, -0.4);
  ink.blob(dish, C.LINEN, { lw: 4, seed: seed + 19 });
  if (flame)
    sharp(P(-40, -46, 40, -46, 0, -46 + 80 * flame), '#d8c9a0', { lw: 4, seed: seed + 20 });
}
