// Example scene for the pixel text system (ctx.text): a title card, a lower third and kinetic
// text over a slowly orbiting voxel set. Text calls are immediate-mode: they run in update() on
// every frame, and at/until plus the enter/exit animations make each frame a pure function of t.
// Colours are palette tokens, so the scene renders in every style preset.
export const meta = { id: 's01', title: 'Text cards', treatment: 'kinetic-text' };

const FLOOR_SIZE = 10;
const PILLAR_COUNT = 9;

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  const material = new three.MeshLambertMaterial({ color, flatShading: true });
  return new three.Mesh(geometry, material);
}

export function build(ctx) {
  const { three, scene, palette, rng } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.fog = new three.Fog(palette.sky, 9, 24);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.2));
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

  const pillars = [];
  for (let index = 0; index < PILLAR_COUNT; index += 1) {
    const color = rng.pick([palette.accent1, palette.accent2, palette.accent3, palette.hero]);
    const height = rng.range(0.8, 2.6);
    const pillar = box(three, [0.8, height, 0.8], color);
    const angle = (index / PILLAR_COUNT) * Math.PI * 2;
    const base = [Math.cos(angle) * 3.4, height / 2, Math.sin(angle) * 3.4];
    pillars.push({ pillar, base, phase: rng.range(0, Math.PI * 2) });
    scene.add(pillar);
  }
  return { pillars };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({
    target: [0, 1, 0],
    radius: 10,
    height: 3,
    degrees: [-20, 40],
    to: 6,
    ease: 'easeInOutSine',
  })(t);
  for (const { pillar, base, phase } of state.pillars) {
    pillar.position.set(base[0], base[1] + 0.15 * Math.sin(t * 2 + phase), base[2]);
  }

  ctx.text.title('Zażółć gęślą jaźń', { id: 'title', at: 0.2, until: 2.6, enter: 'pop' });
  ctx.text.lowerThird('Papi Kowalski', 'twórca · ReelForge', { id: 'name', at: 2.8 });
  ctx.text.kinetic('How much did it cost?', {
    id: 'question',
    at: 3.2,
    perWordDelay: 0.3,
    pos: [0.5, 0.3],
    highlight: 'accent2',
  });
}
