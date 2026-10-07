// Game B1 gameplay (PLAN.md#13.15 B1 rework), example 1: a LEVEL played in the TV. A miner's
// shift as a scrolling level: the miner runs the tunnel, jumps a shaft, takes a hit from an ore
// cart he does not clear, stomps a rat, collects two lamps and reaches the lift.
// Narration: "Every shift the miner walked two miles of tunnel. A shaft, a runaway cart, the rats.
// Two lamps lit the way to the lift."
// Focal: the miner in the tunnel; the lift blinking gold at the end.
// Traces: held-step running, the hit-stop and blink after the cart, the squash on landing, the
// cart's patrol a beat out of step with the run, labels typed at an irregular cadence.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-p1',
  title: 'Gameplay: a level',
  treatment: 'character-scene',
};

const ASSETS = {
  version: 1,
  world: 'game-b1',
  describe: "A miner's shift in the tunnel",
  sprites: {
    lift: {
      describe: 'the cage lift at the end of the tunnel',
      rows: ['########', '#..##..#', '#..##..#', '#......#', '#......#', '########'],
      colours: { 0: 'grey', 1: 'tan', 3: 'grey', 5: 'greyDark' },
      size: 2,
      rowH: 3,
    },
    rat: {
      describe: 'a tunnel rat',
      frames: [['......#.', '.#####..', '######..', '#.#..#..'], ['......#.', '.#####..', '######..', '.#..#...']],
      colours: { 0: 'grey', 1: 'greyDark', 3: 'grey' },
      fps: 6,
      size: 2,
      rowH: 2,
    },
  },
  generated: {
    miner: { kind: 'person', role: 'miner', hat: 'helmet', tool: 'pick', size: 2 },
    oreCart: { kind: 'vehicle', type: 'cart', size: 2 },
    lamp: { kind: 'item', type: 'potion', size: 2 },
    rock: { kind: 'rock', width: 6, seed: 3, size: 2 },
  },
}; // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1911,
  });
  screen.assets(ASSETS);
  const r = screen.level({
    intent: "the shift is a run: the shaft, the cart and the rats stand between the miner and the lift",
    at: 0,
    width: 320,
    sky: [[0, 'walnutDark'], [30, 'walnut'], [44, 'teak'], [48, 'walnut']],
    ground: { y: 150, colour: 'walnut', edge: 'tan', pits: [[96, 116]] },
    platforms: [{ x: 168, y: 120, w: 40, colour: 'teak' }],
    hero: {
      sprite: 'miner',
      run: [[0, 8], [1.4, 80], [2.4, 150], [3.4, 196], [5.2, 290]],
      jumps: [{ at: 1.3, dur: 0.6, height: 24 }, { at: 2.45, dur: 0.5, height: 22, onto: 0 }, { at: 3.3, dur: 0.55, height: 18 }],
    },
    things: [
      { sprite: 'rock', x: 40, role: 'scenery' },
      { sprite: 'lamp', x: 60, y: 118, role: 'item', label: 'LAMP' },
      { sprite: 'oreCart', x: 120, role: 'obstacle', label: 'CART', labelAt: 1.6 },
      { sprite: 'lamp', x: 184, y: 96, role: 'item' },
      { sprite: 'rat', x: 220, role: 'enemy', patrol: { to: 250, period: 1.6 } },
      { sprite: 'lift', x: 290, role: 'goal', label: 'THE LIFT', labelAt: 4.4 },
    ],
  }); // prettier-ignore
  for (const c of r.cues) ctx.sfx.at(c.t, c.name);
  screen.year('1911', { at: -1 });
  screen.progress({ from: 0.2, to: 0.3, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
