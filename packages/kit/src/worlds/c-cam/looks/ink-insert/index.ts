/**
 * Look `ink-insert` (world Grim Ink / c-cam, look B, PLAN.md#14.2): the insert. An extreme
 * close-up of the gag object or a document, drawn big on the ink stage. Self-contained: it brings
 * its own `inkStage` fx (the same definition the other looks share).
 */
import { defineLook } from '../../../../looks/types.js';
import { inkStage } from '../../stage.js';
import { C_CAM_ID, C_CAM_VARIATION } from '../../style.js';

const DOCS = `Look \`ink-insert\` (world Grim Ink, B roll): the insert, an extreme close-up of the thing the narration names (a gauge, a hand-written ledger, a stamped form, a worn tool). Same stage as every Grim Ink look: \`const stage = ctx.kit.fx.inkStage()\`, \`ctx.scene.add(stage)\`, \`stage.paint(t, (g, env) => { ... })\` every frame.
- The object fills 60-80 % of the frame, off-centre, with a foreground edge (table, sleeve) for depth; ink widths scale up (w 10-14 for the silhouette).
- Its wear tells the story: dents, peeled paint, stains, a crack, drawn with \`env.brush.blob\` crescents, mottle and hatch.
- One accent colour on the detail that matters; numbers or words only as ink marks from the narration, never fonts.
- Holds are long and still; the change happens on twos (\`env.time.twos(t)\`).`;

export const inkInsertLook = defineLook({
  id: 'ink-insert',
  label: 'Ink insert',
  description:
    'an extreme close-up of the gag object or a document in uneven hand ink: worn, stained, one accent on the detail that matters',
  rolls: ['B'],
  treatments: ['metaphor-object', 'counter/odometer'],
  docs: DOCS,
  soundPalette: 'voxel',
  variationBudget: C_CAM_VARIATION,
  available: true,
  styles: [C_CAM_ID],
  experimental: true,
  kit: { fx: [inkStage] },
});
