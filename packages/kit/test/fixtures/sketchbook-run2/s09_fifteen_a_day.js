/* eslint-disable @typescript-eslint/no-unused-vars -- verbatim scene of real film 2 (docs/real-run-sketchbook-2.md) */
// focal: the big blue ballpoint "15 / DAY" on a clipped index card (left two thirds), struck through in red with a crooked red "NO RECORD" stamp | traces: an uneven double underline that overshoots, a pencil "?" in the margin, a coffee ring half under the card
export const meta = {
  id: 's09_fifteen_a_day',
  title: 'Fifteen a day? No record',
  treatment: 'counter/odometer',
};

// quick hand capitals as strokes in a unit box (x right, y down)
const arc = (a0, a1, n = 9) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)];
  });
const GLYPHS = {
  '/': [
    [
      [0.1, 1],
      [0.7, 0],
    ],
  ],
  D: [
    [
      [0, 1],
      [0, 0],
      [0.55, 0.05],
      [0.95, 0.45],
      [0.6, 0.95],
      [0, 1],
    ],
  ],
  A: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
    [
      [0.22, 0.62],
      [0.8, 0.6],
    ],
  ],
  Y: [
    [
      [0, 0],
      [0.5, 0.5],
      [1, 0],
    ],
    [
      [0.5, 0.5],
      [0.48, 1],
    ],
  ],
  N: [
    [
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 0],
    ],
  ],
  O: [arc(-90, 275, 12)],
  R: [
    [
      [0, 1],
      [0, 0],
      [0.75, 0.04],
      [0.95, 0.25],
      [0.75, 0.46],
      [0, 0.5],
    ],
    [
      [0.4, 0.5],
      [1, 1],
    ],
  ],
  E: [
    [
      [0.95, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.5],
      [0.7, 0.48],
    ],
  ],
  C: [arc(-40, -320, 10)],
};

function letter(page, text, { x, y, h, w, gap, rot, tool, at, dur }) {
  const c = Math.cos((rot * Math.PI) / 180),
    s = Math.sin((rot * Math.PI) / 180);
  let penAt = at,
    cx = x,
    first = null,
    last = null;
  for (const ch of text) {
    if (ch === ' ') {
      cx += gap * 0.6;
      continue;
    }
    for (const g of GLYPHS[ch]) {
      const pts = g.map(([u, v]) => {
        const px = cx + u * w - x,
          py = (v - 1) * h;
        return [x + px * c - py * s, y + px * s + py * c];
      });
      last = page.stroke(pts, { tool, at: penAt, dur });
      first = first || last;
      penAt = last.end + 0.015;
    }
    cx += gap;
  }
  return { at: first.at, end: last.end };
}

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const fifteen = anchor('Fifteen');
  const day = anchor('day');
  const often = anchor('often claimed');
  const noRecord = anchor('No record backs it');

  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'graph',
    page: 9,
    pageTool: 'bic',
    boilFps: 8,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  // already on the page: a coffee ring, the index card clipped on, the source note
  page.coffeeRing(600, 420, 52, { at: -9 });
  page.sheet({ x: 110, y: 100, w: 520, h: 330, deg: -3, at: -8 });
  page.clip(560, 98, 8, { at: -7 });
  page.write('en.wikipedia.org', {
    x: 690,
    y: 488,
    size: 14,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -2,
    at: -6,
  });

  // "Fifteen": highlighter sweep, then the number in fast heavy ballpoint strokes
  page.stroke([175, 215, 300, 207, 420, 213, 545, 204], { tool: 'hi', at: fifteen.t, dur: 0.14 });
  const one = page.stroke([196, 150, 228, 124, 226, 266], {
    tool: 'bic',
    at: fifteen.t + 0.16,
    dur: 0.1,
  });
  const fiveTop = page.stroke([338, 124, 284, 128], { tool: 'bic', at: one.end + 0.03, dur: 0.05 });
  const num = page.stroke([284, 128, 278, 190, 314, 180, 344, 204, 342, 242, 306, 266, 272, 252], {
    tool: 'bic',
    at: fiveTop.end + 0.02,
    dur: 0.14,
  });
  const per = letter(page, '/ DAY', {
    x: 376,
    y: 262,
    h: 42,
    w: 28,
    gap: 36,
    rot: -3,
    tool: 'bic',
    at: Math.max(day.t - 0.08, num.end + 0.03),
    dur: 0.05,
  });
  page.keepClear(180, 110, 360, 170);

  // "often claimed": an uneven double underline that overshoots, then a pencil doubt in the margin
  const u1 = page.stroke([186, 292, 360, 289, 548, 294], {
    tool: 'bic',
    at: Math.max(often.t, per.end + 0.03),
    dur: 0.14,
  });
  const u2 = page.stroke([204, 306, 380, 302, 500, 305], {
    tool: 'bic',
    at: u1.end + 0.04,
    dur: 0.11,
  });
  const hook = page.stroke([690, 196, 706, 176, 730, 178, 738, 200, 718, 220, 716, 240], {
    tool: 'pencil',
    at: u2.end + 0.2,
    dur: 0.16,
  });
  const doubt = page.stroke([716, 258, 718, 263], {
    tool: 'pencil',
    at: hook.end + 0.04,
    dur: 0.03,
  });

  // still beat, then the one red correction on "No record backs it": strike the number, stamp the verdict
  const strike = page.stroke([176, 236, 330, 196, 548, 160], {
    tool: 'red',
    at: Math.max(noRecord.t, doubt.end + 0.4),
    dur: 0.14,
  });
  const stamp = letter(page, 'NO RECORD', {
    x: 230,
    y: 392,
    h: 46,
    w: 30,
    gap: 40,
    rot: -7,
    tool: 'red',
    at: strike.end + 0.06,
    dur: 0.045,
  });

  sfx.at(fifteen.t, 'scribble');
  sfx.at(per.at, 'scribble');
  sfx.at(noRecord.t, 'hit-soft');
  sfx.at(strike.at, 'scribble');
  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
