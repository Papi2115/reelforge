// Kit 3D infographics (PLAN.md#3.4): bar chart, node graph, timeline. One setup per effect,
// picked by FX; the render tests swap the FX line.
// Follows the scene contract: no imports, update() poses everything absolutely from t.
export const meta = {
  id: 'k05',
  title: 'Kit effects: 3D infographics',
  treatment: 'data-chart-3d',
};

// Setup under test; the render tests swap this line.
const FX = 'bars';

const SETUPS = {
  bars: {
    camera: { target: [0, 1, 0], radius: 9, height: 1.6, degrees: [-14, 10] },
    build(kit) {
      const chart = kit.fx.bars3d({
        data: [
          { label: 'Doom', value: 3 },
          { label: 'Calculator', value: 12 },
          { label: 'Fridge', value: 35 },
          { label: 'Pregnancy test', value: 20 },
          { label: 'Laptop', value: 60 },
        ],
        start: 0.4,
        barWidth: 0.9,
        gap: 0.7,
        values: { suffix: 'FPS' },
      });
      const title = kit.fx.label3d({ text: 'DOOM FRAME RATES', height: 0.32, color: 'textDim' });
      title.position.set(0, 3.95, 0);
      return [kit.env.sky({ style: 'dusk' }), chart, title];
    },
  },
  graph: {
    camera: { target: [0, 0.2, 0], radius: 8, height: 0.8, degrees: [-8, 8] },
    build(kit) {
      const graph = kit.fx.nodeGraph({
        nodes: [
          { id: 'id', label: 'id Software', position: [-3, 1.4], labelSide: 'above' },
          { id: 'wad', label: 'WAD files', position: [0, 2], labelSide: 'above' },
          { id: 'src', label: 'Source code', position: [-3, -1.4] },
          { id: 'port', label: 'Ports', position: [0, -0.6] },
          { id: 'calc', label: 'Calculator', position: [3, 1.2], labelSide: 'above' },
          { id: 'fridge', label: 'Fridge', position: [3, -1.6] },
        ],
        edges: [
          { from: 'id', to: 'wad' },
          { from: 'id', to: 'src' },
          { from: 'src', to: 'port' },
          { from: 'wad', to: 'port' },
          { from: 'port', to: 'calc' },
          { from: 'port', to: 'fridge' },
        ],
        start: 0.3,
        stagger: 0.3,
        highlights: [
          { id: 'port', at: 3 },
          { id: 'port>calc', at: 3 },
        ],
      });
      return [kit.env.sky({ style: 'night', stars: 60 }), graph];
    },
  },
  timeline: {
    camera: { target: [0, 0.5, 0], radius: 7.2, height: 1, degrees: [-10, 6] },
    build(kit) {
      const timeline = kit.fx.timeline3d({
        items: [
          { label: 'Doom', caption: '1993' },
          { label: 'Source released', caption: '1997' },
          { label: 'Ports everywhere', caption: '2000s' },
          { label: 'Calculator', caption: '2014' },
          { label: 'Pregnancy test', caption: '2020' },
        ],
        start: 0.3,
        drawTime: 3.5,
        length: 9,
      });
      return [kit.env.sky({ style: 'dusk' }), timeline];
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[FX];
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  const objects = setup.build(kit);
  scene.add(...objects);
  return { setup, objects };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({ ...state.setup.camera, to: 6, ease: 'easeInOutSine' })(t);
  state.objects.forEach((object) => object.update(t));
}
