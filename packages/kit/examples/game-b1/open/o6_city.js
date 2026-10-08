// Game B1 open vocabulary (PLAN.md#13.15), example 6: a CITY film. The room is a 1987 office
// (room DSL: shell, a window on the city, the wall clock at the market's close, a computer on the
// desk, the calendar's ringed day with the year); the camera pushes into the TV, where the
// street is built from the film's own vocabulary: a skyline playfield, lit office towers, cars as
// NUSIZ copies, clerks running with papers, and a counter of the real number.
// Narration: "On Monday, October 19, 1987, the Dow Jones fell from 2246 to 1738 in a single day.
// By four o'clock, traders were running into the streets of New York."
// Focal: the ringed 19 on the calendar; then the counter landing on 1738 (the only crimson).
// Traces: the pen rings the day and never closes the circle; the screen on the desk blinks off
// the beat; the cars and clerks move on their own cadences; papers fall in uneven drifts; the
// counter drops in one jolt with a decaying shake.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-o6',
  title: 'Open vocabulary: city',
  treatment: 'character-scene',
};

/** What would live in assets/game-b1/crash-1987.json. */
const ASSETS = {
  version: 1,
  world: 'game-b1',
  generated: {
    skyline: { kind: 'scenery', type: 'skyline', rows: 8, rowH: 4, seed: 19, colours: ['grey', 'grey'] },
    tower: { kind: 'building', type: 'office', size: 2, rowH: 3, seed: 4 },
    towerB: { kind: 'building', type: 'office', size: 2, rowH: 4, seed: 7, colours: { m: 'tealDark', l: 'tealDark' } },
    traffic: { kind: 'vehicle', type: 'car', copies: 2, gap: 'wide', seed: 2 },
    taxi: { kind: 'vehicle', type: 'car', seed: 3, colours: { m: 'gold', s: 'orange' } },
    trader: { kind: 'person', role: 'clerk', tool: 'document', seed: 1, fps: 10 },
    traderB: { kind: 'person', role: 'clerk', tool: 'none', seed: 6, fps: 10, colours: { top: 'blue', hair: 'walnut' } },
    paper: { kind: 'item', type: 'document', seed: 2 },
  },
  rooms: {
    office: {
      shell: 'office',
      light: 'day',
      calendar: { month: 'OCT', year: 1987, mark: 19, markAt: [0.5, 1.3] },
      defaults: false,
      props: [
        { kind: 'window', x: 212, w: 50, sky: 'day', view: 'city' },
        { kind: 'clock', x: 290, y: 12, time: '4:00' },
        { kind: 'desk', x: 214, w: 60, on: 'computer' },
        { kind: 'cabinet', x: 290, type: 'filing' },
      ],
    },
  },
}; // prettier-ignore

const PUSH = [1.9, 3.0];
/** The day's two numbers from the narration: no invented steps in between. */
const DROPS = [
  [0, 2246],
  [5.9, 1738],
];

function picture(g, t) {
  const { path, hash, shake } = g.util;
  const jolt = shake(t, DROPS[1][0], 3, 8, 919);
  g.offset(jolt.x * 4, jolt.y * 2);
  g.bands(0, 160, [
    [0, 'blue'],
    [50, 'aqua'],
  ]);
  g.field('skyline', 54);
  g.draw('tower', 8, 50, { playfield: true });
  g.draw('towerB', 112, 36, { playfield: true });
  g.bands(0, 160, [
    [86, 'greyDark'],
    [128, 'grey'],
    [131, 'greyDark'],
    [170, 'grey'],
  ]);
  for (let i = 0; i < 8; i += 1) g.rect(i * 20 + 4, 129, 8, 1, 'cream');
  const car = path([[0, -60, 112], [8, 180, 112]], t);
  g.draw('traffic', car.x, car.y);
  const taxi = path([[0, 170, 140], [8, -30, 140]], t);
  g.draw('taxi', taxi.x, taxi.y, { face: 'left' });
  // the traders run out once the counter starts falling
  const run = path([[0, 40, 146], [3.6, 40, 146], [7.6, 132, 146]], t);
  g.draw('trader', run.x, run.y, { frame: run.moving ? undefined : 0, flicker: false });
  const runB = path([[0, 20, 148], [4.2, 20, 148], [7.6, 100, 148]], t);
  g.draw('traderB', runB.x, runB.y, { frame: runB.moving ? undefined : 0, phase: 1 });
  for (let i = 0; i < 4; i += 1) {
    const from = 3.8 + i * 0.7 + hash(8, i, 1) * 0.4;
    if (t < from) continue;
    const k = t - from;
    const x = 30 + i * 28 + Math.round(Math.sin(k * 3 + i) * 4);
    g.draw('paper', x, Math.min(150, 60 + Math.floor(k * 22)), { playfield: true });
  }
  g.offset(0, 0);
  g.counter({
    means: 'the Dow Jones index that day',
    keys: DROPS,
    x: 6,
    y: 26,
    colour: t >= DROPS[1][0] ? 'crimson' : 'white',
    cell: [4, 4],
  });
  g.text('DOW JONES', 6, 36, { colour: 'cream' });
  g.text('NEW YORK', 6, 172, { colour: 'cream', type: { at: 3.2, cps: 14 } });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1987,
  });
  screen.assets(ASSETS);
  screen.interior('office');
  screen.camera([
    { at: PUSH[0], on: 'room' },
    { at: PUSH[1], on: 'tv', ease: 'inOut' },
  ]);
  screen.tv(picture);
  screen.year('1987', { at: 0.3 });
  screen.progress({ from: 0.83, to: 1, slots: 6 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
