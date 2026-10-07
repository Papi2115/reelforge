// Comic look A (comic-story), template 2: "the descent, read panel by panel" (showcase
// comic-panels-v2 shot 2). Four uneven panels: Eagle falling, the crew asking, the code, Houston.
// The page camera reads it like an eye (hold, travel, hold, each travel its own ease and length)
// and pulls back to the whole page, which ends on the question, not the answer.
// Focal: Steve Bales' thought cloud "GO, OR ABORT?" - the page ends on it.
// Traces: the colour plates print Y, C, M, K one after another, crew poses differ, a thumbprint,
// a thought balloon instead of an answer, plates off register per panel.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'ca2',
  title: 'Comic story: the descent',
  treatment: 'character-scene',
};

const PANELS = {
  eagle: [12, 12, 262, 13, 257, 348, 13, 347],
  crew: [270, 12, 628, 13, 627, 148, 271, 150],
  code: [271, 159, 389, 158, 391, 348, 270, 347],
  houston: [399, 158, 628, 160, 627, 348, 400, 347],
};

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

/** Houston: the guidance officer at his console, from behind, in a white shirt. */
function houston(g, o) {
  const F = g.plate;
  F.rect(-10, -10, 260, 220, g.tone('cyan', 0.22, { cell: 4, on: 'cyanDeep' }));
  // Wall projection screen: the descent plot, dim, texture only.
  F.rect(118, 8, 104, 58, 'night');
  const plot = [];
  for (let i = 0; i <= 20; i++) plot.push(124 + i * 4.6, 18 + 38 * Math.pow(i / 20, 1.6));
  g.polyline(plot, 'cyan', { w: 1 });
  g.ink([118, 8, 222, 8, 222, 66, 118, 66], { boil: 0.4, key: o.key + 's' });
  F.poly([-10, 128, 240, 112, 240, 200, -10, 200], 'greyMid');
  F.poly([-10, 128, 240, 112, 240, 124, -10, 142], 'greyLight');
  for (const mx of [138, 186]) {
    const box = [mx, 76, mx + 40, 74, mx + 41, 112, mx + 1, 114];
    F.poly(box, 'greyDark');
    F.poly([mx + 4, 80, mx + 36, 78, mx + 37, 106, mx + 5, 108], 'night');
    for (let l = 0; l < 4; l++)
      g.rect(mx + 8, 84 + l * 5, 12 + g.rnd(o.key, mx + l) * 14, 1, 'paper');
    g.ink(box, { boil: 0.4, key: o.key + mx });
  }
  g.ink([-10, 128, 240, 112], { closed: false, key: o.key + 'desk' });
  g.ink([-10, 142, 240, 124], { closed: false, key: o.key + 'desk2' });
  // Bales from behind, lost profile toward his monitors: glasses, headset, boom mic.
  const L = g.at(o.lean, 0);
  const body = [30, 200, 34, 140, 46, 124, 70, 118, 96, 120, 110, 132, 114, 200];
  const shirt = (lx) => 0.15 + 0.5 * Math.max(0, (lx - 60) / 54);
  L.plate.poly(body, L.tone('shade', shirt, { cell: 3, angle: 0.78, on: 'paper' }));
  L.ink(body, { boil: 0.5, key: o.key + 'body' });
  L.blob(
    [
      { c: [110, 136, 136, 132, 5] },
      { e: [140, 130, 6, 4] },
      { c: [100, 128, 110, 138, 8], fill: 'paper' },
    ],
    'shade',
    { key: o.key + 'arm' },
  );
  L.line(64, 140, 60, 196, 'shade', 1);
  L.line(88, 132, 92, 180, 'shade', 1);
  L.plate.rect(64, 104, 16, 16, 'shade');
  const collar = [58, 120, 70, 114, 86, 114, 90, 122, 74, 124];
  L.plate.poly(collar, 'paper');
  L.ink(collar, { boil: 0.3, key: o.key + 'collar' });
  L.plate.ellipse(73, 92, 13, 15, 'shade');
  L.plate.ellipse(83, 96, 4, 9, 'aged');
  L.plate.poly(
    [60, 98, 60, 84, 66, 76, 76, 74, 84, 78, 86, 84, 80, 85, 76, 92, 74, 104, 64, 106],
    'ink',
  );
  L.line(78, 92, 87, 93, 'ink', 1);
  L.line(62, 80, 72, 75, 'ink', L.w(1.5));
  L.line(72, 75, 76, 90, 'ink', L.w(1.5));
  L.ellipse(76, 95, 3, 4, 'ink');
  L.line(78, 98, 90, 104, 'ink', 1);
  L.ink(g.ellipsePts(73, 92, 13, 15, 18), { boil: 0.4, key: o.key + 'head' });
  // Chair back in the foreground.
  F.poly([-10, 160, 30, 150, 36, 200, -10, 200], g.dither('night', 'greyDark', 0.3));
  g.ink([-10, 160, 30, 150, 36, 200, -10, 200], { boil: 0.4, key: o.key + 'chair' });
}

/** Eagle's height: falls fast, then settles into its slow descent. */
function lmY(t, track) {
  return track(
    [
      [0, 36],
      [2.3, 196, 'inOutSine'],
      [8, 214, 'linear'],
    ],
    t,
  );
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 102, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { seg, track } = page.util;
  // The reader's eye: hold, travel, hold; each travel has its own ease and length.
  page.camera([
    { at: 0, x: 137, y: 104, zoom: 1.45 },
    { at: 0.5, x: 137, y: 104, zoom: 1.45 },
    { at: 2.0, x: 137, y: 190, zoom: 1.45, ease: 'inOutSine' },
    { at: 2.6, x: 449, y: 80, zoom: 2 },
    { at: 3.72, x: 449, y: 80, zoom: 2 },
    { at: 4.12, x: 330, y: 253, zoom: 2, ease: 'outQuart' },
    { at: 4.92, x: 330, y: 253, zoom: 2 },
    { at: 5.46, x: 513, y: 250, zoom: 2 },
    { at: 6.42, x: 513, y: 250, zoom: 2 },
    { at: 6.92, x: 320, y: 180, zoom: 1, ease: 'outBackSoft' },
  ]);
  page.press({ at: 0.06, step: 0.14, order: 'YCMK' });
  page.thumbprint(636, 178);
  page.panel(PANELS.eagle).draw((g, t) => {
    sky(g);
    g.ground({
      x0: -40,
      x1: 300,
      horizon: 214,
      xc: 120,
      radius: 700,
      tilt: 0.05,
      bottom: 360,
      craters: 22,
      key: 's2surf',
      craterScale: 0.8,
    });
    const count = Math.round(11 * (1 - seg(t, 1.9, 2.5)));
    g.speedLines({
      x: 137,
      y: lmY(t, track) - 16,
      dx: -0.06,
      dy: 1,
      count,
      length: 74,
      spread: 32,
      gap: 42,
      key: 's2sl',
    });
    lander(g.at(137, lmY(t, track), 1.15), 's2lm');
  });
  page.panel(PANELS.crew).draw((g, t) => {
    g.rect(270, 0, 370, 160, 'night');
    const alarmLamp = g.rnd('lamp2', Math.floor(t * 3)) < 0.7;
    cockpit(g.at(270, 10, 1), { key: 's2cock', horizonDy: -26, alarmLamp });
  });
  page.panel(PANELS.code).draw((g, t) => {
    g.rect(260, 150, 140, 210, g.tone('greyDark', 0.4, { cell: 3, on: 'greyMid' }));
    const acty = g.rnd('acty2', Math.floor(t * 6)) < 0.5;
    computer(g.at(270, 194, 1), { acty, labels: false, key: 's2dsky' });
  });
  page.panel(PANELS.houston).draw((g, t) => {
    houston(g.at(400, 158, 1), { key: 's2hou', lean: Math.round(2 * seg(t, 5.5, 5.9, 'outQuad')) });
  });
  // Lettering sits in page space: it travels with the panels and stays crisp at any zoom.
  page.balloon(['GIVE US A READING', 'ON THE 1202', 'PROGRAM ALARM.'].join('\n'), {
    x: 456,
    y: 46,
    at: 2.72,
    kind: 'radio',
    pop: 0.24,
    tail: [382, 60],
  });
  page.caption(['HOUSTON. GUIDANCE OFFICER', 'STEVE BALES.'].join('\n'), {
    x: 405,
    y: 165,
    at: 5.42,
    tilt: -1,
  });
  // No answer yet: the page ends on the question (the answer comes shots later).
  page.balloon('GO, OR ABORT?', {
    x: 560,
    y: 232,
    at: 5.95,
    kind: 'thought',
    pop: 0.2,
    dots: [480, 242],
  });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
