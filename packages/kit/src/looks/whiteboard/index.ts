/**
 * Look `whiteboard` (PLAN.md#12.7): hand-drawn explainer boards. A hand with a marker draws
 * strokes, doodles, diagrams and handwriting over time on a framed whiteboard; an eraser wipes it.
 * Every board is a pixel-exact 2D raster (board.ts) through the same post pass as every look, and
 * every stroke can land on its spoken phrase.
 */
import { defineLook } from '../types.js';
import { whiteboardBoard } from './backdrop.js';
import { whiteboardCounter } from './counter.js';
import { whiteboardDiagram } from './diagram.js';
import { DOODLE_NAMES } from './doodles.js';
import { whiteboardSketch } from './sketch.js';
import { whiteboardText } from './text.js';

const DOCS = `Look \`whiteboard\`: a hand-drawn explainer: a hand with a marker draws on a framed off-white whiteboard (black, blue, red, green ink; handwritten pixel caps). Each template is a full-frame board: create ONE in build(), \`scene.add\` it, call \`board.update(t)\` in update(t). Always pass \`size: [ctx.shot.width, ctx.shot.height]\` and, when any time is a spoken phrase, \`anchor: ctx.anchor\`. Boards ignore the camera; voxel objects, \`ctx.text\` and \`ctx.annotate\` draw on top. Coordinates are 640x360-frame pixels.
- \`kit.fx.whiteboardSketch\`: \`strokes\` drawn in order, each a string or { draw, at, duration, color, id }. Shapes: \`line x1 y1 x2 y2 ...\`, \`curve x1 y1 cx cy x2 y2\`, \`arrow x1 y1 x2 y2\` (6 numbers = curved), \`box x y w h [r]\`, \`circle cx cy r [ry]\`, \`bracket x1 y1 x2 y2\`, \`underline x y w\`, \`zigzag x1 y1 x2 y2\`, \`hatch x y w h\`, \`dot x y\`, \`write x y TEXT\` (centred label); doodles \`<name> cx cy [size=100]\`: ${DOODLE_NAMES.join(', ')}. A trailing ink name colours a string: \`'arrow 200 180 420 180 red'\`.
- \`kit.fx.whiteboardText\`: \`lines\` written glyph by glyph (strings or { text, at }), \`emphasis\` [{ word, style: underline/double/circle/box/strike, at }].
- \`kit.fx.whiteboardDiagram\`: \`kind: 'flow'\` (\`nodes\` { id, label, shape box/circle/cloud/none or doodle, at }, \`edges\` default a chain, layout auto/row/column/cycle), \`'timeline'\` (\`events\` { label, caption, at }), \`'equation'\` (\`terms\`: 'IDEA', '+', { doodle: 'coin' }, '=', ...).
- \`kit.fx.whiteboardCounter\`: \`values\` [{ value, at }] written large, each crossing out the one before, the last circled; \`label\`.
- \`kit.env.whiteboardBoard\`: bare board / title card (\`headline\`, \`subline\`, extra \`strokes\`).
Shared: \`title\` (handwritten heading), \`pen\` hand/marker/none, \`color\`, \`grid\` none/dots/lines, \`erase\` [{ at }] wipes everything drawn before it (draw the next idea on the clean board), \`start\`, \`speed\`. Sync: \`board.strokeTime(i)\` gives { t, tEnd } of item i (for ctx.sfx), \`board.stroke(i)\` / \`board.point('id')\` are ctx.annotate targets.
Rules: time strokes to the words (\`at\` = the phrase that names the thing); at most 12 strokes per beat (erase or cut for the next idea); keep drawings inside the central safe area (x 40-600, y 40-310; the tray is at the bottom); one idea per board, labels short (<= 16 characters); use red/blue for the one thing that matters, black for the rest; write numbers and words the narration says, never filler.`;

export const whiteboardLook = defineLook({
  id: 'whiteboard',
  label: 'Whiteboard',
  description:
    'hand-drawn whiteboard explainer: a hand draws doodles, arrows, flow charts, timelines and handwriting in marker on a whiteboard, synced to the words',
  rolls: ['B', 'C'],
  treatments: [
    'metaphor-object',
    'node-graph/timeline',
    'counter/odometer',
    'kinetic-text',
    'title-card',
  ],
  docs: DOCS,
  soundPalette: 'whiteboard',
  variationBudget: 'whiteboard',
  available: true,
  kit: {
    env: [whiteboardBoard],
    templates: [whiteboardSketch, whiteboardText, whiteboardDiagram, whiteboardCounter],
  },
});
