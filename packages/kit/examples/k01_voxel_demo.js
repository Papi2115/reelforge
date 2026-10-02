// Kit demo (PLAN.md#3.1): a hand-drawn 16x16x16 voxel diorama (house, tree, pond, lamp, chimney
// smoke) built with ctx.kit.voxel.fromGrid, on a speckled voxel floor, with an extruded+mirrored
// heart and instanced floating cubes. Colours are palette tokens, so it renders in every style.
// Follows the scene contract: no imports, update() sets everything absolutely from t.
export const meta = { id: 'k01', title: 'Voxel toolkit demo', treatment: 'metaphor-object' };

const E = ''; // empty row

// Layers bottom-up ('top' orientation): rows back (-z) to front (+z), characters left to right.
const ISLAND_SMALL = [
  E,
  '....dddddddd....',
  '...dddddddddd...',
  ...Array(10).fill('..dddddddddddd..'),
  '...dddddddddd...',
  '....dddddddd....',
];
const ISLAND = [
  '..dddddddddddd..',
  '.dddddddddddddd.',
  ...Array(12).fill('dddddddddddddddd'),
  '.dddddddddddddd.',
  '..dddddddddddd..',
];
const GRASS = [
  '..gggggggggggg..',
  '.gggggggggggggg.',
  ...Array(6).fill('gggggggggggggggg'),
  'gggggppggggggggg',
  'gggggppggggggggg',
  'gggggppggggggggg',
  'gggggppgggg~~ggg',
  'gggggppgg~~~~ggg',
  'gggggppggg~~~ggg',
  '.ggggppgggggggg.',
  '..gggppggggggg..',
];
const WALLS_DOOR = [
  E,
  E,
  '..wwwwwwww......',
  '..wwwwwwww......',
  '..wwwwwwww..t...',
  '..wwwwwwww......',
  '..wwwwwwww......',
  '..wwwDDwww......',
  E,
  E,
  '........c.......',
];
const WALLS_WINDOW_DOOR = [...WALLS_DOOR.slice(0, 7), '..wOwDDwOw......', E, E, '........c.......'];
const WALLS_WINDOW = [...WALLS_DOOR.slice(0, 7), '..wOwwwwOw......', E, E, '........L.......'];
const WALLS = [...WALLS_DOOR.slice(0, 7), '..wwwwwwww......'];
const ROOF_EAVES = [
  E,
  '.rrrrrrrrrr.....',
  ...Array(6).fill('.rrrrrrrrrr.....'),
  '.rrrrrrrrrr.....',
];
const ROOF_1 = [
  E,
  E,
  '..rrrrrrrr.lll..',
  '..rrrrrcrrllllll',
  '..rrrrrrrrllllll',
  '..rrrrrrrrllllll',
  '..rrrrrrrr.lll..',
  '..rrrrrrrr......',
];
const ROOF_2 = [
  E,
  E,
  E,
  '...rrrrcr...lll.',
  '...rrrrrr..lllll',
  '...rrrrrr...lll.',
  '...rrrrrr.......',
];
const ROOF_3 = [E, E, E, '.......c........', '....rrrr....l...', '....rrrr........'];
const SMOKE_1 = [E, E, E, '.......s........'];
const SMOKE_2 = [E, E, '........s.......'];
const SMOKE_3 = [E, E, '.........s......', '........ss......'];
const SMOKE_4 = [E, '.........ss.....'];

const DIORAMA_LAYERS = [
  ISLAND_SMALL,
  ISLAND,
  GRASS,
  WALLS_DOOR,
  WALLS_WINDOW_DOOR,
  WALLS_WINDOW,
  WALLS,
  ROOF_EAVES.map((row, z) => (z === 4 ? '.rrrrrrrrrr.t...' : row)),
  ROOF_1,
  ROOF_2,
  ROOF_3,
  [E, E, E, '.......c........'],
  SMOKE_1,
  SMOKE_2,
  SMOKE_3,
  SMOKE_4,
];

const DIORAMA_KEY = {
  d: 'groundAlt',
  g: 'accent3',
  p: 'heroTrim',
  '~': { color: 'accent1', glow: true },
  w: 'heroTrim',
  D: 'accent2',
  O: { color: 'keyLight', glow: true },
  r: 'hero',
  c: 'textDim',
  t: 'shadow',
  l: 'accent1',
  L: { color: 'keyLight', glow: true },
  s: 'fillLight',
};

const HEART_HALF = ['.oo.', 'oooo', 'oooo', '.ooo', '..oo', '...o'];
const CUBE_COUNT = 28;

export function build(ctx) {
  const { three, scene, palette, kit, rng } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.fog = new three.Fog(palette.sky, 12, 30);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.2));
  const sun = new three.DirectionalLight(palette.keyLight, 2.6);
  sun.position.set(5, 9, 6);
  scene.add(sun);

  const floorModel = kit.voxel.speckle(
    kit.voxel.box([48, 1, 48], 'ground'),
    { from: 'ground', to: 'groundAlt', share: 0.18 },
    rng.fork('floor'),
  );
  const floor = kit.voxel.mesh(floorModel, { voxelSize: 0.25 });
  floor.position.y = -0.25;
  scene.add(floor);

  const sprite = kit.voxel.fromGrid({ layers: DIORAMA_LAYERS, key: DIORAMA_KEY });
  const leafy = kit.voxel.speckle(
    sprite,
    { from: 'accent1', to: 'accent3', share: 0.2 },
    rng.fork('leaves'),
  );
  const diorama = kit.voxel
    .mesh(leafy, { voxelSize: 0.25, anchors: { door: [6, 3, 8] } })
    .on(floor);

  const heartModel = kit.voxel.mirror(
    kit.voxel.extrude({ rows: HEART_HALF, key: { o: 'accent2' }, depth: 2 }),
    'x',
    { join: true },
  );
  const heart = kit.voxel.mesh(heartModel, { voxelSize: 0.1, pivot: 'center' });
  diorama.mount(heart, 'door', { offset: [0, 1.1, 0.3] });

  const cubeVoxels = [];
  for (let index = 0; index < CUBE_COUNT; index += 1) {
    cubeVoxels.push([index * 2, 0, 0, 1 + (index % 3)]);
  }
  const cubes = kit.voxel.mesh(
    kit.voxel.fromGrid({ voxels: cubeVoxels }, [
      'accent1',
      'accent2',
      { color: 'accent4', glow: true },
    ]),
    { mode: 'instanced', voxelSize: 0.2, pivot: 'corner' },
  );
  scene.add(cubes);
  const orbits = [];
  for (let index = 0; index < cubes.instanceCount; index += 1) {
    const home = cubes.instanceCell(index);
    orbits.push({
      // Undo the home offset along x: every cube orbits the diorama on its own ring.
      back: -(home[0] + 0.5) * 0.2,
      angle: rng.range(0, Math.PI * 2),
      radius: rng.range(3.4, 5.6),
      height: rng.range(1.2, 4.4),
      speed: rng.range(0.15, 0.35) * (index % 2 === 0 ? 1 : -1),
      spin: rng.range(0.8, 2.2),
    });
  }
  return { diorama, heart, heartBase: heart.position.y, cubes, orbits };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({
    target: [0, 1.6, 0],
    radius: 9.5,
    height: 4.2,
    degrees: [-35, 35],
    to: 6,
    ease: 'easeInOutSine',
  })(t);

  state.heart.position.y = state.heartBase + 0.12 * Math.sin(t * 2.4);
  state.heart.rotation.y = t * 1.2;

  state.orbits.forEach((orbit, index) => {
    const angle = orbit.angle + t * orbit.speed;
    state.cubes.setVoxelTransform(index, {
      offset: [
        orbit.back + Math.cos(angle) * orbit.radius,
        orbit.height + 0.25 * Math.sin(t * 1.7 + orbit.angle),
        Math.sin(angle) * orbit.radius - 0.1,
      ],
      rotation: [t * orbit.spin, t * orbit.spin * 0.6, 0],
    });
  });
}
