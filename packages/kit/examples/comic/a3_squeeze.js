// Comic look A (comic-story), template 3: "the squeeze" (showcase comic-panels-v2 shot 6).
// The alarms keep coming while Eagle skims a boulder field: the gutters close in like walls at
// three speeds, a fourth panel (the hand on the stick) shoves its way in, the alarm is drawn, not
// heard (BEEP twice), a fifth panel elbows in with the second code - then the page freezes.
// Focal: the second code, 1201, in red, popped in over the crossing of the gutters.
// Traces: gutters closing at uneven speeds, two BEEP bursts with their own beats, a smudge on
// the crossing, plates off register, speed lines that stop before Eagle.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'ca3',
  title: 'Comic story: the squeeze',
  treatment: 'character-scene',
};

const ROOMY = {
  a: [14, 14, 332, 15, 330, 200, 15, 198],
  b: [346, 14, 626, 16, 625, 198, 345, 200],
  c: [14, 214, 250, 213, 251, 346, 15, 346],
};
const TIGHT = {
  a: [9, 9, 300, 11, 297, 206, 10, 203],
  b: [303, 8, 632, 9, 629, 182, 300, 203],
  c: [8, 207, 197, 208, 199, 352, 9, 351],
  d: [202, 213, 631, 186, 632, 352, 203, 351],
};
const CODE = [242, 150, 372, 146, 375, 214, 240, 211];
/** The page clock: a short lead-in, a beat a little slower than real time, frozen from 5.7 s. */
const FREEZE = 5.7;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sky(g, strength) {
  const tone = (lx, ly) => strength * clamp01((ly - 10) / 120);
  g.rect(-200, -200, 2000, 700, g.tone('cyanDeep', tone, { cell: 4, angle: 0.26, on: 'night' }));
}

/** Eagle, front view, sun from the left: gold-foil descent stage, grey ascent stage, legs. */
function lander(g, key) {
  const F = g.plate;
  const w2 = g.w(1.7);
  for (const side of [-1, 1]) {
    g.line(-28 * side, 4, -49 * side, 37, 'ink', w2);
    g.line(-31 * side, 20, -46 * side, 35, 'ink');
    F.ellipse(-50 * side, 39, 7, 2.4, 'greyLight');
    g.ink(g.ellipsePts(-50 * side, 39, 7, 2.4, 14), { boil: 0, key: key + side });
    g.line(-50 * side, 41, -50 * side - side, 52, 'ink');
  }
  g.line(-1, 22, 0, 38, 'ink', w2);
  for (let y = 26; y < 37; y += 3.4) g.line(-3, y, 3, y, 'ink');
  F.ellipse(0, 40, 6, 2.2, 'greyLight');
  g.ink(g.ellipsePts(0, 40, 6, 2.2, 14), { boil: 0, key: key + 'f' });
  const D = [-31, 0, 31, 0, 33, 3, 33, 21, 31, 24, -31, 24, -33, 21, -33, 3];
  const foil = (lx, ly) => Math.min(0.62, clamp01((lx + 4) / 46) * 0.55 + (ly > 15 ? 0.18 : 0));
  F.poly(D, g.tone('magenta', foil, { cell: 3, angle: 1.31, on: 'yellow' }));
  F.poly([-11, 3, 11, 3, 11, 22, -11, 22], g.dither('night', 'greyDark', 0.25));
  for (let i = 0; i < 7; i++) {
    const x = g.range(key, i, -29, 27);
    if (x > -13 && x < 11) continue;
    const y = g.range(key, i + 20, 3, 20);
    g.line(x, y, x + g.range(key, i + 40, 1.5, 3.5), y + g.range(key, i + 60, -1, 1.5), 'ink');
  }
  F.poly([-7, 24, 7, 24, 10, 31, -10, 31], 'greyMid');
  g.ink([-7, 24, 7, 24, 10, 31, -10, 31], { key: key + 'bell' });
  g.ink(D, { key: key + 'D' });
  const A = [-25, 0, 25, 0, 27, -9, 22, -26, 12, -33, -11, -33, -22, -26, -27, -9];
  const lit = (lx) => clamp01((lx - 2) / 30) * 0.55;
  F.poly(A, g.tone('greyMid', lit, { cell: 3, angle: 0.78, on: 'greyLight' }));
  F.poly([-27, -9, -22, -26, -17, -24, -19, -7], 'greyDark');
  F.poly([27, -9, 22, -26, 17, -24, 19, -7], 'night');
  F.poly([-13, -4, 13, -4, 15, -22, 7, -29, -7, -29, -15, -22], 'paper');
  for (const side of [-1, 1]) {
    const win = [-14 * side, -25, -3 * side, -25, -4 * side, -15];
    g.poly(win, 'night');
    g.ink(win, { boil: 0, key: key + 'w' + side });
  }
  F.poly([-5, -12, 5, -12, 5, -3, -5, -3], 'greyMid');
  g.ink([-5, -12, 5, -12, 5, -3, -5, -3], { boil: 0, key: key + 'h' });
  F.rect(-5, -37, 10, 4, 'greyMid');
  g.ink(A, { key: key + 'A' });
  g.line(10, -33, 14, -39, 'ink');
  F.ellipse(16, -41, 5, 4, 'greyLight');
  g.ink(g.ellipsePts(16, -41, 5, 4, 12), { boil: 0, key: key + 'rr' });
  g.line(22, -26, 28, -34, 'ink');
  F.ellipse(29, -36, 3.5, 3, 'greyLight');
  g.ink(g.ellipsePts(29, -36, 3.5, 3, 10), { boil: 0, key: key + 'sb' });
  for (const side of [-1, 1]) {
    g.line(28 * side, -22, 28 * side, -14, 'ink');
    g.line(28 * side - 3, -18, 28 * side + 3, -18, 'ink');
  }
}

/** A boulder lit from the left, its long shadow to the right. */
function boulder(g, x, y, r, key) {
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + g.rnd(key, i) * 0.5;
    const rr = r * (0.75 + g.rnd(key, i + 10) * 0.35);
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.62 - (Math.sin(a) < 0 ? r * 0.2 : 0));
  }
  g.ellipse(x + r * 1.5, y + r * 0.45, r * 1.6, r * 0.22, 'night');
  g.plate.poly(pts, 'greyDark');
  const lit = [];
  for (let i = 0; i < pts.length; i += 2) {
    lit.push(x + (pts[i] - x) * 0.7 - r * 0.28, y + (pts[i + 1] - y) * 0.72 - r * 0.1);
  }
  g.plate.poly(lit, 'greyLight');
  g.ink(pts, { boil: 0.5, key });
}

/** Through the window: boulders ride a loop of depth toward the glass, far to near. */
function boulderField(g, t) {
  const K = g.at(300, 0);
  const tone = (lx, ly) => 0.15 + 0.3 * clamp01(ly / 200);
  K.plate.rect(0, 0, 340, 200, K.tone('greyMid', tone, { cell: 4, angle: 0.78, on: 'greyLight' }));
  const items = [];
  for (let i = 0; i < 16; i++) items.push({ i, z: (K.rnd('bfz', i) + t * 0.42) % 1 });
  items.sort((p, q) => p.z - q.z);
  for (const { i, z } of items) {
    const near = z * z;
    const x = 170 + (K.rnd('bfx', i) - 0.5) * (80 + near * 460);
    boulder(K, x, 20 + near * 200, 2 + near * 26, 'bf' + i);
  }
  K.poly([0, 0, 120, 0, 0, 90], 'night');
  K.ink([120, 0, 0, 90], { closed: false, key: 's4win' });
}

/** A gloved hand round the pistol-grip controller: manual control. */
function gloveStick(g, tilt) {
  const F = g.plate;
  F.rect(-300, -300, 1200, 800, g.tone('cyan', 0.2, { cell: 4, on: 'cyanDeep' }));
  const base = [30, 140, 130, 140, 140, 170, 20, 170];
  F.poly(base, 'greyDark');
  g.ink(base, { boil: 0.3, key: 'stickbase' });
  const rot = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - 80;
      const dy = pts[i + 1] - 140;
      const c = Math.cos(tilt);
      const s = Math.sin(tilt);
      out.push(80 + dx * c - dy * s, 140 + dx * s + dy * c);
    }
    return out;
  };
  const grip = rot([68, 140, 92, 140, 96, 60, 90, 30, 72, 28, 64, 50]);
  g.poly(grip, 'night');
  g.ink(grip, { boil: 0.3, key: 'stickgrip' });
  g.poly(rot([74, 30, 86, 30, 86, 24, 74, 24]), 'red');
  const suit = g.tone('greyMid', 0.25, { cell: 3, angle: 0.78, on: 'greyLight' });
  g.blob(
    [
      { e: [120, 84, 26, 36] },
      { c: [58, 54, 104, 58, 7.5] },
      { c: [56, 70, 106, 72, 7.5] },
      { c: [58, 86, 106, 87, 7] },
      { c: [62, 101, 104, 100, 6.5] },
      { c: [112, 46, 76, 38, 7] },
      { c: [150, 70, 200, 66, 26], fill: 'paper' },
    ],
    suit,
    { angle: tilt, about: [80, 140], key: 'glove' },
  );
  for (const y of [62, 78, 94]) g.polyline(rot([66, y, 100, y + 1]), 'ink', { w: 1 });
  g.polyline(rot([142, 46, 146, 104]), 'cyan', { w: g.w(3) });
}

/** Eagle skims the field: the ground scrolls under it, it bobs, the speed lines trail it. */
function skim(g, t) {
  const K = g.at(-t * 150, 0);
  sky(K, 0.3);
  K.ground({
    x0: -60,
    x1: 1300,
    horizon: 132,
    xc: 400,
    radius: 6000,
    bottom: 260,
    craters: 70,
    key: 's4surf',
    craterScale: 0.7,
  });
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 120 + g.rnd('s4bx', i) * 60;
    boulder(K, x, 150 + g.rnd('s4by', i) * 40, 6 + g.rnd('s4br', i) * 7, 's4bo' + i);
  }
  const bob = Math.round(Math.sin((t / 0.82 + 0.25) * 3.1) * 1.5);
  g.speedLines({
    x: 104,
    y: 74 + bob,
    dx: 1,
    dy: 0.02,
    count: 12,
    length: 70,
    gap: 40,
    key: 's4sl',
  });
  lander(g.at(104, 80 + bob, 0.95), 's4lm');
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 106, anchor: ctx.anchor });
  ctx.scene.add(page);
  page.shake(1.86, 4, 0.13);
  page.shake(2.36, 3, 0.11);
  // Gutters close at three different speeds.
  page.panel(ROOMY.a).morph(TIGHT.a, { at: 0.3, dur: 1.7, ease: 'inOutCubic' }).draw(skim);
  page
    .panel(ROOMY.b)
    .enter({ at: 0.16 })
    .morph(TIGHT.b, { at: 0.42, dur: 1.38, ease: 'inOutSine' })
    .draw(boulderField);
  page
    .panel(ROOMY.c)
    .enter({ at: 0.3 })
    .morph(TIGHT.c, { at: 0.62, dur: 1.58, ease: 'inOutCubic' })
    .draw((g) => g.rect(0, 200, 260, 160, g.tone('cyanDeep', 0.35, { cell: 4, on: 'night' })));
  page.balloon('60 SECONDS.', {
    x: 114,
    y: 288,
    at: 1.3,
    kind: 'radio',
    pop: 0.2,
    size: 2,
    tail: [12, 213],
  });
  // The fourth panel shoves its way in: the hand takes manual control.
  page
    .panel(TIGHT.d)
    .enter({ at: 1.05, kind: 'slide', from: 'right', dur: 0.45 })
    .draw((g, t) => gloveStick(g.at(242, 201), (g.rnd('stick', Math.floor(t * 8)) - 0.5) * 0.16));
  // The alarm tone: big hand-cut letters, two bursts, the second smaller and lower.
  page.sfx('BEEP', {
    x: 317,
    y: 54.5,
    at: 1.86,
    size: 6.5,
    pitch: 54,
    beats: [0, 0.05, 0.11, 0.155],
    angles: [-0.13, 0.05, -0.05, 0.12],
    rise: [3.5, -5.5, 5.5, -3.5],
  });
  page.sfx('BEEP', {
    x: 508.5,
    y: 318.75,
    at: 2.36,
    size: 4.8,
    pitch: 41.7,
    beats: [0, 0.06, 0.09, 0.17],
    angles: [0.08, -0.06, 0.1, -0.03],
    rise: [-6.75, 3.25, -3.75, 7.25],
  });
  page.smudge(301, 196, { length: 8, angle: 2.2 });
  // A fifth, smaller panel elbows in over the crossing: the other code, same family, same red.
  page
    .panel(CODE, { border: 3 })
    .enter({ at: 2.95, kind: 'pop', dur: 0.19 })
    .draw((g) => {
      g.rect(200, 120, 220, 120, g.tone('cyanDeep', 0.3, { cell: 3, on: 'night' }));
      const shade = (lx, ly) => 0.5 * clamp01((ly - 176) / 22);
      const fill = g.layer(g.tone('ink', shade, { cell: 3, angle: 0.78 }), 'red');
      [-0.06, 0.04, -0.02, 0.07].forEach((angle, i) => {
        const y = 178.7 + (i % 2 ? 2 : -1);
        const look = { size: 3.4, angle, fill, extrude: [2, 3], mis: [1, -1], key: 'c' + i };
        g.bigLetter('1201'[i], 268 + i * 26, y, look);
      });
    });
  return { page };
}

export function update(t, state) {
  state.page.update(Math.max(0, Math.min(t, FREEZE) - 0.25) * 0.82);
}
