// Game B1 open vocabulary (PLAN.md#13.15), example 4: a MEDIEVAL VILLAGE film, look C (boss).
// Built only from the film's own vocabulary: a storm-cloud boss made from traits (body, eyes,
// mouth, arms), the castle and huts from the building generator, a farmer, a hand-drawn wheat
// playfield that rots row by row, a cart, rain as 2600 missiles.
// Narration: "A medieval village lived by its harvest. One summer the rain did not stop for six
// weeks. The wheat rotted in the fields, and the castle took what was left."
// Focal: the storm boss over the field; then the cart rolling to the castle.
// Traces: the boss's lightning on its own slow cadence; the HP (weeks) drops at uneven times;
// the wheat rots from the top row down; the farmer's input-lag crouch before he turns away; the
// cart's wheels stepping; rain streaks never in step.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-o4',
  title: 'Open vocabulary: medieval village',
  treatment: 'character-scene',
};

/** What would live in assets/game-b1/village.json. */
const ASSETS = {
  version: 1,
  world: 'game-b1',
  playfields: {
    wheat: {
      describe: 'the wheat field, stalks and ears',
      rows: ['.#.#..#.#..#.#..#.#.', '##.##.##.##.##.##.##', '###.####.###.####.##', '#.#.#.#.#.#.#.#.#.#.', '#.#.#.#.#.#.#.#.#.#.'],
      rowH: [3, 4, 4, 5, 5],
      colours: ['gold', 'gold', 'tan', 'avocado', 'oliveDark'],
      mode: 'repeat',
    },
  },
  generated: {
    rain: { kind: 'boss', body: 'cloud', eyes: 2, mouth: 'grin', arms: true, colour: 'grey', accent: 'night', rowH: 3, seed: 6 },
    castle: { kind: 'building', type: 'castle', seed: 2, rowH: 2 },
    hut: { kind: 'building', type: 'hut', size: 4, seed: 3 },
    hutB: { kind: 'building', type: 'house', seed: 8, colours: { s: 'teak', m: 'tan' } },
    farmer: { kind: 'person', role: 'farmer', seed: 4 },
    cart: { kind: 'vehicle', type: 'cart', size: 2, rowH: 3, seed: 1, colours: { m: 'tan', s: 'teak' } },
    hill: { kind: 'scenery', type: 'hills', rows: 4, rowH: 4, seed: 12, colours: ['oliveDark', 'oliveDark'] },
  },
}; // prettier-ignore

const ROT = [3.1, 3.9, 4.4, 5.0];
const CART = 5.6;

function picture(g, t) {
  const { path, hash } = g.util;
  g.bands(0, 160, [
    [0, 'tube'],
    [30, 'night'],
    [62, 'dusk'],
  ]);
  g.field('hill', 74);
  g.draw('castle', 112, 66, { playfield: true });
  g.draw('hut', 4, 76, { playfield: true });
  g.draw('hutB', 40, 74, { playfield: true });
  g.bands(0, 160, [
    [90, 'oliveDark'],
    [150, 'walnut'],
  ]);
  // the wheat rots from the ears down, one colour register at a time
  g.field('wheat', 112);
  const rotted = ROT.filter((r) => t >= r).length;
  if (rotted > 0) g.field('wheat', 112, { colour: 'walnut', rows: [0, rotted] });
  // rain: missiles, each streak on its own phase
  for (let i = 0; i < 18; i += 1) {
    const speed = 70 + hash(5, i, 1) * 30;
    const y = (hash(5, i, 2) * 150 + t * speed) % 150 + 24;
    g.missile(Math.floor(hash(5, i, 3) * 156), Math.floor(y), { w: 1, h: 3, colour: 'aqua' });
  }
  g.draw('rain', 18, 6, { phase: 1 });
  const crouch = t >= 4.45 && t < 4.6 ? 0.85 : 1;
  g.draw('farmer', 70, 84, { frame: 0, squash: crouch, face: t < 4.6 ? 'right' : 'left', flicker: false });
  const cart = path([[0, -20, 138], [CART, -20, 138], [CART + 2.2, 104, 138]], t, { fps: 8 });
  g.draw('cart', cart.x, cart.y, { frame: 0 });
  g.text('THE HARVEST', 6, 160, { colour: rotted > 2 ? 'teak' : 'gold', type: { at: 0.5, cps: 14 } });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 6,
  });
  screen.assets(ASSETS);
  screen.tv(picture);
  // The boss is the rain; its bar is the six weeks it lasts.
  screen.boss({
    num: 1,
    name: 'THE RAIN',
    from: 'right',
    x: 380,
    y: 56,
    at: 1.0,
    seed: 61,
    hp: {
      n: 6,
      label: 'WEEKS',
      keys: [
        [2.2, 5],
        [2.9, 4],
        [3.8, 3],
        [4.3, 2],
        [5.1, 1],
        [5.5, 0],
      ],
    },
  });
  screen.progress({ from: 0.5, to: 0.67, slots: 6 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
