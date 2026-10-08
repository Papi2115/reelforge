/**
 * Look `comic-info` (Comic world, look B, PLAN.md#13.3): the explainer is still a comic page.
 * Cutaways of the real object, charts drawn as panel art, codes slammed like sound effects, a
 * hand-ticked checklist with the one correction that matters, rubber stamps and captions; the
 * rare sepia flashback (`page.flashback`, showcase shot 3) tells where a fact came from. Same
 * world-level `comicPage` template as looks A and C.
 */
import { defineLook } from '../../../../looks/types.js';
import { comicPage } from '../../page/comic-page.js';
import { COMIC_ID } from '../../style.js';

const DOCS = `Look \`comic-info\` (world Comic, B roll): the explainer is still a comic page. ONE \`const page = kit.fx.comicPage({ seed: N, anchor: ctx.anchor, duration: ctx.shot.duration })\`, \`scene.add(page)\`, lay it out in build(), \`page.update(t)\` in update(t). Page px 640x360.
- Cutaway: the object's real shape with its front cut open along \`page.util.torn(x0, y0, x1, y1, key)\` (ink the torn edge, the inside in a darker plate), named by hand with a kinked leader (\`g.text\` + \`g.ink(pts, { closed: false })\`).
- Charts are panel art: hand-ruled axes (\`g.line\`) with labels from the narration, ticks unevenly spaced, the data line drawn on (\`g.strokeOn(pts, p, 'ink', 2)\`), one red mark on the point.
- Proofs: a clipboard or card in its own panel, items ticked in pencil (\`page.tick\`, each different), a wrong word struck (\`page.strike\`) and corrected, \`page.highlight\` on the answer; a code or number slammed like a sound effect (\`g.bigLetter\`); \`page.stamp('CHECKED', { x, y, at })\`; \`page.caption\` carries the definition.
- Flashback (where a fact came from, at most one per ~60-90 s; a toolkit, never a template): \`page.flashback({ intent: 'the claim the look back shows', when: 'LONG BEFORE...', at, cover: 'page' | 'strip', arrange: 'rows' | 'row' | 'stair' | 'pile', beats: [{ at: 'phrase', draw: (g, t, [w, h]) => ..., weight, caption }], stamp: { text, at } })\`: 1-5 beats from the narration, one panel each (drawn in beat-local px, 0,0 = its top-left), revealed when its words land; the page re-inked as an old sepia print (cover 'page') or a torn strip of it pasted over the present page (cover 'strip'). Cover and arrangement have no defaults; the showcase's pairs (page + rows, strip + row) are never yours. Or invent the mechanism with \`page.panelBreak({ intent, print: 'past', when, panels: [{ id, box, shape, draw: (g, t, [w, h]) => ..., at, enter, from }], moves: [{ target, at, to: { x, y, rotate, scale, box } , lag }], gutters: { kind } })\` (preferred): panels you shape, how each arrives, what moves on which phrase and what the gutters do; the motion must show the claim. Never the same mechanism twice in a film.
Text: page.caption / balloon / note / stamp, labels inside the art g.text; never ctx.text.
Craft (QUALITY.md §6): focal point and three human traces in a comment first. ONE accent colour (red = the point only); numbers and labels from the narration only; a still beat >= 0.4 s before the answer. Traces: kinked leaders, ticks that differ, a struck word and its correction, a stamp off-square, a pencilled arrow in the margin, a thumbprint. Never: a tidy spreadsheet, a chart without labelled axes, invented figures, icons standing in for the thing.
Style references (line, plates and layout only, never their content): docs/worlds/comic-panels-v2/shots/s4-t8.4.png, s7-t7.9.png, s3-t8.4.png.`;

export const comicInfoLook = defineLook({
  id: 'comic-info',
  label: 'Comic info',
  description:
    'comic information pages: cutaways of the real object, charts drawn as panel art, codes slammed like sound effects, a ticked checklist, stamps and captions; the rare sepia flashback',
  rolls: ['B'],
  treatments: ['3d-reconstruction', 'data-chart-3d', 'node-graph/timeline', 'counter/odometer'],
  docs: DOCS,
  soundPalette: 'comic',
  variationBudget: 'comic',
  available: true,
  styles: [COMIC_ID],
  experimental: true,
  kit: { templates: [comicPage] },
});
