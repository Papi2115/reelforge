// Kit environments (PLAN.md#3.2): one setup per environment of ctx.kit.env, picked by ENV.
// The render tests swap the ENV line to render every setup into the contact sheet; the default
// is the synthwave look of the reference (violet neon grid under a dusk sky).
// Follows the scene contract: no imports, update() poses everything absolutely from t.
export const meta = { id: 'k03', title: 'Kit environments', treatment: 'metaphor-object' };

// Setup under test; the contact-sheet test swaps this line.
const ENV = 'neonGridViolet';

/** A 0.75-unit crate (hero colour) as a scale and placement reference. */
function crate(kit) {
  return kit.voxel.mesh(kit.voxel.box([6, 6, 6], 'hero'));
}

const SETUPS = {
  neonGridViolet: {
    lights: 'neon',
    camera: { target: [0, 1.4, 0], radius: 9, height: 2.2, degrees: [-12, 12] },
    build(kit) {
      const grid = kit.env.neonGrid({ variant: 'violet', scroll: 2 });
      crate(kit).on(grid);
      return [kit.env.sky({ style: 'dusk' }), grid];
    },
  },
  neonGridTeal: {
    lights: 'neon',
    camera: { target: [0, 1.6, 0], radius: 9, height: 2.6, degrees: [-20, 5] },
    build(kit) {
      return [
        kit.env.sky({ style: 'night', stars: 160 }),
        kit.env.neonGrid({ variant: 'teal', scroll: (t) => 1.5 * t + 0.4 * Math.sin(t) }),
      ];
    },
  },
  neonGridNavy: {
    lights: 'neon',
    camera: { target: [0, 1.5, 0], radius: 10, height: 3, degrees: [10, -10] },
    build(kit) {
      return [
        kit.env.sky({ style: 'void', stars: 120 }),
        kit.env.neonGrid({ variant: 'navy', scroll: 1, horizonColor: 'groundAlt' }),
        kit.env.floatingCubes({ count: 14, area: [14, 4, 14], clear: 3, seed: 2 }),
      ];
    },
  },
  skyDawn: {
    lights: 'soft',
    camera: { target: [0, 3.5, 0], radius: 8, height: 1.2, degrees: [-6, 6] },
    build(kit) {
      return [
        kit.env.sky({ style: 'dawn', dither: 0.9 }),
        kit.env.floatingCubes({ count: 10, area: [10, 6, 10], clear: 2, seed: 5 }),
      ];
    },
  },
  desk: {
    lights: 'default',
    camera: { target: [0, 0.8, 0], radius: 4.2, height: 2.4, degrees: [-25, 15] },
    build(kit) {
      const desk = kit.env.desk();
      desk.mount(crate(kit), 'spotRight');
      return [desk];
    },
  },
  bench: {
    lights: 'default',
    camera: { target: [0, 0.8, 0], radius: 4.8, height: 2.2, degrees: [20, -10] },
    build(kit) {
      const bench = kit.env.bench();
      bench.mount(crate(kit), 'spotLeft');
      return [bench];
    },
  },
  room: {
    lights: 'default',
    camera: { target: [0, 1.6, 0], radius: 10, height: 5, degrees: [20, 40] },
    build(kit) {
      const room = kit.env.room();
      crate(kit).on(room);
      return [room];
    },
  },
  blockCity: {
    lights: 'default',
    camera: { target: [0, 0.5, 0], radius: 16, height: 9, degrees: [-30, 0] },
    build(kit) {
      return [kit.env.sky({ style: 'dusk' }), kit.env.blockCity({ seed: 7 })];
    },
  },
  floatingCubes: {
    lights: 'neon',
    camera: { target: [0, 2, 0], radius: 9, height: 2.5, degrees: [0, 30] },
    build(kit) {
      return [
        kit.env.sky({ style: 'night', stars: 80 }),
        kit.env.floatingCubes({ count: 40, area: [12, 5, 12], clear: 1.5 }),
      ];
    },
  },
  void: {
    lights: 'dramatic',
    camera: { target: [0, 0.8, 0], radius: 8, height: 1.5, degrees: [-20, 20] },
    build(kit) {
      const stage = kit.env.void({ seed: 3 });
      crate(kit).on(stage);
      return [stage];
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[ENV];
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: setup.lights }));
  const envs = setup.build(kit);
  scene.add(...envs);
  return { setup, envs };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({ ...state.setup.camera, to: 6, ease: 'easeInOutSine' })(t);
  state.envs.forEach((env) => env.update(t));
}
