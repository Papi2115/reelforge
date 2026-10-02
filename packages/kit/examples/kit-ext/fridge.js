// Project-local prop (kit-ext/props/fridge.js, PLAN.md#7.4): the reference fixture of the prop
// module contract - used by the kit/engine/CLI/stage tests and as the example in the docs.
export const prop = {
  name: 'fridge',
  description:
    'Kitchen fridge (~0.9 x 1.8 x 0.8 units), freezer on top, the lower door opens; front faces +z.',
  params: {
    body: { type: 'color', default: 'heroTrim', description: 'Body colour' },
    open: {
      type: 'number',
      default: 0,
      min: 0,
      max: 1,
      description: 'Lower door opening 0..1 when built',
    },
  },
  anchors: { handle: 'front of the lower door handle (door closed)' },
  methods: { 'open(k)': 'lower door opening 0..1; set it every frame when animating' },
  build(ctx, params) {
    const { voxel } = ctx.kit;
    const s = 1 / 22;
    const body = voxel
      .sketch([20, 40, 17], {
        shell: params.body,
        inner: 'groundAlt',
        trim: 'textDim',
        foot: 'outline',
      })
      .box('shell', [0, 1, 0], [20, 40, 16])
      .paint('inner', [1, 2, 15], [19, 26, 16])
      .paint('trim', [0, 26, 15], [20, 27, 16])
      .box('trim', [16, 30, 16], [18, 37, 17]);
    for (const [x, z] of [
      [1, 1],
      [17, 1],
      [1, 13],
      [17, 13],
    ]) {
      body.box('foot', [x, 0, z], [x + 2, 1, z + 2]);
    }
    const door = voxel
      .sketch([20, 25, 2], { shell: params.body, trim: 'textDim' })
      .box('shell', [0, 0, 0], [20, 25, 1])
      .box('trim', [16, 8, 1], [18, 18, 2]);
    const fridge = voxel.group({ anchors: { handle: [7 * s, 14 * s, 10 * s] } });
    const bodyMesh = voxel.mesh(body.model(), { voxelSize: s, pivot: 'corner' });
    bodyMesh.position.set(-10 * s, 0, -8 * s);
    const hinge = voxel.group();
    hinge.position.set(-10 * s, s, 8 * s);
    hinge.add(voxel.mesh(door.model(), { voxelSize: s, pivot: 'corner' }));
    fridge.add(bodyMesh, hinge);
    const open = (k) => {
      hinge.rotation.y = -1.9 * Math.min(1, Math.max(0, k));
    };
    open(params.open);
    return Object.assign(fridge, { open });
  },
};
