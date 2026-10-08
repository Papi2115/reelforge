// Game B2 open vocabulary (PLAN.md#13.15), example 4: a MEDIEVAL VILLAGE film. Dusk over a market
// square: timber-framed walls (a 32 px texture written as pixel art), thatch, packed earth, torches
// that flicker and light their corner, villagers from the person generator (a farmer, a baker, a
// monk, a guard), a well, a cart, hens. Nothing from the showcase.
// Narration (demo): "Every village had its well, and every well its gossip." The baker: "The miller
// raised his price again." The walk crosses the square to the well; the baker turns and talks.
// Focal: the baker by the well (right of centre), the torch behind her.
// Traces: the torch flicker on the plaster, hens out of step, the guard's crooked stance, the stride.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'go4',
  title: 'Open vocabulary: medieval village',
  treatment: 'character-scene',
};

const ASSETS = {
  sprites: {
    farmer: {
      gen: 'person',
      seed: 1,
      hat: 'straw',
      outfit: 'tunic',
      skin: 1,
      tool: 'spade',
      beard: true,
    },
    baker: {
      gen: 'person',
      seed: 2,
      hat: 'bonnet',
      outfit: 'apron',
      clothes: 'rust',
      skin: 0,
      tool: 'basket',
      hair: 'long',
    },
    monk: {
      gen: 'person',
      seed: 3,
      hat: 'hood',
      outfit: 'robe',
      clothes: 'earth',
      skin: 2,
      tool: 'book',
    },
    guard: {
      gen: 'person',
      seed: 4,
      hat: 'helmet',
      outfit: 'tunic',
      clothes: 'sky',
      trim: 'tungsten',
      skin: 3,
      tool: 'sword',
      build: 'stout',
    },
    child: {
      gen: 'person',
      seed: 5,
      build: 'child',
      outfit: 'tunic',
      clothes: 'leaf',
      hair: 'short',
      hairColour: 'tungsten',
    },
    well: { gen: 'structure', kind: 'well', seed: 2, roof: 'warm' },
    cottage: { gen: 'structure', kind: 'house', seed: 3, wall: 'earth', roof: 'earth', lit: 0.6 },
    keep: { gen: 'structure', kind: 'tower', seed: 4, height: 3.6, lit: 0.5 },
    cart: { gen: 'vehicle', kind: 'cart', seed: 1, facing: 'left' },
    barrel: { gen: 'object', kind: 'barrel', seed: 2 },
    sack: { gen: 'object', kind: 'sack', seed: 4 },
    torch: { gen: 'object', kind: 'torch', seed: 6, size: 0.4, z: 0.55 },
    hen: {
      gen: 'creature',
      kind: 'bird',
      form: 'perch',
      coat: 'earth',
      belly: 'paper',
      seed: 7,
      size: 0.24,
    },
    oak: { gen: 'plant', kind: 'deciduous', seed: 21, height: 2.4, leaf: 'leaf' },
  },
  textures: {
    timber: {
      size: 32,
      rows: [
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'bpppppppppppppbbpppppppppppppppb',
        'bpppppppppppppbbppppppppppppppqb',
        'bpbbpppppppppbbbbpppppppppppqqpb',
        'bppbbpppppppbbppbbppppppppqqpppb',
        'bpppbbpppppbbppppbbppppppqqppppb',
        'bppppbbpppbbppppppbbppppqqpppppb',
        'bpppppbbpbbppppppppbbppqqppppppb',
        'bppppppbbbpppppppppppbbqpppppppb',
        'bpppppppbppppppppppppqbbpppppppb',
        'bppqppppbpppppppppppqppbbppppppb',
        'bpppppppbppppppppppppppppbbppppb',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'bpppppppppppppbbpppppppppppppppb',
        'bppppppppppppppbppppppppppppppqb',
        'bpppqppppppppppbppppppppppppppqb',
        'bppppppppppppppbpppppppppppppppb',
        'bpppppppppppppbbpppppppppppppppb',
        'bppppppppppppppbppppqppppppppppb',
        'bppppppppppppppbpppppppppppppppb',
        'bpppppppppppppbbpppppppppppppppb',
        'bpppppppppppppbbpppppppppqpppppb',
        'bppppppppqppppbbpppppppppppppppb',
        'bpppppppppppppbbpppppppppppppppb',
        'bpppppppppppppbbpppppppppppppppb',
        'bpppppppppppppbbppppppppppppqppb',
        'bpppppppppppppbbpppppppppppppppb',
        'dddddddddddddddddddddddddddddddd',
        'dddddddddddddddddddddddddddddddd',
        'dddddddddddddddddddddddddddddddd',
      ],
      legend: { b: 'warm.1', p: 'earth.3', q: 'earth.2', d: 'stone.2' },
    },
    thatch: { gen: 'texture', kind: 'thatch', seed: 3 },
    packed: { gen: 'texture', kind: 'mud', seed: 2, ramp: 'earth' },
    meadow: { gen: 'texture', kind: 'grass', seed: 8 },
  },
  icons: {
    loaf: { gen: 'icon', kind: 'bread' },
  },
};

const VILLAGE = {
  name: 'market-square',
  sky: {
    preset: 'dusk',
    skyline: 'hills',
    skylineHeight: 0.07,
    clouds: 0.22,
    ground: 'meadow',
    sun: { az: 200, el: 2 },
  },
  floor: 'meadow',
  grid: [
    '........................',
    '........................',
    '...TTTT......HHHH.......',
    '...TTTT......HHHH.......',
    '....,,,,,,,,,,,,,,,.....',
    '....,,,,,,,,,,,,,,,.....',
    '....,,,,,,,,,,,,,,,TTT..',
    '....,,,,,,,,,,,,,,,TTT..',
    '....,,,,,,,,,,,,,,,.....',
    '...HHH,,,,,,,,,,,,,.....',
    '...HHH......TTTT........',
    '............TTTT........',
    '........................',
  ],
  legend: {
    T: { wall: 'timber', height: 1.4 },
    H: { wall: 'thatch', height: 1.1 },
    ',': { floor: 'packed' },
  },
  lights: [
    { pos: [12.2, 4.4], z: 0.7, power: 1.1, radius: 3.4, flicker: 'fire' },
    { pos: [5.0, 8.4], z: 0.7, power: 0.9, radius: 3.0, flicker: 'fire' },
    { pos: [18.4, 5.6], z: 0.7, power: 0.9, radius: 3.0, flicker: 'fire' },
  ],
  sprites: [
    { sprite: 'torch', pos: [12.2, 4.15] },
    { sprite: 'torch', pos: [5.0, 8.4] },
    { sprite: 'torch', pos: [18.35, 5.6] },
    { sprite: 'well', pos: [12.0, 6.5] },
    { id: 'baker', sprite: 'baker', pos: [12.9, 7.15] },
    { sprite: 'farmer', pos: [8.6, 5.0] },
    { sprite: 'monk', pos: [16.4, 7.6], flip: true },
    { sprite: 'guard', pos: [17.6, 4.7] },
    { sprite: 'child', pos: [9.6, 7.8] },
    { sprite: 'cart', pos: [6.3, 5.0] },
    { sprite: 'barrel', pos: [15.4, 4.4] },
    { sprite: 'barrel', pos: [15.9, 4.6], scale: 0.9 },
    { sprite: 'sack', pos: [14.2, 4.5] },
    { sprite: 'hen', pos: [10.8, 7.2] },
    { sprite: 'hen', pos: [11.3, 7.5], flip: true },
    { sprite: 'hen', pos: [7.4, 6.6] },
    { sprite: 'cottage', pos: [21.5, 2.0], scale: 1.2 },
    { sprite: 'cottage', pos: [1.6, 6.0], flip: true },
    { sprite: 'keep', pos: [19.0, 0.6] },
    { sprite: 'oak', pos: [22.4, 9.8] },
    { sprite: 'oak', pos: [1.2, 1.4], flip: true },
  ],
};

const WALK = [
  [0.0, 5.0, 6.6, -6, 0, 'lin'],
  [0.5, 5.6, 6.6, -4, 0, 'in'],
  [3.6, 10.2, 6.5, 2, 0, 'out'],
  [4.2, 10.3, 6.5, 8, 2, 'inOut'],
  [8.0, 10.4, 6.5, 6, 2, 'sine'],
];

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: VILLAGE,
    assets: ASSETS,
    duration: ctx.shot.duration,
    seed: 1349,
    path: WALK.map(([at, x, y, yaw, pitch, ease]) => ({ at, x, y, yaw, pitch, ease })),
  });
  view.act('baker', { act: 'talk', at: 4.6, until: 7.4 });
  view.hold({ icon: 'loaf' }, { at: 0.2 });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1349 });
  hud.compass({ place: 'MARKET SQUARE', target: [12.0, 6.5] });
  hud.minimap();
  hud.narrate('EVERY VILLAGE HAD ITS WELL,\nAND EVERY WELL ITS GOSSIP.', { at: 0.4, until: 4.2 });
  hud.say('THE MILLER RAISED\nHIS PRICE AGAIN.', { speaker: 'BAKER', at: 4.6, until: 7.6 });
  hud.inventory({ items: [{ icon: 'loaf', label: 'BREAD', at: 0.1 }], at: 0 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
