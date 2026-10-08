// Game B2 look B (rpg-menu), breakthrough: the automap, the story so far (showcase shot 4).
// We stand at the warehouse's east door holding the cartridge; the map dithers in out of the
// minimap, the arrow replays the walk (office -> warehouse -> the shelf -> this door) and the
// rooms draw on as it enters them; the camera drags right to the rooms still ahead, the store
// door warms, a margin note says where we go next; then the map folds back into the minimap.
// The level is the film's whole route (one room per chapter): the map is generated from it.
// Focal: the player arrow at the east door + the objective diamond just through it (left third).
// Traces: hand-ruled walls 1 px off with overruns, uneven pen speed, pencil ticks by the done
// rooms, the margin note on a stair-step baseline with a two-stroke arrow.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb2',
  title: 'RPG menu: the automap, the story so far',
  treatment: 'map',
};

/** The film's route: office, warehouse, toy store, returns (one room per chapter). */
const ROUTE = {
  name: 'route-1982',
  mood: 'dark',
  floor: 'concrete',
  ceiling: 'dark',
  grid: [
    '###############################',
    '###############################',
    '########wwwwwwww###############',
    '#oooooo#wwwwwwww#pppppp########',
    '#oooooo#wwsssssw#pppppp#rrrrrr#',
    '#ouuooo#wwwwwwww#ppkkpp#rrcccr#',
    '#ooooooDwwwwwwwwDppkkppDrrrrrr#',
    '#oooooo#wwwwwwww#ppkkpp#rrrrrr#',
    '#oooooo#wwsssssw#pppppp#rrrrrr#',
    '########wwwwwwww#pppppp########',
    '########wwwwwwww###############',
    '###############################',
  ],
  legend: {
    '#': { wall: 'concrete' },
    u: { wall: 'cubicle' },
    s: { wall: 'shelf', label: 'E.T.' },
    k: { wall: 'store-shelf' },
    c: { wall: 'counter' },
    D: { door: true },
    o: { floor: 'carpet', ceiling: 'office', mood: 'tungsten' },
    w: { floor: 'warehouse-line', ceiling: 'warehouse-tube', mood: 'fluorescent' },
    p: { floor: 'tile', ceiling: 'office-light', mood: 'shop' },
    r: { floor: 'tile-big', ceiling: 'grey-tube', mood: 'backroom' },
  },
  lights: [
    { pos: [3.5, 4.5], power: 0.8, radius: 4 },
    { pos: [11.5, 6.5], power: 0.95, radius: 3.8, flicker: 'tube' },
    { pos: [14.5, 3.5], power: 0.8, radius: 3.4 },
    { pos: [19.5, 4.2], power: 0.9, radius: 4 },
    { pos: [26.5, 6.5], power: 0.9, radius: 3.6 },
  ],
  sprites: [{ sprite: 'exit', pos: [15.9, 5.6] }],
};

// The walk before this shot (negative times): office -> door -> warehouse -> shelf -> east door.
const WALK = [
  [-6.0, 2.0, 6.5, 0, 'lin'],
  [-5.0, 4.6, 6.5, 0, 'in'],
  [-4.2, 7.0, 6.5, 0, 'lin'],
  [-3.2, 11.0, 6.6, 3, 'out'],
  [-2.9, 12.4, 7.1, 88, 'inOut'],
  [-2.1, 12.4, 7.1, 90, 'lin'],
  [-1.7, 12.7, 6.6, 2, 'inOut'],
  [-0.6, 15.3, 6.5, 0, 'out'],
  [0.0, 15.3, 6.5, 0, 'lin'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: ROUTE,
    duration: ctx.shot.duration,
    seed: 1982,
    path: WALK.map(([at, x, y, yaw, ease]) => ({ at, x, y, yaw, ease })),
  });
  view.hold({ kind: 'cartridge', label: 'E.T.', band: 'pink' }, { at: -1 });
  const map = view.automap({
    intent: 'the story so far: the office and the warehouse are done, the stores come next',
    at: 0,
    until: 8,
    enter: 'wipe',
    scale: 14,
    replay: { from: -6, to: 0, dur: 2.5 },
    rooms: [
      { cell: [3, 4], label: 'THE OFFICE', sub: '1982' },
      { cell: [12, 6], label: 'THE WAREHOUSE', sub: '1982' },
      {
        cell: [18, 4],
        label: 'TOY STORE',
        sub: '1982',
        state: 'next',
        at: 3.55,
        labelAt: [18.9, 1.45],
      },
      { cell: [25, 6], label: 'RETURNS', sub: '1983', state: 'ahead', at: 3.85 },
    ],
    marks: [
      { kind: 'item', pos: [12.4, 7.75], at: 1.95 },
      { kind: 'objective', pos: [18.1, 6.5], at: 4.3 },
    ],
    note: { text: 'NEXT: THE STORES', pos: [14.6, -1.6], to: [18.1, 6.5], at: 5.25 },
    camera: [{ at: 3.25, x: 20.2, y: 7.6 }],
  });
  for (const cue of map.cues) ctx.sfx.at(cue.t, cue.name);
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1982 });
  hud.compass({ at: 0, year: '1982', place: 'THE WAREHOUSE', target: [18.5, 6.5] });
  hud.minimap({ at: 0 });
  hud.narrate('AN OFFICE, A WAREHOUSE:\nTHE GAME IS MADE.', { at: 0.48, until: 3.28 });
  hud.narrate("NEXT STOP: THE STORES.\nTHAT'S WHERE IT GOES WRONG.", { at: 3.92, until: 6.9 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
