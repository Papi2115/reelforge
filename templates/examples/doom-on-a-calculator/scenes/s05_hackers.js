// s05 · character-scene: "So hackers rewrote the engine, shrank the maps, and drew every frame in
// tiny pixels." The voxel hero points at a giant calculator standing on the neon grid while the
// three hacks pop up as labels, each on its spoken words.
export const meta = { id: 's05', title: 'The hacker tricks', treatment: 'character-scene' };

const HACKS = [
  { phrase: 'rewrote the engine', text: 'ENGINE: REWRITTEN', color: 'accent1' },
  { phrase: 'shrank the maps', text: 'MAPS: SHRUNK', color: 'accent3' },
  { phrase: 'tiny pixels', text: 'PIXELS: TINY', color: 'accent2' },
];

export function build(ctx) {
  const { kit, scene, three, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'neon' }));
  const sky = kit.env.sky({ style: 'dusk', stars: 80 });
  const grid = kit.env.neonGrid({ variant: 'violet', scroll: 0.8 });
  const cubes = kit.env.floatingCubes({ count: 30, area: [22, 6, 10], clear: 5, seed: 21 });
  cubes.position.set(0, 0.5, -6);
  const calculator = kit.props.calculator({ screen: 'doom', seed: 2, scale: 2.8 });
  calculator.rotation.x = Math.PI / 2;
  calculator.position.set(0.5, 2.1, -0.2);
  const hero = kit.props.character({
    variant: 'hero',
    accessories: ['headphones'],
    scale: 1.25,
  });
  hero.position.set(-2.2, 0, 0.6);
  hero.rotation.y = 1.25;
  const labels = HACKS.map((hack, index) => {
    const at = anchor(hack.phrase).t;
    sfx.at(at, 'click');
    const label = kit.fx.label3d({
      text: hack.text,
      height: 0.32,
      color: hack.color,
      plate: true,
      align: 'left',
      at,
    });
    label.position.set(2.1, 3 - index * 0.7, 0.4);
    return label;
  });
  scene.add(sky, grid, cubes, calculator, hero, ...labels);
  const point = hero.animate({
    clip: 'point',
    from: anchor(HACKS[0].phrase).t - 0.4,
    fadeIn: 0.4,
    target: calculator,
  });
  return { sky, grid, cubes, calculator, labels, point };
}

export function update(t, s, ctx) {
  ctx.camera.orbit({
    target: [0.7, 1.7, 0],
    radius: 7.6,
    height: 0.6,
    degrees: [8, -10],
    ease: 'easeInOutSine',
  })(t);
  s.sky.update(t);
  s.grid.update(t);
  s.cubes.update(t);
  s.calculator.position.y = 2.1 + 0.12 * Math.sin(t * 1.6);
  s.calculator.update(t);
  s.point(t);
  s.labels.forEach((label) => label.update(t));
}
