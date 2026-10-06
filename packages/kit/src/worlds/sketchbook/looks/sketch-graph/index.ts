/**
 * Look `sketch-graph` (Sketchbook world, look B, PLAN.md#13.6): ballpoint proofs. Blue BIC print on
 * graph paper, on the back of a kraft envelope taped into the book or on a clipped index card: a
 * calculation worked line by line, a ruled chart, boxes that fill, and one red result on the point.
 * Same notebook, same `sketchPage` as look A (a world-level template).
 */
import { defineLook } from '../../../../looks/types.js';
import { sketchPage } from '../../page/sketch-page.js';
import { SKETCHBOOK_ID } from '../../style.js';

const DOCS = `Look \`sketch-graph\` (world Sketchbook, B roll): the maths and the evidence, worked by hand. ONE \`kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], stock: 'graph', page: N, pageTool: 'bic', boilFps: 8, anchor: ctx.anchor })\`; draw in build(), \`page.update(t)\` in update(t). Page coordinates 960x540; ink inside x 60-900, y 40-500.
- Pen: \`tool: 'bic'\` (blue ballpoint, neat \`hand: 'print'\`, size 16-26), the result ONCE in \`tool: 'red'\`; a highlighter sweep \`page.stroke(pts, { tool: 'hi' })\` behind the number that matters.
- Proofs: column sums (align the decimal points with \`page.textWidth\`), \`page.ruled(...)\` lines and chart axes with hand ticks, boxes that fill with \`page.fill(..., { color: 'bicLight', dir: -1 })\`, \`page.ruler(x, y, { at, until })\` slid in under a line.
- Inserts: \`page.sheet({ ..., paper: 'kraft', envelope: true })\` (maths on an envelope back, write with \`attach: sheet.frame()\` or \`sheet.point(u, v)\`), an index card \`sheet.rule(...)\` + \`page.clip(...)\`, tape at two angles, a coffee ring, \`torn: true\` stubs.
Text: always \`page.write\` (ctx.text and ctx.annotate are the engine pixel font, not a hand).
Craft (QUALITY.md): write the focal point and three human traces in a comment first. ONE red result, a still beat >= 0.4 s before it; numbers and units from the narration only; slow 8 fps boil. Traces: a loop round the key number, an uneven double underline, a ruled line that overshoots, a pencil "?" in the margin, a coffee ring. Never: a tidy spreadsheet, invented figures, a chart without labelled axes, everything centred.
References: docs/worlds/sketchbook-v2/shots/s3-t7.9.png (four year-boxes filling, red "≈ 1 day" looped: the sum, then the name), s7-t6.8.png (subtraction on a kraft envelope, a drift line that only climbs), s10-t8.7.png (clipped index card, one red "Feb 29" with a swash, quiet hold).`;

export const sketchGraphLook = defineLook({
  id: 'sketch-graph',
  label: 'Sketch graph',
  description:
    'ballpoint proofs in the notebook: blue BIC on graph paper, an envelope back or an index card; sums, ruled charts and one red result',
  rolls: ['B'],
  treatments: ['data-chart-3d', 'counter/odometer', 'node-graph/timeline'],
  docs: DOCS,
  soundPalette: 'sketchbook',
  variationBudget: 'sketchbook',
  available: true,
  styles: [SKETCHBOOK_ID],
  experimental: true,
  kit: { templates: [sketchPage] },
});
