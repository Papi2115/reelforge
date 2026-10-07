// Comic look B (comic-info), template 2: "the alarm explained" (showcase comic-panels-v2 shot 7).
// The explainer is still a comic page: the two codes slammed like sound effects on the left, one
// family, with the definition in a caption; the reasoning as a hand-ticked checklist on a tilted
// clipboard on the right; the last line ABORT is struck out and corrected to GO.
// Focal: GO, the only accent colour on the page (the yellow highlighter). The showcase also had
// red codes; here the codes print in paper white so the page keeps ONE accent (DECISIONS.md).
// Traces: pencil ticks that each differ, ABORT struck and corrected, a dog-eared sheet on a tilted
// clipboard, a pencilled bracket SAME FAMILY, a thumbprint on the sheet, a smudge in the gutter.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cb2',
  title: 'Comic info: the alarm explained',
  treatment: 'node-graph/timeline',
};

const LEFT = [14, 14, 214, 16, 212, 346, 12, 344];
const RIGHT = [224, 12, 628, 14, 626, 346, 226, 344];
const CODE1_T = 0.75;
const CODE2_T = 1.08;
const BRACKET_T = 1.5;
const DEF_T = 1.95;
const ITEMS = [
  { text: 'COMPUTER RESTARTS', tick: 2.85 },
  { text: 'KEY JOBS KEPT', tick: 3.42 },
  { text: 'STILL STEERING', tick: 4.18 },
];
const STRIKE_T = 4.95;
const GO_T = 5.42;
const HILITE_T = 5.78;
/** The clipboard's own frame: origin on the page and a slight tilt. */
const BOARD = { x: 268, y: 36, angle: -0.032 };

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Board coordinates -> page coordinates (tilted about the board's origin). */
function R(pts) {
  const out = [];
  const c = Math.cos(BOARD.angle);
  const s = Math.sin(BOARD.angle);
  for (let i = 0; i < pts.length; i += 2) {
    out.push(BOARD.x + pts[i] * c - pts[i + 1] * s, BOARD.y + pts[i] * s + pts[i + 1] * c);
  }
  return out;
}

function clipboard(g) {
  g.plate.rect(0, 0, 640, 360, g.layer(g.tone('cyanDeep', 0.22, { cell: 4, angle: 0.4 }), 'cyan'));
  const board = [0, 0, 318, 0, 318, 300, 0, 300];
  g.poly(
    R(board).map((v) => v + 4),
    'ink',
  );
  g.plate.poly(R(board), g.layer(g.tone('greyDark', 0.16, { cell: 3, angle: 1.1 }), 'aged'));
  g.polyline(R(board), 'ink', { w: 1, closed: true });
  const sheet = [16, 26, 302, 26, 302, 292, 26, 292, 16, 282];
  g.poly(R(sheet), 'paper');
  // Ruled lines and a margin, printed in the faint plates.
  for (let y = 72; y < 286; y += 24) g.polyline(R([20, y, 298, y]), g.dither('none', 'cyan', 0.5));
  g.polyline(R([52, 30, 52, 288]), g.dither('none', 'magenta', 0.6));
  g.poly(R([16, 282, 26, 292, 26, 282]), 'shade');
  g.polyline(R(sheet), 'ink', { w: 1, closed: true });
  // The clip.
  g.plate.poly(R([116, -8, 202, -8, 196, 20, 122, 20]), 'greyLight');
  g.poly(R([132, -4, 186, -4, 182, 8, 136, 8]), 'greyMid');
  g.polyline(R([116, -8, 202, -8, 196, 20, 122, 20]), 'ink', { w: 1, closed: true });
  const [hx, hy] = R([60, 38]);
  g.text('PROGRAM ALARM 1202', hx, hy, { bold: true, scale: 2, jitter: 2 });
  ITEMS.forEach((item, i) => {
    const [bx, by] = R([28, 80 + i * 48]);
    g.polyline([bx, by, bx + 14, by, bx + 14, by + 14, bx, by + 14], 'ink', { w: 1, closed: true });
    const [tx, ty] = R([60, 81 + i * 48]);
    g.text(item.text, tx, ty, { bold: true, scale: 2, jitter: 2 });
  });
  const [bx, by] = R([28, 224]);
  g.polyline([bx, by, bx + 14, by, bx + 14, by + 14, bx, by + 14], 'ink', { w: 1, closed: true });
  const [ax, ay] = R([60, 225]);
  g.text('ABORT', ax, ay, { bold: true, scale: 2, jitter: 2 });
}

/** The definition: the two codes slammed like sound effects, one family. */
function definition(g, t, u) {
  const shade = (lx, ly) => 0.18 + 0.2 * clamp01((ly - 40) / 300);
  g.plate.rect(
    0,
    0,
    230,
    360,
    g.layer(g.tone('cyanDeep', shade, { cell: 4, angle: 0.26 }), 'night'),
  );
  const slam = (t0, ch, x, y, size, rot, key) => {
    if (t < t0) return;
    const k = u.track(
      [
        [t0, 1.6],
        [t0 + 0.08, 0.93, 'outQuad'],
        [t0 + 0.16, 1, 'inOutSine'],
      ],
      t,
    );
    const dark = (lx, ly) => 0.5 * clamp01((ly - y - 2) / (size * 5));
    const fill = g.layer(g.tone('greyMid', dark, { cell: 3, angle: 0.78 }), 'paper');
    g.bigLetter(ch, x, y, { size: size * k, angle: rot, fill, extrude: [2, 3], mis: [1, -1], key });
  };
  [0, 0.05, 0.12, 0.16].forEach((dt, i) =>
    slam(
      CODE1_T + dt,
      '1202'[i],
      46 + i * 40,
      74 + (i % 2) * 4,
      5,
      [-0.08, 0.05, -0.03, 0.09][i],
      'a' + i,
    ),
  );
  [0, 0.06, 0.1, 0.17].forEach((dt, i) =>
    slam(
      CODE2_T + dt,
      '1201'[i],
      60 + i * 30,
      150 - (i % 2) * 3,
      3.6,
      [0.06, -0.05, 0.04, -0.08][i],
      'b' + i,
    ),
  );
  // The reader's pencil ties the two codes together.
  if (t >= BRACKET_T) {
    const p = clamp01((t - BRACKET_T) / 0.3);
    g.strokeOn([26, 52, 20, 56, 20, 106, 14, 112, 20, 118, 20, 166, 27, 170], p, 'greyLight', 1);
    const shown = Math.floor(clamp01((t - BRACKET_T - 0.32) / 0.38) * 11.99);
    if (t >= BRACKET_T + 0.32)
      g.text('SAME FAMILY', 40, 188, {
        color: 'paper',
        bold: true,
        slant: 1,
        jitter: 1.4,
        reveal: shown,
      });
  }
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 107, anchor: ctx.anchor });
  ctx.scene.add(page);
  page.panel(LEFT).draw((g, t) => definition(g, t, page.util));
  page.panel(RIGHT).draw(clipboard);
  page.caption('EXECUTIVE OVERFLOW:\nNO ROOM LEFT\nFOR NEW JOBS.', {
    x: 28,
    y: 250,
    at: DEF_T,
    tilt: -1,
  });
  ITEMS.forEach((item, i) => {
    const [bx, by] = R([28, 80 + i * 48]);
    page.tick(bx + 2, by + 7, { at: item.tick, dur: 0.16 });
  });
  const [ax, ay] = R([60, 225]);
  const goAt = R([150, 219]);
  page.strike(ax, ay + 7, ax + 70, { at: STRIKE_T, dur: 0.3, color: 'ink' });
  page.highlight([goAt[0] - 6, goAt[1] - 3, goAt[0] + 44, goAt[1] + 18], {
    at: HILITE_T,
    dur: 0.22,
    color: 'yellow',
  });
  // GO is lettered over the highlighter (registered after it), in two quick strokes.
  page.draw(
    (g, t) => {
      const shown = Math.floor(
        page.util.track(
          [
            [GO_T, 0],
            [GO_T + 0.1, 1, 'linear'],
            [GO_T + 0.26, 2.99, 'outQuad'],
          ],
          t,
        ),
      );
      g.text('GO', goAt[0], goAt[1], { bold: true, scale: 3, jitter: 2, reveal: shown, slant: 1 });
    },
    { at: GO_T },
  );
  const [px, py] = R([276, 262]);
  page.thumbprint(px, py, { over: true });
  page.smudge(219, 330, { length: 7, angle: 1.7 });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
