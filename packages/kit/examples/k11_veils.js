// Open-loop veils (PLAN.md#12.26): the answer stays covered until the closing phrase, then a
// dither wipe reveals it - a question-mark crate over a globe (voxel), a CLASSIFIED slip on the
// retro desktop (retro-ui) and a masked value on a blueprint board. Revealed at t = 2 s over
// 0.6 s. One setup per SETUP; the render tests swap the SETUP line. Follows the scene contract:
// no imports, update() poses everything absolutely from t.
export const meta = { id: 'k11', title: 'Open-loop veils', treatment: 'metaphor-object' };

// Setup under test; the render tests swap this line.
const SETUP = 'voxel';

const REVEAL_AT = 2;

const SETUPS = {
  voxel: {
    build(ctx) {
      const { kit, scene } = ctx;
      const room = kit.env.room();
      const veil = kit.props.veiledProp({ size: [1.2, 1.25, 1.2], revealAt: REVEAL_AT });
      const globe = kit.props.globe({ scale: 1 });
      veil.cover(globe);
      veil.position.set(0, 0, 0.4);
      room.add(veil);
      scene.add(kit.env.lights({ preset: 'default' }), room);
      return { objects: [room, veil, globe] };
    },
    camera(ctx, t) {
      ctx.camera.pushIn({ dist: [4.2, 3.6], target: [0, 0.6, 0.4], direction: [0.25, 0.3, 1] })(t);
    },
  },
  retro: {
    build(ctx) {
      const { kit, scene } = ctx;
      const desktop = kit.env.retroDesktop({ wallpaper: 'checker', accent: 'violet' });
      const slip = kit.props.redactedBlock({
        text: 'A GLASS PRISM',
        label: 'CLASSIFIED',
        caption: 'NEWTON, 1672',
        revealAt: REVEAL_AT,
        size: [210, 96],
      });
      slip.position.set(0, 0, 0.02);
      scene.add(desktop, slip);
      return { objects: [desktop, slip], hero: slip };
    },
    camera(ctx, t, state) {
      const d = state.hero.fitDistance(2) + state.hero.position.z;
      ctx.camera.set({ position: [0, 0, d], target: [0, 0, 0], fov: 50 });
    },
  },
  blueprint: {
    build(ctx) {
      const board = ctx.kit.fx.maskedRegion({
        size: [ctx.shot.width, ctx.shot.height],
        title: 'WHAT DID NEWTON USE?',
        text: 'PRISM',
        caption: 'CAMBRIDGE, 1672',
        revealAt: REVEAL_AT,
      });
      ctx.scene.add(board);
      return { objects: [board] };
    },
    camera() {},
  },
};

export function build(ctx) {
  const { three, scene, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  return SETUPS[SETUP].build(ctx);
}

export function update(t, state, ctx) {
  state.objects.forEach((object) => object.update(t));
  SETUPS[SETUP].camera(ctx, t, state);
}
