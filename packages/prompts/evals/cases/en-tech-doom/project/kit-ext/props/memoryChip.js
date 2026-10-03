// Golden output of the prop-build eval (en-tech-doom): a RAM stick standing on its contacts.
export const prop = {
  name: 'memoryChip',
  description:
    'RAM memory stick (~1.2 x 0.36 units) standing on its edge: green board, four black chips, gold contacts.',
  params: {
    board: { type: 'color', default: 'accent3', description: 'Circuit board colour' },
    chips: { type: 'number', default: 4, min: 1, max: 8, integer: true, description: 'Chips' },
  },
  anchors: { label: 'centre of the first chip' },
  methods: {},
  build(ctx, params) {
    const { voxel } = ctx.kit;
    const s = 1 / 40;
    const sketch = voxel.sketch([48, 15, 4], {
      board: params.board,
      chip: 'outline',
      gold: 'hero',
      notch: 'groundAlt',
    });
    sketch.box('board', [0, 0, 1], [48, 15, 2]);
    for (let x = 1; x < 47; x += 2) sketch.paint('gold', [x, 0, 1], [x + 1, 2, 2]);
    sketch.box(null, [22, 0, 1], [24, 2, 2]);
    const width = Math.floor(44 / params.chips);
    for (let index = 0; index < params.chips; index += 1) {
      const x = 2 + index * width;
      sketch.box('chip', [x, 4, 2], [x + width - 2, 13, 3]);
      sketch.box('chip', [x, 4, 0], [x + width - 2, 13, 1]);
    }
    const stick = voxel.group({ anchors: { label: [(2 + width / 2 - 24) * s, 8.5 * s, 3 * s] } });
    stick.add(voxel.mesh(sketch.model(), { voxelSize: s }));
    return stick;
  },
};
