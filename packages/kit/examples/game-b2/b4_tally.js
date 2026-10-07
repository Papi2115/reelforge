// Game B2 look B (rpg-menu), breakthrough: the intermission tally (showcase shot 8). The end of
// the chapter: the returns room melts away (Doom's screen melt) to the end-of-level card held
// over the frozen room; MADE and SOLD count up (MADE stalls mid-count, SOLD brakes), the pencil
// underlines how few sold, TIME and PAR tick in; a still beat with no sound, then the UNSOLD stamp
// thumps onto the plate's corner; it dissolves back to the room.
// Focal: the UNSOLD stamp (the only accent), before it the counter that is moving.
// Traces: uneven counting, the hand-set row labels, a coffee ring on the plate, the pencil
// underline in two strokes, the misregistered stamp with its smudge and a shake with decay.
// Facts: 4,000,000 made / 1,500,000 sold / par ~6 months are commonly cited: shown with EST.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb4',
  title: 'RPG menu: the intermission tally',
  treatment: 'counter/odometer',
};

const BACKROOM = {
  name: 'returns-back',
  mood: 'backroom',
  floor: 'tile-big',
  ceiling: 'grey',
  grid: [
    '#############',
    '##.........##',
    '##.........##',
    '##..ccccc..##',
    '##....t....##',
    '#..........D#',
    '##.........##',
    '##.........##',
    '#############',
  ],
  legend: {
    '#': { wall: 'cinderblock' },
    c: { wall: 'counter' },
    D: { door: true },
    t: { ceiling: 'grey-tube', flicker: true },
  },
  lights: [
    { pos: [6.5, 4.5], power: 1.0, radius: 4.2, flicker: 'tube' },
    { pos: [10.2, 5.5], z: 0.7, power: 0.6, radius: 1.8 },
  ],
  sprites: [
    { sprite: 'exit', pos: [10.6, 5.5] },
    { sprite: 'boxes', pos: [9.2, 6.9], seed: 3 },
    { sprite: 'boxes', pos: [9.7, 6.6], seed: 9 },
    { sprite: 'sign', pos: [9.5, 3.6], label: 'RETURNS' },
  ],
};

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: BACKROOM,
    duration: ctx.shot.duration,
    seed: 1983,
    path: [
      { at: 0, x: 6.2, y: 5.9, yaw: 4, ease: 'lin' },
      { at: 8, x: 6.6, y: 5.9, yaw: 6, ease: 'sine' },
    ],
  });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1983 });
  const tally = hud.tally({
    intent: 'the chapter in numbers: millions made, far fewer sold, built in about five weeks',
    at: 0,
    until: 8,
    title: 'CHRISTMAS 1982',
    sub: 'FINISHED',
    rows: [
      { label: 'MADE', value: 4000000, est: true },
      { label: 'SOLD', value: 1500000, est: true, underline: true },
      { label: 'TIME', value: 5, format: 'unit', unit: ['WEEK', 'WEEKS'], approx: true },
      {
        label: 'PAR',
        value: 6,
        format: 'unit',
        unit: ['MONTH', 'MONTHS'],
        approx: true,
        est: true,
        role: 'par',
      },
    ],
    stamp: { text: 'UNSOLD' },
  });
  for (const cue of tally.cues) ctx.sfx.at(cue.t, cue.name);
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
