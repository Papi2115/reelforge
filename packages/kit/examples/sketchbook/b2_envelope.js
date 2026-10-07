// Sketchbook look B (sketch-graph), template 2: "the overshoot" (showcase sketchbook-v2 shot 7).
// The back of a kraft envelope taped into the book, maths in blue ballpoint: 365.25 - 365.2422 =
// 0.0078 day = about 11 minutes a year; a drift chart whose line only climbs, to about ten days
// by 1582 in red.
// Focal: the red "≈ 10 days" at the top of the climbing line.
// Traces: decimal points lined up by hand, a red loop round "11 min", hand-ruled axes with uneven
// ticks, a coffee ring on the envelope, tape at two angles, stubs of a torn-out page in the spiral.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sb2',
  title: 'Sketch graph: the overshoot',
  treatment: 'data-chart-3d',
};

/** The showcase plays this page 7 % faster than real time. */
const PACE = 1.07;
const BIC = { tool: 'bic', boil: 0.6 };
const RED = { tool: 'red', width: 2 };
const [EW, EH] = [800, 420];

function envelope(page) {
  const sheet = page.sheet({
    x: 84,
    y: 64,
    deg: -2,
    w: EW,
    h: EH,
    paper: 'kraft',
    envelope: true,
    seed: 333,
  });
  page.coffeeRing(802, 104, 50, { seed: 7 });
  const [a, b] = [sheet.point(-4, 6), sheet.point(EW + 2, EH - 8)];
  page.tape(a[0], a[1], 70, 22, -38, { seed: 3 });
  page.tape(b[0], b[1], 74, 22, -34, { seed: 4 });
  return sheet;
}

/** Writing on the envelope: local (u, v) on the sheet, the sheet's tilt. */
function writer(page, sheet) {
  return (text, u, v, options) => {
    const [x, y] = sheet.point(u, v);
    return page.write(text, { x, y, rot: -2, hand: 'print', ...BIC, ...options });
  };
}

function ruler(page, sheet) {
  return (u0, v0, u1, v1, options) => {
    const [a, b] = [sheet.point(u0, v0), sheet.point(u1, v1)];
    return page.ruled(a[0], a[1], b[0], b[1], { ...BIC, ...options });
  };
}

function subtraction(page, sheet) {
  const write = writer(page, sheet);
  const line = ruler(page, sheet);
  const size = 24;
  const w365 = page.textWidth('365', size, 'print');
  const minus = page.textWidth('− ', size, 'print');
  const zero = page.textWidth('0', size, 'print');
  const ax = 92;
  write('365.25', ax, 82, { size, seed: 141, at: 0.22, until: 0.7 });
  write('− 365.2422', ax - minus, 118, { size, seed: 142, at: 0.82, until: 1.46 });
  line(ax - minus - 6, 130, ax + w365 + 112, 129, { at: 1.54, dur: 0.18, seed: 143 });
  write('0.0078 day', ax + w365 - zero, 162, { size, seed: 144, at: 1.8, until: 2.35 });
  write('≈ 11 min a year', ax - 4, 214, { size: 26, seed: 145, at: 2.48, until: 3.12 });
  const [lx, ly] = sheet.point(ax + 4 + page.textWidth('≈ ', 26, 'print') + 42, 204);
  page.loop(lx, ly, 54, 25, { ...RED, at: 3.2, dur: 0.3, seed: 146, start: -2.6 });
}

function driftChart(page, sheet) {
  const write = writer(page, sheet);
  const line = ruler(page, sheet);
  const [ox, oy, x1, y1] = [452, 372, 760, 198];
  line(ox, oy, x1, oy, { at: 3.66, dur: 0.22, seed: 147 });
  line(ox, oy, ox, y1, { at: 3.94, dur: 0.18, seed: 148 });
  for (let i = 1; i <= 5; i += 1) {
    line(ox - 5, oy - i * 33, ox + 3, oy - i * 33, {
      at: 4.14 + i * 0.035,
      dur: 0.03,
      seed: 149 + i,
    });
  }
  write('325', ox - 16, oy + 28, { size: 16, seed: 156, at: 4.42, until: 4.62 });
  write('1582', x1 - 36, oy + 28, { size: 16, seed: 157, at: 4.7, until: 4.94 });
  write('days', ox - 70, y1 + 12, { size: 16, seed: 158, hand: 'scrawl', at: 5.0, until: 5.2 });
  const [ex, ey] = [x1 - 14, oy - 5 * 33];
  line(ox + 2, oy - 2, ex, ey, { at: 5.34, dur: 1.15, seed: 159, boil: 0.4 });
  // The point: about ten days.
  const [px, py] = sheet.point(ex, ey);
  page.loop(px, py, 3.5, 3.5, { ...RED, width: 3, at: 6.86, dur: 0.1, seed: 160, turns: 1.05 });
  write('≈ 10 days', x1 - 168, y1 - 4, { ...RED, size: 30, seed: 161, at: 7.0, until: 7.5 });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    page: 6,
    pageTool: 'bic',
    boilFps: 8,
    torn: true,
    seed: 106,
  });
  ctx.scene.add(page);
  const sheet = envelope(page);
  subtraction(page, sheet);
  driftChart(page, sheet);
  return { page };
}

export function update(t, state) {
  state.page.update(t * PACE);
}
