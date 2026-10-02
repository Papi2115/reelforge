// Fixture scene for the reelforge CLI tests: a title card over a checker floor with floating
// cubes; the "Doom" anchor schedules a whoosh. Colours are palette tokens.
export const meta = { id: 's01', title: 'Doom runs everywhere', treatment: 'title-card' };

const FLOOR_SIZE = 10;
const CUBE_COUNT = 16;

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  const material = new three.MeshLambertMaterial({ color, flatShading: true });
  return new three.Mesh(geometry, material);
}

export function build(ctx) {
  const { three, scene, palette, rng, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.fog = new three.Fog(palette.sky, 9, 24);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.4));
  const sun = new three.DirectionalLight(palette.keyLight, 2.6);
  sun.position.set(-4, 7, 5);
  scene.add(sun);
  for (let x = 0; x < FLOOR_SIZE; x += 1) {
    for (let z = 0; z < FLOOR_SIZE; z += 1) {
      const tile = box(three, [1, 0.25, 1], (x + z) % 2 === 0 ? palette.ground : palette.groundAlt);
      tile.position.set(x - FLOOR_SIZE / 2 + 0.5, -0.125, z - FLOOR_SIZE / 2 + 0.5);
      scene.add(tile);
    }
  }
  const cubes = [];
  for (let index = 0; index < CUBE_COUNT; index += 1) {
    const cube = box(
      three,
      [0.5, 0.5, 0.5],
      rng.pick([palette.accent1, palette.accent2, palette.hero]),
    );
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(2.5, 4.5);
    const home = [Math.cos(angle) * radius, rng.range(0.8, 3), Math.sin(angle) * radius];
    cubes.push({ cube, home, phase: rng.range(0, Math.PI * 2) });
    scene.add(cube);
  }
  const doom = anchor('Doom');
  sfx.at(doom.t, 'whoosh');
  return { cubes, doom };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({
    target: [0, 1, 0],
    radius: 9,
    height: 3,
    degrees: [-15, 15],
    ease: 'easeInOutSine',
  })(t);
  for (const { cube, home, phase } of state.cubes) {
    cube.position.set(home[0], home[1] + 0.2 * Math.sin(t * 2 + phase), home[2]);
    cube.rotation.set(0, t + phase, 0);
  }
  ctx.text.title('Doom runs on anything', {
    id: 'title',
    at: state.doom.t,
    enter: 'pop',
    maxWidth: 0.8,
  });
}
