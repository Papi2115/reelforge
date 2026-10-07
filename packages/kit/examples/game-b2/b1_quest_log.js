// Game B2 look B (rpg-menu), template 1: the quest log (showcase shot 5). The game pauses in the
// warehouse with the cartridge in hand: the menu opens over the dimmed level; DONE chapters get
// their ticks, the chapter NOW types in big, the quest types into its accent box, AHEAD stays
// redacted; on the right the inventory cursor hops between the facts picked up so far.
// Focal: the quest line in its accent box (left), then the selected item's name (right).
// Traces: two-stroke ticks, the hand-ruled rule, a slot a pixel low, irregular typing, the
// developer's note in the corner.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1',
  title: 'RPG menu: the quest log',
  treatment: 'ui-mockup',
};

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: 'warehouse',
    stencil: 'E.T.',
    duration: ctx.shot.duration,
    seed: 1982,
    path: [{ at: 0, x: 9.6, y: 8.7, yaw: -4, ease: 'lin' }],
  });
  view.hold({ label: 'E.T.', band: 'pink' }, { at: -1 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1982 });
  hud.compass({ at: -1, year: '1982', place: 'THE WAREHOUSE' });
  hud.minimap({ at: -1 });
  hud.menu({
    at: 0,
    until: 6.75,
    quest: {
      now: 'CHRISTMAS 1982',
      objective: 'SELL E.T. FOR CHRISTMAS.',
      done: ['1982 · THE DEADLINE', '1982 · THE WAREHOUSE'],
      ahead: 3,
    },
    inventory: {
      items: [
        { icon: 'cartridge', label: 'E.T. CARTRIDGE', sub: 'ATARI 2600 · 1982', itemLabel: 'E.T.', band: 'pink' },
        { icon: 'calendar', label: 'DEADLINE', sub: 'ABOUT FIVE WEEKS', band: 'pink' },
        { icon: 'carton', label: 'WAREHOUSE STOCK', sub: 'BETTING ON A HIT', itemLabel: 'E.T.' },
      ],
      select: [
        { at: 0.55, index: 0 },
        { at: 2.95, index: 1 },
        { at: 4.4, index: 2 },
      ],
    },
    note: 'DEV NOTE: NO PITS\nIN THIS BUILD',
  });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
