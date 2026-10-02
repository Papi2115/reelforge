// Golden output of the prop-build eval (en-short-prism): a glass prism standing on a dark base.
export const prop = {
  name: 'prism',
  description:
    'Triangular glass prism (~0.6 units) on a dark base, triangle facing the camera; pale glass, glowing edges.',
  params: {
    glass: { type: 'color', default: 'heroTrim', description: 'Glass colour' },
    edge: { type: 'color', default: 'accent1', description: 'Glowing edge colour' },
  },
  anchors: { face: 'centre of the front triangle (where light enters)' },
  methods: {},
  build(ctx, params) {
    const { voxel } = ctx.kit;
    const s = 1 / 40;
    const sketch = voxel.sketch([24, 26, 16], {
      base: 'groundAlt',
      glass: params.glass,
      edge: { color: params.edge, glow: true },
    });
    sketch.box('base', [0, 0, 0], [24, 2, 16]);
    for (let y = 2; y < 26; y += 1) {
      const half = Math.max(1, Math.round(((25 - y) * 12) / 23));
      sketch.box('glass', [12 - half, y, 2], [12 + half, y + 1, 14]);
      sketch.paint('edge', [12 - half, y, 13], [13 - half, y + 1, 14]);
      sketch.paint('edge', [11 + half, y, 13], [12 + half, y + 1, 14]);
    }
    sketch.paint('edge', [0, 2, 13], [24, 3, 14]);
    const prism = voxel.group({ anchors: { face: [0, 10 * s, 7 * s] } });
    prism.add(voxel.mesh(sketch.model(), { voxelSize: s }));
    return prism;
  },
};
