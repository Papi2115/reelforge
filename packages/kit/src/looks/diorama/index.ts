/**
 * Look `diorama` (PLAN.md#12.3): isometric "tiny world on a plate" environments: a tiled
 * floating platform with cut-away walls and small voxel objects, an iso camera preset, own
 * lights per time of day and a dithered base shadow, all through the shared Style post-fx.
 */
import { defineLook } from '../types.js';
import { dioramaCity } from './city.js';
import { dioramaOffice } from './office.js';
import { dioramaRoom } from './room.js';
import { dioramaServerRoom } from './server-room.js';

const DOCS = `Look \`diorama\`: an isometric miniature on a floating plate (model-railway feel), for places, establishing shots and "how it works inside" illustrations.
- Pick one diorama env: \`kit.env.dioramaOffice\`, \`dioramaServerRoom\`, \`dioramaCity\`, \`dioramaRoom\`. Params: \`seed\`, \`accent\` (palette name of screens/LEDs/highlights), \`density\` (0..1 optional props), \`time\` ('day' | 'dusk' | 'night').
- The diorama brings its own lights: do NOT add \`kit.env.lights\`. Background: \`scene.background = new three.Color(palette.sky)\` or \`kit.env.sky({ style: 'void' })\`.
- Camera: always the iso preset, every frame: \`ctx.camera.set(diorama.camera({ t }))\`. \`offset: [-0.18, 0]\` puts the plate on the left third (text on the right); \`zoom: 1.8, focus: 'desk1'\` pushes in on an anchor (animate zoom by t for a push-in). Never orbit or tilt; the pan drift and the props' idle animation keep it alive.
- Call \`diorama.update(t)\` every frame (LEDs, screens, cars, walkers, smoke); server room: \`room.alarm(amount)\` (red alert) every frame before update.
- Point at things with \`ctx.annotate.*\` on its anchors (\`{ object: diorama, anchor: 'rack2' }\`, listed in kit-docs) or on moving parts (\`diorama.part('car0')\`). Keep marks on the free side of the plate.
- Scale: one floor tile = 1 unit, a figure is 1.4 units. Extra kit props go on anchors (\`kit.props.phone({ scale: 0.5 }).on(diorama, { at: 'desk1' })\`); never build a second floor or big props next to it.`;

export const dioramaLook = defineLook({
  id: 'diorama',
  label: 'Isometric diorama',
  description:
    'isometric tiled dioramas (office, server room, city block, room) seen from above, like a model',
  rolls: ['A', 'B'],
  treatments: ['3d-reconstruction', 'metaphor-object', 'character-scene', 'map'],
  docs: DOCS,
  soundPalette: 'diorama',
  variationBudget: 'diorama',
  available: true,
  kit: { env: [dioramaOffice, dioramaServerRoom, dioramaCity, dioramaRoom] },
});
