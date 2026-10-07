// Game B1 breakthrough (PLAN.md#13.15 B1 rework), example 3: the SHOP screen. A sailor in port
// with fifty coins: the sail fits the purse, the chart does not.
// Narration: "Fifty coins. The sail cost forty. The chart cost twenty-five, and he could not have both."
// Focal: the wallet rolling down, NOT ENOUGH blinking. Traces: items printing on the shelf, the
// cursor hop before each buy, the sail's arc into the wallet, the keeper's bob.
export const meta = {
  id: 'gb1-p3',
  title: 'Breakthrough: shop',
  treatment: 'ui-mockup',
};

const ASSETS = {
  version: 1,
  world: 'game-b1',
  describe: 'A chandler in port',
  sprites: {
    sail: { describe: 'a rolled sail', rows: ['.#......', '.##.....', '.###....', '.####...', '.#####..', '########'], colours: ['cream', 'cream', 'cream', 'white', 'white', 'teak'], size: 2, rowH: 3 },
    chart: { describe: 'a sea chart', rows: ['#######.', '#..#..#.', '#.##..#.', '#######.'], colours: ['tan', 'blue', 'aqua', 'tan'], size: 2, rowH: 3 },
    rope: { describe: 'a coil of rope', rows: ['.####...', '#....#..', '#.##.#..', '.####...'], colours: 'teak', size: 2, rowH: 3 },
  },
  generated: {
    chandler: { kind: 'person', role: 'sailor', hat: 'cap' },
  },
}; // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 50,
  });
  screen.assets(ASSETS);
  const r = screen.shop({
    intent: 'fifty coins buy the sail or the chart, never both',
    at: 0,
    until: 6.5,
    wallet: { label: 'COINS', amount: 50 },
    items: [
      { sprite: 'rope', label: 'ROPE', price: 8 },
      { sprite: 'sail', label: 'SAIL', price: 40 },
      { sprite: 'chart', label: 'CHART', price: 25 },
    ],
    buys: [{ item: 1, at: 1.8 }, { item: 2, at: 3.6 }],
    keeper: 'chandler',
  }); // prettier-ignore
  for (const c of r.cues) ctx.sfx.at(c.t, c.name);
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
