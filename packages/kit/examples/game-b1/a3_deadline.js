// Game B1 look A (atari-story), template 3: boss 1, the deadline (showcase game-hud-b1-boss-v2
// shot 3). Inside the TV, over the programmer's shoulder: the wall calendar has become the boss. Its
// months flip back to the page that counts WEEKS LEFT; he types faster and faster, a page tears off
// at each week, the boss's HP drops; at zero he slumps, the boss dies in a flicker, and Dad's sticky
// note on the glass names the weak point (MORE TIME) and is struck out. The console then idles:
// attract mode cycles the picture's colours.
// Focal: the boss page's crimson digit (weeks left), then the sticky note.
// Traces: pages flip back in uneven beats; typing speeds up unevenly and the elbows bob out of
// sync; torn pages flutter onto his desk; a decaying shake per tear; hit-stop + flash + flicker
// death; he slumps; the note is slapped on, underlined twice, then struck out by hand.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb3',
  title: 'Atari story: boss 1, the deadline',
  treatment: 'character-scene',
};

const CAL = { x: 96, y: 22, w: 46, h: 130 };
const FLIPS = [
  [0.72, 0.12],
  [0.86, 0.1],
  [0.97, 0.08],
  [1.06, 0.11],
];
const TEARS = [3.15, 4.1, 4.82, 5.38, 5.8];
const HIT = 5.8;
const DEATH = 6.0;
const BACK = {
  rows: [
    '......####......', '....########....', '...##########...', '...##########...',
    '...##########...', '....########....', '.....######.....', '..############..',
    '.##############.', '################', '################', '################',
  ], // prettier-ignore
  cols: ['walnutDark', 'walnutDark', 'walnutDark', 'walnutDark', 'walnutDark', 'walnutDark',
    'tan', 'orange', 'orange', 'rust', 'orange', 'orange'], // prettier-ignore
};
/** The console idles after the fight: its colours step round the wheel (uneven holds). */
const ATTRACT = [
  [8.12, 'cycle1'],
  [8.27, 'cycle2'],
  [8.41, 'cycle3'],
];

function weeksLeft(t) {
  return 5 - TEARS.filter((at) => t >= at).length;
}

function bossPage(g, t) {
  const { x, y, w, h } = CAL;
  const left = weeksLeft(t);
  for (let i = 0; i < left; i += 1)
    g.rect(x + 1 + i, y + h + i * 0.5, w, 1, i % 2 ? 'tan' : 'teak');
  g.rect(x, y + 8, w, h - 8, 'cream');
  g.rect(x, y + 8, w, 12, 'rust');
  g.text('WEEKS LEFT', x + 3, y + 11, { colour: 'cream' });
  g.score(String(left), x + 12.5, y + 27, { colour: 'crimson', cell: [20, 18] });
  for (let r = 0; r < 4; r += 1)
    for (let d = 0; d < 7; d += 1) {
      g.rect(x + 3 + d * 6, y + 80 + r * 11, 4, 7, 'tan');
      g.rect(x + 4 + d * 6, y + 81 + r * 11, 2, 5, 'cream');
    }
}

function binding(g, alive) {
  const { x, y, w } = CAL;
  g.rect(x, y, w, 8, 'teak');
  g.rect(x, y + 7, w, 1, 'walnut');
  for (const rx of [3, 10, 18, 25, 33, 40]) {
    g.rect(x + rx, y - 4, 2, 8, 'grey');
    g.rect(x + rx, y + 3, 2, 1, 'void');
  }
  // dead: only the binding is left, with torn stubs of paper
  if (!alive)
    for (let i = 0; i < 9; i += 1)
      g.rect(x + 2 + i * 5 + (i % 2), y + 8, 2 + (i % 3 === 0 ? 1 : 0), 2 + (i % 2), 'cream');
}

function calendarBoss(g, t) {
  const { ease, lerp } = g.util;
  if (t >= DEATH && (t >= 6.62 || g.frame % 2 === 0)) {
    binding(g, false);
    return;
  }
  const past = FLIPS.filter(([at, dur]) => t >= at + dur).length;
  if (past >= FLIPS.length) bossPage(g, t);
  else g.rect(CAL.x, CAL.y + 8, CAL.w, CAL.h - 8, 'cream');
  // flipping back through the months, uneven beats; the last flip reveals the boss page
  const flipping = FLIPS.findIndex(([at, dur]) => t >= at && t < at + dur);
  if (flipping >= 0) {
    const [at, dur] = FLIPS[flipping];
    const bottom = lerp(CAL.y + CAL.h, CAL.y + 8, ease.in((t - at) / dur));
    g.rect(CAL.x, CAL.y + 8, CAL.w, Math.max(0, bottom - CAL.y - 8), 'cream');
    g.rect(CAL.x + 1, Math.round(bottom) - 2, CAL.w - 2, 2, 'tan'); // the page's back curling over
  }
  binding(g, true);
}

function tornPages(g, t) {
  const { ease, lerp } = g.util;
  const rest = [[78, 147], [84, 148], [80, 145], [88, 146], [76, 144]]; // prettier-ignore
  TEARS.forEach((t0, i) => {
    const d = t - t0;
    if (d < 0) return;
    const k = Math.min(1, d / (0.62 + i * 0.07));
    const x = Math.round(lerp(CAL.x + 8, rest[i][0], k) + Math.sin(d * 9 + i) * (1 - k) * 5);
    const y = Math.round(lerp(CAL.y + 24, rest[i][1], ease.in(k)));
    const flat = k >= 1 || Math.floor(d * 8 + i) % 2 === 0;
    if (flat) g.rect(x, y, 9, 2, i % 2 ? 'cream' : 'tan');
    else g.rect(x + 2, y - 3, 4, 6, 'cream');
  });
}

function programmer(g, t) {
  const { hash, seg } = g.util;
  const x = 6;
  const y = 132;
  if (t >= 6.15) {
    // slumped: head drops forward, shoulders round
    g.sprite(BACK.rows, BACK.cols, x, y + 4, { stretch: 2, rowH: 4, squash: 0.9 });
    return;
  }
  const rate = 4 + seg(t, 1.5, 5.8) * 9; // typing speeds up
  const key = Math.floor(t * rate);
  const down = hash(77, key, 1) > 0.45;
  const hard = down && hash(77, key, 2) > 0.72;
  g.sprite(BACK.rows, BACK.cols, x, y, { stretch: 2, rowH: 4, squash: hard ? 0.96 : 1 });
  g.rect(x + 5, y + 14, 1, 3, 'tan');
  g.rect(x + 26, y + 14, 1, 3, 'tan');
  // elbows bob on keystrokes, not in sync
  g.rect(x - 2, y + 36 + (down ? 1 : 0), 3, 8, 'orange');
  g.rect(x + 31, y + 36 + (hash(77, key, 3) > 0.5 ? 1 : 0), 3, 8, 'orange');
}

function office(g, t) {
  const { hash, shake } = g.util;
  const hit = t >= HIT && t < HIT + 0.14;
  const tt = hit ? HIT : t; // hit-stop
  let sx = 0;
  let sy = 0;
  for (const t0 of TEARS) {
    const s = shake(tt, t0, 3, 10, 300 + Math.round(t0 * 10));
    sx += s.x;
    sy += s.y;
  }
  g.offset(sx * 2, sy * 2);
  g.bands(
    0,
    160,
    [
      [0, 'void'],
      [12, 'tube'],
      [72, 'night'],
      [128, 'tube'],
    ],
    152,
  );
  g.bands(0, 160, [
    [150, 'teak'],
    [152, 'walnut'],
    [160, 'walnutDark'],
  ]);
  // the terminal behind him: lines of code appear as he types
  g.rect(44, 112, 30, 38, 'grey');
  g.rect(44, 112, 30, 1, 'cream');
  g.rect(73, 112, 1, 38, 'greyDark');
  g.rect(47, 116, 24, 26, 'tealDark');
  const lines = Math.min(11, Math.floor(Math.max(0, tt - 1.2) * 2.2));
  for (let i = 0; i < lines; i += 1)
    g.rect(49 + (i % 4 === 2 ? 2 : 0), 118 + i * 2, 3 + Math.floor(hash(66, i, 1) * 14), 1, 'aqua');
  g.rect(56, 144, 8, 6, 'greyDark');
  const sway = tt > 1.3 && tt < DEATH && hash(39, Math.floor(tt * 2.3), 1) > 0.62 ? 1 : 0;
  g.offset(0, sway * 2); // the boss sways on its own, the tears shake the room
  calendarBoss(g, tt);
  g.offset(sx * 2, sy * 2);
  tornPages(g, tt);
  programmer(g, tt);
  g.offset(0, 0);
  if (hit) g.remap('dim');
  if (t >= HIT && t < HIT + 0.04) g.remap('flash');
  const step = ATTRACT.filter(([at]) => t >= at).pop();
  if (step !== undefined) g.remap(step[1]);
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 31,
  });
  screen.tv(office);
  screen.boss({
    num: 1,
    name: 'THE DEADLINE',
    from: 'left',
    x: 40,
    y: 52,
    at: 1.2,
    seed: 31,
    hp: { n: 5, label: 'WEEKS', segW: 14, keys: TEARS.map((at, i) => [at, 4 - i]) },
    defeat: DEATH,
  });
  // the weak point, slapped on the glass in Dad's hand, then struck out: there was no more time
  screen.note(['WEAK POINT:', 'MORE TIME'], {
    at: 5.72,
    x: 172,
    y: 190,
    angle: -0.075,
    seed: 51,
    under: 1,
    strike: { line: 1, at: 7.05 },
  });
  screen.year('1982', { at: -1 });
  screen.progress({ from: 0.2, to: 0.3, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
