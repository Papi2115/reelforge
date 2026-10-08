// Comic look A (comic-story), template 1: "the hook" (showcase comic-panels-v2 shot 1).
// A splash of Eagle falling to the Moon slams in over its pencil layout, then two leaning gutters
// cut it into a strip: Eagle, the crew, the computer; "1202" slams in breaking the top border.
// Focal: the number 1202, the only red on the page, over the widest panel.
// Traces: the pencil layout before the slam, blue-line pencils past the corners, plates off
// register, a smudge on the gutter, the reader's pencilled question in the margin, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'ca1',
  title: 'Comic story: the hook',
  treatment: 'metaphor-object',
};

const SPLASH = [14, 12, 627, 13, 626, 347, 13, 346];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Space: a faint cyan screen thickening toward the horizon (print has no true black). */
function sky(g) {
  const tone = (lx, ly) => 0.32 * clamp01((ly - 40) / 200);
  g.rect(-200, -200, 1100, 700, g.tone('cyanDeep', tone, { cell: 4, angle: 0.26, on: 'night' }));
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

/** The crew from behind against the triangular windows; Aldrin looks down at the computer. */
function cockpit(g, o) {
  g.plate.rect(-10, -10, 380, 170, g.tone('cyanDeep', 0.3, { cell: 4, on: 'night' }));
  for (const win of [
    [34, 12, 168, 12, 168, 100],
    [192, 12, 326, 12, 192, 100],
  ]) {
    g.clip(win, () => {
      g.plate.rect(20, 0, 320, 120, 'ink');
      g.ground({
        x0: 20,
        x1: 340,
        horizon: 58 + o.horizonDy,
        xc: 180,
        radius: 900,
        tilt: -0.08,
        bottom: 120,
        craters: 16,
        key: o.key + 'win',
        craterScale: 0.5,
      });
    });
    g.ink(win, { w: g.w(1.6), boil: 0.5, key: o.key + win[0] });
  }
  g.plate.rect(172, 4, 16, 130, 'greyDark');
  for (let i = 0; i < 5; i++) {
    g.rect(176 + (i % 2) * 6, 20 + i * 15, 3, 3, i === 2 && o.alarmLamp ? 'yellow' : 'night');
  }
  crewBack(g, 104, -1, 0, 2, o.key + 'cdr');
  crewBack(g, 256, -8, 6, -3, o.key + 'lmp');
}

function crewBack(g, cx, headDx, headDy, sh, key) {
  const F = g.plate;
  const suit = [
    cx - 58,
    170,
    cx - 54,
    120 + sh,
    cx - 30,
    104 + sh * 0.5,
    cx + 30,
    104 - sh * 0.5,
    cx + 54,
    120 - sh,
    cx + 58,
    170,
  ];
  F.poly(
    suit,
    g.tone('greyMid', (lx) => 0.2 + 0.35 * Math.max(0, (lx - cx) / 58), {
      cell: 3,
      angle: 0.78,
      on: 'greyLight',
    }),
  );
  F.poly(
    [
      cx - 54,
      120 + sh,
      cx - 30,
      104 + sh * 0.5,
      cx - 18,
      106,
      cx - 40,
      126,
      cx - 50,
      170,
      cx - 58,
      170,
    ],
    'paper',
  );
  g.line(cx + 6, 112, cx + 2, 170, 'greyMid');
  g.ink(suit, { boil: 0.5, key: key + 's' });
  F.ellipse(cx, 102, 26, 6, 'greyMid');
  g.ink(g.ellipsePts(cx, 102, 26, 6, 18), { boil: 0.3, key: key + 'r' });
  const hx = cx + headDx;
  const hy = 80 + headDy;
  F.ellipse(hx, hy, 14, 16, 'aged');
  F.poly([hx - 5, hy - 15, hx + 5, hy - 15, hx + 4, hy - 2, hx - 4, hy - 2], 'paper');
  g.ellipse(hx - 14, hy + 3, 3.5, 6, 'ink');
  g.ellipse(hx + 14, hy + 3, 3.5, 6, 'ink');
  g.ink(g.ellipsePts(hx, hy, 14, 16, 18), { boil: 0.4, key: key + 'h' });
  const bx = cx + headDx * 0.3;
  g.ink(g.ellipsePts(bx, 76, 27, 28, 28), { boil: 0.3, key: key + 'b' });
  for (const [a0, a1] of [
    [3.5, 4.4],
    [4.65, 4.85],
  ]) {
    const arc = [];
    for (let i = 0; i <= 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      arc.push(bx + Math.cos(a) * 24, 76 + Math.sin(a) * 24);
    }
    g.polyline(arc, 'paper', { w: g.w(1.4) });
  }
}

/** The guidance computer's display and keyboard; PROG lit, the code on the bottom row. */
function computer(g, o) {
  const F = g.plate;
  F.rect(0, 0, 120, 134, g.tone('greyDark', 0.18, { cell: 3, angle: 0.4, on: 'greyMid' }));
  F.rect(6, 6, 50, 60, 'greyDark');
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 2; c++) {
      const prog = c === 1 && r === 2;
      F.rect(9 + c * 23, 9 + r * 8.1, 21, 6.2, prog ? 'yellow' : r > 4 ? 'night' : 'greyLight');
      if (prog && o.labels) {
        const tx = 9 + c * 23 + 10.5 - g.textWidth('PROG') / 2 / g.s;
        g.text('PROG', tx, 9 + r * 8.1 + 3.1 - 3 / g.s, { color: 'ink' });
      }
    }
  }
  F.rect(62, 6, 52, 60, 'night');
  if (o.acty) F.rect(65, 9, 18, 13, 'phosphor');
  g.digits('63', 95, 9);
  g.digits('05', 65, 26);
  g.digits('09', 95, 26);
  g.rect(64, 39.5, 48, 0.8, 'cyanDeep');
  g.digits('01202', 65, 43, { w: 7, h: 11 });
  g.rect(64, 57.5, 48, 0.8, 'cyanDeep');
  const key = (x, y) => {
    F.rect(x, y, 13, 15, 'greyLight');
    g.polyline([x, y, x + 13, y, x + 13, y + 15, x, y + 15], 'ink', { w: 1, closed: true });
    g.rect(x + 1, y + 13.5, 11, 1, 'greyMid');
  };
  key(6, 80);
  key(6, 100);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) key(22 + c * 15.4, 74 + r * 18);
  key(101, 80);
  key(101, 100);
  g.ink([0, 0, 120, 0, 120, 134, 0, 134], { w: g.w(1.2), boil: 0.5, key: o.key });
}

const lmY = (t) => 112 + t * 2.6;

function splash(g, t, shiftX) {
  const K = g.at(shiftX, 0);
  sky(K);
  K.ground({
    x0: -400,
    x1: 900,
    horizon: 205,
    xc: 180,
    radius: 1400,
    tilt: -0.04,
    bottom: 400,
    craters: 56,
    key: 's1surf',
  });
  K.speedLines({
    x: 455,
    y: lmY(t) - 20,
    dx: 0.1,
    dy: 1,
    count: 13,
    length: 96,
    spread: 42,
    gap: 52,
    key: 's1sl',
  });
  lander(K.at(455, lmY(t), 1.5), 's1lm');
}

/** After the cut: a paper flash, then the new subject of the panel. */
function swapTo(g, t, bg, draw) {
  if (t < 2.95) return splash(g, t, 0);
  if (t < 3.02) return g.rect(0, 0, 640, 360, 'paper');
  g.rect(0, 0, 640, 360, bg);
  draw();
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 101, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { seg } = page.util;
  page.camera([
    { at: 0, x: 320, y: 180, zoom: 1 },
    { at: 0.3, x: 320, y: 180, zoom: 0.985, ease: 'outQuad' },
  ]);
  page.shake(0.52, 5, 0.14);
  page.shake(3.46, 3, 0.1);
  page.thumbprint(30, 354);
  // Before the slam only the artist's pencil layout shows: horizon arc, Eagle as a box and legs.
  page
    .panel(SPLASH)
    .enter({ at: 0.3, kind: 'slam', rough: true })
    .exit(2.7)
    .rough((g, t) => {
      const pencil = g.pencil(0.35 + t * 1.5);
      const arc = [];
      for (let x = 0; x <= 640; x += 40)
        arc.push(x, 215 + ((x - 180) * (x - 180)) / 2800 - 0.04 * x + (x % 80 ? 1 : -1));
      g.strokeOn(arc, seg(t, 0, 0.22), pencil);
      g.polyline([412, 100, 500, 102, 498, 148, 414, 146], pencil, { w: 1, closed: true });
      g.strokeOn([420, 146, 384, 178], seg(t, 0.12, 0.25), pencil);
      g.strokeOn([492, 146, 528, 178], seg(t, 0.14, 0.27), pencil);
      g.strokeOn([430, 100, 438, 58, 476, 56, 486, 100], seg(t, 0.05, 0.2), pencil);
    })
    .draw((g, t) => splash(g, t, 0));
  // The splash splits: two hand-ruled gutters, uneven and leaning opposite ways.
  const g1 = (t) => 7 * seg(t, 2.7, 2.92, 'outCubic');
  const g2 = (t) => 12 * seg(t, 2.8, 3.06, 'outBack');
  page
    .panel((t) => [14, 12, 214 - g1(t) / 2, 12, 204 - g1(t) / 2, 347, 13, 346])
    .enter({ at: 2.7 })
    .draw((g, t) => splash(g, t, -345 * seg(t, 2.78, 3.3, 'inOutCubic')));
  page
    .panel((t) => [
      214 + g1(t) / 2,
      12,
      386 - g2(t) / 2,
      13,
      397 - g2(t) / 2,
      347,
      204 + g1(t) / 2,
      347,
    ])
    .enter({ at: 2.7 })
    .draw((g, t) =>
      swapTo(g, t, 'night', () =>
        cockpit(g.at(147, 92, 1.45), { key: 's1cock', alarmLamp: true, horizonDy: 6 }),
      ),
    );
  page
    .panel((t) => [386 + g2(t) / 2, 13, 627, 13, 626, 347, 397 + g2(t) / 2, 347])
    .enter({ at: 2.7 })
    .draw((g, t) =>
      swapTo(g, t, 'greyDark', () => {
        const acty = g.rnd('acty1', Math.floor(t * 7)) < 0.55;
        computer(g.at(333, 52, 2.55), { acty, labels: true, key: 's1dsky' });
      }),
    );
  page.smudge(390, 318, { at: 2.7 });
  page.caption('JULY 20, 1969.', { x: 30, y: 28, at: 0.7, tilt: 1 });
  page.balloon('PROGRAM ALARM.', {
    x: 300,
    y: 70,
    at: 1.35,
    until: 2.62,
    kind: 'radio',
    pop: 0.2,
    tail: (t) => [436, lmY(t) - 30],
  });
  // The number: four hand-cut letters slam in on an uneven beat, breaking the top border.
  page.sfx('1202', {
    x: 508,
    y: 28.5,
    at: 3.4,
    size: 7,
    pitch: 53.3,
    beats: [0, 0.07, 0.17, 0.215],
    angles: [-0.11, 0.05, -0.04, 0.1],
    rise: [-4.5, 2.5, -2.5, 4.5],
    fill: 'red',
    shade: 'ink',
    shadeTone: 0.55,
    extrude: [3, 4],
    mis: [2, -1],
  });
  page.balloon("IT'S A 1202.", { x: 288, y: 110, at: 3.95, kind: 'radio', tail: [292, 167] });
  // The reader's question, pencilled into the bottom margin under the code.
  page.note('WHAT IS 1202?', { x: 452, y: 349, at: 5.1 });
  page.arrow([544, 352], [572, 336], { at: 5.7, dur: 0.25 });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
