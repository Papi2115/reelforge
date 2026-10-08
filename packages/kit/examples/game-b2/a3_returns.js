// Game B2 look A (rpg-explore), template 3: the returns desk (showcase game-hud-b2-rpg-v2 shot 7).
// A boss you talk to: the clerk explains, you push the cartridge across the counter, every
// option but one is struck out, returned stock keeps landing on the desk and UNSOLD only fills.
// The level is written here in full: it is the format the runtime Claude writes.
// Focal: the clerk behind the counter (right of centre), the held cartridge pushed at him.
// Traces: struck options (hand-drawn clay lines), the clerk's head-shake, stacks landing with an
// overshoot and a thump (shake with decay), the faulty tube, irregular typing.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'ga3',
  title: 'RPG explore: the returns desk',
  treatment: 'character-scene',
};

const RETURNS = {
  name: 'returns',
  mood: 'backroom',
  floor: 'tile-big',
  ceiling: 'grey',
  grid: [
    '#############',
    '##.........##',
    '##.........##',
    '##.........##',
    '##..ccccc..##',
    '##....t....##',
    '#..........D#',
    '##.........##',
    '##.........##',
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
    { pos: [6.5, 5.5], power: 1.05, radius: 4.2, flicker: 'tube' },
    { pos: [7.6, 1.7], z: 0.6, power: 0.55, radius: 1.9 },
  ],
  sprites: [
    { id: 'clerk', sprite: 'clerk', pos: [6.45, 3.45] },
    { sprite: 'sign', pos: [4.75, 4.5], label: 'RETURNS' },
    { sprite: 'exit', pos: [10.55, 6.5] },
  ],
};

const WALK = [
  [0.0, 2.0, 6.5, -2, 'lin'],
  [0.5, 3.2, 6.45, -10, 'out'],
  [1.3, 4.3, 6.4, -67, 'inOut'],
  [7.5, 4.35, 6.3, -65, 'sine'],
  [8.2, 4.7, 6.35, 0, 'inOut'],
  [8.5, 5.5, 6.4, 0, 'in'],
];

/** Returned stock lands on the desk in two growing piles, on uneven beats: [at, x, y, level]. */
const LANDINGS = [
  [1.0, 6.95, 4.45, 0],
  [2.25, 7.4, 4.6, 0],
  [3.1, 6.9, 4.45, 1],
  [4.65, 7.45, 4.6, 1],
  [5.55, 6.98, 4.45, 2],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: RETURNS,
    duration: ctx.shot.duration,
    seed: 1983,
    path: WALK.map(([at, x, y, yaw, ease]) => ({ at, x, y, yaw, ease })),
  });
  LANDINGS.forEach(([at, x, y, level], i) => {
    view.place(
      { sprite: 'boxes', pos: [x, y], z: 0.42 + level * 0.22, seed: [3, 9, 14][i % 3] },
      { at },
    );
  });
  view.shake({ at: 5.55, amp: 2.2 });
  view.hold({ kind: 'cartridge', label: 'E.T.', band: 'pink' }, { at: -1 });
  view.present({ at: 3.8, until: 6.45 });
  view.act('clerk', { act: 'talk', at: 1.5, until: 3.6 });
  view.act('clerk', { act: 'no', at: 4.45, until: 4.8 });
  view.act('clerk', { act: 'no', at: 5.25, until: 5.6 });
  view.act('clerk', { act: 'talk', at: 6.45, until: 8.4 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1983 });
  hud.compass({
    years: [
      { at: -1, year: '1982' },
      { at: 0.2, year: '1983', place: 'RETURNS' },
    ],
    target: [6.5, 3.5],
  });
  hud.minimap();
  hud.meter({
    label: 'MARKET',
    keys: [
      [0, 7],
      [6.9, 7],
      [8.1, 3],
    ],
  });
  hud.boss({
    name: 'RETURNS DESK',
    label: 'UNSOLD',
    at: 1.25,
    until: 8.45,
    keys: LANDINGS.map(([at], i) => [at, (i + 1) / LANDINGS.length]),
  });
  hud.say('E.T. SELLS POORLY.\nSTORES SEND IT BACK.', { speaker: 'CLERK', at: 1.5, until: 3.65 });
  hud.choose({
    speaker: 'CLERK',
    options: ['SELL IT', 'MARK IT DOWN', 'SEND IT BACK'],
    at: 3.7,
    until: 6.45,
    steps: [
      { at: 3.85, cursor: 0 },
      { at: 4.5, strike: 0 },
      { at: 4.85, cursor: 1 },
      { at: 5.3, strike: 1 },
      { at: 5.65, cursor: 2 },
      { at: 5.85, pick: 2 },
    ],
  });
  hud.say('BY 1983, THE WHOLE\nMARKET IS CRASHING.', { speaker: 'CLERK', at: 6.45, until: 8.55 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
