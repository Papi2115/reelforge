// Apollo 11 (C-CAM concept film 3) place `windowPov`: looking out of the lander window. One big
// triangle of glass in a flat metal bezel over the landing area: black sky, the moon ground seen
// on approach, a crater ringed by boulders; a strip of tape on the sill. The original set has no
// warm light (no `light`). Ported from films/03-apollo-11/js/sets/sets-b.js (setWindowPOV) +
// crater / boulder / moon ground of lunar.js.
const M = { GROUND: '#7a766a', GROUND_D: '#5d5a50', GROUND_L: '#99958a' };

export const place = {
  id: 'windowPov',
  name: 'Out of the lander window: the boulder field',
  bounds: [1920, 1080],
  anchors: { crater: [1000, 650], overShoulder: [380, 1820] },
  collide: [],
  draw(g, ink) {
    ink.rect(-400, -300, 2700, 1700, '#4d4c42', {
      seed: 110,
      lw: 0,
      mottle: ['rgba(20,20,16,0.3)', 8, 120],
    });
    windowAt(g, ink, [-60, 40, 1980, 40, 1460, 1060, 420, 1060], 111, (bb) => {
      windowView(g, ink, bb, 0.8, 112);
      crater(ink, 1000, 650, 300, 113);
      for (let i = 0; i < 34; i += 1) {
        const a = ink.time.hash(114, i) * Math.PI * 2;
        const d = 0.4 + 0.9 * ink.time.hash(114, i, 1);
        const r = 14 + 40 * ink.time.hash(114, i, 2) * d;
        boulder(ink, 1000 + Math.cos(a) * 380 * d, 650 + Math.sin(a) * 140 * d, r, 115 + i);
      }
    });
    ink.rect(520, 1000, 180, 40, 'rgba(180,170,130,0.8)', { seed: 116, lw: 3, amp: 1 });
  },
};

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

// Boulder: rough lump, hatched shadow side, a flat black shadow thrown right (low sun).
function boulder(ink, x, y, r, seed) {
  const shadow = [x - r * 0.6, y + r * 0.12, x + r * 2.2, y + r * 0.02, x + r * 2.5, y + r * 0.34];
  ink.blob([...shadow, x - r * 0.4, y + r * 0.42], '#34322d', { sharp: true, lw: 0, seed });
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = Math.PI + (i / 7) * Math.PI;
    const k = 0.75 + 0.35 * ink.time.hash(seed, i);
    pts.push(x + Math.cos(a) * r * k, y + Math.sin(a) * r * 0.9 * k);
  }
  pts.push(x + r * 0.9, y + r * 0.2, x - r * 0.9, y + r * 0.2);
  ink.blob(pts, '#8a8578', {
    sharp: true,
    lw: Math.min(7, 2 + r / 12),
    seed: seed + 1,
    shade: ['#5b584e', r * 0.35, 0],
    hatch: { c: 'rgba(30,28,24,0.5)', n: 2, len: r * 0.6, gap: 6, k: 3, ang: 70 },
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

// What is outside the window: black sky over the moon ground, on approach k (1 = high).
function windowView(g, ink, bb, k, seed) {
  ink.rect(bb.x0 - 10, bb.y0 - 10, bb.w + 20, bb.h + 20, '#0d0f12', { seed, lw: 0 });
  ink.stars(bb.x0, bb.y0, bb.w, bb.h * 0.3, 14, seed + 1, '#6e6b5e');
  const hy = bb.y0 + bb.h * (0.34 - 0.12 * (1 - k));
  g.save();
  g.translate(bb.cx, hy);
  g.scale(1 / k, 1 / k);
  g.translate(-bb.cx, -hy);
  const ground = { craters: 70, scale: 0.7, col: '#a29d8e' };
  moonGround(g, ink, bb.x0 - 1400, hy, bb.x1 + 1400, hy + 900 * k + 400, seed + 2, ground);
  g.restore();
}

// The window: a flat metal bezel round the glass (the same shape pulled in toward its centre).
function windowAt(g, ink, pts, seed, view) {
  const n = pts.length / 2;
  const cx = pts.filter((v, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / n;
  const cy = pts.filter((v, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / n;
  const glass = pts.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * 0.9 : cy + (v - cy) * 0.88));
  ink.blob(pts, '#56564c', {
    sharp: true,
    lw: 7,
    seed,
    shade: ['rgba(0,0,0,0.3)', -10, 10],
    hatch: { c: 'rgba(15,15,12,0.4)', n: 4, len: 40, gap: 8, k: 3, ang: 30 },
  });
  g.save();
  g.beginPath();
  g.moveTo(glass[0], glass[1]);
  for (let i = 2; i < glass.length; i += 2) g.lineTo(glass[i], glass[i + 1]);
  g.closePath();
  g.clip();
  view(ink.bbox(glass));
  g.restore();
  ink.inkLine(ink.wobble(glass, 2, seed + 1, 60), { w: 8, closed: true, seed: seed + 1 });
}
