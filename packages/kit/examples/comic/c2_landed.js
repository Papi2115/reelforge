// Comic look C (comic-loud), template 2: "the line" (showcase comic-panels-v2 shot 10).
// The quietest page lands the loudest line: out of the window the last grains of dust fly clean
// arcs and stop dead (no air), a glove rests on the switch it just threw, then two linked
// balloons, the second lettered large: THE EAGLE HAS LANDED. Somebody pencils the time into the
// empty margin.
// Focal: the big balloon (size 2), then the pencilled 20:17 UTC in the empty margin.
// Traces: grains that stop dead, the glove loosening once after the line, a pencilled time with
// an underline, a two-line pencil note with a two-stroke arrow, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cc2',
  title: 'Comic loud: the line',
  treatment: 'character-scene',
};

const WIDE = [14, 14, 626, 12, 624, 212, 16, 214];
const GLOVE = [16, 224, 318, 222, 320, 348, 14, 346];
const WIN = [196, 22, 590, 22, 590, 204];
const DUST_END = 1.7;
const B1_T = 2.0;
const B2_T = 3.15;
const UTC_T = 4.45;
const NOTE_T = 5.45;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
  const lit = [];
  for (let i = 0; i < pts.length; i += 2)
    lit.push(x + (pts[i] - x) * 0.7 - r * 0.28, y + (pts[i + 1] - y) * 0.72 - r * 0.1);
  g.plate.poly(lit, 'greyLight');
  g.ink(pts, { boil: 0.5, key });
}

/** The view out of the window: ground, horizon, and grains finishing their arcs. */
function windowView(g, t) {
  g.plate.rect(
    0,
    0,
    640,
    360,
    g.layer(g.tone('cyanDeep', 0.28, { cell: 4, angle: 0.26 }), 'night'),
  );
  g.clip(WIN, () => {
    const sky = (lx, ly) => 0.2 * clamp01((ly - 30) / 60);
    g.plate.rect(
      0,
      0,
      640,
      360,
      g.layer(g.tone('cyanDeep', sky, { cell: 4, angle: 0.26 }), 'night'),
    );
    const hy = g.ground({
      x0: 180,
      x1: 600,
      horizon: 86,
      xc: 380,
      radius: 3000,
      tilt: -0.02,
      bottom: 230,
      craters: 22,
      craterScale: 0.7,
      key: 'win',
    });
    for (let i = 0; i < 4; i++) {
      const x = 300 + i * 70 + g.rnd('bx', i) * 30;
      boulder(g, x, hy(x) + 30 + g.rnd('by', i) * 60, 4 + g.rnd('br', i) * 5, 'bo' + i);
    }
    // Dust: each grain flies a clean parabola from where the exhaust threw it, lands, and stays.
    for (let i = 0; i < 40; i++) {
      const x0 = g.range('d', i, 230, 560);
      const floor = hy(x0) + 12 + g.rnd('d', i + 40) * 90;
      const t0 = -0.35 + g.rnd('d', i + 80) * 0.6;
      const tl = t0 + 0.7 + g.rnd('d', i + 120) * (DUST_END - 0.75);
      if (t < t0) continue;
      const vx = g.range('d', i + 160, 40, 120) * (g.rnd('d', i + 200) < 0.5 ? -1 : 1);
      const fall = 260;
      const vy = (fall * (tl - t0)) / 2;
      const at = (tau) => [x0 + vx * tau, floor - (vy * tau - (fall * tau * tau) / 2)];
      const tau = Math.min(t, tl) - t0;
      const [x, y] = at(tau);
      if (t < tl) {
        const [px, py] = at(Math.max(0, tau - 1 / 30));
        g.line(px, py, x, y, 'greyLight', 1);
        g.rect(x - 1, y - 1, 2, 2, 'paper');
      } else g.rect(x, floor, 2, 1, 'greyDark');
    }
  });
  g.polyline(WIN, 'greyDark', { w: 5, closed: true });
  g.ink(WIN, { boil: 0.4, key: 'frame' });
  g.plate.poly([0, 178, 150, 186, 196, 214, 0, 214], 'greyDark');
  for (let i = 0; i < 4; i++)
    g.rect(18 + i * 30 + g.rnd('l', i) * 6, 192 + (i % 2), 10, 5, i === 1 ? 'yellow' : 'night');
  g.ink([0, 178, 150, 186, 196, 214], { closed: false, key: 'wall' });
}

/** A pressure-suit glove resting on the guarded toggle it threw (press 1 = lever down). */
function gloveSwitch(g, press) {
  const F = g.plate;
  F.rect(-30, -30, 240, 180, g.layer(g.tone('greyDark', 0.28, { cell: 3, angle: 0.5 }), 'greyMid'));
  for (const [sx, sy] of [
    [10, 10],
    [150, 12],
    [12, 100],
  ]) {
    g.ellipse(sx, sy, 2.4, 2.4, 'greyDark');
    g.line(sx - 1, sy, sx + 1, sy, 'ink');
  }
  [34, 80, 126].forEach((sx, i) => {
    F.rect(sx - 12, 64, 24, 16, 'greyDark');
    g.rect(sx - 15, 52, 3, 34, 'greyLight');
    g.rect(sx + 12, 52, 3, 34, 'greyLight');
    g.ink([sx - 12, 64, sx + 12, 64, sx + 12, 80, sx - 12, 80], { boil: 0, key: 'b' + i });
    const p = i === 1 ? clamp01(press) : i === 0 ? 1 : 0;
    const a = -Math.PI / 2 + p * Math.PI;
    g.line(sx, 72, sx + Math.cos(a) * 4, 72 + Math.sin(a) * 17, 'ink', g.w(4));
    g.line(sx, 72, sx + Math.cos(a) * 4, 72 + Math.sin(a) * 17, 'greyLight', g.w(2));
    g.ellipse(sx, 72, 3, 3, 'greyLight');
  });
  const tipY = 72 + Math.sin(-Math.PI / 2 + clamp01(press) * Math.PI) * 17 - 6;
  const dy = (tipY - 49) * 0.55;
  const suit = g.tone('greyMid', (lx, ly) => 0.12 + 0.4 * clamp01((ly - 20) / 70), {
    cell: 3,
    angle: 0.78,
    on: 'greyLight',
  });
  g.blob(
    [
      { e: [128, 24 + dy, 30, 20] },
      { c: [112, 34 + dy, 82, tipY, 6.5] },
      { c: [120, 42 + dy, 104, 56 + dy, 6.5] },
      { c: [132, 44 + dy, 120, 58 + dy, 6.5] },
      { c: [143, 42 + dy, 134, 54 + dy, 5.5] },
      { c: [106, 16 + dy, 88, 30 + dy, 6] },
      { c: [162, 14 + dy * 0.5, 190, 4, 18], fill: 'paper' },
    ],
    suit,
    { key: 'glove' },
  );
  g.line(108, 48 + dy, 116, 46 + dy, 'ink', 1);
  g.line(124, 52 + dy, 130, 50 + dy, 'ink', 1);
  g.line(150, 0, 156, 36 + dy * 0.5, 'cyan', g.w(3));
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 110, anchor: ctx.anchor });
  ctx.scene.add(page);
  const u = page.util;
  page.panel(WIDE).draw(windowView);
  page.panel(GLOVE).draw((g, t) => {
    const press = u.track(
      [
        [0, 1],
        [3.9, 1],
        [4.2, 0.9, 'inOutSine'],
      ],
      t,
    );
    g.plate.rect(
      0,
      200,
      340,
      160,
      g.layer(g.tone('greyDark', 0.28, { cell: 3, angle: 0.5 }), 'greyMid'),
    );
    gloveSwitch(g.at(22, 180, 1.22), press);
  });
  // The link between the two balloons is drawn first: the balloons cover its ends.
  page.draw(
    (g) => {
      g.poly([96, 50, 101, 47, 153, 132, 148, 136], 'paper');
      g.line(96, 50, 148, 136, 'ink', 1);
      g.line(101, 47, 153, 132, 'ink', 1);
    },
    { at: B2_T + 0.24 },
  );
  page.balloon('HOUSTON, TRANQUILITY\nBASE HERE.', { x: 98, y: 52, at: B1_T, tail: [40, 214] });
  page.balloon('THE EAGLE\nHAS LANDED.', { x: 150, y: 134, at: B2_T, pop: 0.26, size: 2 });
  // The empty margin, and somebody's pencil in it.
  page.draw(
    (g, t) => {
      const shown = Math.floor(
        u.track(
          [
            [UTC_T, 0],
            [UTC_T + 0.14, 2.6, 'linear'],
            [UTC_T + 0.24, 2.9, 'linear'],
            [UTC_T + 0.55, 9.99, 'outQuad'],
          ],
          t,
        ),
      );
      g.text('20:17 UTC', 392, 258, {
        color: 'pencil',
        scale: 2,
        reveal: shown,
        slant: 1,
        jitter: 1.4,
      });
      if (t >= UTC_T + 0.62)
        g.strokeOn(
          [392, 278, 450, 279, 506, 276],
          u.seg(t, UTC_T + 0.62, UTC_T + 0.8),
          'pencil',
          1,
        );
    },
    { at: UTC_T },
  );
  page.note('NO AIR. THE DUST', { x: 396, y: 292, at: NOTE_T, dur: 0.55 });
  page.note('JUST STOPS.', { x: 404, y: 304, at: NOTE_T + 0.55, dur: 0.3 });
  page.arrow([470, 296], [528, 214], { at: NOTE_T + 0.95, dur: 0.35 });
  page.thumbprint(612, 334);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
