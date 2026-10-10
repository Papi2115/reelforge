// Apollo 11 (C-CAM concept film 3) place `control`: mission control. A smoky room, the wall of
// screens (the moon chart with the track drawn on it, side screens with plots), two flat bands of
// smoke haze, the floor, the back row of consoles with dim screens, one warm pool (`light`).
// Ported from films/03-apollo-11/js/sets/sets-c.js (setControl + console). `foreground` draws what
// the original draws OVER the people standing behind it: the front console row with the ashtray
// and the cigarette (controlFront) and its smoke curling on twos (cigSmoke; opts.smoke: false
// drops it).
export const place = {
  id: 'control',
  name: 'Mission control',
  bounds: [1920, 1080],
  light: { x: 1400, y: 700, rx: 600, ry: 380, color: '#e0a443', alpha: 0.08 },
  anchors: {
    chart: [960, 230],
    leftDesk: [470, 1100],
    rightDesk: [1260, 1110],
    rowFarLeft: [180, 1060],
    rowLeft: [760, 1060],
    rowRight: [1660, 1060],
    rowFarRight: [2000, 1060],
  },
  collide: [
    [-220, 560, 440, 160],
    [260, 560, 440, 160],
    [740, 560, 440, 160],
    [1220, 560, 440, 160],
    [1700, 560, 440, 160],
  ],
  draw(g, ink) {
    ink.rect(-400, -300, 2700, 1700, '#2a2a28', { seed: 120, lw: 0 });
    screens(g, ink);
    [
      [260, 0.1],
      [520, 0.07],
    ].forEach(([y, a], i) => {
      const haze = [-300, y, 600, y - 40, 1300, y + 30, 2300, y - 20, 2300, y + 140, -300, y + 160];
      ink.blob(haze, `rgba(170,165,140,${String(a)})`, { lw: 0, seed: 145 + i });
    });
    ink.rect(-400, 860, 2700, 500, '#3a3630', { seed: 147, lw: 6 });
    for (let i = 0; i < 5; i += 1) {
      consoleDesk(g, ink, -200 + i * 480, 560, 400, 150 + i * 10, true);
    }
  },
  foreground(g, ink, t, opts) {
    const { C, time } = ink;
    for (let i = 0; i < 3; i += 1) consoleDesk(g, ink, -300 + i * 800, 900, 800, 200 + i * 10);
    ink.blob(ink.ellipseRing(420, 900, 40, 12, 10), '#6d6a5a', { lw: 4, seed: 230 }); // ashtray
    ink.tube([440, 896, 480, 890], [8, 8], C.LINEN, { lw: 3, seed: 231 });
    if (opts.smoke === false) return;
    const w = Math.floor(time.twos(t) * 3) % 3;
    const smoke = [470, 880, 480 + w * 4, 840, 464 - w * 3, 790, 482, 730];
    ink.brushStroke(smoke, { w: 4, color: 'rgba(190,185,160,0.5)', seed: 232 + w, taper: false });
  },
};

// The wall of screens: a moon chart with the track drawn on it, side screens with plots.
function screens(g, ink) {
  const { time } = ink;
  ink.rect(-300, 20, 2500, 420, '#1a1c1c', { seed: 121, lw: 8 });
  ink.rect(520, 50, 880, 360, '#2e3a36', { seed: 122, lw: 6 });
  g.save();
  g.beginPath();
  g.rect(526, 56, 868, 348);
  g.clip();
  for (let i = 0; i < 12; i += 1) {
    const x = time.rnd(540, 1380, 123, i);
    const y = time.rnd(70, 390, 123, i, 1);
    const k = time.hash(123, i, 2);
    ink.blob(ink.ellipseRing(x, y, 20 + 40 * k, 14 + 26 * k, 9), 'rgba(140,170,120,0.25)', {
      lw: 2,
      seed: 124 + i,
      lineColor: 'rgba(150,180,120,0.6)',
    });
  }
  const track = [560, 360, 800, 280, 1040, 220, 1240, 200, 1300, 210];
  ink.brushStroke(track, { w: 6, color: '#c6b56c', seed: 140, taper: false });
  g.restore();
  [
    [-200, 50, 620],
    [1430, 50, 640],
  ].forEach(([x, y, w], i) => {
    ink.rect(x, y, w, 360, '#2b3330', { seed: 141 + i, lw: 6 });
    const plot = [x + 40, y + 300, x + w * 0.3, y + 220, x + w * 0.6, y + 240, x + w - 40, y + 120];
    ink.brushStroke(plot, { w: 5, color: 'rgba(150,180,120,0.7)', seed: 143 + i, taper: false });
  });
}

// A console seen from behind / three-quarter: sloped top; `front` adds a dim screen box with
// three readouts (the back row faces the camera).
function consoleDesk(g, ink, x, y, w, seed, front) {
  const { C, time } = ink;
  ink.rough([x, y, x + w, y, x + w + 20, y + 160, x - 20, y + 160], C.GREYBLUE_D, {
    seed,
    lw: 6,
    shade: ['#2c353a', -16, 0],
    hatch: { c: 'rgba(10,12,14,0.45)', n: 4, len: 50, gap: 8, k: 3, ang: 80 },
  });
  if (!front) return;
  const top = [x + 20, y - 120, x + w - 20, y - 120, x + w - 10, y + 6, x + 10, y + 6];
  ink.rough(top, '#3b464c', { seed: seed + 1, lw: 6 });
  for (let i = 0; i < 3; i += 1) {
    const sx = x + 40 + i * ((w - 80) / 3);
    ink.rect(sx, y - 100, (w - 120) / 3, 70, '#1c2420', { seed: seed + 2 + i, lw: 4 });
    g.fillStyle = 'rgba(140,170,110,0.55)';
    for (let r = 0; r < 4; r += 1) {
      g.fillRect(sx + 8, y - 90 + r * 14, ((w - 120) / 3 - 16) * time.rnd(0.3, 0.9, seed, i, r), 4);
    }
  }
}
