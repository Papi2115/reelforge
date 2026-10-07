// Game B1 open vocabulary (PLAN.md#13.15), example 2: an OCEAN film, inside the TV only.
// Built only from the film's own vocabulary: a hand-drawn rowing boat (sprite DSL, two oar
// frames), schools of fish (one player copied three times, NUSIZ), kelp, a reef playfield.
// Narration: "The reef off Cape Rocha fed the whole village. Each dawn the boats rowed out and the
// fish came up to meet the nets. In 1998 the water warmed, and the reef turned white."
// Focal: the reef turning white line by line under the lone boat.
// Traces: the oars dip on their own cadence; the two schools never swim in step (phase); the
// net line drops in uneven jerks; the white climbs the reef row by row at uneven gaps; the kelp
// greys a beat after the reef; the place typed irregularly.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-o2',
  title: 'Open vocabulary: ocean',
  treatment: 'metaphor-object',
};

/** What would live in assets/b1/reef.json. */
const ASSETS = {
  version: 1,
  world: 'game-b1',
  sprites: {
    rowboat: {
      describe: 'a fisherman rowing a small boat',
      frames: [
        ['...#....', '..###...', '#..#..#.', '########', '.######.'],
        ['...#....', '..###...', '.#.#.#..', '########', '.######.'],
      ],
      colours: ['tan', 'blue', 'walnut', 'teak', 'walnut'],
      fps: 2.5,
      size: 2,
      rowH: 3,
    },
  },
  generated: {
    school: { kind: 'fish', colour: 'gold', stripe: 'orange', copies: 3, gap: 'close', rowH: 2, seed: 2 },
    schoolB: { kind: 'fish', colour: 'aqua', stripe: 'teal', copies: 2, gap: 'medium', rowH: 2, seed: 5 },
    kelp: { kind: 'seaweed', height: 14, size: 2, seed: 3 },
    kelpB: { kind: 'seaweed', height: 10, size: 2, seed: 8 },
    waves: { kind: 'scenery', type: 'waves', rows: 2, rowH: 3, seed: 4 },
    reef: { kind: 'scenery', type: 'reef', rows: 6, rowH: 4, seed: 7, colours: ['orange', 'mauve', 'rust', 'dusk'] },
  },
}; // prettier-ignore

const KELP = [
  [14, 'kelp', 0],
  [42, 'kelpB', 1],
  [118, 'kelp', 2],
  [144, 'kelpB', 0],
];
const BLEACH = 3.9;
/** Reef rows turn white bottom-up at uneven gaps. */
const ROW_TIMES = [0, 0.18, 0.31, 0.55, 0.68, 0.94];

function picture(g, t) {
  const { path, seg } = g.util;
  g.bands(0, 160, [
    [0, 'dusk'],
    [16, 'mauve'],
    [30, 'orange'],
    [38, 'blue'],
    [70, 'tealDark'],
    [120, 'night'],
  ]);
  const boat = path([[0, 22, 26], [3.2, 52, 26]], t, { fps: 6 });
  g.draw('rowboat', boat.x, boat.y, { frame: boat.moving ? undefined : 0, flicker: false });
  g.field('waves', 38);
  // the net line drops in uneven jerks from the stern
  const drop = Math.floor(seg(t, 1.0, 3.0) * 7) * 9 + (t > 2.1 ? 4 : 0);
  if (t > 1.0) g.missile(boat.x + 14, 41, { w: 1, h: drop, colour: 'cream' });
  // the schools rise toward the net, then scatter when the water warms
  const a = path([[0, -24, 104], [BLEACH, 70, 76], [BLEACH + 1.4, 180, 60]], t);
  const b = path([[0, 170, 92], [BLEACH, 96, 70], [BLEACH + 1.2, -40, 52]], t);
  g.draw('school', a.x, a.y, { phase: 0 });
  g.draw('schoolB', b.x, b.y, { face: 'left', phase: 1 });
  const grey = t > BLEACH + 0.7;
  for (const [x, id, phase] of KELP)
    g.draw(id, x, 150 - (id === 'kelp' ? 28 : 20), { phase, playfield: true, ...(grey ? { colour: 'grey' } : {}) });
  g.field('reef', 150);
  const k = seg(t, BLEACH, BLEACH + 1.1);
  const white = ROW_TIMES.filter((r) => k > r).length;
  if (white > 0) g.field('reef', 150, { colour: 'cream', rows: [6 - white, 6] });
  g.bands(0, 160, [[174, 'tan']]);
  g.text('CAPE ROCHA', 6, 54, { colour: 'cream', size: 2, type: { at: 0.4, cps: 15 } });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1998,
  });
  screen.assets(ASSETS);
  screen.tv(picture);
  screen.year('1998', { at: BLEACH - 0.2 });
  screen.progress({ from: 0.17, to: 0.33, slots: 6 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
