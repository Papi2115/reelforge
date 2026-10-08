// Game B1 breakthrough (PLAN.md#13.15 B1 rework), example 2: the INVENTORY / crafting screen. A
// bakery's dough as a recipe: the parts lie in the inventory, flour and water lift into the
// crafting row, a beat of silence, the dough pops in gold.
// Narration: "Flour, water, salt and yeast. Flour and water alone already make a dough."
// Focal: the gold result slot. Traces: slots printing with 2600 flicker, the cursor's uneven
// hops, the parts' arcs into the row, the beat of silence, the result's squash and shake.
export const meta = {
  id: 'gb1-p2',
  title: 'Breakthrough: inventory',
  treatment: 'ui-mockup',
};

const ASSETS = {
  version: 1,
  world: 'game-b1',
  describe: 'A bakery recipe',
  sprites: {
    flour: { describe: 'a sack of flour', rows: ['.####...', '######..', '######..', '######..', '.####...'], colours: ['tan', 'cream', 'cream', 'cream', 'tan'], size: 2, rowH: 3 },
    water: { describe: 'a jug of water', rows: ['..##....', '.####...', '######..', '######..', '.####...'], colours: ['grey', 'blue', 'blue', 'aqua', 'blue'], size: 2, rowH: 3 },
    salt: { describe: 'a salt cellar', rows: ['..#.....', '.###....', '.###....', '.###....'], colours: ['grey', 'white', 'white', 'grey'], size: 2, rowH: 3 },
    yeast: { describe: 'a block of yeast', rows: ['........', '.####...', '#####...', '####....'], colours: ['tan', 'gold', 'gold', 'teak'], size: 2, rowH: 3 },
    dough: { describe: 'a round of dough', rows: ['..###...', '.#####..', '#######.', '#######.'], colours: ['cream', 'cream', 'tan', 'teak'], size: 2, rowH: 3 },
  },
}; // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 77,
  });
  screen.assets(ASSETS);
  const r = screen.inventory({
    intent: 'flour and water alone already make a dough; the salt and yeast wait',
    at: 0,
    until: 6,
    slots: [
      { sprite: 'flour', label: 'FLOUR' },
      { sprite: 'water', label: 'WATER' },
      { sprite: 'salt', label: 'SALT' },
      { sprite: 'yeast', label: 'YEAST' },
    ],
    cursor: [[1.3, 0], [1.75, 1], [2.05, 2], [2.3, 3]],
    craft: { a: 0, b: 1, at: 2.9, result: { sprite: 'dough', label: 'DOUGH' } },
  }); // prettier-ignore
  for (const c of r.cues) ctx.sfx.at(c.t, c.name);
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
