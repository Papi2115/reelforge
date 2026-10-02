// Kit props (PLAN.md#3.3): one prop of ctx.kit.props on a turntable, picked by PROP; the
// turntable makes a quarter turn per second (t = 0, 1, 2, 3 -> 0, 90, 180, 270 degrees). The
// render tests swap the PROP line to render every prop; 'gallery' shows 20 animated desk-scale
// props at once (performance check; the world props have their own scene, k06_world.js). Follows the scene contract: no imports, update() poses from t.
export const meta = { id: 'k04', title: 'Kit props', treatment: 'metaphor-object' };

// Prop under test; the turntable and catalog tests swap this line.
const PROP = 'calculator';

const SETUPS = {
  calculator: (kit) => kit.props.calculator({ screen: 'doom' }),
  bench: (kit) => kit.props.bench(),
  paper: (kit) => kit.props.paper({ variant: 'stamp', title: 'EXAM' }),
  laptop: (kit) => kit.props.laptop({ screen: 'code' }),
  monitor: (kit) => kit.props.monitor({ screen: 'chart' }),
  server: (kit) => kit.props.server(),
  phone: (kit) => kit.props.phone(),
  folder: (kit) => kit.props.folder({ title: 'CASE 7', stamp: true }),
  documentStack: (kit) => kit.props.documentStack({ count: 16, messy: 2 }),
  cash: (kit) => kit.props.cash({ count: 7 }),
  suitcase: (kit) => kit.props.suitcase(),
  lock: (kit) => kit.props.lock(),
  key: (kit) => kit.props.key(),
  clock: (kit) => kit.props.clock({ speed: 600 }),
  globe: (kit) => kit.props.globe(),
  mapTable: (kit) => kit.props.mapTable(),
  usbStick: (kit) => kit.props.usbStick(),
  character: (kit) => kit.props.character({ accessories: ['backpack'] }),
  crowd: (kit) => kit.props.crowd({ count: 24, area: [7, 4], walking: 0 }),
  car: (kit) => kit.props.car({ speed: 2 }),
  van: (kit) => kit.props.van(),
  truck: (kit) => kit.props.truck({ body: 'flatbed' }),
  container: (kit) => kit.props.container(),
  warehouse: (kit) => kit.props.warehouse(),
  building: (kit) => kit.props.building({ rooftop: 'antenna' }),
  tower: (kit) => kit.props.tower(),
  house: (kit) => kit.props.house(),
  drone: (kit) => kit.props.drone(),
};

/** Desk-scale props of batch A (the gallery). */
const DESK_PROPS = [
  'calculator',
  'bench',
  'paper',
  'laptop',
  'monitor',
  'server',
  'phone',
  'folder',
  'documentStack',
  'cash',
  'suitcase',
  'lock',
  'key',
  'clock',
  'globe',
  'mapTable',
  'usbStick',
];

/** 20 props for the gallery: the desk props plus three variants. */
const GALLERY = [
  ...DESK_PROPS.map((name) => SETUPS[name]),
  (kit) => kit.props.cash({ kind: 'coins', count: 6 }),
  (kit) => kit.props.suitcase({ style: 'trolley' }),
  (kit) => kit.props.clock({ style: 'alarm', speed: 60 }),
];

const FOV = 30;
const ELEVATION = 0.42;
const AZIMUTH = 0.5;

/** Puts `prop` on a turntable group, centred, standing on y = 0. */
function turntable(kit, prop) {
  const box = prop.bounds();
  const table = kit.voxel.group();
  const scale = prop.scale.x;
  prop.position.set(
    (-(box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    (-(box.min.z + box.max.z) / 2) * scale,
  );
  table.add(prop);
  const size = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
  return { table, height: size[1] * scale, radius: (Math.hypot(...size) / 2) * scale };
}

function camera(height, radius) {
  const distance = (radius * 1.15) / Math.tan(((FOV / 2) * Math.PI) / 180);
  const target = [0, height / 2, 0];
  const position = [
    Math.sin(AZIMUTH) * Math.cos(ELEVATION) * distance,
    target[1] + Math.sin(ELEVATION) * distance,
    Math.cos(AZIMUTH) * Math.cos(ELEVATION) * distance,
  ];
  return { position, target, fov: FOV };
}

function buildGallery(kit, scene) {
  const props = GALLERY.map((make, index) => {
    const prop = make(kit);
    const { table, height } = turntable(kit, prop);
    const fit = 1.4 / Math.max(1.4, height, prop.bounds().max.x - prop.bounds().min.x);
    table.scale.setScalar(fit);
    table.position.set(((index % 5) - 2) * 2.2, 0, (Math.floor(index / 5) - 1.5) * 2.2);
    scene.add(table);
    return prop;
  });
  return { props, tables: [], pose: camera(0.5, 4.2) };
}

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  if (PROP === 'gallery') return buildGallery(kit, scene);
  const prop = SETUPS[PROP](kit);
  const { table, height, radius } = turntable(kit, prop);
  scene.add(table);
  return { props: [prop], tables: [table], pose: camera(height, radius) };
}

export function update(t, state, ctx) {
  ctx.camera.set(state.pose);
  state.tables.forEach((table) => {
    table.rotation.y = (t * Math.PI) / 2;
  });
  state.props.forEach((prop) => prop.update(t));
}
