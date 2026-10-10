// Apollo 11 (C-CAM concept film 3) place `title`: the title poster, the Moon rising over a lunar
// ridge. Ported from films/03-apollo-11/js/sets/sets-a.js (setTitle) with the moon disc, Earth,
// moon ground, craters and the small lander of lunar.js. The warm halo sits BEHIND the moon disc,
// so it is drawn inside draw() in the original order (no `light` field: drawn last, it would tint
// the moon). No imports: draw(g, ink, t) gets the brushes bound to this frame.
const M = { GROUND: '#7a766a', GROUND_D: '#5d5a50', GROUND_L: '#99958a', FOIL: '#b88e34' };

export const place = {
  id: 'title',
  name: 'Title poster: the Moon rising over a lunar ridge',
  bounds: [1920, 1080],
  anchors: { moon: [1500, 470], centre: [960, 1120], left: [420, 1110], right: [1520, 1110] },
  collide: [],
  draw(g, ink) {
    ink.bands(-200, -200, 2200, 1100, ['#121419', '#171a1f', '#1c2025', '#22262a'], 2.1);
    ink.stars(-200, -200, 2400, 1100, 120, 11);
    ink.pool(1500, 420, 520, 420, '#c98f3e', 0.07);
    moonDisc(g, ink, 1500, 470, 360, 12);
    earth(g, ink, 170, 470, 56, 13);
    moonGround(g, ink, -200, 840, 2200, 1200, 14, { craters: 10, scale: 0.6 });
    lander(ink, 1640, 880, 0.32, 15);
  },
};

function trace(g, pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}

// Grey disc with flat dark maria, a few craters, hatching on the shadow side.
function moonDisc(g, ink, x, y, r, seed) {
  const { time } = ink;
  const ring = ink.ellipseRing(x, y, r, r, 24);
  ink.blob(ring, '#9b968a', { lw: 8, seed, shade: ['#6d695f', -r * 0.16, r * 0.04] });
  g.save();
  trace(g, ink.curve(ring, true, 8));
  g.clip();
  [
    [-0.3, -0.35, 0.32],
    [0.2, -0.1, 0.24],
    [-0.05, 0.3, 0.2],
    [0.42, 0.35, 0.14],
  ].forEach(([a, b, s], i) => {
    const mare = ink.ellipseRing(x + a * r, y + b * r, s * r * 1.3, s * r, 10);
    ink.blob(ink.wobble(mare, s * r * 0.15, seed + i, 40), '#77736a', {
      lw: 0,
      seed: seed + 5 + i,
    });
  });
  for (let i = 0; i < 9; i += 1) {
    const cx = x + time.rnd(-0.8, 0.8, seed, i) * r;
    const cy = y + time.rnd(-0.8, 0.8, seed, i, 1) * r;
    const k = time.hash(seed, i, 2);
    ink.blob(ink.ellipseRing(cx, cy, 14 + 30 * k, 12 + 26 * k, 9), '#7c776d', {
      lw: 3,
      seed: seed + 20 + i,
      shade: ['#5c584f', -8, -3],
      light: ['#b3ad9f', 5, 4],
    });
  }
  const shadow = { c: 'rgba(40,38,32,0.3)', n: 14, len: 60, gap: 9, k: 3, ang: 70 };
  ink.hatch({ x0: x - r, y0: y - r, w: r * 2, h: r * 2 }, shadow, seed + 40);
  g.restore();
}

function earth(g, ink, x, y, r, seed) {
  const { C } = ink;
  ink.blob(ink.ellipseRing(x, y, r, r, 16), '#4f6670', {
    lw: 5,
    seed,
    shade: ['#1f262b', -r * 0.45, r * 0.1],
  });
  g.save();
  trace(g, ink.curve(ink.ellipseRing(x, y, r, r, 16), true, 5));
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
function lander(ink, x, y, k, seed) {
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
}
