// Game B1 open vocabulary (PLAN.md#13.15), example 1: a FOREST film. Built only from the film's
// own vocabulary (no showcase sprite, no cartridge): the scene's asset file defines the ranger,
// the oaks, the deer, the crows, the canopy and a hand-drawn stump.
// Narration: "1990. Four thousand old oaks stood in the valley. Every morning the ranger walked
// the ridge and counted them. By 2010 there were nine hundred left."
// Focal: the ranger stopped at the stumps, the count dropping to 900 (gold).
// Traces: the deer bolts a beat after the ranger stops; oaks fall at uneven times, each with a
// puff of dust; the crows flicker where they cross the canopy (the 2600 cannot draw them all on
// one line); the ranger's clipboard hand; the place typed with an irregular cadence.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-o1',
  title: 'Open vocabulary: forest',
  treatment: 'character-scene',
};

/** What would live in assets/game-b1/forest.json: this film's own things. */
const ASSETS = {
  version: 1,
  world: 'game-b1',
  describe: 'The valley of old oaks, 1990-2010',
  sprites: {
    stump: {
      describe: 'a felled oak, the cut face up',
      rows: ['..####..', '.#.##.#.', '.######.', '########'],
      colours: { 0: 'tan', 1: 'teak', 2: 'walnut' },
      size: 2,
      rowH: 2,
    },
  },
  generated: {
    oak: { kind: 'tree', shape: 'round', height: 26, size: 2, seed: 4 },
    oakB: { kind: 'tree', shape: 'round', height: 24, size: 2, seed: 9 },
    ranger: { kind: 'person', role: 'ranger', tool: 'document' },
    deer: { kind: 'animal', like: 'deer', size: 2 },
    crows: { kind: 'bird', colour: 'tube', copies: 3, gap: 'close' },
    canopy: { kind: 'scenery', type: 'canopy', rows: 6, rowH: 4, seed: 3, colours: ['avocado', 'avocado', 'avocado', 'walnut', 'walnut', 'walnut'] },
    dust: { kind: 'effect', type: 'dust' },
  },
}; // prettier-ignore

/** Oaks along the ridge: x, which drawing, when it falls (uneven; Infinity = still standing). */
const OAKS = [
  [6, 'oakB', 3.62],
  [36, 'oak', Infinity],
  [72, 'oakB', 4.05],
  [104, 'oak', 3.86],
  [134, 'oakB', 4.41],
];
const STOP = 2.2;
const DROP = 4.6;

function picture(g, t) {
  const { path, hash } = g.util;
  g.bands(0, 160, [
    [0, 'night'],
    [26, 'dusk'],
    [44, 'mauve'],
    [54, 'tan'],
    [60, 'oliveDark'],
  ]);
  g.field('canopy', 60);
  for (const [x, id, falls] of OAKS) {
    if (t < falls) g.draw(id, x, 92, { playfield: true });
    else {
      g.draw('stump', x, 140, { playfield: true });
      g.draw('dust', x, 136, { at: falls });
    }
  }
  g.bands(0, 160, [
    [148, 'avocado'],
    [152, 'walnut'],
    [166, 'walnutDark'],
  ]);
  for (let i = 0; i < 14; i += 1)
    g.rect(Math.floor(hash(21, i, 1) * 156), 150 + Math.floor(hash(21, i, 2) * 26), 2, 1, 'oliveDark');
  // the crows cross the sky: three copies of one player, crowding the canopy's lines
  const crow = path([[0.3, -30, 52], [3.4, 170, 40]], t);
  g.draw('crows', crow.x, crow.y);
  // the deer grazes, then bolts a beat after the ranger stops
  const deer = path([[0, 112, 126], [STOP + 0.35, 112, 126], [STOP + 1.1, 176, 118]], t, { ease: 'in' });
  g.draw('deer', deer.x, deer.y, { face: deer.dir < 0 ? 'left' : 'right', frame: deer.moving ? undefined : 0 });
  // the ranger walks the ridge and stops among the felled oaks
  const ranger = path([[0, 2, 120], [STOP, 54, 120], [5.2, 54, 120], [6.2, 62, 120]], t);
  g.draw('ranger', ranger.x, ranger.y, { frame: ranger.moving ? undefined : 0, flicker: false });
  const count = g.counter({
    means: 'old oaks left in the valley',
    keys: [[0, 4000], [DROP, 900]],
    x: 6,
    y: 26,
    colour: t >= DROP ? 'gold' : 'cream',
    cell: [4, 4],
  });
  g.text('OLD OAKS', 6, 38, { colour: count < 1000 ? 'gold' : 'tan' });
  g.text('THE RIDGE', 6, 164, { colour: 'tan', type: { at: 0.45, cps: 16 } });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1990,
  });
  screen.assets(ASSETS);
  screen.tv(picture);
  screen.year('1990', { at: 0.3 });
  screen.year('2010', { at: 3.4 });
  screen.progress({ from: 0, to: 0.17, slots: 6, at: 0.2 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
