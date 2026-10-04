/**
 * Look `paper-cutout` (PLAN.md#12.6): layered paper pieces with torn edges, paper grain and soft
 * dithered drop shadows on a multiplane stage with real parallax, moving on a stop-motion clock.
 * Composited into palette indices on the CPU (stage.ts), so every frame goes through the shared
 * Crisp 640 post pass already on the palette.
 */
import { defineLook } from '../types.js';
import { paperBuildings } from './city.js';
import { paperCard, paperLabel, paperSign } from './labels.js';
import { paperClouds } from './clouds.js';
import { paperHills, paperTrees } from './landscape.js';
import { paperPuppet } from './puppet.js';
import { paperRoom } from './room.js';
import { paperStack } from './stack.js';
import { paperStage } from './stage.js';

const DOCS = `Look \`paper-cutout\`: a handmade paper theatre. Torn and cut paper pieces on up to five depth layers over a paper sky, soft dithered drop shadows, real parallax and stop-motion movement (poses change 8 times a second). For warm storytelling, places, characters, metaphors and title cards.
- ONE set per shot: \`const stage = kit.env.paperStage({ size: [ctx.shot.width, ctx.shot.height], backdrop: 'dusk' })\`, \`scene.add(stage)\`. backdrop day | dusk | night | kraft | paper (plain sheets for desks and cards); scenery hills | city | none; \`layers\` 1-4 built-in strips; light 'low' (shadows rise above each layer: landscapes) or 'high' (they fall down-right: rooms, desks, walls).
- Pieces go ON the stage, never scene.add: \`stage.place(kit.props.paperPuppet({ pose: 'wave' }), { layer: 4, x: 320, y: 300 })\`. Layers 1 (far) .. 5 (near), 0 = pasted on the sky; x, y in 640x360 px (strips: y = ridge or street line; puppets and signs: y = ground under them; cards, labels, stacks: their centre). At most 5 layers in use and 4 moving pieces.
- Pieces: \`paperHills\`, \`paperTrees\`, \`paperClouds\`, \`paperBuildings\` (strips across the frame), \`paperRoom\` (toy-theatre room filling the frame: layer 2, light 'high', backdrop 'paper', scenery 'none'; puppets at layer 4, y 290-320), \`paperPuppet\` (pose idle | wave | walk | talk | point | cheer; \`walk: { from, to, start, end }\` crosses the set), \`paperSign\` / \`paperLabel\` (place names in pixel caps), \`paperCard\` (title strip: \`title\`, \`subtitle\`, slides in at \`at\`), \`paperStack\` (photos and documents dealt one by one; \`asset: ctx.assets.image('<id>')\` puts a real picture on top).
- update(t) every frame: \`state.stage.update(t); ctx.camera.set(state.stage.camera({ t }));\`. Camera: slow lateral parallax only: \`camera({ t, pan })\` with pan in px of the middle layer, |pan| <= 60 over the shot (e.g. \`pan: -30 + 12 * t\`), or \`ctx.camera.parallax({ amount: 0.3-0.6, t0, t1 })\` after set. Never orbit, dolly, push in or tilt: the paper is drawn 1:1 in frame pixels.
- Times (\`at\`, walk \`start\`/\`end\`) are seconds: resolve spoken phrases with ctx.anchor in build. Marks: \`ctx.annotate.*\` on piece anchors (\`{ object: puppet, anchor: 'hand' }\`, room items 'window', 'shelf', stack 'photo') or \`stage.point(layer, x, y)\`. Put ctx.text on a calm area (sky band, a paperCard), never over the puppet.
Example: \`const stage = kit.env.paperStage({ size: [ctx.shot.width, ctx.shot.height], backdrop: 'day' }); const kid = stage.place(kit.props.paperPuppet({ walk: { from: 80, to: 300, start: 0, end: 3 }, pose: 'wave' }), { layer: 4, y: 330 }); stage.place(kit.props.paperSign({ text: 'SCHOOL' }), { layer: 4, x: 500, y: 330 });\``;

export const paperCutoutLook = defineLook({
  id: 'paper-cutout',
  label: 'Paper cut-out',
  description:
    'layered paper cut-out sets (hills, city, rooms) with a jointed paper puppet, signs and title strips; soft shadows, parallax and stop-motion movement',
  rolls: ['A', 'B', 'C'],
  treatments: [
    'metaphor-object',
    'character-scene',
    '3d-reconstruction',
    'title-card',
    'montage/transition',
  ],
  docs: DOCS,
  soundPalette: 'paper-cutout',
  variationBudget: 'paper-cutout',
  available: true,
  kit: {
    env: [paperStage],
    props: [
      paperHills,
      paperTrees,
      paperClouds,
      paperBuildings,
      paperRoom,
      paperPuppet,
      paperSign,
      paperLabel,
      paperCard,
      paperStack,
    ],
  },
});
