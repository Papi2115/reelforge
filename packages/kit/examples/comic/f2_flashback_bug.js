// Comic breakthrough: flashback, inspiration 2 of 2 (a different topic and mechanism).
// Narration: "Why do we call it a bug? On September 9, 1947, the operators of the Harvard Mark II
// found a moth caught in relay 70, panel F. They taped it into the logbook: first actual case of
// bug being found."
// Mechanism: cover 'strip' + arrange 'row' - the present page (today's screen, in colour) stays;
// a torn strip of an old sepia comic slides in over it with three beats in reading order (the
// machine, the relay with the moth, the logbook page), then slides away: back to the present.
// Focal: the moth in the relay (beat 2), then the taped moth in the logbook.
// Traces: the strip's torn edge and its shadow on the present page, the strip pasted crooked,
// handwriting in the logbook, a strip of tape across the moth, a smudge on today's page.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cf2',
  title: 'Comic flashback: the first bug',
  treatment: 'node-graph/timeline',
};

const STRIP_T = 1.0;
const MACHINE_T = 1.35;
const RELAY_T = 2.7;
const LOG_T = 4.05;
const BACK_T = 6.5;

/** Today: a dark screen of code, one line marked red (the bug the narration asks about). */
function screen(g) {
  g.plate.rect(0, 0, 640, 360, g.tone('cyanDeep', 0.25, { cell: 4, angle: 0.26, on: 'night' }));
  for (let i = 0; i < 24; i++) {
    const y = 26 + i * 13;
    const indent = [0, 16, 16, 32, 32, 16, 0, 16][i % 8];
    const w = 60 + g.rnd('code', i) * 260;
    g.rect(52 + indent, y, w, 4, i === 15 ? 'red' : i % 5 === 2 ? 'cyan' : 'greyMid');
  }
  g.rect(52, 26 + 15 * 13 + 6, 2, 8, 'paper');
}

/** The machine: a wall of relay cabinets, an operator from behind. */
function machine(g, t, [w, h]) {
  g.plate.rect(-4, -4, w + 8, h + 8, g.tone('ink', 0.12, { cell: 4, on: 'aged' }));
  for (let c = 0; c < 4; c++) {
    const x = 8 + c * 44;
    g.plate.rect(x, 14, 38, h - 34, 'greyMid');
    for (let r = 0; r < 12; r++) {
      for (let k = 0; k < 4; k++)
        g.rect(x + 5 + k * 8, 20 + r * 9, 4, 5, (r + k + c) % 7 === 0 ? 'greyLight' : 'ink');
    }
    g.ink([x, 14, x + 38, 14, x + 38, h - 20, x, h - 20], { boil: 0.4, key: 'cab' + c });
  }
  g.plate.rect(-4, h - 20, w + 8, 24, 'greyDark');
  // The operator, from behind, a clipboard under the arm.
  const ox = w - 44;
  g.blob(
    [
      { e: [ox, h - 70, 11, 13] },
      { c: [ox - 18, h - 40, ox + 18, h - 40, 16] },
      { c: [ox - 22, h - 30, ox + 22, h - 30, 16] },
    ],
    'night',
    { key: 'operator' },
  );
  g.rect(ox + 16, h - 50, 12, 18, 'paper');
}

/** Relay 70, panel F: two contact blades, the moth caught between them. */
function relay(g, t, [w, h]) {
  g.plate.rect(-4, -4, w + 8, h + 8, g.tone('ink', 0.3, { cell: 3, angle: 0.8, on: 'greyDark' }));
  const cx = w / 2;
  const cy = h / 2 + 8;
  g.plate.rect(cx - 52, cy - 52, 104, 22, 'greyLight');
  g.ink([cx - 52, cy - 52, cx + 52, cy - 52, cx + 52, cy - 30, cx - 52, cy - 30], { key: 'coil' });
  for (const dx of [-26, 26]) {
    g.line(cx + dx, cy - 30, cx + dx * 0.4, cy + 34, 'greyLight', g.w(4));
    g.line(cx + dx, cy - 30, cx + dx * 0.4, cy + 34, 'ink', 1);
  }
  // The moth: wings spread across the contacts, the body between them.
  const wing = (dx, flip) => g.ellipsePts(cx + dx, cy + 10 + flip * 3, 15, 9, 14);
  for (const [dx, flip] of [
    [-11, -1],
    [11, 1],
  ]) {
    g.plate.poly(wing(dx, flip), g.tone('ink', 0.35, { cell: 3, on: 'shade' }));
    g.ink(wing(dx, flip), { boil: 0.5, key: 'wing' + dx });
  }
  g.blob([{ c: [cx, cy - 2, cx, cy + 22, 3.5] }], 'ink', { key: 'body' });
  g.line(cx - 1, cy - 4, cx - 7, cy - 12, 'ink', 1);
  g.line(cx + 1, cy - 4, cx + 7, cy - 12, 'ink', 1);
}

/** The logbook page: the operators' handwriting, the moth taped onto the page. */
function logbook(g, t, [w, h]) {
  g.plate.rect(-4, -4, w + 8, h + 8, 'paper');
  for (let y = 22; y < h; y += 12) g.line(0, y, w, y, 'cyan', 1);
  g.line(26, 0, 26, h, 'magenta', 1);
  const hand = { color: 'ink', slant: 1, jitter: 1.2 };
  g.text('1545 RELAY 70 PANEL F', 30, 14, hand);
  g.text('MOTH IN RELAY.', 30, 26, hand);
  const mx = w / 2 + 6;
  const my = 66;
  for (const dx of [-9, 9])
    g.plate.ellipse(mx + dx, my, 10, 6, g.tone('ink', 0.35, { cell: 3, on: 'shade' }));
  g.blob([{ c: [mx, my - 6, mx, my + 8, 2.5] }], 'ink', { key: 'logmoth' });
  g.poly(
    [mx - 34, my - 6, mx + 32, my - 10, mx + 33, my + 2, mx - 33, my + 6],
    g.dither('none', 'greyLight', 0.5),
  );
  if (t >= LOG_T + 0.6) {
    const n = Math.floor(Math.min(1, (t - LOG_T - 0.6) / 0.9) * 37.99);
    g.text('FIRST ACTUAL CASE', 30, 98, { ...hand, reveal: n });
    g.text('OF BUG BEING FOUND.', 30, 110, { ...hand, reveal: Math.max(0, n - 18) });
  }
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 112, anchor: ctx.anchor });
  ctx.scene.add(page);
  page.panels('splash')[0].draw(screen);
  page.caption('WHY DO WE CALL IT A BUG?', { x: 30, y: 22, at: 0.2, tilt: -1 });
  page.flashback({
    intent: 'the word bug comes from a real moth found in a relay of the Mark II in 1947',
    when: 'SEPTEMBER 9, 1947.',
    at: STRIP_T,
    until: BACK_T,
    cover: 'strip',
    arrange: 'row',
    enter: 'slide',
    beats: [
      { at: MACHINE_T, draw: machine, weight: 1.1 },
      { at: RELAY_T, draw: relay, weight: 0.9, caption: 'RELAY 70, PANEL F.' },
      { at: LOG_T, draw: logbook, weight: 1.2, enter: 'pop' },
    ],
  });
  page.smudge(600, 330, { length: 8, angle: 2.2 });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
