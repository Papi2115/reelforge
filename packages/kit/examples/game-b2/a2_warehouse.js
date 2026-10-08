// Game B2 look A (rpg-explore), template 2: the warehouse (showcase game-hud-b2-rpg-v2 shot 3).
// A checkpoint: walk in along the painted line between racks stencilled with the game's name;
// stop, turn to the shelf, reach and take one cartridge (it drops into the inventory); walk on
// into the fog holding it.
// Focal: the hand closing on the cartridge (pink band = THE item), then the cartridge held.
// Traces: the faulty tube flickers on its own cadence, a carton missing from the rack, the reach
// overshoots on the way back, a held beat at the shelf, uneven strides.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'ga2',
  title: 'RPG explore: the warehouse',
  treatment: 'character-scene',
};

const WALK = [
  [0.0, 2.5, 8.6, 2, 0, 'lin'],
  [1.4, 3.8, 8.68, 3, 0, 'in'],
  [2.5, 6.9, 8.76, 2, 0, 'out'],
  [3.15, 7.0, 8.76, -80, 5, 'inOut'],
  [4.5, 7.0, 8.76, -82, 9, 'sine'],
  [5.4, 7.0, 8.76, -82, 9, 'lin'],
  [5.95, 7.1, 8.72, -4, 0, 'inOut'],
  [7.45, 14.4, 8.74, -3, 0, 'inOut'],
  [8.0, 15.1, 8.74, -5, 0, 'out'],
];

const CARTRIDGE = { kind: 'cartridge', label: 'E.T.', band: 'pink' };

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: 'warehouse',
    stencil: 'E.T.',
    duration: ctx.shot.duration,
    seed: 1982,
    path: WALK.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  // Reach for the rack's front face, close on one cartridge, swing back and keep holding it.
  view.take(CARTRIDGE, { at: 3.25, from: [7.25, 7.02, 0.45] });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1982 });
  hud.compass({ at: 0, year: '1982', place: 'THE WAREHOUSE', target: [18.5, 8.5] });
  hud.minimap({ at: 0 });
  hud.status({ label: 'RUSHED', icon: 'hourglass', at: 0 });
  // A new chapter starts here: its flag pops on the film-progress strip.
  hud.progress({ at: 0, from: 0.2, to: 0.29, chapters: [0.2, 0.47, 0.71] });
  hud.checkpoint({ label: 'CHECKPOINT', at: 0.4 });
  hud.narrate('ATARI BETS ON A HIT\nAND FILLS THE WAREHOUSE.', { at: 1.9, until: 6.9 });
  // What we carry so far; the cartridge drops in the moment the hand closes on it.
  hud.inventory({
    at: 0.9,
    items: [
      { icon: 'calendar', label: 'DEADLINE: ~5 WEEKS', at: -3 },
      { icon: 'cartridge', label: '+ E.T. CARTRIDGE', at: 4.35, band: 'pink' },
    ],
  });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
