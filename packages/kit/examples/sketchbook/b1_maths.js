// Sketchbook look B (sketch-graph), template 1: "the maths of the quarter" (showcase
// sketchbook-v2 shot 3). Graph paper, blue ballpoint: 365.2422 with the fraction highlighted, four
// year-boxes that fill with the leftover quarter days, 0.2422 x 4; a beat, then the red pen:
// about one day - the leap day.
// Focal: the red "≈ 1 day" in its loop (then "leap day!").
// Traces: box corners that overshoot and do not close, a highlighter sweep wider than the number,
// a clear plastic ruler slid in under the boxes and out again, label pace that varies, a ruled
// underline that runs past the words; one still beat before the red.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sb1',
  title: 'Sketch graph: the maths',
  treatment: 'counter/odometer',
};

/** The showcase plays this page 30 % faster than real time. */
const PACE = 1.3;
const BIC = { tool: 'bic', boil: 0.6 };
const RED = { tool: 'red', width: 2 };

function heading(page) {
  const text = '1 year = 365.2422 days';
  const head = { x: 106, y: 108, size: 21, hand: 'print', seed: 61, ...BIC };
  page.write(text, { ...head, at: 0.2, until: 1.62 });
  // The highlighter sweeps the fraction that matters (wider than it, behind the ink).
  const x0 = 106 + page.textWidth('1 year = 365.', 21, 'print');
  const x1 = 106 + page.textWidth('1 year = 365.2422', 21, 'print');
  page.stroke([x0 - 6, 100, (x0 + x1) / 2, 98.5, x1 + 10, 99.5], {
    tool: 'hi',
    at: 1.78,
    dur: 0.3,
    seed: 62,
    ease: 'out',
  });
}

function yearBoxes(page) {
  const xs = [106, 190, 275, 358];
  const [top, side] = [180, 60];
  const share = [0.2422, 0.4844, 0.7266, 0.9688];
  // The ruler slides in under the boxes while they are ruled, then out.
  page.ruler(30, 242, { at: 2.37, until: 3.5 });
  [2.4, 2.68, 2.93, 3.22].forEach((at, i) => {
    const x = xs[i] + (i === 2 ? 1 : 0);
    const y = top + (i === 3 ? -1 : 0);
    page.stroke(
      [x, y, x + side + (i === 1 ? 2 : 0), y, x + side, y + side, x - 1, y + side + 1, x, y - 2],
      {
        ...BIC,
        at,
        dur: 0.22 + i * 0.02,
        smooth: false,
        ease: 'lin',
        seed: 63 + i * 7,
      },
    );
  });
  [3.62, 3.86, 4.12, 4.44].forEach((at, i) => {
    const fillTop = top + side - side * share[i];
    const [l, r, b] = [xs[i] + 2, xs[i] + side - 2, top + side - 2];
    page.fill([l, fillTop, r, fillTop, r, b, l, b], {
      color: 'bicLight',
      at,
      dur: 0.16 + i * 0.04,
      spacing: 3,
      dir: -1,
      seed: 70 + i,
    });
  });
  const pace = [0.1, 0.08, 0.11, 0.09];
  xs.forEach((x, i) => {
    page.write(`yr ${String(i + 1)}`, {
      ...BIC,
      x: x + 15 + (i % 2) * 2,
      y: top + 86,
      size: 14,
      hand: 'print',
      seed: 75 + i,
      at: 4.76 + i * pace[i] * 1.1 + i * 0.02,
      until: 4.96 + i * 0.1,
    });
  });
}

function result(page) {
  page.write('0.2422 × 4 = 0.9688', {
    ...BIC,
    x: 490,
    y: 216,
    size: 21,
    hand: 'print',
    seed: 81,
    at: 5.25,
    until: 6.3,
  });
  // A beat. Then the red pen: about one whole day.
  const red = page.write('≈ 1 day', {
    ...RED,
    x: 604,
    y: 296,
    size: 30,
    hand: 'print',
    seed: 83,
    rot: -2,
    at: 6.72,
    until: 7.2,
  });
  page.loop(604 + red.width / 2, 284, red.width / 2 + 22, 30, {
    ...RED,
    at: 7.26,
    dur: 0.34,
    seed: 84,
    start: -2.9,
  });
}

function rule(page) {
  const line = page.write('+1 day every 4 years', {
    ...BIC,
    x: 106,
    y: 402,
    size: 23,
    hand: 'print',
    seed: 85,
    at: 7.78,
    until: 8.72,
  });
  page.ruler(40, 416, { at: 8.8, until: 9.1 });
  page.ruled(102, 414, 110 + line.width, 413, { ...BIC, at: 8.8, dur: 0.2, seed: 86 });
  const arrow = page.arrow([664, 322, 650, 350, 616, 372], {
    ...RED,
    at: 9.12,
    dur: 0.16,
    seed: 87,
    head: 12,
  });
  page.write('leap day!', {
    ...RED,
    x: 440,
    y: 410,
    size: 36,
    hand: 'scrawl',
    width: 3,
    seed: 88,
    rot: -4,
    at: arrow.end + 0.04,
    until: arrow.end + 0.5,
  });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'graph',
    page: 3,
    pageTool: 'bic',
    boilFps: 8,
    seed: 103,
  });
  ctx.scene.add(page);
  heading(page);
  yearBoxes(page);
  result(page);
  rule(page);
  return { page };
}

export function update(t, state) {
  state.page.update(t * PACE);
}
