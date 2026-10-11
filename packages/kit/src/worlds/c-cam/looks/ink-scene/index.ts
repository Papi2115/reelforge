/**
 * Look `ink-scene` (world Grim Ink / c-cam, look A, PLAN.md#14.2, docs 14.10): the scene. The
 * film's own people in a specific, grimy place, drawn in uneven ink on the full-frame ink stage
 * and framed by a cut table; the docs point at the world's `reelforge kit-docs ink-*` topics.
 * Every look of the world brings the same `inkStage` fx, so any one of them can be the only look
 * of a project (PLAN.md#14.12).
 */
import { defineLook } from '../../../../looks/types.js';
import { inkStage } from '../../stage.js';
import { C_CAM_ID, C_CAM_VARIATION } from '../../style.js';

const DOCS = `Look \`ink-scene\` (world Grim Ink, A roll): the scene, the film's own people acting in one specific grimy place. Build ONE \`const stage = ctx.kit.fx.inkStage()\`, \`ctx.scene.add(stage)\`; in update(t) repaint it from scratch with \`stage.paint(t, (g, env) => { ... })\` (canvas px, 1920x1080). The world's docs: \`reelforge kit-docs grim-ink\`.
- Camera first: a cut table of 2-5 framings on the narration's beats (wide, extreme close-up of the object, close-up of the reaction, over-the-shoulder), zoom 0.8-5.4, Dutch tilt 2-7 deg only on tense beats (\`reelforge kit-docs ink-camera\`).
- Then the place, the warm light pool behind the people, the props, the people back to front (the film's own, by id: \`reelforge kit-docs people\` and \`places\`), foreground pieces; contacts solved in world space before the camera.
- Ink brushes only (\`reelforge kit-docs ink-brushes\`): the uneven ink line (width swells 0.4-1.9x, never uniform), blobs with shade crescents, mottle and hatching; muddy olive/clay/grey-blue/mustard/rust/plum from \`env.C\`, dirty whites, ink darks, ONE accent object per shot; grime as flat shapes, never gradients, textures or filters.
- Acting on twos (\`env.time.twos(t)\`), expressions snap, holds >= 0.4 s; words only as ink lettering from the narration (\`reelforge kit-docs ink-lettering\`), never ctx.text or Math.random.`;

export const inkSceneLook = defineLook({
  id: 'ink-scene',
  label: 'Ink scene',
  description:
    'a specific grimy place in uneven hand ink and muddy full colour on a 1080p canvas: flat grime shapes, one warm light pool, one accent object',
  rolls: ['A'],
  treatments: ['character-scene', 'metaphor-object'],
  docs: DOCS,
  soundPalette: 'c-cam',
  variationBudget: C_CAM_VARIATION,
  available: true,
  styles: [C_CAM_ID],
  experimental: true,
  kit: { fx: [inkStage] },
});
