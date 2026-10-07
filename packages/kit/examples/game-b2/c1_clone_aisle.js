// Game B2 look C (rpg-boss), template 1: the clone aisle (showcase shot 6). A toy store aisle of
// look-alike game boxes that narrows as we walk in; one held look at the shelf of clones while
// MARKET starts to drain (each lost chunk pops off the meter as a number) and FLOODED comes up;
// on "too many" the stinger slams in letter by letter, the view and the HUD shake, and the squeeze
// goes on.
// Focal: the TOO MANY stinger (left third); before it the shelf of clones in the held look.
// Traces: SALE cards on sticks at angles, the uneven strides, the held look (a beat of stillness
// before the squeeze), losing segments blinking, uneven letter beats, the shake with decay.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gc1',
  title: 'RPG boss: the clone aisle',
  treatment: 'character-scene',
};

const AISLE = {
  name: 'toy-store-aisle',
  mood: 'shop',
  floor: 'tile',
  ceiling: 'office-light',
  grid: [
    '#################',
    '#SSSSSSSSSSSSSSS#',
    '#.....SSSSSSSSSS#',
    '#.........SSSSSS#',
    '#..............E#',
    '#..............E#',
    '#SSSSSSSSSSSSSSS#',
    '#################',
  ],
  legend: {
    '#': { wall: 'cinderblock' },
    S: { wall: 'store-shelf' },
    E: { wall: 'shelf-end' },
  },
  lights: [
    { pos: [3.5, 3.5], power: 0.9, radius: 3.6 },
    { pos: [8.0, 4.0], power: 0.9, radius: 3.6 },
    { pos: [12.5, 4.6], power: 0.85, radius: 3.4, flicker: 'tube' },
  ],
  sprites: [
    { sprite: 'card', pos: [2.9, 2.25], label: 'SALE', tilt: -6, seed: 2 },
    { sprite: 'card', pos: [7.7, 3.3], label: 'SALE', tilt: 5, seed: 5 },
    { sprite: 'card', pos: [12.4, 4.3], label: 'SALE', tilt: -3, seed: 8 },
    { sprite: 'bin', pos: [4.6, 5.4], seed: 3 },
  ],
};

const WALK = [
  [0.0, 1.5, 4.2, 2, 0, 'lin'],
  [2.4, 4.6, 4.3, -8, 0, 'out'],
  [3.0, 4.7, 4.3, -62, -4, 'inOut'],
  [3.9, 4.75, 4.3, -64, -4, 'lin'],
  [4.5, 5.0, 4.4, -4, 0, 'inOut'],
  [8.0, 12.8, 4.75, 0, 0, 'in'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: AISLE,
    duration: ctx.shot.duration,
    seed: 1983,
    path: WALK.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  view.hold({ kind: 'cartridge', label: 'E.T.', band: 'pink' }, { at: -1 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1983 });
  hud.compass({ at: 0, year: '1982', place: 'TOY STORE', target: [15.5, 4.5] });
  hud.minimap({ at: 0 });
  hud.meter({
    label: 'MARKET',
    at: 0.4,
    keys: [
      [0.4, 12],
      [2.7, 12],
      [3.3, 10],
      [5.1, 9],
      [6.9, 7],
    ],
  });
  hud.status({ label: 'FLOODED', icon: 'waves', at: 2.9 });
  hud.narrate('BUT STORES ARE ALREADY\nDROWNING IN GAMES.', { at: 0.6, until: 3.9 });
  hud.narrate('CHEAP CLONES.\nTOO MANY OF THEM.', { at: 4.35, until: 7.6 });
  hud.damage({ text: '-2', at: 3.3, on: 'meter' });
  hud.damage({ text: '-1', at: 5.1, on: 'meter' });
  const sting = hud.stinger('TOO MANY', { at: 5.55, until: 7.5 });
  for (const cue of sting.cues) ctx.sfx.at(cue.t, cue.name);
  view.shake({ at: 5.55, amp: 1.6 });
  hud.shake({ at: 5.55, amp: 2.5 });
  hud.damage({ text: '-2', at: 6.9, on: 'meter' });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
