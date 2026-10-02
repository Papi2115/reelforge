// Style presets (PLAN.md#3.5): one composite shot - dusk sky over the violet neon grid, a desk
// with the calculator and a hero crate, floating cubes, a title and a lower third. The render
// tests draw the same code at the same t in every style preset (Crisp 640, Noir Voxel, Soft 480)
// to compare palettes, lighting and text plates. Colours are tokens or kit defaults only.
// Follows the scene contract: no imports, update() poses everything absolutely from t.
export const meta = { id: 'k09', title: 'Style comparison', treatment: 'metaphor-object' };

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights());
  const sky = kit.env.sky({ style: 'dusk', stars: 60 });
  const grid = kit.env.neonGrid({ variant: 'violet', scroll: 0.5 });
  const desk = kit.env.desk({ width: 3.2, depth: 1.6 });
  const calculator = kit.props.calculator({ screen: 'doom' });
  desk.mount(calculator, 'spotLeft');
  desk.mount(kit.voxel.mesh(kit.voxel.box([5, 5, 5], 'hero')), 'spotRight');
  const cubes = kit.env.floatingCubes({ count: 18, area: [16, 3, 6], clear: 2, seed: 9 });
  cubes.position.set(0, 0.6, -5);
  scene.add(sky, grid, desk, cubes);
  return { envs: [sky, grid, cubes], calculator };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({
    target: [0, 1.3, 0],
    radius: 6,
    height: 1.5,
    degrees: [-28, -8],
    to: 6,
    ease: 'easeInOutSine',
  })(t);
  state.envs.forEach((env) => env.update(t));
  state.calculator.update(t);
  ctx.text.title('ONE SCENE, THREE STYLES', {
    id: 'title',
    at: 0,
    pos: [0.5, 0.16],
    enter: 'none',
  });
  ctx.text.lowerThird('Calculator', 'runs DOOM at 3 fps', { id: 'name', at: 0, enter: 'none' });
}
