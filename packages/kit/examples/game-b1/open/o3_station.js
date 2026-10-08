// Game B1 open vocabulary (PLAN.md#13.15), example 3: a SPACE STATION film. The room is not the
// 1982 living room: a kid's bedroom in 1986 (room DSL: shell, calendar with the year, a window on
// the night, a poster printing the film's own station sprite); the camera pushes into the TV.
// Inside: a hand-drawn module, its solar wings as ONE mirrored playfield (the 2600 draws the
// symmetric arrays for free), a docking capsule, a drifting cosmonaut, the Earth's limb.
// Narration: "In 1986 the first module of Mir reached orbit. Two cosmonauts lived aboard for
// months, and every ninety minutes they watched the sun rise over the Earth."
// Focal: the station between its wings; then the gold sunrise line on the limb.
// Traces: the capsule docks in held steps with a bump; the cosmonaut bobs off the beat; stars
// twinkle on their own cadences; the ringed day on the calendar; the bedroom lamp's warm pool.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-o3',
  title: 'Open vocabulary: space station',
  treatment: 'character-scene',
};

/** What would live in assets/game-b1/mir.json. */
const ASSETS = {
  version: 1,
  world: 'game-b1',
  sprites: {
    module: {
      describe: 'the station module, side view, a row of windows',
      rows: ['.######.', '########', '#.#.#.#.', '########', '.######.'],
      colours: ['grey', 'white', 'cream', 'white', 'grey'],
      size: 4,
      rowH: 2,
    },
    capsule: {
      describe: 'the crew capsule with its two small wings',
      rows: ['..##....', '.###.###', '########', '.###.###', '..##....'],
      colours: ['greyDark', 'blue', 'grey', 'blue', 'greyDark'],
      size: 2,
      rowH: 2,
    },
  },
  playfields: {
    wings: {
      describe: 'the solar arrays, mirrored about the module',
      rows: ['..........######....', '..........#.#.#.....', '..........######....', '..........#.#.#.....', '..........######....'],
      rowH: 2,
      colours: ['blue', 'tealDark', 'blue', 'tealDark', 'blue'],
      mode: 'mirror',
    },
    earth: {
      describe: 'the curve of the Earth, mirrored about the centre',
      rows: ['...........#########', '........############', '......##############', '....################', '..##################', '.###################', '####################'],
      rowH: [2, 2, 3, 3, 4, 6, 24],
      colours: ['aqua', 'blue', 'blue', 'blue', 'teal', 'teal', 'tealDark'],
    },
  },
  generated: {
    cosmonaut: { kind: 'person', role: 'astronaut', seed: 3 },

  },
  rooms: {
    bedroom: {
      shell: 'bedroom',
      light: 'night',
      calendar: { month: 'FEB', year: 1986, mark: 20 },
      defaults: false,
      props: [
        { kind: 'window', x: 214, sky: 'night', view: 'stars' },
        { kind: 'poster', x: 270, y: 18, w: 34, h: 30, sprite: 'module', colour: 'night' },
        { kind: 'bed', x: 228, colour: 'teal' },
        { kind: 'lamp', x: 300, type: 'floor' },
      ],
      carts: 2,
    },
  },
}; // prettier-ignore

const PUSH = [1.4, 2.8];
const DOCK = 4.6;
const SUNRISE = 5.3;

function picture(g, t) {
  const { path, hash, shake } = g.util;
  g.bands(0, 160, [
    [0, 'void'],
    [60, 'tube'],
    [118, 'night'],
  ]);
  for (let i = 0; i < 26; i += 1) {
    const on = hash(31, i, Math.floor(t * (0.6 + hash(31, i, 3) * 1.4) + i)) > 0.2;
    if (on) g.rect(Math.floor(hash(31, i, 1) * 158), Math.floor(hash(31, i, 2) * 128), 1, 1, i % 6 === 0 ? 'aqua' : 'cream');
  }
  const bump = shake(t, DOCK, 1.5, 9, 77);
  g.offset(bump.x * 4, bump.y * 2);
  g.field('wings', 62);
  g.draw('module', 64, 62, { flicker: false });
  const cap = path([[0, -24, 64], [3.2, -24, 64], [DOCK, 24, 64]], t, { fps: 5 });
  g.draw('capsule', cap.x, cap.y);
  g.offset(0, 0);
  g.text('MIR', 72, 50, { colour: 'cream', size: 2, type: { at: 3.0, cps: 10 } });
  const bob = Math.round(Math.sin(t * 2.3 + 0.7) * 2);
  g.draw('cosmonaut', 118, 86 + bob, { frame: 0, face: 'left' });
  g.field('earth', 136);
  if (t >= SUNRISE) {
    const k = Math.min(1, (t - SUNRISE) / 0.5);
    g.field('earth', 136, { colour: 'gold', rows: [0, 1] });
    if (k >= 1) g.field('earth', 136, { colour: 'orange', rows: [1, 2] });
  }
  g.text('EVERY NINETY MINUTES', 6, 120, { colour: t >= SUNRISE ? 'gold' : 'grey', type: { at: SUNRISE - 0.9, cps: 20 } });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1986,
  });
  screen.assets(ASSETS);
  screen.interior('bedroom');
  screen.camera([
    { at: PUSH[0], on: 'room' },
    { at: PUSH[1], on: 'tv', ease: 'inOut' },
  ]);
  screen.tv(picture);
  screen.year('1986', { at: 0.4 });
  screen.progress({ from: 0.33, to: 0.5, slots: 6 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
