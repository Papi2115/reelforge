// Assets as scene elements (PLAN.md#12.11): the same picture ('test-card', the synthetic test
// photo the render tests ship in the manifest) embedded in the world of three looks - a framed
// print and a polaroid in a voxel room, a laptop and a monitor on a desk, a billboard, a retro
// newspaper and CRT, a diorama billboard and office screen. One setup per SETUP; the render tests
// swap the SETUP line. Follows the scene contract: no imports, update() poses everything from t.
export const meta = { id: 'k10', title: 'Assets in scenes', treatment: '3d-reconstruction' };

// Setup under test; the render tests swap this line.
const SETUP = 'wall';

const PHOTO = 'test-card';

/** The picture as a handle for kit props (build only; the id is written as a literal). */
function picture(ctx, options) {
  return ctx.assets.image(PHOTO, options);
}

const SETUPS = {
  wall: {
    build(ctx) {
      const { kit } = ctx;
      const room = kit.env.room();
      const photo = picture(ctx);
      const frame = kit.props.photoFrame({ asset: photo, pixels: 96 });
      room.mount(frame, 'backWall', { align: 'back', offset: [-1.6, 0.2, 0] });
      const bench = kit.env.bench();
      bench.position.set(1.2, 0, 0.6);
      room.add(bench);
      const instant = kit.props.polaroid({
        asset: photo,
        crop: { focus: [0.27, 0.55], zoom: 2 },
        caption: 'HOME',
        developAt: 1,
      });
      bench.mount(instant, 'spotLeft');
      return { objects: [room, frame, bench, instant], roots: [room] };
    },
    camera(ctx, t) {
      ctx.camera.pushIn({
        dist: [5.2, 4.2],
        target: [-0.9, 1.5, -1.2],
        direction: [0.12, 0.06, 1],
      })(t);
    },
  },
  laptop: {
    build(ctx) {
      const { kit } = ctx;
      const desk = kit.env.desk({ width: 2.6 });
      const photo = picture(ctx);
      const laptop = kit.props.assetScreen({
        asset: photo,
        device: 'laptop',
        revealAt: 0.4,
        revealTime: 1.2,
      });
      desk.mount(laptop, 'spotLeft');
      const monitor = kit.props.assetScreen({
        asset: photo,
        crop: { focus: [0.72, 0.27], zoom: 2.5 },
        scanlines: true,
        flicker: 0.4,
        seed: 3,
      });
      desk.mount(monitor, 'spotRight');
      return { objects: [desk, laptop, monitor], roots: [desk] };
    },
    camera(ctx, t) {
      ctx.camera.orbit({ target: [0, 1.1, 0], radius: 3.4, height: 1.9, degrees: [-12, 10] })(t);
    },
  },
  billboard: {
    build(ctx) {
      const { kit } = ctx;
      const city = kit.env.blockCity({ seed: 2 });
      const board = kit.props.billboard({ asset: picture(ctx), posts: 1 });
      board.position.set(0, 0, 2.5);
      return { objects: [city, board], roots: [city, board] };
    },
    camera(ctx, t) {
      ctx.camera.orbit({ target: [0, 2, 2.5], radius: 7, height: 1.4, degrees: [-18, 12] })(t);
    },
  },
  retro: {
    build(ctx) {
      const { kit } = ctx;
      const photo = picture(ctx);
      const desktop = kit.env.retroDesktop({ wallpaper: 'checker', accent: 'teal' });
      const paper = kit.props.retroDocument({
        variant: 'newspaper',
        title: 'THE DAILY BYTE',
        headline: 'HOUSE BY THE LAKE',
        asset: photo,
        caption: 'PHOTO: TEST CARD',
        size: [200, 250],
        stamp: { text: 'EVIDENCE', at: 1.5 },
      });
      paper.position.set(-1.5, 0, 0.02);
      const crt = kit.props.retroCrt({
        asset: photo,
        size: [128, 96],
        casing: 'monitor',
        powerOn: 0.6,
      });
      crt.position.set(1.9, -0.3, 0.3);
      return { objects: [desktop, paper, crt], roots: [desktop, paper, crt], hero: paper };
    },
    camera(ctx, t, state) {
      const d = state.hero.fitDistance(1.4);
      ctx.camera.set({ position: [0.2, 0, d], target: [0.2, 0, 0], fov: 50 });
    },
  },
  diorama: {
    build(ctx) {
      const city = ctx.kit.env.dioramaCity({ seed: 4, billboard: picture(ctx) });
      return { objects: [city], roots: [city], diorama: city, focus: 'billboard', zoom: 3 };
    },
  },
  office: {
    build(ctx) {
      const office = ctx.kit.env.dioramaOffice({ seed: 3, screen: picture(ctx, { dither: 0.8 }) });
      return {
        objects: [office],
        roots: [office],
        diorama: office,
        focus: 'whiteboard',
        zoom: 2.4,
      };
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  const state = SETUPS[SETUP].build(ctx);
  if (!state.diorama) scene.add(kit.env.lights({ preset: 'default' }));
  scene.add(...state.roots);
  return state;
}

export function update(t, state, ctx) {
  state.objects.forEach((object) => object.update(t));
  if (state.diorama) {
    const screen = [ctx.shot.width, ctx.shot.height];
    ctx.camera.set(state.diorama.camera({ t, screen, zoom: state.zoom, focus: state.focus }));
    return;
  }
  SETUPS[SETUP].camera(ctx, t, state);
}
