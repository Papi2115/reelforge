// Game B2 open vocabulary (PLAN.md#13.15), example 1: a FOREST film. Nothing here comes from the
// showcase: every sprite, texture and icon is the film's own, defined below through the open layer
// (generators + pixel art) and used in an OUTDOOR level (sky, tree-line skyline, open border).
// Narration (demo): "Under every tree, fungi link the roots. Pick one up: that thread is the
// network." The walk follows a trail, stops at the fallen log, the hand takes the mushroom.
// Focal: the clay mushroom cluster on the log (left of centre), then the mushroom in the hand.
// Traces: uneven strides, the ferns sway, a jay flaps past, the reach overshoots, the deer looks up.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'go1',
  title: 'Open vocabulary: forest',
  treatment: 'character-scene',
};

/** The film's own assets (the same object could live in assets/b2/forest.json). */
const ASSETS = {
  version: 1,
  world: 'game-b2',
  sprites: {
    oak: { gen: 'plant', kind: 'deciduous', seed: 3, height: 2.6 },
    'oak-old': { gen: 'plant', kind: 'deciduous', seed: 11, height: 3.1, width: 1.2, lean: -0.3 },
    birch: { gen: 'plant', kind: 'deciduous', seed: 7, height: 2.4, width: 0.7, trunk: 'stone' },
    pine: { gen: 'plant', kind: 'conifer', seed: 5, height: 3.2 },
    'pine-young': { gen: 'plant', kind: 'conifer', seed: 9, height: 1.7 },
    bush: { gen: 'plant', kind: 'bush', seed: 4, bloom: 'clay' },
    shrooms: { gen: 'plant', kind: 'mushrooms', seed: 2, height: 0.22, bloom: 'clay' },
    'fallen-log': { gen: 'object', kind: 'log', seed: 3, size: 0.32 },
    deer: {
      gen: 'creature',
      kind: 'quadruped',
      form: 'grazer',
      horns: 'antlers',
      seed: 6,
      size: 1.1,
      fps: 0,
    },
    jay: {
      gen: 'creature',
      kind: 'bird',
      form: 'fly',
      coat: 'sky',
      belly: 'paper',
      seed: 8,
      z: 1.7,
    },
    fern: {
      frames: [
        [
          '.....g......',
          '..g..g..g...',
          '...g.g.g....',
          'g...ggg...g.',
          '.g..gGg..g..',
          '..g.GgG.g...',
          '...gGgGg....',
          '....GdG.....',
          '.....d......',
        ],
        [
          '......g.....',
          '..g...g..g..',
          '...g..g.g...',
          '.g...ggg...g',
          '..g..gGg..g.',
          '...g.GgG.g..',
          '...gGgGg....',
          '....GdG.....',
          '.....d......',
        ],
      ],
      legend: { g: 'leaf.3', G: 'leaf.2', d: 'leaf.1' },
      size: [0.5, 0.36],
      fps: 2,
    },
  },
  textures: {
    moss: { gen: 'texture', kind: 'grass', seed: 2 },
    trail: { gen: 'texture', kind: 'mud', seed: 5, ramp: 'earth' },
    brook: { gen: 'texture', kind: 'water', seed: 3, ramp: 'leaf' },
    thicket: { gen: 'texture', kind: 'foliage', seed: 6 },
  },
  icons: {
    mushroom: {
      rows: [
        '............',
        '...RRRRRR...',
        '..RRwRRRRR..',
        '.RRRRRRwRRR.',
        '.RRwRRRRRRR.',
        '..rrrrrrrr..',
        '.....pp.....',
        '.....pp.....',
        '....pppp....',
        '............',
      ],
      legend: { R: 'clay', w: 'paper', r: 'rust.1', p: 'putty' },
    },
  },
};

const FOREST = {
  name: 'old-growth',
  sky: {
    preset: 'day',
    skyline: 'trees',
    skylineHeight: 0.12,
    clouds: 0.3,
    sun: { az: -30, el: 30 },
    ground: 'moss',
  },
  density: 0.035,
  floor: 'moss',
  grid: [
    '..........................',
    '..........................',
    '...TTT............TTTT....',
    '..TTTT.............TT.....',
    '..........................',
    '..........................',
    '..............ww..........',
    '...,,,,,,,,,,,,ww,,,,,,...',
    '...,,,,,,,,,,,,,ww,,,,,...',
    '...............ww.........',
    '..............ww..........',
    '..........................',
    '...TT...............TTT...',
    '..TTTT.............TTTT...',
    '..........................',
    '..........................',
  ],
  legend: {
    T: { wall: 'thicket', height: 1.6 },
    ',': { floor: 'trail' },
    w: { floor: 'brook' },
  },
  lights: [],
  sprites: [
    { sprite: 'oak-old', pos: [6.5, 5.2] },
    { sprite: 'pine', pos: [9.4, 4.6] },
    { sprite: 'birch', pos: [11.6, 5.4] },
    { sprite: 'oak', pos: [14.5, 4.2] },
    { sprite: 'pine', pos: [17.2, 5.1], flip: true },
    { sprite: 'pine-young', pos: [19.5, 6.0] },
    { sprite: 'oak', pos: [21.8, 4.6], flip: true },
    { sprite: 'pine', pos: [23.5, 6.8] },
    { sprite: 'birch', pos: [7.6, 10.8], flip: true },
    { sprite: 'oak-old', pos: [10.6, 11.8], flip: true },
    { sprite: 'pine', pos: [13.6, 11.2] },
    { sprite: 'pine-young', pos: [17.8, 10.4] },
    { sprite: 'oak', pos: [20.4, 11.6] },
    { sprite: 'birch', pos: [23.2, 10.2] },
    { sprite: 'pine', pos: [4.6, 11.4] },
    { sprite: 'pine-young', pos: [1.6, 6.2] },
    { sprite: 'oak', pos: [24.6, 2.4] },
    { sprite: 'pine', pos: [12.4, 1.6] },
    { sprite: 'pine', pos: [16.2, 14.2] },
    { sprite: 'oak-old', pos: [8.4, 14.6] },
    { sprite: 'bush', pos: [9.2, 6.6] },
    { sprite: 'bush', pos: [19.6, 9.4], scale: 1.3 },
    { sprite: 'fern', pos: [8.3, 9.4] },
    { sprite: 'fern', pos: [10.2, 9.8], flip: true },
    { sprite: 'fern', pos: [14.1, 6.6] },
    { sprite: 'fern', pos: [18.6, 8.8], flip: true },
    { sprite: 'fern', pos: [6.4, 6.4] },
    { sprite: 'fallen-log', pos: [12.6, 8.7] },
    { id: 'shrooms', sprite: 'shrooms', pos: [12.35, 8.6], z: 0.26 },
    { sprite: 'shrooms', pos: [15.4, 9.6], scale: 0.8 },
    { id: 'deer', sprite: 'deer', pos: [20.5, 7.3], flip: true },
    { sprite: 'jay', pos: [16.5, 3.5] },
  ],
};

const WALK = [
  [0.0, 3.6, 7.6, 0, 0, 'lin'],
  [0.6, 4.6, 7.62, 2, 0, 'in'],
  [3.0, 10.0, 7.8, 6, 0, 'out'],
  [3.7, 10.25, 7.85, 22, 14, 'inOut'],
  [5.6, 10.3, 7.85, 20, 12, 'inOut'],
  [6.4, 10.35, 7.82, 4, 0, 'inOut'],
  [8.0, 10.4, 7.8, 2, 0, 'sine'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: FOREST,
    assets: ASSETS,
    duration: ctx.shot.duration,
    seed: 2026,
    path: WALK.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  view.take({ icon: 'mushroom' }, { at: 4.1, from: [12.35, 8.55, 0.4] });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 2026 });
  hud.compass({ place: 'OLD-GROWTH FOREST', target: [12.4, 8.6] });
  hud.minimap();
  hud.narrate('UNDER EVERY TREE, FUNGI\nLINK THE ROOTS.', { at: 0.6, until: 3.9 });
  hud.narrate('PICK ONE UP: THAT THREAD\nIS THE NETWORK.', { at: 4.6, until: 7.6 });
  hud.inventory({ items: [{ icon: 'mushroom', label: 'FUNGI', at: 5.2 }], at: 5.0 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
