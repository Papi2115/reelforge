// Sketchbook look B (sketch-graph), template 3: "the rule" (showcase sketchbook-v2 shot 10). An
// index card clipped into the book, neat fine-liner print: the whole leap-year rule, 1900 no,
// 2000 yes. One red word: Feb 29, with a swash. A small sun beside the card smiles. Quiet hold.
// Focal: the red "Feb 29" and its swash, low right on the card.
// Traces: the card tilted 1.2°, a paper clip at an angle, a check and a cross drawn by hand, a
// swash that loops back on itself, the sun's face added last as an afterthought.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sb3',
  title: 'Sketch graph: the rule',
  treatment: 'node-graph/timeline',
};

/** The showcase plays this page 8 % faster than real time. */
const PACE = 1.08;
const FINE = { tool: 'fine', width: 2 };
const RED = { tool: 'red', width: 3 };
const [CW, CH] = [500, 318];

function card(page) {
  const sheet = page.sheet({ x: 236, y: 96, deg: -1.2, w: CW, h: CH, seed: 777 });
  sheet.rule(0, 66, CW, 66, 'margin');
  sheet.rule(0, 67, CW, 67, 'margin');
  for (let v = 112; v < CH; v += 34) sheet.rule(0, v, CW, v, 'rule');
  const [cx, cy] = sheet.point(404, -18);
  page.clip(cx, cy, 7, { scale: 1.15 });
  return sheet;
}

function rule(page, sheet) {
  const write = (text, u, v, options) => {
    const [x, y] = sheet.point(u, v);
    return page.write(text, { x, y, rot: -1.2, hand: 'print', ...FINE, ...options });
  };
  write('LEAP YEARS', 30, 48, { size: 22, seed: 301, track: 0.4, at: 0.25, until: 0.82 });
  write('÷ 4  → leap', 34, 112, { size: 24, seed: 302, at: 1.02, until: 1.6 });
  write('÷ 100 → no leap', 34, 146, { size: 24, seed: 303, at: 1.82, until: 2.62 });
  write('÷ 400 → leap', 34, 180, { size: 24, seed: 304, at: 2.84, until: 3.46 });
  write('1900', 34, 246, { size: 26, seed: 305, at: 3.9, until: 4.16 });
  write('✗', 112, 246, { size: 24, seed: 306, at: 4.26, until: 4.36 });
  write('2000', 178, 246, { size: 26, seed: 307, at: 4.62, until: 4.88 });
  write('✓', 256, 246, { size: 30, seed: 308, at: 4.95, until: 5.04 });
  // A beat, then the one red word and its swash.
  write('Feb 29', 300, 292, {
    ...RED,
    size: 46,
    hand: 'scrawl',
    seed: 309,
    rot: -5,
    at: 5.5,
    until: 6.08,
  });
  const [s0, s1] = [sheet.point(296, 304), sheet.point(470, 296)];
  page.stroke(
    [
      s0[0],
      s0[1],
      s0[0] + 60,
      s0[1] + 5,
      s1[0] - 30,
      s1[1] - 2,
      s1[0],
      s1[1] - 10,
      s1[0] - 8,
      s1[1] - 16,
      s1[0] - 14,
      s1[1] - 6,
      s1[0] + 10,
      s1[1] + 4,
    ],
    { ...RED, at: 6.16, dur: 0.3, seed: 310 },
  );
}

function sun(page) {
  // The calendar and the sky agree again: a small sun beside the card, smiling.
  const [x, y] = [846, 236];
  page.sun(x, y, 24, { rays: 7, rayScale: 0.75, fillDur: 0.3, at: 6.78, until: 7.42, seed: 311 });
  page.stroke([x - 8, y - 5, x - 7, y - 2], { ...FINE, at: 7.5, dur: 0.04, seed: 312 });
  page.stroke([x + 6, y - 5, x + 7, y - 2], { ...FINE, at: 7.58, dur: 0.04, seed: 313 });
  page.stroke([x - 10, y + 5, x, y + 11, x + 10, y + 4], {
    ...FINE,
    width: 1,
    at: 7.66,
    dur: 0.1,
    seed: 314,
  });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'lined',
    page: 8,
    boilFps: 10,
    seed: 108,
  });
  ctx.scene.add(page);
  rule(page, card(page));
  sun(page);
  return { page };
}

export function update(t, state) {
  state.page.update(t * PACE);
}
