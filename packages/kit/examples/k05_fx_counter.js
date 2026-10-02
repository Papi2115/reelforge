// Kit text effects (PLAN.md#3.4): odometer counters, typewriter block, ticker band, glitching
// screen. One setup per effect, picked by FX; the render tests swap the FX line.
// Follows the scene contract: no imports, update() poses everything absolutely from t.
export const meta = {
  id: 'k05',
  title: 'Kit effects: counters and text',
  treatment: 'counter/odometer',
};

// Setup under test; the render tests swap this line.
const FX = 'counter';

const SETUPS = {
  counter: {
    lights: 'neon',
    camera: { target: [0, 1.7, 0], radius: 7, height: 0.4, degrees: [-10, 8] },
    build(kit) {
      const memory = kit.fx.counter({
        from: 0,
        to: 1024,
        start: 0.5,
        end: 3.5,
        height: 0.8,
        format: { suffix: 'KB' },
      });
      memory.position.y = 2.7;
      const money = kit.fx.counter({
        from: 0,
        to: 12500.75,
        start: 0.5,
        end: 3.5,
        height: 0.6,
        color: 'accent2',
        format: { prefix: '$', decimals: 2 },
      });
      money.position.y = 0.75;
      return [kit.env.sky({ style: 'night', stars: 60 }), kit.env.neonGrid(), memory, money];
    },
  },
  typewriter: {
    lights: 'default',
    camera: { target: [0, 1.5, 0], radius: 5.5, height: 0.2, degrees: [-6, 6] },
    build(kit) {
      const block = kit.fx.typewriterBlock({
        lines: ['BOOTING DOOM...', 'LOADING WAD.... OK', 'RAM FREE: 32 KB', 'PRESS ANY KEY'],
        prompt: '> ',
        start: 0.3,
        cps: 16,
        height: 0.28,
      });
      block.position.y = 1.5;
      return [kit.env.sky({ style: 'void', stars: 40 }), block];
    },
  },
  ticker: {
    lights: 'default',
    camera: { target: [0, 1.3, 0], radius: 6, height: 0.3, degrees: [6, -6] },
    build(kit) {
      const title = kit.fx.label3d({ text: 'BREAKING', height: 0.7, color: 'hero', plate: true });
      title.position.set(-1.6, 2.3, 0);
      const band = kit.fx.ticker({
        text: 'CALCULATOR RUNS DOOM AT 3 FPS',
        width: 7,
        height: 0.32,
        speed: 1.8,
      });
      band.position.y = 1.2;
      return [kit.env.sky({ style: 'dusk' }), title, band];
    },
  },
  screen: {
    lights: 'default',
    camera: { target: [0, 1.2, 0], radius: 4.2, height: 0.6, degrees: [-14, 10] },
    build(kit) {
      const desk = kit.env.desk();
      const monitor = kit.voxel.mesh(kit.voxel.box([18, 12, 2], 'groundAlt'));
      monitor.on(desk);
      const screen = kit.fx.screenGlitch({
        text: ['FATAL', 'ERROR'],
        columns: 32,
        rows: 20,
        size: [1.9, 1.2],
        start: 1,
        density: 0.6,
        seed: 2,
      });
      screen.position.set(0, 0.75, 0.15);
      monitor.add(screen);
      return [kit.env.sky({ style: 'night', stars: 40 }), desk, screen];
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[FX];
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: setup.lights }));
  const objects = setup.build(kit);
  scene.add(...objects.filter((object) => !object.parent));
  return { setup, objects };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({ ...state.setup.camera, to: 6, ease: 'easeInOutSine' })(t);
  state.objects.forEach((object) => object.update(t));
}
