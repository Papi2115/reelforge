// s06 · ui-mockup: "And there it is: demons and shotguns, on a calculator screen." A giant
// calculator floats over the neon grid among cubes; the camera cranes over it and pushes into the
// running Doom screen, which flickers on "demons" and "shotguns".
export const meta = { id: 's06', title: 'Doom on the calculator screen', treatment: 'ui-mockup' };

const FLASH_S = 0.35;

export function build(ctx) {
  const { kit, scene, three, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'neon' }));
  const sky = kit.env.sky({ style: 'night', stars: 200 });
  const grid = kit.env.neonGrid({ variant: 'violet', scroll: 2 });
  const cubes = kit.env.floatingCubes({ count: 46, area: [16, 4, 16], clear: 3.2, seed: 33 });
  cubes.position.y = 0.4;
  const calculator = kit.props.calculator({ screen: 'doom', seed: 2, scale: 2.6 });
  calculator.position.set(0, 1.2, 0);
  scene.add(sky, grid, cubes, calculator);
  scene.updateMatrixWorld(true);
  const screenAt = calculator.localToWorld(calculator.anchor('screen')).toArray();
  const hits = [anchor('demons').t, anchor('shotguns').t];
  hits.forEach((t) => sfx.at(t, 'glitch'));
  return { sky, grid, cubes, calculator, screenAt, hits, reveal: anchor('there it is').t };
}

function flash(t, hits) {
  return hits.reduce((level, at) => {
    const k = (t - at) / FLASH_S;
    return k < 0 || k > 1 ? level : Math.max(level, 1 - k);
  }, 0);
}

export function update(t, s, ctx) {
  const [x, y, z] = s.screenAt;
  ctx.camera.dolly({
    start: [x + 3.2, y + 4.2, z + 5.2],
    end: [x + 0.3, y + 2.8, z + 1.6],
    target: [x, y - 0.4, z + 0.6],
    targetEnd: [x, y, z],
    ease: 'easeInOutCubic',
  })(t);
  s.sky.update(t);
  s.grid.update(t);
  s.cubes.update(t);
  s.calculator.rotation.y = 0.18 * Math.sin(t * 0.7);
  s.calculator.screen.glitch(0.8 * flash(t, s.hits));
  s.calculator.update(t);
  ctx.text.lowerThird('IT RUNS DOOM', 'demons and shotguns, on a calculator screen', {
    id: 'reveal',
    at: s.reveal,
    side: 'right',
    scale: 2,
  });
}
