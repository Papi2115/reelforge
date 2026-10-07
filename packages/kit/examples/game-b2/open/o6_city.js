// Game B2 open vocabulary (PLAN.md#13.15), example 6: a CITY film. Night on a main street: tall
// facade walls (generated, a share of the windows lit and glowing), a city skyline with lit
// windows, a road written as pixel art (asphalt + the dashed centre line), streetlamps that light
// their pools, cars and a night bus, people from the person generator. Nothing from the showcase.
// Narration (demo): "At night, a city runs on a second shift: bakers, nurses, drivers, cleaners."
// The walk goes down the pavement and stops at the bus stop as the bus waits.
// Focal: the lit bus at the stop (right of centre), the nurse waiting under the lamp.
// Traces: one lamp buzzes (bulb flicker), the uneven lit windows, the moon behind a tower block.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'go6',
  title: 'Open vocabulary: city',
  treatment: 'character-scene',
};

const ASPHALT = [
  'aaAaaaaaaaaAaaaa',
  'aaaaaaAaaaaaaaaa',
  'aaaaaaaaaaaaaAaa',
  'aAaaaaaaaAaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaAaaaaaaaaAa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaAaaaaaaaaaaa',
  'aaaaaaaaaaaAaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaAaaaaaaaaaaaaa',
  'aaaaaaaaaAaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaAaaaaaaaaa',
  'aaaaaaaaaaaaaaAa',
];
/** The centre line: two rows of the asphalt tile painted with a dash. */
const MIDDLE = ASPHALT.map((row, y) => (y === 7 || y === 8 ? 'yyyyyyyyyaaaaaaa' : row));

const ASSETS = {
  sprites: {
    nurse: {
      gen: 'person',
      seed: 11,
      outfit: 'uniform',
      clothes: 'sky',
      trim: 'paper',
      skin: 3,
      hair: 'bun',
    },
    commuter: {
      gen: 'person',
      seed: 12,
      outfit: 'suit',
      trim: 'clay',
      skin: 0,
      glasses: true,
      tool: 'umbrella',
    },
    walker: {
      gen: 'person',
      seed: 13,
      outfit: 'coat',
      clothes: 'plum',
      skin: 1,
      hat: 'cap',
      trim: 'dusk',
    },
    bus: { gen: 'vehicle', kind: 'bus', seed: 2, size: 2.6, facing: 'left' },
    'car-red': { gen: 'vehicle', kind: 'car', seed: 3 },
    'car-blue': { gen: 'vehicle', kind: 'car', seed: 4, body: 'sky', facing: 'left' },
    lamp: { gen: 'object', kind: 'streetlamp', seed: 1 },
    hydrant: { gen: 'object', kind: 'hydrant', seed: 2 },
    bench: { gen: 'object', kind: 'bench', seed: 3, ramp: 'stone' },
    tower: { gen: 'structure', kind: 'skyscraper', seed: 5, height: 5, lit: 0.35 },
    dog: {
      gen: 'creature',
      kind: 'quadruped',
      form: 'dog',
      coat: 'stone',
      seed: 9,
      size: 0.6,
      fps: 2,
    },
  },
  textures: {
    'block-a': { gen: 'texture', kind: 'facade', seed: 3, lit: 0.45 },
    'block-b': { gen: 'texture', kind: 'facade', seed: 8, ramp: 'rust', lit: 0.3 },
    'block-c': { gen: 'texture', kind: 'glass', seed: 4, lit: 0.25 },
    pavement: { gen: 'texture', kind: 'tile', seed: 2, ramp: 'stone', wear: 0.4 },
    road: { size: 16, rows: ASPHALT, legend: { a: 'char', A: 'slate' } },
    'road-middle': { size: 16, rows: MIDDLE, legend: { a: 'char', A: 'slate', y: 'tungsten' } },
  },
  icons: {
    ticket: { gen: 'icon', kind: 'ticket', colour: 'sandLight', accent: 'dusk' },
  },
};

const STREET = {
  name: 'main-street',
  sky: {
    preset: 'night',
    skyline: 'city',
    skylineHeight: 0.16,
    sun: { az: 10, el: 24, moon: true },
    ground: 'road',
  },
  floor: 'pavement',
  grid: [
    'AAABBBCCCAAABBBCCCAAA.....',
    '..........................',
    '==========================',
    '--------------------------',
    '==========================',
    '..........................',
    'BBBAAACCCBBBAAACCCBBB.....',
  ],
  legend: {
    A: { wall: 'block-a', height: 3 },
    B: { wall: 'block-b', height: 2.4 },
    C: { wall: 'block-c', height: 3.6 },
    '=': { floor: 'road' },
    '-': { floor: 'road-middle' },
  },
  lights: [
    { pos: [6.5, 5.4], z: 1.4, power: 1.2, radius: 3.0 },
    { pos: [12.5, 5.4], z: 1.4, power: 1.2, radius: 3.0, flicker: 'bulb' },
    { pos: [18.5, 5.4], z: 1.4, power: 1.2, radius: 3.0 },
    { pos: [9.5, 1.6], z: 1.4, power: 1.0, radius: 3.0 },
    { pos: [16.0, 1.6], z: 1.4, power: 1.0, radius: 3.0 },
  ],
  sprites: [
    { sprite: 'lamp', pos: [6.5, 5.6] },
    { sprite: 'lamp', pos: [12.5, 5.6] },
    { sprite: 'lamp', pos: [18.5, 5.6] },
    { sprite: 'lamp', pos: [9.5, 1.4] },
    { sprite: 'lamp', pos: [16.0, 1.4] },
    { sprite: 'bus', pos: [14.6, 4.4] },
    { sprite: 'car-red', pos: [8.2, 2.5] },
    { sprite: 'car-blue', pos: [20.2, 3.5] },
    { id: 'nurse', sprite: 'nurse', pos: [13.2, 5.5] },
    { sprite: 'bench', pos: [12.0, 5.75] },
    { sprite: 'commuter', pos: [17.4, 5.4], flip: true },
    { sprite: 'walker', pos: [11.2, 1.5] },
    { sprite: 'hydrant', pos: [9.4, 5.6] },
    { sprite: 'dog', pos: [10.6, 1.7] },
    { sprite: 'tower', pos: [24.0, 0.5] },
    { sprite: 'tower', pos: [24.5, 6.4], scale: 0.8 },
  ],
};

const WALK = [
  [0.0, 2.0, 5.3, 0, 0, 'lin'],
  [0.6, 2.8, 5.3, 0, 0, 'in'],
  [4.2, 9.8, 5.2, 2, 0, 'out'],
  [4.9, 10.0, 5.2, 10, 2, 'inOut'],
  [8.0, 10.2, 5.2, 6, 0, 'sine'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: STREET,
    assets: ASSETS,
    duration: ctx.shot.duration,
    seed: 2340,
    path: WALK.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  view.act('nurse', { act: 'talk', at: 5.3, until: 7.4 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 2340 });
  hud.compass({ place: 'MAIN STREET, NIGHT', target: [14.6, 4.4] });
  hud.minimap();
  hud.narrate('AT NIGHT, A CITY RUNS\nON A SECOND SHIFT.', { at: 0.5, until: 4.4 });
  hud.say('BAKERS, NURSES, DRIVERS,\nCLEANERS.', { speaker: 'NURSE', at: 5.3, until: 7.6 });
  hud.inventory({ items: [{ icon: 'ticket', label: 'NIGHT BUS', at: 4.6 }], at: 4.4 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
