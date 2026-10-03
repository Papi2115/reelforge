/**
 * `reelforge kit-docs prop-module`: how to write a project prop (`kit-ext/props/<name>.js`,
 * PLAN.md#7.4) - the contract the engine and `reelforge lint` enforce, scale rules and an example.
 */
import { PROP_PARAM_TYPES } from '@reelforge/kit';

export const PROP_MODULE_TOPIC = 'prop-module';

const EXAMPLE = `// kit-ext/props/mailbox.js
export const prop = {
  name: 'mailbox',                       // = file name, camelCase, not a kit prop name
  description: 'Street mailbox on a post (~0.5 x 1.3 units); the flag rises with raise(k).',
  params: {
    body: { type: 'color', default: 'accent2', description: 'Box colour' },
    flag: { type: 'number', default: 0, min: 0, max: 1, description: 'Flag raised 0..1' },
  },
  anchors: { slot: 'mail slot on the front' },
  methods: { 'raise(k)': 'flag 0..1; set it every frame when animating' },
  build(ctx, params) {
    const { voxel } = ctx.kit;
    const s = 1 / 24;                                    // voxel size: 24 voxels = 1 unit
    const box = voxel
      .sketch([12, 31, 16], { post: 'groundAlt', body: params.body, slot: 'outline' })
      .box('post', [5, 0, 6], [7, 20, 8])                // post, rests on y = 0
      .box('body', [0, 20, 0], [12, 31, 16])             // touches the post: nothing floats
      .paint('slot', [3, 27, 15], [9, 28, 16]);          // detail painted on the surface
    const flag = voxel.sketch([1, 6, 2], { flag: 'accent1' }).box('flag', [0, 0, 0], [1, 6, 2]);
    const mailbox = voxel.group({ anchors: { slot: [0, 27.5 * s, 8 * s] } });
    mailbox.add(voxel.mesh(box.model(), { voxelSize: s }));       // pivot: bottom centre
    const arm = voxel.group();
    arm.position.set(6 * s, 22 * s, 0);
    arm.add(voxel.mesh(flag.model(), { voxelSize: s, pivot: 'corner' }));
    mailbox.add(arm);
    const raise = (k) => { arm.rotation.z = -1.5 * Math.min(1, Math.max(0, k)); };  // absolute
    raise(params.flag);
    return Object.assign(mailbox, { raise });
  },
};`;

export function propModuleDocs(): string {
  return [
    'Project prop modules: kit-ext/props/<name>.js -> ctx.kit.props.<name>(params) in every scene',
    '  Use one when the kit has no fitting prop (reelforge kit-docs lists them; project props are marked project-local).',
    '  export const prop = { name, description, params, anchors, methods, build(ctx, params) } and nothing else.',
    '  name/description/params/anchors/methods are LITERAL values (the docs read them without running code).',
    `  params: { <name>: { type: ${PROP_PARAM_TYPES.map((type) => `'${type}'`).join(' | ')}, description, default, ... } }`,
    "    number: min?, max?, integer?; enum: values: ['a', 'b']; string: maxLength?; color: a palette name. Every param needs a default.",
    '    `scale` (uniform size, default 1) is added to every prop automatically - do not declare it.',
    '  build(ctx, params): ctx = { kit: { voxel }, palette, rng } - only ctx.kit.voxel (sketch, fromGrid, generate, box, merge, mirror, mesh, group).',
    '    No imports, no Date/Math.random/timers/fetch (use ctx.rng), no module-level variables written by functions.',
    '    Return ONE kit object (voxel.group() holding voxel.mesh(...) parts). Same params -> same object, every time.',
    '  Scale: 1 unit = 1 m-ish; the hero character is 2 units tall, a desk ~1 unit high, a phone 0.95.',
    '    Draw 24-64 voxels along the largest side (voxelSize = size in units / voxels); largest side 0.3-4 units.',
    '    Front faces +z (towards the default camera), y is up, the bottom rests on y = 0 (pivot: bottom centre).',
    '  Colours: palette tokens (hero, heroTrim, accent1-4, ground, groundAlt, text, textDim, outline, shadow ...);',
    "    { color: 'accent1', glow: true } for screens/lamps. 2-4 colours, paint details (seams, labels, handles).",
    '  Structure: every part touches another part or the ground (no floating voxels or meshes).',
    '  Anchors: custom points via voxel.group({ anchors: { name: [x, y, z] } }) or object.setAnchor(name, [x, y, z]).',
    '  Methods: animation hooks set state ABSOLUTELY from their argument (open(k) sets the angle for k, never adds).',
    'Check it: reelforge lint kit-ext/props/<name>.js, then reelforge prop-preview <name> and Read the sheet:',
    '  it must read as the object from every angle, nothing cut off or floating, colours from the style.',
    'Example:',
    EXAMPLE,
  ].join('\n');
}
