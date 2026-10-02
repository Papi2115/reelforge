// Kit animated map (PLAN.md#3.4): a stylised voxel map with a route drawing in and pins
// dropping where it passes. One setup per region, picked by FX; the render tests swap the FX
// line. Follows the scene contract: no imports, update() poses everything absolutely from t.
export const meta = { id: 'k05', title: 'Kit effects: animated map', treatment: 'map' };

// Setup under test; the render tests swap this line.
const FX = 'europe';

const SETUPS = {
  europe: {
    camera: { target: [0, 0, 0.3], radius: 4.2, height: 8.2, degrees: [-6, 6] },
    build(kit) {
      return kit.fx.mapAnimated({
        region: 'europe',
        coords: 'lonlat',
        width: 8,
        route: [
          [-3.7, 40.4],
          [2.35, 48.86],
          [13.4, 52.5],
          [21.0, 52.2],
        ],
        pins: [
          { at: [-3.7, 40.4], label: 'Madrid' },
          { at: [2.35, 48.86], label: 'Paris' },
          { at: [13.4, 52.5], label: 'Berlin' },
          { at: [21.0, 52.2], label: 'Warsaw', color: 'accent2' },
        ],
        start: 0.5,
        end: 3.5,
      });
    },
  },
  generic: {
    camera: { target: [0, 0, 0.4], radius: 6.5, height: 6, degrees: [10, -10] },
    build(kit) {
      return kit.fx.mapAnimated({
        region: 'generic',
        seed: 3,
        route: [
          [0.3, 0.6],
          [0.45, 0.35],
          [0.7, 0.45],
        ],
        pins: [
          { at: [0.3, 0.6], label: 'Base' },
          { at: [0.7, 0.45], label: 'Target', color: 'accent2' },
        ],
      });
    },
  },
  islands: {
    camera: { target: [0, 0, 0.4], radius: 6.5, height: 6, degrees: [-10, 10] },
    build(kit) {
      return kit.fx.mapAnimated({
        region: 'islands',
        seed: 8,
        route: [
          [0.2, 0.3],
          [0.5, 0.55],
          [0.8, 0.4],
        ],
        pins: [{ at: [0.8, 0.4], label: 'X' }],
      });
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[FX];
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  const map = setup.build(kit);
  scene.add(map);
  return { setup, map };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({ ...state.setup.camera, to: 6, ease: 'easeInOutSine' })(t);
  state.map.update(t);
}
