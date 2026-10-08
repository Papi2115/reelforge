// Game B2 open vocabulary (PLAN.md#13.15), example 3: a SPACE STATION film. The level is outdoor
// (sky preset `space`, no ground: stars above and below) with a roofed module inside it: hull
// walls with see-through portholes, a generated planet floating outside, consoles that glow, an
// astronaut drawn by the person generator. Nothing from the showcase.
// Narration (demo): "The station circles the Earth about every ninety minutes. That is some sixteen
// sunrises a day." The walk floats down the module, turns to the window, the planet fills it.
// Focal: the planet framed by the porthole (centre), the astronaut at the console to the right.
// Traces: the slow float (low bob), a blinking console, the hand-lettered sticky on the hull.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'go3',
  title: 'Open vocabulary: space station',
  treatment: 'character-scene',
};

const ASSETS = {
  sprites: {
    earth: { gen: 'structure', kind: 'planet', seed: 12, height: 4 },
    astronaut: {
      gen: 'person',
      seed: 3,
      outfit: 'spacesuit',
      hat: 'space',
      skin: 2,
      trim: 'clay',
      tool: 'clipboard',
      z: 0.12,
    },
    console: { gen: 'object', kind: 'console', seed: 5 },
    crate: { gen: 'object', kind: 'crate', seed: 2, ramp: 'stone', size: 0.34 },
    sprout: { gen: 'plant', kind: 'flowers', seed: 6, bloom: 'paper', height: 0.3 },
    satellite: { gen: 'vehicle', kind: 'satellite', seed: 1, size: 1.2, z: 0.6 },
  },
  textures: {
    hull: { gen: 'texture', kind: 'hull', seed: 2 },
    porthole: { gen: 'texture', kind: 'hull', seed: 2, window: true },
    deck: { gen: 'texture', kind: 'metal', seed: 6, wear: 0.1 },
    panel: { gen: 'texture', kind: 'metal', seed: 9, ramp: 'stone', wear: 0 },
  },
  icons: {
    cell: { gen: 'icon', kind: 'battery' },
  },
};

const STATION = {
  name: 'orbital-module',
  sky: { preset: 'space', skyline: 'none', ground: 'none', sun: { az: -120, el: 8 } },
  floor: 'deck',
  grid: [
    '......................',
    '......................',
    '......................',
    '......................',
    '.HHHHHHWHHHHWHHHHHHH..',
    '.Hiiiiiiiiiiiiiiiiih..',
    '.Hiiiiiiiiiiiiiiiiih..',
    '.Hiiiiiiiiiiiiiiiiih..',
    '.HHHHHHHHHHHHHHHHHHH..',
    '......................',
  ],
  legend: {
    '.': { floor: 'none' },
    H: { wall: 'hull' },
    W: { wall: 'porthole' },
    h: { wall: 'hull' },
    i: { ceiling: 'panel', mood: 'shop' },
  },
  lights: [
    { pos: [5.5, 6.5], z: 0.95, power: 0.9, radius: 3.4, flicker: 'tube' },
    { pos: [12.5, 6.5], z: 0.95, power: 1.0, radius: 3.6 },
    { pos: [17.0, 6.5], z: 0.95, power: 0.8, radius: 3.0 },
  ],
  sprites: [
    { sprite: 'earth', pos: [12.5, 1.6], z: -1 },
    { sprite: 'satellite', pos: [7.2, 2.4] },
    { id: 'pilot', sprite: 'astronaut', pos: [15.6, 5.6] },
    { sprite: 'console', pos: [16.6, 5.4] },
    { sprite: 'console', pos: [9.4, 7.5], flip: true },
    { sprite: 'crate', pos: [3.4, 7.4] },
    { sprite: 'crate', pos: [3.8, 7.6], z: 0.34, scale: 0.8 },
    { sprite: 'sprout', pos: [11.2, 7.6] },
  ],
};

const FLOAT = [
  [0.0, 3.0, 6.4, 0, 0, 'lin'],
  [0.6, 4.0, 6.4, 0, 0, 'in'],
  [3.4, 11.4, 6.3, -10, 0, 'out'],
  [4.4, 12.4, 6.9, -86, -8, 'inOut'],
  [6.6, 12.5, 6.9, -90, -10, 'inOut'],
  [8.0, 12.6, 6.9, -50, -2, 'inOut'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: STATION,
    assets: ASSETS,
    duration: ctx.shot.duration,
    seed: 400,
    bob: 0.25,
    path: FLOAT.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  view.act('pilot', { act: 'talk', at: 6.9, until: 8 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 400 });
  hud.compass({ place: 'LOW EARTH ORBIT', target: [12.5, 1.2] });
  hud.minimap();
  hud.status({ label: '90 MIN ORBIT', icon: 'hourglass', at: 0.4 });
  hud.narrate('THE STATION CIRCLES THE EARTH\nABOUT EVERY NINETY MINUTES.', {
    at: 0.5,
    until: 4.2,
  });
  hud.say('SOME SIXTEEN SUNRISES\nA DAY.', { speaker: 'CREW', at: 6.9, until: 8 });
  hud.inventory({ items: [{ icon: 'cell', label: 'POWER CELL', at: 0.2 }], at: 0 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
