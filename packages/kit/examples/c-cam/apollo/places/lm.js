// Apollo 11 (C-CAM concept film 3) place `lm`: inside the lunar lander. The cramped grey cabin
// with two triangular windows onto the moon ground, the centre panel (guidance computer, switches,
// two gauges, the master alarm), side switch banks, cables, tape, a scrawled note, the floor
// and the cabin floodlight (its pool is `light`). Ported from films/03-apollo-11/js/sets/sets-b.js
// (setLM) + lunar.js. opts: scroll (px the ground slides by), k (approach: 1 high, 0.35 near the
// ground), boulders (count in each window), alarm (the master alarm lit: red light, lit computer
// lamps, a red pool; flash it from the shot on twos). Not drawn: the stencilled letters (MASTER
// ALARM, the computer's key labels): no font text. The red pool lies under the floodlight's.
const M = { GROUND: '#7a766a', GROUND_D: '#5d5a50', GROUND_L: '#99958a' };
const WALL = '#686759';
const PANEL = '#45463f';
const WIN_L = [240, 130, 770, 130, 740, 480, 300, 450];
const WIN_R = [1150, 130, 1680, 130, 1620, 450, 1180, 480];

export const place = {
  id: 'lm',
  name: 'Inside the lunar lander',
  bounds: [1920, 1080],
  light: { x: 960, y: 400, rx: 900, ry: 520, color: '#e0a443', alpha: 0.07 },
  anchors: { computer: [920, 417], leftStation: [760, 1066], rightStation: [1420, 1050] },
  collide: [],
  // prettier-ignore
  draw(g, ink, t, opts) {
    const { C } = ink;
    const { scroll = 0, k = 1, boulders = 0, alarm = false } = opts;
    ink.rect(-400, -300, 2700, 1700, '#4d4c42', { seed: 60, lw: 0 });
    [[-400, 60, 650, 640], [1720, 60, 680, 640], [-400, 560, 2700, 300]].forEach(([x, y, w, h], i) => metalPanel(g, ink, x, y, w, h, 61 + i));
    metalPanel(g, ink, 230, -300, 1460, 400, 64);
    [WIN_L, WIN_R].forEach((pts, i) => {
      const view = { scroll: scroll + i * 500, k, boulders };
      windowAt(g, ink, pts, 70 + i, (bb) => windowView(g, ink, bb, view, 80 + i));
    });
    centrePanel(g, ink, alarm);
    switches(ink, -40, 640, 12, 2, 46, 96);
    switches(ink, 1480, 640, 12, 2, 46, 97);
    [[180, -60, 520, 40, 900, -40], [1050, -40, 1400, 50, 1760, -60]].forEach((pts, i) => ink.tube(pts, [16, 16, 16], C.BLACK, { lw: 4, seed: 98 + i }));
    ink.rect(300, 560, 120, 30, 'rgba(180,170,130,0.8)', { seed: 100, lw: 3, amp: 1 });
    ink.brushStroke([312, 570, 340, 580, 362, 566, 400, 578], { w: 2.5, seed: 101, taper: false });
    ink.stain(1820, 380, 120, 80, 102, 'rgba(30,24,10,0.3)');
    ink.rect(-400, 900, 2700, 500, '#3b3a33', { seed: 103, lw: 6, hatch: { c: 'rgba(10,10,8,0.5)', n: 10, len: 80, gap: 10, k: 2, ang: 5, bend: 0 } });
    ink.blob([900, 100, 1020, 100, 1000, 130, 920, 130], C.BLACK, { lw: 5, seed: 104 });
    if (alarm) ink.pool(1059, 287, 700, 500, C.RED, 0.09);
  },
};

// Metal wall: flat panel with rivet rows, a strip of tape (on some), a stain.
function metalPanel(g, ink, x, y, w, h, seed) {
  const { time } = ink;
  ink.rect(x, y, w, h, WALL, {
    seed,
    lw: 6,
    amp: 1.5,
    shade: ['rgba(0,0,0,0.18)', -18, 0],
    mottle: ['rgba(40,38,30,0.2)', 4, 40],
    hatch: { c: 'rgba(20,20,16,0.35)', n: 5, len: 40, gap: 8, k: 3, ang: 80 },
  });
  g.fillStyle = 'rgba(25,24,20,0.6)';
  for (let i = 8; i < w - 8; i += 34) {
    g.fillRect(x + i, y + 8, 5, 5);
    g.fillRect(x + i, y + h - 13, 5, 5);
  }
  if (time.hash(seed, 2) < 0.6) {
    const tx = x + w * time.rnd(0.1, 0.6, seed, 3);
    const ty = y + h * time.rnd(0.2, 0.7, seed, 4);
    ink.rect(tx, ty, 60, 16, 'rgba(170,160,120,0.7)', { seed: seed + 5, lw: 2, amp: 1 });
  }
  const sx = x + w * time.rnd(0.2, 0.8, seed, 6);
  const sy = y + h * time.rnd(0.3, 0.8, seed, 7);
  ink.stain(sx, sy, 50, 34, seed + 8, 'rgba(40,30,15,0.25)');
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

// Boulder: rough lump, hatched shadow side, a flat black shadow thrown to the right (low sun).
// prettier-ignore
function boulder(ink, x, y, r, seed) {
  ink.blob([x - r * 0.6, y + r * 0.12, x + r * 2.2, y + r * 0.02, x + r * 2.5, y + r * 0.34, x - r * 0.4, y + r * 0.42], '#34322d', { sharp: true, lw: 0, seed });
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = Math.PI + (i / 7) * Math.PI;
    const q = 0.75 + 0.35 * ink.time.hash(seed, i);
    pts.push(x + Math.cos(a) * r * q, y + Math.sin(a) * r * 0.9 * q);
  }
  pts.push(x + r * 0.9, y + r * 0.2, x - r * 0.9, y + r * 0.2);
  ink.blob(pts, '#8a8578', { sharp: true, lw: Math.min(7, 2 + r / 12), seed: seed + 1, shade: ['#5b584e', r * 0.35, 0], hatch: { c: 'rgba(30,28,24,0.5)', n: 2, len: r * 0.6, gap: 6, k: 3, ang: 70 } });
}

// What is outside a window: black sky over the moon ground; it slides by `scroll` and comes
// closer as the approach `k` drops (1 = high), with `boulders` strewn on it.
function windowView(g, ink, bb, v, seed) {
  const { hash } = ink.time;
  ink.rect(bb.x0 - 10, bb.y0 - 10, bb.w + 20, bb.h + 20, '#0d0f12', { seed, lw: 0 });
  ink.stars(bb.x0, bb.y0, bb.w, bb.h * 0.3, 14, seed + 1, '#6e6b5e');
  const hy = bb.y0 + bb.h * (0.34 - 0.12 * (1 - v.k));
  g.save();
  g.translate(bb.cx, hy);
  g.scale(1 / v.k, 1 / v.k);
  g.translate(-bb.cx - v.scroll, -hy);
  const ground = { craters: 70, scale: 0.7, col: '#a29d8e' };
  moonGround(g, ink, bb.x0 - 1400, hy, bb.x1 + 1400, hy + 900 * v.k + 400, seed + 2, ground);
  for (let i = 0; i < v.boulders; i += 1) {
    const q = hash(seed, i, 7);
    const x = bb.x0 - 300 + hash(seed, i, 8) * (bb.w + 600) + v.scroll;
    boulder(ink, x, hy + 30 + q * q * 500, 14 + 60 * q * q, seed + 50 + i);
  }
  g.restore();
}

// A window: a flat metal bezel round the glass (the same shape pulled in toward its centre).
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

// The guidance computer (DSKY) at half size: status lights (PROG, KEY REL lit by the alarm), the
// display, the keypad.
function dsky(ink, x, y, k, seed, alarm) {
  const { C } = ink;
  const R = (a, b, w, h, col, sd, opt) =>
    ink.rect(x + a * k, y + b * k, w * k, h * k, col, { seed: seed + sd, lw: 4, amp: 1, ...opt });
  R(0, 0, 400, 470, PANEL, 0, {
    lw: 7,
    shade: ['rgba(0,0,0,0.25)', -14, 0],
    hatch: { c: 'rgba(10,10,8,0.4)', n: 4, len: 40, gap: 8, k: 3, ang: 80 },
  });
  for (let i = 0; i < 6; i += 1) {
    const lit = alarm && (i === 2 || i === 4);
    R(30 + (i % 2) * 85, 24 + Math.floor(i / 2) * 50, 76, 38, lit ? C.FIRE : '#6d6a5a', 10 + i, {
      lw: 3,
    });
  }
  R(214, 20, 166, 160, '#1d211b', 20, { lw: 5 });
  const keyLight = ['rgba(200,190,160,0.18)', 3, -3];
  for (let i = 0; i < 18; i += 1) {
    const bx = 20 + (i % 6) * 61;
    const by = 214 + Math.floor(i / 6) * 82;
    R(bx, by, 54, 66, '#2a2a26', 30 + i, { lw: 4, light: keyLight });
  }
}

// Centre panel: computer, switches, gauges, the master alarm.
function centrePanel(g, ink, alarm) {
  const { C } = ink;
  ink.rect(790, 110, 340, 470, PANEL, { seed: 90, lw: 7, shade: ['rgba(0,0,0,0.2)', -14, 0] });
  dsky(ink, 820, 300, 0.5, 91, alarm);
  switches(ink, 1040, 330, 2, 6, 38, 92);
  gauge(g, ink, 880, 200, 48, 0.4, 93);
  gauge(g, ink, 1040, 200, 48, -0.6, 94);
  ink.rect(996, 264, 126, 44, alarm ? C.RED : C.RED_D, { seed: 95, lw: 5 });
}
