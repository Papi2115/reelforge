// Game B2 look A (rpg-explore), template 1: the hook (showcase game-hud-b2-rpg-v2 shot 1).
// Darkness, one bulb clicks on in a damp corridor. A glance at the chalk tally on the wall, a look
// down at desert sand on the floor (a cartridge corner in it), then on to the door.
// Focal: the sand drift with the pink cartridge corner, lower right, under the bulb.
// Traces: the bulb stutters on (two uneven blinks) and sways, uneven strides, the chalk tally
// (four strokes and the gate), the narration typed at an irregular cadence; a held look-down.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'ga1',
  title: 'RPG explore: the corridor hook',
  treatment: 'metaphor-object',
};

/** The walk: [at, x, y, yaw, pitch, eye, ease into this key], in cells of the 'office' level. */
const WALK = [
  [0.0, 5.0, 6.32, 9, 0, 0.5, 'lin'],
  [1.0, 5.0, 6.32, 9, 0, 0.5, 'lin'],
  [2.6, 7.3, 6.45, 3, 0, 0.5, 'in'],
  [3.35, 8.25, 6.5, -27, 0, 0.5, 'lin'],
  [4.0, 8.95, 6.5, -15, 0, 0.5, 'lin'],
  [4.6, 9.55, 6.5, 2, 0, 0.5, 'out'],
  [5.1, 9.65, 6.5, 2, 22, 0.49, 'inOut'],
  [5.8, 9.65, 6.5, 2, 22, 0.49, 'lin'],
  [6.35, 9.8, 6.5, 0, 0, 0.5, 'inOut'],
  [7.5, 13.5, 6.5, 0, 0, 0.5, 'in'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: 'office',
    stencil: 'E.T.',
    duration: ctx.shot.duration,
    seed: 1983,
    path: WALK.map(([at, x, y, yaw, pitch, eye, ease]) => ({ at, x, y, yaw, pitch, eye, ease })),
  });
  // The bulb is off until a beat of darkness has passed; the door ahead opens as we near it.
  view.switchOn('bulb', { at: 0.42 });
  view.open([13, 6], { at: 5.9, dur: 0.7 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1983 });
  hud.compass({ at: 0.25, year: '1983', target: [13.5, 6.5] });
  hud.minimap({ at: 0.45 });
  hud.progress({ at: 0.6, from: 0, to: 0.09, chapters: [0.2, 0.47, 0.71] });
  hud.narrate('1983. ATARI BURIED ITS\nUNSOLD GAMES IN THE DESERT.', { at: 1.2, until: 4.4 });
  hud.toast({ head: 'NEW QUEST', body: 'HOW THEY GOT THERE', at: 2.9, until: 5.6 });
  hud.narrate('THIS IS HOW\nTHEY GOT THERE.', { at: 5.85, until: 7.4 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
