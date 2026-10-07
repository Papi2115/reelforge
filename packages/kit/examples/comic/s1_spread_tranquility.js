// Comic breakthrough: double-page spread, inspiration 1 of 2 (showcase comic-panels-v2 shot 9).
// Narration: "... Tranquility Base." (a long silence before it; the hold is trimmed to the rule:
// never more than 4 s without a new beat).
// Mechanism: assemble 'merge', pieces 'grid' - the page turns onto four panels that are secretly
// one picture; the gutters close on their own beats (horizontal first), each panel slides into
// register, the borders thin out, the margin slides off, the picture bleeds off every edge. Then
// it holds: one foil glint, a tiny pencilled SEA OF TRANQUILITY by the spine.
// Focal: Eagle on the right third, its shadow running out of the spread; the title second.
// Traces: panels out of register before the merge, title letters leaning, regolith drifted
// against them, a pencilled margin note with a two-stroke arrow, the spine crease.
// Note: the front-view Eagle can read a little like a face (DECISIONS.md); kept as in the
// showcase Papi approved.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cs1',
  title: 'Comic spread: Tranquility Base',
  treatment: 'title-card',
};

const GLINT = [4.1, 4.17];
const NOTE_T = 5.2;
const EAGLE = [526, 262];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
  F.poly([-7, 24, 7, 24, 10, 31, -10, 31], 'greyMid');
  g.ink([-7, 24, 7, 24, 10, 31, -10, 31], { key: key + 'bell' });
  g.ink(D, { key: key + 'D' });
  const A = [-25, 0, 25, 0, 27, -9, 22, -26, 12, -33, -11, -33, -22, -26, -27, -9];
  F.poly(
    A,
    g.tone('greyMid', (lx) => clamp01((lx - 2) / 30) * 0.55, {
      cell: 3,
      angle: 0.78,
      on: 'greyLight',
    }),
  );
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
}

/** Eagle's shadow under the low sun: the silhouette laid flat and stretched to the right. */
function shadow(g, paint) {
  const flat = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length; i += 2) out.push(-pts[i + 1] * 2.1 + 70, pts[i] * 0.34);
    return out;
  };
  g.poly(flat([-33, 3, 33, 3, 33, 22, -33, 22]), paint);
  g.poly(flat([-27, -9, -22, -26, -11, -33, 11, -33, 22, -26, 27, -9, 25, 3, -25, 3]), paint);
  for (const side of [-1, 1]) {
    const a = flat([side * 28, 6, side * 49, 37]);
    g.line(a[0], a[1], a[2], a[3], paint, g.w(2.4));
  }
}

function boulder(g, x, y, r, key) {
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + g.rnd(key, i) * 0.5;
    const rr = r * (0.75 + g.rnd(key, i + 10) * 0.35);
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.62 - (Math.sin(a) < 0 ? r * 0.2 : 0));
  }
  g.ellipse(x + r * 1.5, y + r * 0.45, r * 1.6, r * 0.22, 'night');
  g.plate.poly(pts, 'greyDark');
  g.ink(pts, { boil: 0.5, key });
}

/** The one picture across both pages: black sky, a low ridge, the plain, the title, Eagle. */
function vista(g, t) {
  const sky = (lx, ly) => 0.22 * clamp01((ly - 70) / 70);
  g.rect(-20, -20, 680, 400, g.tone('cyanDeep', sky, { cell: 4, angle: 0.26, on: 'night' }));
  const ridge = [];
  for (let x = -40; x <= 690; x += 15)
    ridge.push(
      x,
      132 + x * 0.014 - 4 - 5 * g.rnd('ridge', Math.floor(x / 60)) - 3 * Math.sin(x / 23),
    );
  g.plate.poly(
    [...ridge, 690, 160, -40, 160],
    g.tone('greyDark', 0.35, { cell: 3, angle: 0.78, on: 'greyMid' }),
  );
  g.ink(ridge, { closed: false, boil: 0.4, key: 'ridge' });
  g.ground({
    x0: -40,
    x1: 690,
    horizon: 138,
    xc: 300,
    radius: 9000,
    tilt: 0.014,
    bottom: 400,
    craters: 46,
    craterScale: 1.1,
    key: 'plain',
  });
  const rim = [-40, 300, 30, 318, 110, 334, 180, 352, 200, 400, -40, 400];
  g.plate.poly(rim, g.tone('night', 0.35, { cell: 4, angle: 0.78, on: 'greyDark' }));
  g.ink(rim.slice(0, 8), { closed: false, w: g.w(1.5), key: 'rim' });
  for (let i = 0; i < 5; i++)
    boulder(g, 20 + i * 34 + g.rnd('b', i) * 10, 312 + i * 6, 5 + g.rnd('br', i) * 6, 'bo' + i);
  g.standing('TRANQUILITY BASE', { x: 46, y0: 218, y1: 188, h0: 32, h1: 20, key: 'title' });
  const [ex, ey] = EAGLE;
  shadow(g.at(ex - 34, ey + 1, 1.35), g.dither('greyMid', 'greyDark', 0.8));
  lander(g.at(ex, ey - 54, 1.35), 'eagle');
  if (t >= GLINT[0] && t < GLINT[1]) g.rect(ex - 30, ey - 34, 2, 2, 'paper');
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 109, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  page.spread({
    intent: 'the landing site is one wide, still plain, and Eagle is the only made thing on it',
    art: vista,
    assemble: 'merge',
    pieces: 'grid',
    delay: 1.05,
    dur: 1.4,
    beats: [GLINT[0]],
  });
  page.note('SEA OF TRANQUILITY', { x: 334, y: 40, at: NOTE_T, dur: 0.9 });
  page.arrow([352, 52], [340, 118], { at: NOTE_T + 1.0, dur: 0.35 });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
