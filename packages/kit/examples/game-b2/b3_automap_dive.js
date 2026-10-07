// Game B2 look B (rpg-menu), breakthrough: a dive into the map in the middle of a walk (a
// different mechanism from b2: no replay, no story so far). We walk the warehouse aisle; at the
// line about the stock the minimap UNFOLDS into the full map (same arrow, same heading: the
// continuity), it shows the racks either side and the one door out at the far end, crosses the
// door we came in by, then folds back into the minimap and the walk goes on towards that door.
// Focal: the arrow on the painted line + the diamond on the far door (the way the stock leaves).
// Traces: the racks drawn on in pencil order (interior lines after the shell), the cross drawn in
// two strokes, the arrow blinking while the walk holds, uneven strides in the footprints.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb3',
  title: 'RPG menu: a dive into the map mid-walk',
  treatment: 'map',
};

const WALK = [
  [0.0, 2.2, 8.6, 0, 'lin'],
  [1.6, 6.4, 8.62, 0, 'out'],
  [5.9, 6.5, 8.6, 0, 'lin'],
  [7.6, 11.6, 8.66, -2, 'inOut'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: 'warehouse',
    stencil: 'E.T.',
    duration: ctx.shot.duration,
    seed: 1983,
    path: WALK.map(([at, x, y, yaw, ease]) => ({ at, x, y, yaw, ease })),
  });
  view.hold({ label: 'E.T.', band: 'pink' }, { at: -1 });
  const map = view.automap({
    intent: 'every rack in the warehouse leads to one door: the stock can only go out that way',
    at: 1.75,
    until: 6.0,
    scale: 13,
    rooms: [{ cell: [10, 3], label: 'THE WAREHOUSE', sub: '1982', labelAt: [2.2, -1.6] }],
    marks: [
      { kind: 'cross', pos: [1.5, 8.5], at: 3.0 },
      { kind: 'objective', pos: [19.5, 8.5], at: 3.6 },
    ],
    legend: false,
  });
  for (const cue of map.cues) ctx.sfx.at(cue.t, cue.name);
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1983 });
  hud.compass({ at: 0, year: '1982', place: 'THE WAREHOUSE', target: [19.5, 8.5] });
  hud.minimap({ at: 0 });
  hud.narrate('ATARI BETS ON A HIT\nAND FILLS THE WAREHOUSE.', { at: 0.3, until: 3.3 });
  hud.narrate('ALL OF IT HAS TO\nGO OUT THROUGH ONE DOOR.', { at: 3.5, until: 6.4 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
