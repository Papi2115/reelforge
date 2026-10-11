// Apollo 11 (C-CAM concept film 3) place `panelWall`: a close lander panel wall for inserts (the
// computer, the 1202 alarm, the fuel gauge are drawn over it by the shots). Four riveted metal
// panels with tape and stains, a bank of toggle switches top right, the cabin floodlight (its pool
// is `light`). Ported from films/03-apollo-11/js/sets/sets-b.js (setPanelWall) + metalPanel and
// switches of lunar.js. opts.seed varies the panels (the film's shots used 340, 350 and 420;
// default 340, the computer shot).
const SEED = 340;

export const place = {
  id: 'panelWall',
  name: 'Lander panel wall (close, for inserts)',
  bounds: [1920, 1080],
  light: { x: 900, y: 400, rx: 1100, ry: 700, color: '#e0a443', alpha: 0.06 },
  anchors: { switches: [1675, 170], foregroundLeft: [230, 1960], foregroundRight: [1420, 1560] },
  collide: [],
  draw(g, ink, t, opts) {
    const seed = typeof opts.seed === 'number' ? opts.seed : SEED;
    ink.rect(-400, -300, 2700, 1700, '#45463f', {
      seed,
      lw: 0,
      mottle: ['rgba(20,20,16,0.3)', 10, 120],
    });
    for (let i = 0; i < 4; i += 1) {
      metalPanel(g, ink, -300 + i * 640, -200, 620, 1500, seed + 1 + i, '#55554b');
    }
    switches(ink, 1500, 100, 6, 3, 70, seed + 6);
  },
};

// Metal wall: flat panel with rivet rows, a strip of tape (on some), a stain.
function metalPanel(g, ink, x, y, w, h, seed, col) {
  const { time } = ink;
  ink.rect(x, y, w, h, col, {
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
