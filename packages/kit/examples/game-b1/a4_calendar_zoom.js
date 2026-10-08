// Game B1 look A (atari-story), template: the calendar zoom as one shot (showcase
// game-hud-b1-boss-v2 shots 2 -> 3, "masterful"). The living room at Christmas 1982; the pen rings
// the 25th on the wall calendar; the camera pushes into the calendar until its page stands where
// the deadline's page will stand; then the frame is redrawn line by line, interlaced, as the
// programmer's office inside the TV. Only the page stays: same place, same size; the whole room
// around it changes cleanly. Its months flip back to WEEKS LEFT.
// Focal: the calendar page (the ringed 25th, then the crimson 5).
// Traces: the unclosed pen ring; bulbs blinking on their own cadences; the push eases in and out;
// the interlaced redraw with its beam; pages flipping back in uneven beats; the programmer's
// elbows bobbing out of sync as he types.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-a4',
  title: 'Atari story: into the calendar',
  treatment: 'character-scene',
};

const PUSH = 2.2;
const REDRAWN = 3.72;
const FLIPS = [
  [3.9, 0.12],
  [4.04, 0.1],
  [4.16, 0.08],
  [4.27, 0.11],
];
const BACK = {
  rows: ['......####......', '....########....', '...##########...', '...##########...',
    '...##########...', '....########....', '.....######.....', '..############..',
    '.##############.', '################', '################', '################'],
  cols: ['walnutDark', 'walnutDark', 'walnutDark', 'walnutDark', 'walnutDark', 'walnutDark',
    'tan', 'orange', 'orange', 'rust', 'orange', 'orange'],
}; // prettier-ignore

function office(g, t, page) {
  const { ease, hash, lerp } = g.util;
  g.bands(0, 160, [[0, 'void'], [12, 'tube'], [72, 'night'], [128, 'tube']], 152); // prettier-ignore
  g.bands(0, 160, [[150, 'teak'], [152, 'walnut'], [160, 'walnutDark']]); // prettier-ignore
  g.rect(44, 112, 30, 38, 'grey');
  g.rect(47, 116, 24, 26, 'tealDark');
  const lines = Math.min(11, Math.floor(Math.max(0, t - REDRAWN) * 2.2));
  for (let i = 0; i < lines; i += 1)
    g.rect(49 + (i % 4 === 2 ? 2 : 0), 118 + i * 2, 3 + Math.floor(hash(66, i, 1) * 14), 1, 'aqua');
  // the calendar page: exactly where the room's calendar landed
  const { x, y, w, h } = page;
  const past = FLIPS.filter(([at, dur]) => t >= at + dur).length;
  g.rect(x, y + 8, w, h - 8, 'cream');
  if (past >= FLIPS.length) {
    g.rect(x, y + 8, w, 12, 'rust');
    g.text('WEEKS LEFT', x + 3, y + 11, { colour: 'cream' });
    g.score('5', x + 12.5, y + 27, { colour: 'crimson', cell: [20, 18] });
  } else {
    g.text('DEC', x + 3, y + 30, { colour: 'rust', size: 4 });
  }
  const flipping = FLIPS.find(([at, dur]) => t >= at && t < at + dur);
  if (flipping !== undefined) {
    const [at, dur] = flipping;
    const bottom = lerp(y + h, y + 8, ease.in((t - at) / dur));
    g.rect(x + 1, Math.round(bottom) - 2, w - 2, 2, 'tan');
  }
  g.rect(x, y, w, 8, 'teak');
  for (const rx of [3, 10, 18, 25, 33, 40]) g.rect(x + rx, y - 4, 2, 8, 'grey');
  const key = Math.floor(t * (4 + Math.max(0, t - REDRAWN) * 3));
  const down = hash(77, key, 1) > 0.45;
  g.sprite(BACK.rows, BACK.cols, 6, 132, { stretch: 2, rowH: 4 });
  g.rect(4, 168 + (down ? 1 : 0), 3, 8, 'orange');
  g.rect(37, 168 + (hash(77, key, 3) > 0.5 ? 1 : 0), 3, 8, 'orange');
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1982,
  });
  screen.room({ calendar: { month: 'DEC', mark: 25, markAt: [0.6, 1.4] }, tree: true });
  const zoom = screen.calendarZoom({
    intent: 'Christmas is the deadline: the calendar on the wall becomes the boss of the office',
    at: PUSH,
    push: 0.9,
    wipe: 0.62,
  });
  for (const cue of zoom.cues) ctx.sfx.at(cue.t, cue.name);
  // Before the redraw the TV idles in attract mode; after it, the TV picture is the office.
  screen.tv((g, t) => {
    if (t < PUSH + 0.9) g.attract();
    else office(g, t, zoom.landing);
  });
  screen.year('1982', { at: -1 });
  screen.progress({ from: 0.1, to: 0.2, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
