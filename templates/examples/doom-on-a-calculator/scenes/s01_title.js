// s01 · title-card: "Doom runs on almost anything." The words pop in on their spoken times over
// a scrolling violet neon grid with floating cubes; a low crane rises towards the title.
export const meta = { id: 's01', title: 'Doom runs on almost anything', treatment: 'title-card' };

const WORDS = ['Doom', 'runs', 'on', 'almost', 'anything'];

export function build(ctx) {
  const { kit, scene, three, palette, anchor } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'neon' }));
  const sky = kit.env.sky({ style: 'dusk', stars: 120 });
  const grid = kit.env.neonGrid({ variant: 'violet', scroll: 3 });
  const cubes = kit.env.floatingCubes({ count: 40, area: [22, 5, 12], clear: 2, seed: 11 });
  cubes.position.set(0, 0.8, -6);
  const calculator = kit.props.calculator({ screen: 'doom', scale: 2.2, seed: 2 });
  calculator.position.set(0, 0.05, 1.2);
  scene.add(sky, grid, cubes, calculator);
  const words = WORDS.map((word) => ({ text: word.toUpperCase(), t: anchor(word).t }));
  return { sky, grid, cubes, calculator, words };
}

export function update(t, s, ctx) {
  ctx.camera.crane({
    target: [0, 0.4, 1.2],
    height: [0.5, 1.8],
    targetHeight: [0.7, 0.5],
    dist: 5,
    degrees: -12,
    ease: 'easeInOutCubic',
  })(t);
  s.sky.update(t);
  s.grid.update(t);
  s.cubes.update(t);
  s.calculator.rotation.y = 0.5 + 0.25 * t;
  s.calculator.update(t);
  ctx.text.kinetic(s.words, {
    id: 'headline',
    pos: [0.5, 0.3],
    scale: 3,
    style: 'pop',
    highlight: 'hero',
    maxWidth: 0.85,
  });
}
