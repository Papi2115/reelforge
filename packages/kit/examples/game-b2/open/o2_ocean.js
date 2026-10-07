// Game B2 open vocabulary (PLAN.md#13.15), example 2: an OCEAN film. An underwater level (sky
// preset `underwater`: the surface shimmers above, the murk closes in), a reef canyon of generated
// rock walls, coral drawn as pixel art, swaying seaweed, fish that float and flap. Nothing from
// the showcase. Narration (demo): "Corals are animals, not plants. Each tiny polyp builds its
// own stone cup." The diver drifts along the reef, stops at the coral, takes a shell.
// Focal: the clay branching coral right of centre with a fish crossing it.
// Traces: the slow drift (low bob), seaweed sway out of step, the AIR meter ticking down unevenly.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'go2',
  title: 'Open vocabulary: ocean',
  treatment: 'character-scene',
};

const ASSETS = {
  sprites: {
    kelp: { gen: 'plant', kind: 'seaweed', seed: 3, height: 1.3 },
    'kelp-tall': { gen: 'plant', kind: 'seaweed', seed: 8, height: 1.9 },
    'fish-orange': {
      gen: 'creature',
      kind: 'fish',
      form: 'slim',
      coat: 'rust',
      belly: 'bulb',
      seed: 2,
      size: 0.62,
    },
    'fish-blue': {
      gen: 'creature',
      kind: 'fish',
      form: 'round',
      coat: 'sky',
      pattern: 'stripes',
      seed: 5,
      size: 0.66,
      facing: 'left',
    },
    eel: { gen: 'creature', kind: 'fish', form: 'eel', coat: 'leaf', seed: 4, size: 0.9, z: 0.15 },
    turtle: {
      gen: 'creature',
      kind: 'reptile',
      form: 'turtle',
      coat: 'leaf',
      seed: 6,
      size: 0.8,
      z: 0.7,
      fps: 2,
    },
    boulder: { gen: 'object', kind: 'rock', seed: 4, ramp: 'sky' },
    wreck: { gen: 'vehicle', kind: 'rowboat', seed: 2, size: 1.6, facing: 'left' },
    coral: {
      rows: [
        '..r.....r.....r.',
        '..r..r..r..r..r.',
        '.rR..r.rR..R.rR.',
        '..R.rR..R.rR..R.',
        '..RrR...RrR..rR.',
        '...R...RR.....R.',
        '...RR.RR....RR..',
        '....RRR....RR...',
        '.....RR..RRR....',
        '......RRRR......',
        '.......RR.......',
        '......DDDD......',
      ],
      legend: { r: 'bulb', R: 'tungsten', D: 'clay' },
      size: [0.7, 0.55],
    },
    brain: {
      rows: [
        '....gggggg....',
        '..gGgGGgGgGg..',
        '.gGggGgGGgGgg.',
        'gGgGGgGggGGgGg',
        'gggGgGGgGgggGg',
        '.dgggdggdggdd.',
        '..dddddddddd..',
      ],
      legend: { g: 'leaf.3', G: 'leaf.4', d: 'leaf.1' },
      size: [0.5, 0.25],
    },
  },
  textures: {
    seabed: { gen: 'texture', kind: 'sand', seed: 4 },
    reef: { gen: 'texture', kind: 'rock', seed: 7, ramp: 'earth', wear: 0.6 },
  },
  icons: {
    conch: { gen: 'icon', kind: 'shell' },
  },
};

const REEF = {
  name: 'coral-reef',
  sky: { preset: 'underwater', skyline: 'none', ground: 'seabed' },
  floor: 'seabed',
  grid: [
    '......................',
    '......................',
    '.......RR.............',
    '......................',
    '......................',
    '......................',
    '......................',
    '................RR....',
    '......................',
    '......................',
  ],
  legend: { R: { wall: 'reef', height: 0.7 } },
  sprites: [
    { sprite: 'boulder', pos: [6.5, 1.6], scale: 4 },
    { sprite: 'boulder', pos: [12.5, 1.4], scale: 4, flip: true },
    { sprite: 'boulder', pos: [20.2, 2.0], scale: 3.5 },
    { sprite: 'boulder', pos: [9.6, 8.4], scale: 4, flip: true },
    { sprite: 'boulder', pos: [15.4, 8.6], scale: 3 },
    { sprite: 'kelp', pos: [5.2, 3.4] },
    { sprite: 'kelp-tall', pos: [9.3, 3.6] },
    { sprite: 'kelp', pos: [12.4, 6.6], flip: true },
    { sprite: 'kelp-tall', pos: [17.6, 3.4] },
    { sprite: 'kelp', pos: [19.4, 6.4] },
    { sprite: 'kelp', pos: [7.6, 6.7], flip: true },
    { sprite: 'kelp-tall', pos: [3.4, 6.5] },
    { id: 'coral', sprite: 'coral', pos: [11.6, 4.3] },
    { sprite: 'coral', pos: [15.2, 6.4], scale: 0.7, flip: true },
    { sprite: 'brain', pos: [10.4, 5.6] },
    { sprite: 'brain', pos: [14.4, 3.5], scale: 1.3 },
    { sprite: 'boulder', pos: [13.3, 3.3] },
    { sprite: 'boulder', pos: [8.6, 6.6], scale: 0.7 },
    { sprite: 'wreck', pos: [18.2, 5.3] },
    { sprite: 'fish-orange', pos: [11.2, 4.6], z: 0.55 },
    { sprite: 'fish-orange', pos: [12.6, 4.1], z: 0.85, flip: true },
    { sprite: 'fish-orange', pos: [16.5, 4.9], z: 0.6 },
    { sprite: 'fish-blue', pos: [13.0, 3.9], z: 0.45 },
    { sprite: 'fish-blue', pos: [15.6, 5.5], z: 1.0 },
    { sprite: 'eel', pos: [14.8, 6.7] },
    { sprite: 'turtle', pos: [14.1, 4.8] },
  ],
};

const DRIFT = [
  [0.0, 2.6, 4.9, 0, 4, 0.62, 'lin'],
  [0.5, 3.2, 4.85, 2, 4, 0.62, 'in'],
  [4.2, 8.7, 4.7, 8, 2, 0.6, 'out'],
  [5.0, 8.8, 4.7, 4, 8, 0.56, 'inOut'],
  [8.0, 9.0, 4.72, 2, 8, 0.56, 'sine'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: REEF,
    assets: ASSETS,
    duration: ctx.shot.duration,
    seed: 77,
    bob: 0.35,
    path: DRIFT.map(([at, x, y, yaw, pitch, eye, ease]) => ({ at, x, y, yaw, pitch, eye, ease })),
  });
  view.take({ icon: 'conch' }, { at: 5.4, from: [10.1, 5.2, 0.1] });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 77 });
  hud.compass({ place: 'CORAL REEF', target: [11.6, 4.3] });
  hud.minimap();
  hud.meter({
    label: 'AIR',
    keys: [
      [0, 9],
      [2.6, 8],
      [5.9, 7],
    ],
  });
  hud.narrate('CORALS ARE ANIMALS,\nNOT PLANTS.', { at: 0.5, until: 3.4 });
  hud.narrate('EACH TINY POLYP BUILDS\nITS OWN STONE CUP.', { at: 3.6, until: 7.4 });
  hud.inventory({ items: [{ icon: 'conch', label: 'SHELL', at: 6.3 }], at: 6.1 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
