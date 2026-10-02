// s07 · title-card (closing): "If it has a screen, it runs Doom." The headline pops in over the
// dusk neon grid; "DOOM" lands on its spoken word with a hit and a shard burst behind the
// spinning calculator, then the camera slowly pulls out.
export const meta = {
  id: 's07',
  title: 'If it has a screen, it runs Doom',
  treatment: 'title-card',
};

export function build(ctx) {
  const { kit, scene, three, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'neon' }));
  const sky = kit.env.sky({ style: 'dusk', stars: 140 });
  const grid = kit.env.neonGrid({ variant: 'violet', scroll: 1 });
  const cubes = kit.env.floatingCubes({ count: 36, area: [18, 5, 12], clear: 4, seed: 5 });
  cubes.position.set(0, 0.6, -4);
  const calculator = kit.props.calculator({ screen: 'doom', seed: 2, scale: 1.9 });
  calculator.rotation.x = Math.PI / 2;
  calculator.position.set(0, 0.6, 0);
  const doom = anchor('Doom', 2);
  const burst = kit.fx.shardExplosion({
    origin: [0, 1.6, -0.8],
    at: doom.t,
    count: 50,
    seed: 9,
    spread: 0.55,
    speed: [2.5, 5.5],
    colors: ['hero', 'accent2', 'heroTrim'],
  });
  scene.add(sky, grid, cubes, calculator, burst);
  sfx.at(doom.t, 'hit');
  return { sky, grid, cubes, calculator, burst, start: anchor('If it has').t, doom };
}

export function update(t, s, ctx) {
  ctx.camera.pushIn({
    target: [0, 1.5, 0],
    dist: [5.2, 7],
    direction: [0, 0.18, 1],
    ease: 'easeInOutSine',
  })(t);
  s.sky.update(t);
  s.grid.update(t);
  s.cubes.update(t);
  s.calculator.rotation.y = 0.6 * Math.sin(t * 0.9);
  s.calculator.update(t);
  s.burst.update(t);
  ctx.text.title('IF IT HAS A SCREEN,', {
    id: 'headline',
    at: s.start,
    pos: [0.5, 0.16],
    scale: 3,
  });
  ctx.text.title('IT RUNS DOOM', {
    id: 'punchline',
    at: s.doom.t,
    pos: [0.5, 0.84],
    scale: 4,
    color: 'hero',
    enter: 'shake',
  });
}
