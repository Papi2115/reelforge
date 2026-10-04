/**
 * Look `flat-2d` (PLAN.md#12.5): flat 2D motion graphics (shapes, icons, infographics, kinetic
 * type, lower thirds) painted as pixel-exact boards (board.ts) in palette tones, through the same
 * post pass as every look. Reveals land on spoken phrases; everything is a pure function of t.
 */
import { defineLook } from '../types.js';
import { flatIcons } from './icons.js';
import { flatInfographic } from './infographic.js';
import { flatKinetic } from './kinetic.js';
import { flatLowerThird } from './lower-third.js';
import { flatShapes } from './shapes.js';
import { flatStage } from './stage-env.js';

const DOCS = `Look \`flat-2d\` (B and C rolls): clean flat motion graphics in palette tones: shapes, pixel icons, infographics, kinetic type, lower thirds. Use it for explainer beats (a concept as icons, a step list, a percentage, A vs B, a big number, a phrase that must land) where blueprint would be too technical (blueprint = charts, maps, schematics, timelines from data) and retro-ui too "on a screen" (retro-ui = proof in a window, terminal, document). Every template is a full-frame board: create it in build(), \`scene.add\` it, call \`board.update(t)\` in update(t); always pass \`size: [ctx.shot.width, ctx.shot.height]\` and \`anchor: ctx.anchor\` when a time is a phrase. Boards ignore the camera; stack them with \`layer\` (later boards use \`stage: 'none'\` to stay transparent). Shared params: \`tone\` (indigo, violet, teal, night, wine, cream), \`stage\` (solid, gradient, spot, stripes, dots, grid, checker, rays, none), \`drift\`.
- \`kit.env.flatStage\`: the backdrop alone (pattern + floating \`decor\` on the edges), under \`ctx.text\` titles or voxel objects.
- \`kit.fx.flatShapes\`: \`shapes: [{ kind, x, y, w, h?, color, label?, at, enter, idle, out, morph: [{ at, kind?, x?, w?, color? }] }]\` (circle, rect, pill, triangle, diamond, hexagon, star, plus, ring, line, arrow with \`points\`); a metaphor in shapes, a shape turning into another on the word.
- \`kit.fx.flatIcons\`: \`icons: [{ name, x, y, scale, badge, label, at, enter }]\`; 26 icons: person, gear, lightbulb, lock, cloud, phone, chart, star, arrow, check, cross, heart, clock, globe, magnifier, document, envelope, battery, wifi, coin, rocket, shield, camera, play, bolt, flag.
- \`kit.fx.flatInfographic\`: \`kind\` icons (steps with captions, connector) / progress (bars) / ring (gauges) / versus (2 cards + VS) / stat (big count-up numbers); \`items: [{ label, value, icon, at }]\`, \`title\`, \`prefix\`/\`suffix\`, \`max\`.
- \`kit.fx.flatKinetic\`: \`text: 'THIS CHANGED / *EVERYTHING*'\` (words on \`stagger\`, "/" breaks, *word* gets \`mark\`) or \`words: [{ text, at: 'phrase', effect, mark, color, br }]\`; effects pop, slide, drop, shake, type, fade; marks underline, plate, box, strike.
- \`kit.fx.flatLowerThird\`: \`name\`, \`caption\`, \`icon\`, \`at\`, \`out\`; overlay over any shot (also voxel).
Entrances: pop, scale, slide-left/right/up/down, drop, spin, wipe, fade, none; idles: float, pulse, spin, wobble.
Rules: one idea per board and at most 6 elements on screen at once; keep everything inside the 5 % safe area (x 32-608, y 18-342 in frame pixels; the templates' own layouts already do); land each element on the word that names it (\`at: 'phrase'\`), stagger the rest 0.2-0.4 s, hold the finished board >= 1 s; one accent colour carries the point (\`primary\` by default), the rest stays in the tone; labels short (<= 14 characters), numbers only from the narration or \`research.md\`. Point \`ctx.annotate\` at \`board.target('item:1')\` (\`shape:<i>\`, \`icon:<i>\`, \`word:<i>\`, \`name\`), never over the content for long. Put \`ctx.text\` only where the board leaves room (flatStage, or above/below a single row).`;

export const flat2dLook = defineLook({
  id: 'flat-2d',
  label: 'Flat 2D motion graphics',
  description:
    'flat 2D motion graphics: shapes, pixel icons, infographics (steps, bars, gauges, versus, big numbers), kinetic type and lower thirds',
  rolls: ['B', 'C'],
  treatments: [
    'kinetic-text',
    'title-card',
    'metaphor-object',
    'counter/odometer',
    'data-chart-3d',
    'node-graph/timeline',
  ],
  docs: DOCS,
  soundPalette: 'flat-2d',
  variationBudget: 'flat-2d',
  available: true,
  kit: {
    env: [flatStage],
    templates: [flatShapes, flatIcons, flatInfographic, flatKinetic, flatLowerThird],
  },
});
