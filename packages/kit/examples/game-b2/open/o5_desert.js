// Game B2 open vocabulary (PLAN.md#13.15), example 5: a DESERT film. Noon over dunes (skyline
// `dunes`, the sun high), sand that ripples, an oasis pool of animated water ringed by palms and
// reeds, adobe walls with a window, tents, a camel caravan and a trader, a lizard on a rock.
// Nothing from the showcase. Narration (demo): "An oasis is groundwater that reaches the surface.
// Caravans planned their routes around them." The walk comes over the sand to the pool; the
// WATER meter, low all the way, fills when the flask dips.
// Focal: the pool and the palms (centre), the camels left of it.
// Traces: the heat-slow stride, the reeds sway, the meter blinks low, the uneven tent line.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'go5',
  title: 'Open vocabulary: desert',
  treatment: 'character-scene',
};

const ASSETS = {
  sprites: {
    palm: { gen: 'plant', kind: 'palm', seed: 4, height: 2.6 },
    'palm-bent': { gen: 'plant', kind: 'palm', seed: 9, height: 2.2, lean: -0.8 },
    reeds: { gen: 'plant', kind: 'reeds', seed: 2, height: 0.7 },
    scrub: { gen: 'plant', kind: 'bush', seed: 5, leaf: 'earth', height: 0.4 },
    camel: {
      gen: 'creature',
      kind: 'quadruped',
      form: 'grazer',
      hump: true,
      coat: 'earth',
      neck: 0.55,
      legs: 0.8,
      ears: 'round',
      seed: 3,
      size: 1.3,
      fps: 0,
    },
    lizard: {
      gen: 'creature',
      kind: 'reptile',
      form: 'lizard',
      coat: 'earth',
      seed: 8,
      size: 0.4,
      z: 0.3,
      fps: 0,
    },
    trader: {
      gen: 'person',
      seed: 6,
      hat: 'turban',
      outfit: 'robe',
      clothes: 'earth',
      trim: 'dusk',
      skin: 2,
      beard: true,
      tool: 'staff',
    },
    tent: { gen: 'structure', kind: 'tent', seed: 3, wall: 'rust', height: 1.1 },
    rock: { gen: 'object', kind: 'rock', seed: 6, ramp: 'stone', size: 0.5 },
  },
  textures: {
    dune: { gen: 'texture', kind: 'sand', seed: 6 },
    oasis: { gen: 'texture', kind: 'water', seed: 2 },
    mudbrick: { gen: 'texture', kind: 'adobe', seed: 4 },
    'mudbrick-window': { gen: 'texture', kind: 'adobe', seed: 4, window: true },
  },
  icons: {
    flask: { gen: 'icon', kind: 'bottle', colour: 'tan', accent: 'haze' },
  },
};

const DESERT = {
  name: 'oasis',
  sky: {
    preset: 'day',
    skyline: 'dunes',
    skylineHeight: 0.07,
    clouds: 0.08,
    sun: { az: 15, el: 40 },
    ground: 'dune',
  },
  floor: 'dune',
  ambient: 1.05,
  grid: [
    '..........................',
    '..........................',
    '..................AAWAA...',
    '..................A...A...',
    '..................A.......',
    '..........www.............',
    '.........wwwww............',
    '........wwwwwww...........',
    '.........wwwww....AAWAA...',
    '..........................',
    '..........................',
  ],
  legend: {
    w: { floor: 'oasis' },
    A: { wall: 'mudbrick', height: 1.2 },
    W: { wall: 'mudbrick-window', height: 1.2 },
  },
  sprites: [
    { sprite: 'palm', pos: [9.2, 5.1] },
    { sprite: 'palm-bent', pos: [13.6, 6.0] },
    { sprite: 'palm', pos: [12.4, 4.4], flip: true },
    { sprite: 'palm', pos: [9.6, 8.6], scale: 0.85 },
    { sprite: 'palm-bent', pos: [13.2, 8.8], flip: true },
    { sprite: 'reeds', pos: [10.2, 4.9] },
    { sprite: 'reeds', pos: [14.4, 7.4], flip: true },
    { sprite: 'reeds', pos: [11.6, 5.0] },
    { sprite: 'camel', pos: [12.2, 3.0], flip: true },
    { sprite: 'camel', pos: [14.0, 2.4], flip: true, scale: 0.9 },
    { id: 'trader', sprite: 'trader', pos: [10.9, 3.4] },
    { sprite: 'tent', pos: [16.2, 3.0] },
    { sprite: 'tent', pos: [16.6, 9.2], flip: true, scale: 0.9 },
    { sprite: 'scrub', pos: [5.2, 7.8] },
    { sprite: 'scrub', pos: [15.4, 6.8], scale: 0.8 },
    { sprite: 'rock', pos: [8.2, 9.0] },
    { sprite: 'lizard', pos: [8.25, 8.95] },
  ],
};

const WALK = [
  [0.0, 1.6, 6.6, -2, 4, 'lin'],
  [0.7, 2.4, 6.6, 0, 4, 'in'],
  [4.6, 6.2, 6.8, 2, 6, 'out'],
  [5.4, 6.4, 6.8, 4, 14, 'inOut'],
  [6.6, 6.5, 6.8, -6, 6, 'inOut'],
  [8.0, 6.6, 6.8, -16, 2, 'sine'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: DESERT,
    assets: ASSETS,
    duration: ctx.shot.duration,
    seed: 900,
    bob: 0.8,
    path: WALK.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  view.hold({ icon: 'flask' }, { at: 4.8, until: 7.6 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 900 });
  hud.compass({ place: 'OASIS', target: [11.0, 6.6] });
  hud.minimap();
  hud.meter({
    label: 'WATER',
    keys: [
      [0, 3],
      [4.9, 2],
      [5.8, 2],
      [6.4, 10],
    ],
  });
  hud.narrate('AN OASIS IS GROUNDWATER\nTHAT REACHES THE SURFACE.', { at: 0.5, until: 4.4 });
  hud.narrate('CARAVANS PLANNED THEIR\nROUTES AROUND THEM.', { at: 4.6, until: 7.8 });
  hud.inventory({ items: [{ icon: 'flask', label: 'WATER', at: 6.3 }], at: 6.1 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
