// Ambient variation (PLAN.md#12.8): one voxel shot per setup, written once and reused for many
// shots. With ambientVariation on, the kit environments drift from shot to shot by themselves
// (tones, horizon, grid density, debris, light turn, camera drift); nothing here varies by hand.
// The render tests swap the SETUP line. Follows the scene contract: no imports, pure update(t).
export const meta = { id: 'k07', title: 'Ambient variation', treatment: 'metaphor-object' };

// Setup under test; the render test swaps this line.
const SETUP = 'grid';

/** A 1-unit crate in the hero colour with a trim band: the subject that must stay constant. */
function crate(kit) {
  return kit.voxel.mesh(
    kit.voxel.generate([8, 8, 8], (x, y) => (y === 5 ? 2 : 1), ['hero', 'heroTrim']),
  );
}

const SETUPS = {
  grid: {
    lights: 'neon',
    camera: { target: [0, 1.2, 0], radius: 8, height: 2, degrees: [-14, 10] },
    build(kit) {
      const grid = kit.env.neonGrid({ variant: 'violet', scroll: 1.5 });
      crate(kit).on(grid);
      return [kit.env.sky({ style: 'dusk' }), grid];
    },
  },
  night: {
    lights: 'neon',
    camera: { target: [0, 1.4, 0], radius: 9, height: 2.4, degrees: [12, -8] },
    build(kit) {
      const grid = kit.env.neonGrid({ variant: 'teal', scroll: 1 });
      crate(kit).on(grid);
      const cubes = kit.env.floatingCubes({ count: 18, area: [16, 4, 16], clear: 3, seed: 1 });
      cubes.position.y = 1.5;
      return [kit.env.sky({ style: 'night', stars: 120 }), grid, cubes];
    },
  },
  void: {
    lights: 'dramatic',
    camera: { target: [0, 0.8, 0], radius: 8, height: 1.5, degrees: [-18, 12] },
    build(kit) {
      const stage = kit.env.void({ seed: 2 });
      crate(kit).on(stage);
      return [stage];
    },
  },
  city: {
    lights: 'default',
    camera: { target: [0, 0.6, 0], radius: 15, height: 8, degrees: [-30, -10] },
    build(kit) {
      return [kit.env.sky({ style: 'dusk' }), kit.env.blockCity({ seed: 7, blocks: 4 })];
    },
  },
  room: {
    lights: 'default',
    camera: { target: [0, 1.6, 0], radius: 10, height: 5, degrees: [22, 34] },
    build(kit) {
      const room = kit.env.room();
      crate(kit).on(room);
      return [room];
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit, ambient } = ctx;
  const setup = SETUPS[SETUP];
  // The clear colour follows the shot's tones like the kit environments do.
  scene.background = new three.Color(palette[ambient.tone('navy')] ?? palette.sky);
  scene.add(kit.env.lights({ preset: setup.lights }));
  const envs = setup.build(kit);
  scene.add(...envs);
  return { setup, envs };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({ ...state.setup.camera, to: 6, ease: 'easeInOutSine' })(t);
  state.envs.forEach((env) => env.update(t));
}
