// Apollo 11 (C-CAM concept film 3) place `cm`: the command module cabin in lunar orbit. Cramped
// curved walls, two switch banks, a gauge, the round porthole with the Moon far below (its ground
// bobs slowly: a pure function of t), the couch frames, one warm lamp pool (`light`). Ported from
// films/03-apollo-11/js/sets/sets-c.js (setCM) + switches, gauge, moon ground of lunar.js. The
// drifting crumbs and pencil (floaters) belong to the orbit shot, not the set.
const M = { GROUND: '#7a766a', GROUND_D: '#5d5a50', GROUND_L: '#99958a' };
const PX = 1460;
const PY = 560;

export const place = {
  id: 'cm',
  name: 'Command module cabin in lunar orbit',
  bounds: [1920, 1080],
  light: { x: 760, y: 380, rx: 700, ry: 460, color: '#e0a443', alpha: 0.08 },
  anchors: { float: [700, 880], porthole: [PX, PY] },
  collide: [],
  draw(g, ink, t) {
    ink.rect(-400, -300, 2700, 1700, '#4a4a42', { seed: 160, lw: 0 });
    ink.blob(ink.ellipseRing(960, 560, 1100, 700, 20), '#686759', {
      lw: 9,
      seed: 161,
      shade: ['rgba(0,0,0,0.25)', -60, 30],
      mottle: ['rgba(40,38,30,0.2)', 8, 80],
      hatch: { c: 'rgba(20,20,16,0.35)', n: 10, len: 60, gap: 9, k: 3, ang: 70 },
    });
    switches(ink, 120, 140, 10, 3, 48, 162);
    switches(ink, 1360, 160, 9, 3, 48, 163);
    gauge(g, ink, 400, 420, 50, 0.3, 164);
    porthole(g, ink, t);
    ink.rect(-400, 940, 2700, 400, '#34332d', { seed: 170, lw: 6 });
    ink.tube([200, 900, 700, 960, 1200, 930], [40, 40, 40], '#5c5a4c', { lw: 6, seed: 171 });
  },
};

function porthole(g, ink, t) {
  ink.blob(ink.ellipseRing(PX, PY, 200, 200, 18), '#0d0f12', { lw: 0, seed: 165 });
  const glass = ink.curve(ink.ellipseRing(PX, PY, 196, 196, 18), true, 6);
  g.save();
  g.beginPath();
  g.moveTo(glass[0], glass[1]);
  for (let i = 2; i < glass.length; i += 2) g.lineTo(glass[i], glass[i + 1]);
  g.closePath();
  g.clip();
  ink.stars(PX - 200, PY - 200, 400, 140, 10, 166, '#77736a');
  const top = PY - 40 + Math.sin(t * 0.3) * 4;
  moonGround(g, ink, PX - 400, top, PX + 400, PY + 300, 167, { craters: 16, scale: 0.35 });
  g.restore();
  const rim = ink.curve(ink.ellipseRing(PX, PY, 200, 200, 18), true, 6);
  ink.inkLine(rim, { w: 34, closed: true, seed: 168, color: '#2b2b27' });
  const outer = ink.curve(ink.ellipseRing(PX, PY, 218, 218, 18), true, 6);
  ink.inkLine(outer, { w: 8, closed: true, seed: 169 });
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

// A bank of toggle switches, some up, some down, a few under guards.
function switches(ink, x, y, cols, rows, sp, seed) {
  const { C, time } = ink;
  for (let i = 0; i < rows * cols; i += 1) {
    const cx = x + (i % cols) * sp;
    const cy = y + Math.floor(i / cols) * sp;
    const lever = time.hash(seed, i) < 0.5 ? -sp * 0.38 : sp * 0.38;
    ink.blob(ink.ellipseRing(cx, cy, sp * 0.2, sp * 0.2, 7), C.BLACK, { lw: 3, seed: seed + i });
    const flat = { color: C.STONE, seed: seed + 40 + i, taper: false };
    ink.brushStroke([cx, cy, cx + 2, cy + lever], { w: 6, ...flat });
    if (time.hash(seed, i, 3) >= 0.15) continue;
    const [l, r, lo, hi] = [cx - sp * 0.32, cx + sp * 0.32, cy + sp * 0.2, cy - sp * 0.4];
    const guard = { w: 3, color: C.STONE_D, seed: seed + 80 + i, taper: false };
    ink.brushStroke([l, lo, l, hi, r, hi, r, lo], guard);
  }
}

// Round gauge: dial, ticks, a red low zone, the needle at angle a (rad, 0 = straight up).
function gauge(g, ink, x, y, r, a, seed) {
  const { C } = ink;
  ink.blob(ink.ellipseRing(x, y, r + 14, r + 14, 14), C.BLACK, { lw: 6, seed });
  const dial = { lw: 4, seed: seed + 1, shade: ['#9a9174', -r * 0.1, r * 0.08] };
  ink.blob(ink.ellipseRing(x, y, r, r, 14), '#c2b996', dial);
  g.save();
  g.strokeStyle = C.RED_D;
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.ellipse(x, y, r * 0.8, r * 0.8, 0, -Math.PI / 2 - 2.4, -Math.PI / 2 - 1.6);
  g.stroke();
  g.restore();
  for (let i = 0; i <= 10; i += 1) {
    const s = Math.sin(-2.4 + (4.8 * i) / 10);
    const c = -Math.cos(-2.4 + (4.8 * i) / 10);
    const tick = [x + s * r * 0.72, y + c * r * 0.72, x + s * r * 0.92, y + c * r * 0.92];
    ink.brushStroke(tick, { w: i % 5 ? 3 : 5, seed: seed + 2 + i, taper: false });
  }
  const tip = [x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82];
  ink.tube([x, y, ...tip], [r * 0.08, r * 0.03], C.INK, { lw: 0, seed: seed + 20 });
  ink.blob(ink.ellipseRing(x, y, r * 0.09, r * 0.09, 7), C.STONE, { lw: 3, seed: seed + 21 });
}
