// Cinematic camera moves (PLAN.md#12.28): one voxel room, four 3 s acts, one move each —
// rack focus (laptop -> hero), dolly zoom (vertigo on the hero), orbit (55 deg around the hero)
// and layered parallax (floating debris in front races past). Follows the scene contract: no
// imports, everything through ctx; moves are called in update() every frame like ctx.text.
export const meta = { id: 's03', title: 'Camera moves', treatment: 'character-scene' };

const ACT = 3;
/** Base pose of each act; the act's move modifies it. */
const POSES = [
  { position: [-0.2, 1.75, 5.6], target: [0, 1.05, -1], fov: 46 },
  { position: [0.6, 1.5, 5.5], target: [0.6, 1.2, -0.5], fov: 50 },
  { position: [0.6, 2.4, 6.2], target: [0.6, 1.1, -0.5], fov: 48 },
  { position: [2.2, 1.7, 6.6], target: [1.4, 1.2, -1], fov: 50 },
];

export function build(ctx) {
  const { kit, scene, three, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  scene.add(kit.env.room({ width: 12, depth: 9, height: 5 }));

  const hero = kit.props.character({ pose: 'stand' });
  hero.position.set(0.6, 0, -0.5);
  hero.rotation.y = -0.25;
  scene.add(hero);

  const desk = kit.env.desk({ width: 2.6, depth: 1.4, drawers: false });
  desk.position.set(-1.7, 0, 3.3);
  desk.rotation.y = 0.35;
  scene.add(desk);
  const laptop = kit.props.laptop({ screen: 'chart', scale: 0.8 });
  laptop.on(desk);
  laptop.rotation.y = 0.75;

  const servers = [3.2, 4.6].map((x, index) => {
    const server = kit.props.server({ seed: index });
    server.position.set(x, 0, -3.6);
    scene.add(server);
    return server;
  });
  const globe = kit.props.globe({ speed: 0.6 });
  globe.position.set(-3.6, 0, -3.4);
  scene.add(globe);

  // Debris above head height, in front of the set: the foreground layer of the parallax act.
  const debris = kit.env.floatingCubes({ count: 14, seed: 3, area: [12, 1.4, 5], clear: 1.5 });
  debris.position.set(0.6, 2.6, 2.4);
  scene.add(debris);

  return { hero, laptop, servers, globe, debris };
}

export function update(t, state, ctx) {
  const act = Math.min(POSES.length - 1, Math.floor(t / ACT));
  const start = act * ACT;
  ctx.camera.set(POSES[act]);
  if (act === 0) {
    ctx.camera.rackFocus({ from: state.laptop, to: state.hero, t0: 0.8, t1: 2.2 });
  } else if (act === 1) {
    ctx.camera.dollyZoom({
      from: 2.8,
      to: 9,
      t0: start + 0.3,
      t1: start + 2.7,
      subject: [0.6, 1.2, -0.5],
    });
  } else if (act === 2) {
    ctx.camera.orbit({ degrees: 55, t0: start + 0.3, t1: start + 2.7 });
  } else {
    ctx.camera.parallax({
      amount: -2.2,
      t0: start + 0.2,
      t1: start + 2.8,
      layers: [{ kit: 'floatingCubes', ratio: 2 }],
    });
  }

  state.hero.update(t);
  state.laptop.update(t);
  state.servers.forEach((server) => server.update(t));
  state.globe.update(t);
  state.debris.update(t);
}
