// Example scene for the engine harness: a voxel hero on a checker floor among floating cubes.
// Follows the scene contract (PLAN.md §3.2): no imports, everything comes through ctx, and
// update() sets every time-dependent property absolutely from the local time t. Colours are
// palette tokens, so the scene renders in every style preset.
export const meta = { id: 's00', title: 'Hello voxel', treatment: 'title-card' };

const FLOOR_SIZE = 12;
const CUBE_COUNT = 24;

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  const material = new three.MeshLambertMaterial({ color, flatShading: true });
  return new three.Mesh(geometry, material);
}

export function build(ctx) {
  const { three, scene, palette, rng, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.fog = new three.Fog(palette.sky, 10, 26);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.4));
  const sun = new three.DirectionalLight(palette.keyLight, 2.8);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  for (let x = 0; x < FLOOR_SIZE; x += 1) {
    for (let z = 0; z < FLOOR_SIZE; z += 1) {
      const tile = box(three, [1, 0.25, 1], (x + z) % 2 === 0 ? palette.ground : palette.groundAlt);
      tile.position.set(x - FLOOR_SIZE / 2 + 0.5, -0.125, z - FLOOR_SIZE / 2 + 0.5);
      scene.add(tile);
    }
  }

  const hero = new three.Group();
  const body = box(three, [1, 1.2, 0.7], palette.hero);
  body.position.y = 0.6;
  const head = box(three, [0.8, 0.8, 0.8], palette.heroTrim);
  head.position.y = 1.65;
  hero.add(body, head);
  scene.add(hero);

  const cubes = [];
  for (let index = 0; index < CUBE_COUNT; index += 1) {
    const color = rng.pick([palette.accent1, palette.accent2, palette.accent3, palette.accent4]);
    const cube = box(three, [0.4, 0.4, 0.4], color);
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(2.5, 5.5);
    const home = [Math.cos(angle) * radius, rng.range(1.5, 4.5), Math.sin(angle) * radius];
    cubes.push({ cube, home, phase: rng.range(0, Math.PI * 2), spin: rng.range(0.5, 2) });
    scene.add(cube);
  }

  const hello = anchor('hello world');
  sfx.at(hello.t, 'pop');
  return { hero, cubes, hello };
}

export function update(t, state, ctx) {
  // Slow linear orbit (20 deg/s) with a short impact shake when "hello world" is spoken.
  const orbit = ctx.camera.orbit({
    target: [0, 1.2, 0],
    radius: 9,
    height: 2.2,
    degrees: [0, 200],
    to: 10,
    ease: 'linear',
  });
  ctx.camera.shake(orbit, { amplitude: 0.12, from: state.hello.t, decay: 0.35 })(t);

  const popped = t >= state.hello.t ? Math.min((t - state.hello.t) / 0.25, 1) : 0;
  const scale = 1 + 0.4 * Math.sin(popped * Math.PI);
  state.hero.scale.set(scale, scale, scale);
  state.hero.position.y = 0.15 * Math.abs(Math.sin(t * 3));

  for (const { cube, home, phase, spin } of state.cubes) {
    cube.position.set(home[0], home[1] + 0.3 * Math.sin(t * 1.5 + phase), home[2]);
    cube.rotation.set(t * spin, t * spin * 0.7, 0);
  }
}
