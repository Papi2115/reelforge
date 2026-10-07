// Comic breakthrough: flashback, inspiration 1 of 2 (showcase comic-panels-v2 shot 3).
// Narration: "Eight years earlier, in 1961, the country had set itself a goal: a person on the
// Moon before the decade was out. Meanwhile, somebody had to build the computer that would fly
// them there."
// Mechanism: cover 'page' + arrange 'rows' - the page turned back IS the old print: three
// letterboxed beats down the page (the speech, the deadline as a line of years, an engineer's
// sketch), the date stamp half on the margin. The camera never moves: the past is still.
// Focal: the 1961 stamp, then the year line running out at the Moon.
// Traces: hand-ruled uneven years, a two-stroke loop round 1969 and an arrow to the Moon, a sketch
// gone over twice by a hand that enters with the pencil, a coffee ring, a worn rotated stamp.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cf1',
  title: 'Comic flashback: 1961',
  treatment: 'node-graph/timeline',
};

const HALL_T = 0.6;
const STAMP_T = 1.95;
const GOAL_T = 2.62;
const YEARS_T = [2.75, 2.9, 3.1, 3.2, 3.38, 3.5, 3.71, 3.83, 4.12];
const LOOP_T = 4.5;
const DESK_T = 5.3;
const SKETCH = [5.6, 7.15];
const LABEL = [7.2, 7.95];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The years 1961-1969 ruled by hand: uneven steps (beat-local x). */
function yearXs(u) {
  const xs = [];
  let x = 214;
  for (let i = 0; i < 9; i++) {
    xs.push(x);
    x += 28 + u.range('years', 40 + i, -3, 3);
  }
  return xs;
}

/** The speech, seen from the audience: big dark heads in front, a small lit lectern far off. */
function hall(g) {
  const F = g.plate;
  const folds = (lx) => 0.18 + 0.2 * Math.abs(Math.sin(lx / 11 + Math.sin(lx / 37)));
  F.rect(-10, -10, 620, 110, g.tone('cyanDeep', folds, { cell: 4, angle: 0.4, on: 'aged' }));
  F.poly(
    [200, 58, 600, 54, 600, 100, 200, 100],
    g.tone('ink', 0.22, { cell: 3, angle: 0.9, on: 'greyDark' }),
  );
  F.poly([200, 58, 600, 54, 600, 58, 200, 62], 'greyLight');
  g.ink([200, 58, 600, 54], { closed: false, key: 'rostrum' });
  // The lectern and its microphones, all leaning toward one mouth.
  const S = g.at(412, 6, 1.3);
  S.plate.poly([-20, 40, 20, 40, 25, 74, -25, 74], 'aged');
  S.plate.poly([-20, 40, 20, 40, 21, 44, -21, 44], 'greyLight');
  S.ink([-20, 40, 20, 40, 25, 74, -25, 74], { boil: 0.4, key: 'lectern' });
  S.plate.poly([-17, 40, -15, 25, -7, 20, 7, 20, 15, 25, 17, 40], 'night');
  S.plate.poly([-3, 20, 3, 20, 1, 31, -1, 31], 'paper');
  S.line(0, 22, 0, 30, 'ink', 1);
  S.plate.ellipse(0, 11, 5.5, 7, 'shade');
  S.poly([-6, 9, -5, 3, 0, 2, 5, 3, 6, 8, 2, 5, -3, 6], 'ink');
  S.rect(-3, 11, 2, 1, 'ink');
  S.rect(2, 11, 2, 1, 'ink');
  S.rect(-1, 15, 3, 1, 'greyDark');
  S.ink(S.ellipsePts(0, 11, 5.5, 7, 14), { boil: 0.3, key: 'head', w: 1 });
  S.plate.ellipse(-15, 40, 3, 2, 'shade');
  S.plate.ellipse(16, 40, 3, 2, 'shade');
  [
    [-12, 26],
    [-6, 23],
    [6, 24],
    [12, 27],
  ].forEach(([dx, dy], i) => {
    S.line(dx * 0.35, 40, dx, dy, 'ink', 1);
    S.ellipse(dx, dy - 1, 1.5 + (i % 2) * 0.6, 2, 'ink');
  });
  // The audience in front: big dark heads and shoulders cut by the panel, rim-lit by the lamps.
  [
    [58, 50, 22, 1.0],
    [196, 68, 14, 0.92],
    [318, 60, 17, 1.05],
    [520, 56, 20, 0.95],
  ].forEach(([hx, hy, r, k], i) => {
    const sh = [
      hx - r * 2.6,
      110,
      hx - r * 2.1,
      hy + r * 1.05,
      hx - r * 0.7,
      hy + r * 0.72,
      hx + r * 0.8,
      hy + r * 0.78,
      hx + r * 2.2,
      hy + r * 1.15,
      hx + r * 2.7,
      110,
    ];
    g.poly(sh, 'cyanDeep');
    g.ellipse(hx, hy, r * 0.8 * k, r, 'cyanDeep');
    const side = hx < 412 ? 1 : -1;
    const rim = [];
    for (let a = -1.35; a <= 0.3; a += 0.12)
      rim.push(hx + side * Math.cos(a) * (r * 0.8 * k - 1), hy + Math.sin(a) * (r - 1));
    g.ink(rim, { closed: false, boil: 0.3, color: 'greyMid', key: 'rim' + i });
    g.ellipse(hx - side * r * 0.8 * k, hy + 3, 2.6, 5, 'ink');
    g.ink(g.ellipsePts(hx, hy, r * 0.8 * k, r, 22), { boil: 0.3, key: 'aud' + i });
  });
}

/** The deadline as a hand-ruled line of years that runs out at the Moon. */
function yearLine(g, t, xs) {
  g.plate.rect(-10, -10, 600, 100, g.tone('cyan', 0.07, { cell: 4, angle: 0.26, on: 'paper' }));
  const [mx, my, mr] = [512, 38, 27];
  const lit = (lx) => Math.max(0, (lx - mx + 6) / mr) * 0.75;
  g.plate.ellipse(
    mx,
    my,
    mr,
    mr,
    g.tone('greyMid', lit, { cell: 3, angle: 0.78, on: 'greyLight' }),
  );
  for (let i = 0; i < 6; i++) {
    const a = g.rnd('moon', i) * 6.28;
    const d = g.rnd('moon', i + 9) * mr * 0.7;
    const cr = 2 + g.rnd('moon', i + 20) * 4;
    g.plate.ellipse(mx + Math.cos(a) * d, my + Math.sin(a) * d, cr, cr * 0.8, 'greyMid');
  }
  g.ink(g.ellipsePts(mx, my, mr, mr, 30), { boil: 0.4, key: 'moon' });
  const shown = YEARS_T.filter((y) => t >= y).length;
  const y0 = 50;
  if (shown > 0) {
    const end = shown >= 9 ? xs[8] + 8 : xs[Math.min(8, shown)];
    g.ink([xs[0] - 6, y0 + 1, end, y0 - 1], { closed: false, boil: 0.4, key: 'rule' });
  }
  for (let i = 0; i < shown; i++) {
    const label = String(1961 + i);
    const bold = i === 0 || i === 8;
    g.line(xs[i], y0 - 3, xs[i] + (i % 3) - 1, y0 + 3, 'ink', 1);
    g.text(label, xs[i] - g.textWidth(label, 1, bold) / 2, y0 + 7, { bold, jitter: 1 });
  }
}

/** The pencil, the hand around it (one silhouette), a rolled sleeve; tip at (x, y). */
function hand(g, x, y) {
  g.line(x + 3, y - 4, x + 24, y - 31, 'ink', g.w(4));
  g.line(x + 3, y - 4, x + 24, y - 31, 'yellow', g.w(2));
  g.line(x, y, x + 4, y - 5, 'greyLight', g.w(2));
  g.blob(
    [
      { c: [x + 74, y - 56, x + 150, y - 92, 15], fill: 'greyLight' },
      { c: [x + 46, y - 38, x + 80, y - 58, 11.5] },
      { e: [x + 33, y - 27, 15, 11] },
      { c: [x + 9, y - 11, x + 27, y - 23, 4.2] },
      { c: [x + 15, y - 6, x + 34, y - 16, 4.2] },
      { c: [x + 25, y - 3, x + 43, y - 13, 4] },
      { c: [x + 36, y - 3, x + 49, y - 12, 3.6] },
    ],
    'aged',
    { key: 'hand' },
  );
  g.line(x + 19, y - 13, x + 23, y - 16, 'ink', 1);
  g.line(x + 29, y - 9, x + 33, y - 12, 'ink', 1);
  g.line(x + 66, y - 46, x + 82, y - 70, 'ink', g.w(1));
}

/** An engineer's table: graph paper, the box and its keyboard sketched on, a slide rule. */
function desk(g, t) {
  const grain = (lx, ly) => 0.12 + 0.1 * Math.sin(ly / 3 + Math.sin(lx / 40) * 2);
  g.plate.rect(-10, -10, 600, 140, g.tone('cyanDeep', grain, { cell: 3, angle: 1.2, on: 'aged' }));
  const sheet = [66, 12, 430, 6, 436, 124, 70, 130];
  g.poly(
    sheet.map((v) => v + 3),
    'greyDark',
  );
  g.plate.poly(sheet, 'paper');
  const grid = (lx, ly) => {
    const gx = Math.floor(lx - 66);
    const gy = Math.floor(ly - 6);
    return (gx % 10 === 0 && gy % 2 === 0) || (gy % 10 === 0 && gx % 2 === 0)
      ? g.color('shade')
      : -1;
  };
  g.poly(sheet, g.local(grid));
  g.ink(sheet, { boil: 0.3, key: 'sheet' });
  const strokes = [
    [128, 54, 236, 54, 236, 104, 128, 104, 128, 54],
    [128, 54, 146, 40, 254, 40, 236, 54],
    [254, 40, 254, 90, 236, 104],
    [150, 46, 162, 46, 174, 46, 186, 46, 198, 46, 210, 46, 222, 46, 234, 46],
    [282, 32, 336, 32, 336, 108, 282, 108, 282, 32],
    [288, 38, 330, 38, 330, 64, 288, 64, 288, 38],
    [
      290, 72, 298, 72, 298, 80, 290, 80, 290, 72, 302, 72, 310, 72, 310, 80, 302, 80, 302, 72, 314,
      72, 322, 72, 322, 80, 314, 80, 314, 72,
    ],
    [
      290, 86, 298, 86, 298, 94, 290, 94, 290, 86, 302, 86, 310, 86, 310, 94, 302, 94, 302, 86, 314,
      86, 322, 86, 322, 94, 314, 94, 314, 86,
    ],
  ];
  const weights = [1.4, 0.8, 0.6, 0.5, 1.2, 0.7, 0.9, 0.9];
  const total = weights.reduce((a, b) => a + b, 0);
  const p = clamp01((t - SKETCH[0]) / (SKETCH[1] - SKETCH[0]));
  let acc = 0;
  let tip = null;
  strokes.forEach((s, i) => {
    const a = acc / total;
    acc += weights[i];
    const q = clamp01((p - a) / (acc / total - a));
    if (q <= 0) return;
    const pts = s.map((v, j) => v + g.range('s' + i, j, -0.7, 0.7));
    g.strokeOn(pts, q, 'cyanDeep', 1);
    // The main outlines are gone over twice, the second pass never quite on the first.
    if (i < 3)
      g.strokeOn(
        pts.map((v, j) => v + (j % 2 ? 1 : 0)),
        q * 0.9,
        'ink',
        1,
      );
    if (q < 1) tip = along(pts, q);
  });
  if (t >= LABEL[0]) {
    const n = Math.floor(clamp01((t - LABEL[0]) / (LABEL[1] - LABEL[0])) * 17.99);
    g.text('GUIDANCE COMPUTER', 150, 18, { color: 'cyanDeep', slant: 1, jitter: 1.4, reveal: n });
    if (!tip && n < 17) tip = [150 + n * 6.3, 25];
  }
  const rule = [392, 112, 590, 76, 592, 88, 394, 124];
  g.plate.poly(rule, 'greyLight');
  for (let i = 0; i < 25; i++) {
    const rx = 398 + i * 7.6 + (i % 5 ? 0 : 1);
    const ry = 112 - (rx - 392) * (36 / 198);
    g.line(rx, ry, rx, ry + (i % 5 ? 2 : 4), 'ink', 1);
  }
  g.ink(rule, { boil: 0.3, key: 'rule' });
  // The hand comes in with the first stroke, follows the pencil tip, then rests.
  const [tx, ty] = tip || (p <= 0 ? [130, 56] : [372, 112]);
  const enter = clamp01((t - SKETCH[0] + 0.42) / 0.42);
  const come = 1 - (1 - enter) * (1 - enter) * (1 - enter);
  hand(g, tx + (1 - come) * 190, ty - (1 - come) * 110);
}

function along(pts, q) {
  let total = 0;
  for (let i = 2; i < pts.length; i += 2)
    total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  let left = total * q;
  for (let i = 2; i < pts.length; i += 2) {
    const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (left <= l)
      return [
        pts[i - 2] + ((pts[i] - pts[i - 2]) * left) / l,
        pts[i - 1] + ((pts[i + 1] - pts[i - 1]) * left) / l,
      ];
    left -= l;
  }
  return [pts[pts.length - 2], pts[pts.length - 1]];
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 103, anchor: ctx.anchor });
  ctx.scene.add(page);
  const xs = yearXs(page.util);
  const past = page.flashback({
    intent: 'the Moon deadline was set in 1961, before anyone had built the computer to fly there',
    when: 'EIGHT YEARS EARLIER...',
    cover: 'page',
    arrange: 'rows',
    beats: [
      { at: HALL_T, draw: hall, weight: 1 },
      { at: GOAL_T, draw: (g, t) => yearLine(g, t, xs), weight: 0.9 },
      { at: DESK_T, draw: desk, weight: 1.45, caption: 'MEANWHILE...' },
    ],
    stamp: { text: '1961', at: STAMP_T },
  });
  const [, years, table] = past.panels.map((panel) => panel.box);
  page.caption('THE GOAL: THE MOON,\nBEFORE THE DECADE\nWAS OUT.', {
    x: years[0] + 12,
    y: years[1] + 8,
    at: GOAL_T + 0.08,
    tilt: 1,
  });
  page.loop(years[0] + xs[8], years[1] + 60, 17, 9, { at: LOOP_T, dur: 0.42, color: 'ink' });
  page.arrow([years[0] + xs[8] + 18, years[1] + 52], [years[0] + 480, years[1] + 46], {
    at: LOOP_T + 0.55,
    dur: 0.4,
    color: 'ink',
  });
  page.coffeeRing(table[0] + 408, table[1] + 100, 15, { at: DESK_T });
  page.thumbprint(612, 352);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
