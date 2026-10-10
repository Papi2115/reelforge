/**
 * Look `ink-poster` (world Grim Ink / c-cam, look C, PLAN.md#14.2): the poster. A title or the line
 * of the film as a hand-inked poster on the ink stage (the stroke lettering of PLAN.md#14.7 joins
 * it through the stage later). Self-contained: it brings its own `inkStage` fx.
 */
import { defineLook } from '../../../../looks/types.js';
import { inkStage } from '../../stage.js';
import { C_CAM_ID, C_CAM_VARIATION } from '../../style.js';

const DOCS = `Look \`ink-poster\` (world Grim Ink, C roll): the poster, the title card or the line the film turns on as a hand-inked poster. Same stage as every Grim Ink look: \`const stage = ctx.kit.fx.inkStage()\`, \`ctx.scene.add(stage)\`, \`stage.paint(t, (g, env) => { ... })\` every frame.
- Screen space, no camera: one emblem of THIS narration drawn big and off-centre (\`env.brush.blob\`) on a flat field of one mud colour, thick uneven ink (w 12-18), a worn border.
- The words (at most 6, exactly as narrated) in the poster capitals, bone fill and rust extrusion, thudding in letter by letter on twos (\`reelforge kit-docs ink-lettering\`); two or three colours from \`env.C\`; no gradients, no fonts, no ctx.text.
- It lands with a thud on its phrase (a short shake on twos) and then holds still for at least 0.6 s.`;

export const inkPosterLook = defineLook({
  id: 'ink-poster',
  label: 'Ink poster',
  description:
    'a hand-inked poster for a title or the loud line: one big emblem on a flat mud field, thick uneven ink, two or three colours',
  rolls: ['C'],
  treatments: ['title-card', 'montage/transition'],
  docs: DOCS,
  soundPalette: 'c-cam',
  variationBudget: C_CAM_VARIATION,
  available: true,
  styles: [C_CAM_ID],
  experimental: true,
  kit: { fx: [inkStage] },
});
