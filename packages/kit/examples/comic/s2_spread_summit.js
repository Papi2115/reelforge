// Comic breakthrough: double-page spread, inspiration 2 of 2 (a different topic and mechanism).
// Narration: "Mount Everest. Eight thousand eight hundred and forty-nine metres. On 29 May 1953,
// Edmund Hillary and Tenzing Norgay stood on top."
// Mechanism: assemble 'unfold' - the book opens from the spine: the two pages swing out, their
// lifted edges flatten, and the one picture runs across the fold (the summit just right of it).
// Then the height by the summit, and one inset panel lands on the spread: the two men on
// top, with the date. Never more than 4 s without a new beat.
// Focal: the summit and its snow plume; the inset second.
// Traces: the spine crease, the plume dithered off the ridge, jagged rock bands inked by hand,
// the height lettered in with a two-stroke arrow to the top, the inset's pencils past its corners.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cs2',
  title: 'Comic spread: the summit',
  treatment: 'title-card',
};

const SUMMIT = [372, 70];
const HEIGHT_T = 2.6;
const TOP_T = 4.3;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** A ridge line between key points, broken by seeded jags (rock is never straight). */
function jagged(g, pts, key, amp) {
  const out = [];
  for (let i = 0; i + 2 < pts.length; i += 2) {
    const [ax, ay, bx, by] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 14));
    for (let k = 0; k < n; k++) {
      const p = k / n;
      const j = k === 0 ? 0 : g.range(key, i * 40 + k, -amp, amp);
      out.push(ax + (bx - ax) * p + j * 0.4, ay + (by - ay) * p + j);
    }
  }
  out.push(pts[pts.length - 2], pts[pts.length - 1]);
  return out;
}

/** A point list walked backwards. */
function reversed(pts) {
  const out = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
  return out;
}

/** The massif across both pages: pale sky, far ridges, the pyramid, a snowfield, the name. */
function massif(g, t) {
  const sky = (lx, ly) => 0.06 + 0.22 * clamp01(1 - ly / 200);
  g.rect(-20, -20, 680, 400, g.tone('cyan', sky, { cell: 4, angle: 0.26, on: 'paper' }));
  const far = jagged(
    g,
    [-20, 190, 60, 150, 130, 172, 210, 128, 290, 160, 480, 150, 560, 118, 660, 160],
    'far',
    4,
  );
  g.plate.poly(
    [...far, 660, 260, -20, 260],
    g.tone('greyMid', 0.18, { cell: 3, angle: 0.78, on: 'greyLight' }),
  );
  g.ink(far, { closed: false, boil: 0.4, key: 'far' });
  const [sx, sy] = SUMMIT;
  // The pyramid: a lit west face, a face in shadow to the east, a long ridge down to the left.
  const skyline = jagged(
    g,
    [sx - 190, 214, sx - 70, 150, sx, sy, sx + 120, 160, sx + 170, 250],
    'sky',
    5,
  );
  const arete = jagged(g, [sx, sy, sx + 4, 168, sx - 40, 250], 'arete', 4);
  const top = skyline.findIndex((v, i) => i % 2 === 0 && v === sx && skyline[i + 1] === sy);
  const westRidge = skyline.slice(0, top + 2);
  const eastRidge = skyline.slice(top);
  g.plate.poly([...westRidge, ...arete.slice(2)], 'paper');
  const shade = (lx) => 0.25 + 0.3 * clamp01((lx - sx) / 140);
  g.plate.poly(
    [...arete, ...reversed(eastRidge)],
    g.tone('cyanDeep', shade, { cell: 3, angle: 1.1, on: 'greyMid' }),
  );
  for (let i = 0; i < 7; i++) {
    const y = sy + 22 + i * 21 + g.rnd('band', i) * 6;
    const x0 = sx - (y - sy) * 0.9 + g.rnd('band', i + 9) * 20;
    g.ink([x0, y, x0 + 24, y + 4 + g.rnd('band', i + 20) * 4, x0 + 46, y + 2], {
      closed: false,
      boil: 0.5,
      key: 'rock' + i,
      color: 'greyDark',
    });
  }
  g.ink(skyline, { closed: false, key: 'skyline' });
  g.ink(arete, { closed: false, key: 'arete' });
  // The plume: snow torn off the summit by the wind, blowing east.
  const plume = [
    sx + 2,
    sy + 2,
    sx + 60,
    sy - 10,
    sx + 150,
    sy - 4,
    sx + 220,
    sy + 10,
    sx + 140,
    sy + 14,
    sx + 50,
    sy + 10,
  ];
  g.poly(plume, g.dither('none', 'paper', 0.7 + 0.1 * Math.sin(t * 1.3)));
  // The snowfield in front, the name standing in it.
  const field = jagged(g, [-20, 262, 140, 248, 330, 258, 520, 244, 660, 256], 'field', 2);
  g.plate.poly(
    [...field, 660, 380, -20, 380],
    g.tone('greyLight', (lx, ly) => 0.1 + 0.3 * clamp01((ly - 250) / 120), {
      cell: 4,
      angle: 0.78,
      on: 'paper',
    }),
  );
  g.ink(field, { closed: false, boil: 0.5, key: 'field' });
  g.standing('EVEREST', {
    x: 64,
    y0: 336,
    y1: 318,
    h0: 34,
    h1: 26,
    face: 'paper',
    side: 'greyMid',
    shadow: 'greyMid',
    key: 'name',
  });
}

/** The inset: two small figures on the summit ridge, one with the ice axe raised. */
function summitTop(g) {
  g.plate.rect(430, 180, 200, 140, g.tone('cyan', 0.3, { cell: 3, on: 'paper' }));
  const ridge = [430, 300, 500, 262, 540, 246, 580, 258, 640, 300, 640, 330, 430, 330];
  g.plate.poly(ridge, 'paper');
  g.ink(ridge.slice(0, 10), { closed: false, key: 'ridge' });
  const climber = (x, y, raised, key) => {
    g.blob(
      [
        { e: [x, y - 26, 5, 6] },
        { c: [x, y - 18, x, y - 6, 6] },
        { c: [x - 3, y - 4, x - 5, y + 6, 3] },
        { c: [x + 3, y - 4, x + 5, y + 6, 3] },
      ],
      'greyDark',
      { key },
    );
    if (raised) {
      g.line(x + 5, y - 16, x + 14, y - 40, 'ink', 2);
      g.line(x + 10, y - 40, x + 18, y - 38, 'ink', 1);
    }
  };
  climber(536, 246, true, 'tenzing');
  climber(566, 252, false, 'hillary');
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 113, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  const spread = page.spread({
    intent: 'Everest is one huge mountain, and in 1953 two men stood on its very top',
    art: massif,
    assemble: 'unfold',
    delay: 0.35,
    dur: 1.6,
    insets: [{ box: [430, 180, 196, 140], at: TOP_T, draw: summitTop, kind: 'pop' }],
  });
  page.caption('8,849 M.', {
    x: SUMMIT[0] - 176,
    y: SUMMIT[1] - 48,
    at: HEIGHT_T,
    tilt: -1,
    type: 0.35,
  });
  page.arrow([SUMMIT[0] - 114, SUMMIT[1] - 26], [SUMMIT[0] - 8, SUMMIT[1] - 2], {
    at: HEIGHT_T + 0.45,
    dur: 0.3,
    color: 'ink',
  });
  page.caption('29 MAY 1953.', { x: 438, y: 170, at: TOP_T + 0.25, tilt: 1, on: spread.insets[0] });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
