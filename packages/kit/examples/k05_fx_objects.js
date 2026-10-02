// Kit object effects (PLAN.md#3.4): shard burst, voxel dissolve out/in, glitch, light flicker.
// One setup per effect, picked by FX; the render tests swap the FX line to render every setup.
// Follows the scene contract: no imports, update() poses everything absolutely from t.
export const meta = { id: 'k05', title: 'Kit effects: objects', treatment: 'montage/transition' };

// Setup under test; the render tests swap this line.
const FX = 'shards';

/** A 10x16x8 server tower: dark case, glowing status rows, a hero-coloured badge. */
function towerModel(kit) {
  return kit.voxel.generate(
    [10, 16, 8],
    (x, y, z) => {
      const front = z === 7;
      if (front && x >= 2 && x <= 7 && y % 3 === 1 && y > 2 && y < 14) return x === 7 ? 4 : 3;
      if (front && x >= 3 && x <= 6 && y === 14) return 5;
      return x === 0 || x === 9 || y === 0 || y === 15 ? 2 : 1;
    },
    [
      'textDim',
      'groundAlt',
      { color: 'accent1', glow: true },
      { color: 'accent2', glow: true },
      'hero',
    ],
  );
}

const SETUPS = {
  shards: {
    lights: 'neon',
    camera: { target: [0, 1.2, 0], radius: 7.5, height: 1.8, degrees: [-15, 10] },
    build(kit) {
      const grid = kit.env.neonGrid({ variant: 'violet' });
      const crate = kit.voxel.mesh(kit.voxel.box([8, 8, 8], 'hero'));
      crate.on(grid);
      const burst = kit.fx.shardExplosion({ origin: [0, 0.5, 0], at: 1, count: 90, seed: 2 });
      return {
        objects: [kit.env.sky({ style: 'night', stars: 80 }), grid, burst],
        pose: (t) => {
          crate.visible = t < 1;
        },
      };
    },
  },
  dissolve: {
    lights: 'default',
    camera: { target: [0, 1.1, 0], radius: 7, height: 1.5, degrees: [-10, 10] },
    build(kit) {
      const floor = kit.env.void({ seed: 4 });
      const leaving = kit.voxel.mesh(towerModel(kit));
      leaving.position.x = -1.4;
      floor.add(leaving);
      const arriving = kit.voxel.mesh(towerModel(kit));
      arriving.position.x = 1.4;
      floor.add(arriving);
      const out = kit.fx.dissolve({ object: leaving, start: 0.5, end: 3.5, direction: 'down' });
      const into = kit.fx.dissolve({
        object: arriving,
        mode: 'in',
        start: 0.5,
        end: 3.5,
        direction: 'up',
        seed: 1,
      });
      return { objects: [floor, out, into] };
    },
  },
  glitch: {
    lights: 'dramatic',
    camera: { target: [0, 1.1, 0], radius: 5.5, height: 1.2, degrees: [-12, 12] },
    build(kit) {
      const floor = kit.env.void({ seed: 6 });
      const tower = kit.voxel.mesh(towerModel(kit));
      floor.add(tower);
      const fx = kit.fx.glitch({ object: tower, start: 1, end: 3, density: 1, seed: 3 });
      return { objects: [floor, fx] };
    },
  },
  flicker: {
    lights: 'soft',
    camera: { target: [0, 1.4, 0], radius: 6, height: 0.8, degrees: [-8, 8] },
    build(kit, ctx) {
      const stage = kit.env.void({ seed: 1 });
      const dim = kit.fx.label3d({
        text: 'OPEN 24/7',
        height: 0.6,
        color: 'groundAlt',
        glow: false,
      });
      const lit = kit.fx.label3d({ text: 'OPEN 24/7', height: 0.6, color: 'accent2' });
      dim.position.set(0, 2.2, -0.03);
      lit.position.set(0, 2.2, 0);
      const neon = kit.fx.flicker({
        pattern: 'neon',
        rate: 3,
        seed: 4,
        targets: [lit],
        light: { color: 'accent2', intensity: 8, distance: 6 },
      });
      neon.position.set(0, 2.2, 0.8);
      const crate = kit.voxel.mesh(kit.voxel.box([6, 6, 6], 'heroTrim'));
      crate.on(stage);
      const candle = kit.fx.flicker({
        pattern: 'candle',
        rate: 4,
        light: { color: 'keyLight', intensity: 5, distance: 4 },
      });
      candle.position.set(1.2, 0.8, 1);
      ctx.scene.background = new ctx.three.Color(ctx.palette.shadow);
      return { objects: [stage, dim, lit, neon, candle] };
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[FX];
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: setup.lights }));
  const built = setup.build(kit, ctx);
  // Object effects already took their object's place in its parent.
  scene.add(...built.objects.filter((object) => !object.parent));
  return { setup, built };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({ ...state.setup.camera, to: 6, ease: 'easeInOutSine' })(t);
  state.built.objects.forEach((object) => object.update(t));
  if (state.built.pose) state.built.pose(t);
}
