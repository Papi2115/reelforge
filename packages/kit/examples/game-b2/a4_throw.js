// Game B2 look A (rpg-explore), the throw (the showcase's cartridge toss, generalised): at the
// returns desk the clerk says the stores send it back; we lift the cartridge, toss it onto the
// returns pile on the counter (it tumbles, lands with a puff of dust, the pile jolts), it leaves
// the inventory and the UNSOLD bar grows by that one; the clerk goes on about the crash.
// Focal: the cartridge in the air, then the pile it lands on (right of centre, by the clerk).
// Traces: the dip before the swing (anticipation), the tumble frames, dust at 8.5 fps, the pile's
// jolt with decay, the faulty tube, irregular typing.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'ga4',
  title: 'RPG explore: the cartridge onto the returns pile',
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
    { id: 'clerk', sprite: 'clerk', pos: [6.1, 3.4] },
    { id: 'pile', sprite: 'boxes', pos: [7.45, 4.5], z: 0.42, seed: 14 },
    { sprite: 'boxes', pos: [7.1, 4.55], z: 0.42, seed: 3 },
    { sprite: 'sign', pos: [4.75, 4.5], label: 'RETURNS' },
  ],
};

const WALK = [
  [0.0, 6.3, 7.6, -92, 'lin'],
  [1.3, 6.45, 6.55, -90, 'out'],
  [8.0, 6.5, 6.5, -88, 'sine'],
];

const CARTRIDGE = { kind: 'cartridge', label: 'E.T.', band: 'pink' };

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: RETURNS,
    duration: ctx.shot.duration,
    seed: 1983,
    path: WALK.map(([at, x, y, yaw, ease]) => ({ at, x, y, yaw, ease })),
  });
  view.hold(CARTRIDGE, { at: -1 });
  view.act('clerk', { act: 'talk', at: 0.7, until: 3.0 });
  const toss = view.throw(CARTRIDGE, {
    intent: 'the cartridge goes back onto the returns pile: E.T. comes back unsold',
    at: 3.75,
    target: 'pile',
  });
  for (const cue of toss.cues) ctx.sfx.at(cue.t, cue.name);
  view.act('clerk', { act: 'talk', at: 5.3, until: 7.4 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1983 });
  hud.compass({ at: 0, year: '1983', place: 'RETURNS', target: [6.5, 3.5] });
  hud.minimap({ at: 0 });
  hud.inventory({
    at: 0,
    items: [
      { icon: 'calendar', label: 'DEADLINE: ~5 WEEKS', at: -3 },
      { icon: 'cartridge', label: 'E.T. CARTRIDGE', at: -3, band: 'pink', out: toss.release },
    ],
  });
  hud.boss({
    name: 'RETURNS DESK',
    label: 'UNSOLD',
    at: 0.4,
    keys: [
      [0.4, 0.55],
      [toss.land, 0.72],
    ],
  });
  hud.say('E.T. SELLS POORLY.\nSTORES SEND IT BACK.', { speaker: 'CLERK', at: 0.7, until: 3.1 });
  hud.toast({ head: '- ITEM', body: 'E.T. CARTRIDGE', at: toss.land + 0.15 });
  hud.say('BY 1983, THE WHOLE\nMARKET IS CRASHING.', { speaker: 'CLERK', at: 5.3, until: 7.6 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
