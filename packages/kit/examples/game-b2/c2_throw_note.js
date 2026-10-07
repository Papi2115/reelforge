// Game B2 look C (rpg-boss), the throw with another item (not the cartridge): the Christmas
// deadline lands on the programmer's desk. We stand in the 1982 office with a note that says
// XMAS!; the narrator says Atari wants E.T. on the shelves for Christmas; we toss the note onto
// the desk across the room (it flutters, lands, the desk jolts), the HUD shakes once, RUSHED pops
// under the compass and the quest toast types in.
// Focal: the note in the air, then the desk with the worker (upper right).
// Traces: the dip before the swing, the flutter frames, the desk's jolt with decay, the worker's
// uneven typing, irregular typing in the box.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gc2',
  title: 'RPG boss: the deadline thrown onto the desk',
  treatment: 'character-scene',
};

const WALK = [
  [0.0, 18.4, 8.6, -70, 'lin'],
  [1.4, 18.4, 6.9, -64, 'out'],
  [7.0, 18.5, 6.8, -60, 'sine'],
];

const NOTE = { kind: 'note', label: 'XMAS!', band: 'clay' };

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: 'office',
    duration: ctx.shot.duration,
    seed: 1982,
    path: WALK.map(([at, x, y, yaw, ease]) => ({ at, x, y, yaw, ease })),
  });
  view.hold(NOTE, { at: -1 });
  const toss = view.throw(NOTE, {
    intent: "the Christmas deadline lands on the programmer's desk: five weeks start now",
    at: 3.9,
    target: 'worker',
    arc: 0.35,
  });
  for (const cue of toss.cues) ctx.sfx.at(cue.t, cue.name);
  view.shake({ at: toss.land, amp: 1.2 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1982 });
  hud.compass({ at: 0, year: '1982', place: 'THE OFFICE', target: [20.6, 2.3] });
  hud.minimap({ at: 0 });
  hud.narrate('1982. ATARI WANTS E.T.\nON SHELVES FOR CHRISTMAS.', { at: 0.6, until: 3.6 });
  hud.shake({ at: toss.land, amp: 2 });
  hud.status({ label: 'RUSHED', icon: 'hourglass', at: toss.land + 0.1 });
  hud.toast({ head: 'NEW QUEST', body: 'SHELVES BY CHRISTMAS', at: toss.land + 0.45 });
  hud.narrate('THE PROGRAMMER GETS\nABOUT FIVE WEEKS.', { at: 5.0, until: 6.9 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
