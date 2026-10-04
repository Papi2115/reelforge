/**
 * Look `voxel` (ReelForge 1.x, unchanged): the existing voxel kit — kit.voxel, kit.env,
 * kit.props, kit.fx — exactly as before looks existed. It is the A-roll anchor of a mixed film.
 */
import { ENV_DEFINITIONS } from '../../env/index.js';
import { FX_DEFINITIONS } from '../../fx/index.js';
import { PROP_DEFINITIONS } from '../../props/index.js';
import { defineLook } from '../types.js';

export const VOXEL_LOOK_ID = 'voxel';

const DOCS = `Look \`voxel\`: chunky voxel 3D built with the kit (\`reelforge kit-docs\`): \`kit.voxel\` models, \`kit.env\` worlds (neon grid, room, city, void), \`kit.props\` objects and characters, \`kit.fx\` effects (counters, charts, maps, glitch, text). One hero object on a third, depth (foreground, hero, background), camera always moving, lighting from \`kit.env.lights\`. Real photos (B-roll, evidence) live inside the world: \`const photo = ctx.assets.image('<asset id>')\` in build(), then \`kit.props.photoFrame({ asset: photo })\` (wall, \`mount: 'stand'\` on a desk), \`polaroid\` (\`developAt\`), \`billboard\` (street) or \`assetScreen\` (monitor/laptop, \`revealAt\`, scanlines); never a flat full-frame photo. Follow the style bible; never hand-pick hex colours.`;

export const voxelLook = defineLook({
  id: VOXEL_LOOK_ID,
  label: 'Voxel 3D',
  description:
    'chunky voxel 3D worlds with a moving camera: characters, places, objects, reconstructions, 3D charts and counters (the anchor of the film)',
  rolls: ['A', 'B', 'C'],
  treatments: [
    '3d-reconstruction',
    'character-scene',
    'metaphor-object',
    'title-card',
    'kinetic-text',
    'montage/transition',
    'data-chart-3d',
    'counter/odometer',
    'map',
    'node-graph/timeline',
    'ui-mockup',
  ],
  docs: DOCS,
  soundPalette: 'voxel',
  variationBudget: 'voxel',
  available: true,
  kit: { env: ENV_DEFINITIONS, props: PROP_DEFINITIONS, fx: FX_DEFINITIONS },
});
