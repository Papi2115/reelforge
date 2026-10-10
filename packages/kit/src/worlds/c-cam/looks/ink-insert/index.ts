/**
 * Look `ink-insert` (world Grim Ink / c-cam, look B, PLAN.md#14.2): the insert. An extreme
 * close-up of the gag object or a document, drawn big on the ink stage. Self-contained: it brings
 * its own `inkStage` fx (the same definition the other looks share).
 */
import { defineLook } from '../../../../looks/types.js';
import { inkStage } from '../../stage.js';
import { C_CAM_ID, C_CAM_VARIATION } from '../../style.js';

const DOCS = `Look \`ink-insert\` (world Grim Ink, B roll): the insert, an extreme close-up of the one thing the narration names (a gauge, a hand-written ledger, a stamped form, a worn tool, a coin in a palm). Same stage as every Grim Ink look: \`const stage = ctx.kit.fx.inkStage()\`, \`ctx.scene.add(stage)\`, \`stage.paint(t, (g, env) => { ... })\` every frame.
- The object fills 60-80 % of the frame, off-centre, with a foreground edge (a table, a sleeve, a hand solved onto it) for depth; the ink scales with the zoom (2.4-5.4 in a cut table, \`reelforge kit-docs ink-camera\`), silhouettes stay the thickest lines.
- Its wear tells the story: dents, peeled paint, stains, a crack, as blob crescents, mottle and hatching (\`reelforge kit-docs ink-brushes\`).
- One accent colour on the detail that matters; numbers or words only as hand lettering from the narration (\`reelforge kit-docs ink-lettering\`), never fonts.
- Holds are long and still; the change lands on twos (\`env.time.twos(t)\`) on its phrase.`;

export const inkInsertLook = defineLook({
  id: 'ink-insert',
  label: 'Ink insert',
  description:
    'an extreme close-up of the gag object or a document in uneven hand ink: worn, stained, one accent on the detail that matters',
  rolls: ['B'],
  treatments: ['metaphor-object', 'counter/odometer'],
  docs: DOCS,
  soundPalette: 'c-cam',
  variationBudget: C_CAM_VARIATION,
  available: true,
  styles: [C_CAM_ID],
  experimental: true,
  kit: { fx: [inkStage] },
});
