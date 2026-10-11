// Apollo 11 (C-CAM concept film 3) place `pad`: the white room at the top of the launch tower.
// Dirty panelled walls, a window onto the rust-red tower truss and a dawn sky, a sign, the capsule
// hull with its hatch open on the right, floor grating, one warm work lamp (its pool is `light`).
// Ported from films/03-apollo-11/js/sets/sets-a.js (setPad) + metalPanel of lunar.js. The sign's
// stencilled "NO SMOKING" is not drawn: Grim Ink has no font text (lettering is a separate tool).
export const place = {
  id: 'pad',
  name: 'The white room at the top of the launch tower',
  bounds: [1920, 1080],
  light: { x: 760, y: 520, rx: 620, ry: 420, color: '#e0a443', alpha: 0.08 },
  anchors: { window: [380, 330], centre: [860, 1060], hatch: [1640, 1000], door: [300, 930] },
  collide: [],
  draw(g, ink) {
    walls(g, ink);
    towerWindow(g, ink);
    hull(g, ink);
    floorAndLamp(ink);
  },
};

const PANEL_HATCH = { c: 'rgba(20,20,16,0.35)', n: 5, len: 40, gap: 8, k: 3, ang: 80 };

// Metal wall: flat panel with rivet rows, a strip of tape (on some), a stain.
function metalPanel(g, ink, x, y, w, h, seed, col) {
  const { time } = ink;
  ink.rect(x, y, w, h, col, {
    seed,
    lw: 6,
    amp: 1.5,
    shade: ['rgba(0,0,0,0.18)', -18, 0],
    mottle: ['rgba(40,38,30,0.2)', 4, 40],
    hatch: PANEL_HATCH,
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

function walls(g, ink) {
  ink.rect(-300, -200, 2500, 1400, '#958d72', {
    seed: 20,
    lw: 0,
    mottle: ['rgba(60,50,30,0.25)', 10, 90],
  });
  for (let i = 0; i < 6; i += 1)
    metalPanel(g, ink, -260 + i * 300, 60, 290, 700, 21 + i, '#a39b7e');
}

// The window: dawn bands, the rust-red tower truss, a sliver of sea; then the sign and a stain.
function towerWindow(g, ink) {
  const { C } = ink;
  ink.rect(120, 150, 520, 360, '#20201c', { seed: 30, lw: 9 });
  g.save();
  g.beginPath();
  g.rect(128, 158, 504, 344);
  g.clip();
  ink.bands(120, 150, 640, 510, ['#4a4e52', '#6f6b5c', '#9a835a', '#b58d4c'], 1.3);
  ink.rect(120, 440, 520, 70, '#3c4a4c', { seed: 31, lw: 0 });
  [
    [180, 160, 210, 520],
    [560, 160, 590, 520],
  ].forEach(([a, b, c, d], i) => ink.beam((a + c) / 2, b, (a + c) / 2, d, 26, 32 + i, C.RUST));
  for (let k = 0; k < 2; k += 1) {
    ink.beam(195, 170 + k * 170, 575, 330 + k * 170, 14, 40 + k, C.RUST_D);
    ink.beam(575, 170 + k * 170, 195, 330 + k * 170, 14, 44 + k, C.RUST_D);
  }
  g.restore();
  ink.brushStroke([380, 154, 380, 506], { w: 8, seed: 34, taper: false });
  ink.rect(760, 210, 260, 90, '#c9bf9c', { seed: 35, lw: 5 });
  ink.stain(900, 420, 160, 90, 36, 'rgba(60,50,20,0.3)');
}

// The capsule hull on the right with the open hatch, the couch edge inside, rivets, a scratch.
function hull(g, ink) {
  ink.blob([1280, -200, 2200, -200, 2200, 1200, 1420, 1200, 1340, 700, 1300, 300], '#8e8a7b', {
    lw: 8,
    seed: 37,
    shade: ['#66635a', -40, 0],
    hatch: { c: 'rgba(30,28,24,0.45)', n: 10, len: 60, gap: 9, k: 3, ang: 75 },
  });
  ink.rect(1460, 220, 420, 460, '#1d1c1a', { seed: 38, lw: 10 });
  ink.rect(1500, 520, 360, 120, '#3a3730', { seed: 39, lw: 5 });
  g.fillStyle = 'rgba(25,24,20,0.7)';
  for (let i = 0; i < 9; i += 1) {
    g.fillRect(1440 + i * 50, 196, 7, 7);
    g.fillRect(1440 + i * 50, 700, 7, 7);
  }
  ink.brushStroke([1360, 760, 1420, 820, 1400, 900], { w: 4, seed: 40 });
}

// Floor grating and the work lamp hanging on its rod (its warm pool is the place `light`).
function floorAndLamp(ink) {
  const { C } = ink;
  ink.rect(-300, 860, 2500, 400, '#4f4b40', { seed: 41, lw: 6 });
  ink.bricks(-300, 860, 2500, 300, {
    bh: 30,
    bw: 30,
    seed: 42,
    line: 'rgba(15,12,8,0.6)',
    density: 0.05,
  });
  ink.beam(760, -200, 760, 70, 10, 43, C.BLACK);
  ink.blob([700, 70, 820, 70, 800, 120, 720, 120], C.BLACK, { lw: 5, seed: 44 });
  ink.blob(ink.ellipseRing(760, 122, 40, 9, 10), C.FIRE, { lw: 4, seed: 45 });
}
