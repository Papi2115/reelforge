// s04 · counter/odometer: "The original game needed four megabytes. Here, everything has to fit in
// 61 KB." An odometer rolls up to 4,096 KB on "four megabytes", then a second one rolls all the
// way down and lands on 61 KB with a burst, over a teal neon grid.
export const meta = { id: 's04', title: 'From 4 MB down to 61 KB', treatment: 'counter/odometer' };

const COUNTER_Y = 2.2;

export function build(ctx) {
  const { kit, scene, three, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'neon' }));
  const sky = kit.env.sky({ style: 'night', stars: 160 });
  const grid = kit.env.neonGrid({ variant: 'teal', scroll: 1.5 });
  const cubes = kit.env.floatingCubes({ count: 28, area: [20, 5, 10], clear: 4, seed: 7 });
  cubes.position.set(0, 0.5, -5);
  const needed = anchor('four megabytes');
  const here = anchor('Here');
  const fit = anchor('61 KB', 2);
  const up = kit.fx.counter({
    from: 0,
    to: 4096,
    start: anchor('original game').t,
    end: needed.tEnd,
    height: 1,
    color: 'hero',
    digits: 4,
    format: { separator: ',', suffix: ' KB' },
  });
  const down = kit.fx.counter({
    from: 4096,
    to: 61,
    start: here.t,
    end: fit.t,
    ease: 'easeInOutCubic',
    height: 1,
    color: 'accent3',
    digits: 4,
    format: { separator: ',', suffix: ' KB' },
  });
  up.position.y = COUNTER_Y;
  down.position.y = COUNTER_Y;
  const burst = kit.fx.shardExplosion({
    origin: [0, COUNTER_Y, 0.3],
    at: fit.t,
    count: 90,
    seed: 5,
    spread: 1,
    speed: [2, 5],
    gravity: 4,
    colors: ['accent3', 'accent1', 'text'],
  });
  scene.add(sky, grid, cubes, up, down, burst);
  sfx.at(needed.t, 'tick');
  sfx.at(fit.t, 'hit');
  return { sky, grid, cubes, up, down, burst, here, intro: anchor('The original').t };
}

export function update(t, s, ctx) {
  ctx.camera.orbit({
    target: [0, COUNTER_Y - 0.2, 0],
    radius: 7.5,
    height: 0.2,
    degrees: [-16, 10],
    ease: 'easeInOutSine',
  })(t);
  s.sky.update(t);
  s.grid.update(t);
  s.cubes.update(t);
  s.up.visible = t < s.here.t;
  s.down.visible = !s.up.visible;
  s.up.update(t);
  s.down.update(t);
  s.burst.update(t);
  ctx.text.title('DOOM NEEDED', {
    id: 'needed',
    at: s.intro,
    until: s.here.t,
    pos: [0.5, 0.18],
    scale: 3,
  });
  ctx.text.title('A CALCULATOR HAS', {
    id: 'has',
    at: s.here.t,
    pos: [0.5, 0.18],
    scale: 3,
    color: 'accent3',
  });
}
