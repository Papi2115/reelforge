// Golden output of the prop-build eval (pl-history-apollo): the Apollo lunar module.
export const prop = {
  name: 'lunarModule',
  description:
    'Apollo lunar module (~1.6 units): gold-foil descent stage on four legs, grey ascent cabin with a window.',
  params: {
    foil: { type: 'color', default: 'hero', description: 'Descent stage foil colour' },
    cabin: { type: 'color', default: 'textDim', description: 'Ascent cabin colour' },
  },
  anchors: { hatch: 'front hatch of the cabin' },
  methods: {},
  build(ctx, params) {
    const { voxel } = ctx.kit;
    const s = 1 / 24;
    const sketch = voxel.sketch([38, 36, 38], {
      foil: params.foil,
      cabin: params.cabin,
      window: { color: 'accent1', glow: true },
      leg: 'groundAlt',
      pad: 'textDim',
    });
    sketch.box('foil', [9, 8, 9], [29, 20, 29]);
    for (const [x, z, dx, dz] of [
      [1, 1, 1, 1],
      [35, 1, -1, 1],
      [1, 35, 1, -1],
      [35, 35, -1, -1],
    ]) {
      sketch.box('pad', [x - 1, 0, z - 1], [x + 2, 1, z + 2]);
      for (let step = 0; step < 9; step += 1) {
        const lx = x + dx * step;
        const lz = z + dz * step;
        const [x0, z0] = [Math.min(lx, lx + dx), Math.min(lz, lz + dz)];
        sketch.box('leg', [x0, 1 + step, z0], [x0 + 2, 3 + step, z0 + 2]);
      }
    }
    sketch.box('cabin', [12, 20, 12], [26, 32, 26]).box('cabin', [15, 32, 15], [23, 36, 23]);
    sketch.paint('window', [14, 26, 25], [18, 30, 26]).paint('window', [20, 26, 25], [24, 30, 26]);
    const lander = voxel.group({ anchors: { hatch: [0, 23 * s, 7 * s] } });
    lander.add(voxel.mesh(sketch.model(), { voxelSize: s }));
    return lander;
  },
};
