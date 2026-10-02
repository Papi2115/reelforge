// Kit world props (PLAN.md#3.3, batch B): the voxel character, crowds, vehicles and buildings,
// one setup per WORLD value. 'poses' and 'seated' show the clips (stand, walk, point, wave; sit,
// typing, think, shrug), 'variants' the outfits, 'street' the vehicles in motion and 'city' the
// performance scene (hero + 200-person crowd + 6 buildings + 2 vehicles). The render tests swap
// the WORLD line. Follows the scene contract: no imports, update() poses everything from t.
export const meta = { id: 'k06', title: 'Kit world props', treatment: 'character-scene' };

// Setup under test; the render tests swap this line.
const WORLD = 'poses';

/** A plain 0.5625-unit stool (the kit chair height) so the sit pose shows its legs. */
function stool(kit) {
  return kit.voxel.mesh(kit.voxel.box([6, 9, 6], 'textDim'), { voxelSize: 1 / 16 });
}

function posesSetup(kit, scene) {
  const people = ['stand', 'walk', 'point', 'wave'].map((pose, index) => {
    const person = kit.props.character({ pose });
    person.position.set(-2.7 + index * 1.8, 0, 0);
    // The pointer turns to point across the frame (straight ahead would aim at the camera).
    person.rotation.y = pose === 'point' ? 1.1 : 0;
    scene.add(person);
    return person;
  });
  return {
    animated: people,
    camera: { position: [0.8, 2.4, 6.6], target: [0, 1, 0], fov: 44 },
  };
}

function seatedSetup(kit, scene) {
  const seat = stool(kit);
  seat.position.set(-2.8, 0, 0);
  seat.rotation.y = 0.5;
  scene.add(seat);
  const sitter = kit.props.character({ variant: 'hoodie', pose: 'sit' });
  sitter.on(seat, { align: 'seat' });
  const desk = kit.props.bench();
  desk.position.set(-0.6, 0, -0.6);
  scene.add(desk);
  const typist = kit.props.character({ variant: 'suit', pose: 'typing' });
  typist.on(desk, { at: 'seat', align: 'seat' });
  kit.props.laptop({ scale: 0.45, screen: 'code' }).on(desk);
  const standing = ['think', 'shrug'].map((pose, index) => {
    const person = kit.props.character({ variant: index === 0 ? 'officer' : 'hacker', pose });
    person.position.set(1.3 + index * 1.7, 0, 0);
    scene.add(person);
    return person;
  });
  return {
    animated: [sitter, typist, ...standing],
    camera: { position: [0.3, 2.6, 6.4], target: [0, 0.9, 0], fov: 44 },
  };
}

function variantsSetup(kit, scene) {
  const specs = [
    { variant: 'hero', accessories: ['backpack'] },
    { variant: 'hoodie', hair: 'spiky', accessories: ['headphones'] },
    { variant: 'suit', hair: 'bald', accessories: ['glasses'] },
    { variant: 'hacker' },
    { variant: 'officer', skin: 'warm' },
    { variant: 'hoodie', hair: 'long', hat: 'beanie', skin: 'warm', outfit: 'accent2' },
  ];
  const people = specs.map((spec, index) => {
    const person = kit.props.character(spec);
    person.position.set((index - 2.5) * 1.3, 0, 0);
    person.rotation.y = (index - 2.5) * -0.08;
    scene.add(person);
    return person;
  });
  return {
    animated: people,
    camera: { position: [0, 1.9, 6.4], target: [0, 1.05, 0], fov: 40 },
  };
}

function streetSetup(kit, scene) {
  scene.add(kit.env.neonGrid({ variant: 'violet', scroll: 0 }));
  const car = kit.props.car({ style: 'taxi' });
  car.rotation.y = Math.PI / 2;
  scene.add(car);
  const truck = kit.props.truck({ body: 'flatbed' });
  truck.rotation.y = -Math.PI / 2;
  truck.position.set(1, 0, -4.5);
  kit.props.container({ seed: 4 }).on(truck, { at: 'cargo' });
  scene.add(truck);
  const van = kit.props.van();
  van.position.set(-5.5, 0, -1);
  van.rotation.y = 0.5;
  scene.add(van);
  const drone = kit.props.drone({ scale: 1.6 });
  drone.position.set(3.2, 3.2, 1.5);
  scene.add(drone);
  const hero = kit.props.character();
  hero.rotation.y = -Math.PI / 2;
  scene.add(hero);
  return {
    animated: [drone],
    camera: { position: [1.5, 4.2, 11], target: [0.5, 1.2, -1], fov: 45 },
    pose(t) {
      car.position.set(-9 + car.drive(t, 3), 0, 1.2);
      truck.drive(t, -2);
      hero.position.set(4.5 - hero.walk(t, 1.1), 0, 3.4);
    },
  };
}

function citySetup(kit, scene) {
  scene.add(kit.env.sky({ style: 'dusk' }));
  scene.add(kit.env.neonGrid({ variant: 'violet', scroll: 0 }));
  const buildings = [
    [kit.props.tower({ floors: 18, seed: 1 }), -14, -26],
    [kit.props.tower({ floors: 12, setbacks: 1, seed: 2 }), 12, -30],
    [kit.props.building({ floors: 7, rooftop: 'antenna', seed: 3 }), -4, -22],
    [kit.props.building({ floors: 5, style: 'apartment', rooftop: 'tank', seed: 4 }), 4, -20],
    [kit.props.building({ floors: 3, width: 12, rooftop: 'helipad', seed: 5 }), 22, -18],
    [kit.props.warehouse({ seed: 6 }), -24, -16],
  ];
  for (const [item, x, z] of buildings) {
    item.position.set(x, 0, z);
    scene.add(item);
  }
  const crowd = kit.props.crowd({ count: 200, area: [26, 10], seed: 7, walking: 0.3 });
  crowd.position.set(0, 0, -6);
  scene.add(crowd);
  const car = kit.props.car();
  car.rotation.y = Math.PI / 2;
  scene.add(car);
  const truck = kit.props.truck();
  truck.rotation.y = -Math.PI / 2;
  scene.add(truck);
  const hero = kit.props.character({ pose: 'wave' });
  hero.position.set(0, 0, 3.5);
  scene.add(hero);
  return {
    animated: [crowd, hero],
    camera: { position: [0, 6.5, 16], target: [0, 3, -8], fov: 50 },
    pose(t) {
      car.position.set(-16 + car.drive(t, 4), 0, 0);
      truck.position.set(16 - truck.drive(t, 2.5), 0, -1.8);
    },
  };
}

const SETUPS = {
  poses: { lights: 'default', build: posesSetup },
  seated: { lights: 'default', build: seatedSetup },
  variants: { lights: 'default', build: variantsSetup },
  street: { lights: 'neon', build: streetSetup },
  city: { lights: 'neon', build: citySetup },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[WORLD];
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: setup.lights }));
  return setup.build(kit, scene);
}

export function update(t, state, ctx) {
  ctx.camera.set(state.camera);
  state.animated.forEach((item) => item.update(t));
  if (state.pose) state.pose(t);
}
