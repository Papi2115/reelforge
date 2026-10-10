/**
 * Look `ink-scene` (world Grim Ink / c-cam, look A, PLAN.md#14.2): the scene. A specific, grimy
 * place drawn in uneven ink on the full-frame ink stage; people, faces and the cut camera arrive
 * in later tasks (14.4-14.6). Every look of the world brings the same `inkStage` fx, so any one
 * of them can be the only look of a project (PLAN.md#14.12).
 */
import { defineLook } from '../../../../looks/types.js';
import { inkStage } from '../../stage.js';
import { C_CAM_ID, C_CAM_VARIATION } from '../../style.js';

const DOCS = `Look \`ink-scene\` (world Grim Ink, A roll): the scene, one specific grimy place per shot. Build ONE \`const stage = ctx.kit.fx.inkStage()\`, \`ctx.scene.add(stage)\`; in update(t) call \`stage.paint(t, (g, env) => { ... })\` and draw everything from scratch (canvas px, 1920x1080).
- Draw with the brushes only: \`env.brush.blob(pts, env.C.CLAY, { mottle, hatch, shade })\` for every shape, \`env.brush.inkLine(pts, { w })\` for lines (width swells 0.4-1.9x; never uniform strokes); silhouettes w 7-8, details 3-4.
- Palette: muddy olive/clay/grey-blue/mustard/rust/plum from \`env.C\`; whites are dirty linen, darks are ink; one warm light pool per place; ONE accent object per shot.
- Grime as flat shapes (crescents, mottle, hatch clusters, stains, cracks); no gradients, textures, filters or text.
- Motion on twos (\`env.time.twos(t)\`), seeded with \`env.time.hash\`; never Math.random.`;

export const inkSceneLook = defineLook({
  id: 'ink-scene',
  label: 'Ink scene',
  description:
    'a specific grimy place in uneven hand ink and muddy full colour on a 1080p canvas: flat grime shapes, one warm light pool, one accent object',
  rolls: ['A'],
  treatments: ['character-scene', 'metaphor-object'],
  docs: DOCS,
  soundPalette: 'voxel',
  variationBudget: C_CAM_VARIATION,
  available: true,
  styles: [C_CAM_ID],
  experimental: true,
  kit: { fx: [inkStage] },
});
