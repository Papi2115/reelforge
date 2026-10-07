/**
 * Look `comic-story` (Comic world, look A, PLAN.md#13.3): story panels. One printed page per
 * shot: uneven hand-ruled panels on newsprint, ink line art over colour plates printed out of
 * register, halftone screens, the camera reading the page like an eye, speech balloons with tails,
 * yellow captions, onomatopoeia slammed in. Looks B and C share its world-level `comicPage`
 * template.
 */
import { defineLook } from '../../../../looks/types.js';
import { COMIC_ID } from '../../style.js';
import { comicPage } from '../../page/comic-page.js';

const DOCS = `Look \`comic-story\` (world Comic, A roll): one printed comic page per shot. Build ONE \`const page = kit.fx.comicPage({ seed: N, anchor: ctx.anchor })\`, \`scene.add(page)\`, lay it out in build(), call \`page.update(t)\` in update(t). Page coordinates are 640x360 (the frame).
- Panels: \`const [a, b, c] = page.panels('strip' | '2-up' | '3-up-l' | '4-grid' | '4-l' | 'splash' | 'splash-inset', { weights })\` (uneven gutters built in), \`page.layout([{ at, weight, draw, backdrop }, ...])\` (one panel per beat of the narration, each with its establishing backdrop) or \`page.panel([x0, y0, x1, y1, x2, y2, x3, y3])\`; <= 5 on the page at once; the panel that matters is the biggest.
- Content: \`a.draw((g, t) => { g.plate.rect(0, 0, 640, 360, g.tone('cyanDeep', 0.3, { on: 'night' })); g.plate.poly(body, 'greyLight'); g.ink(body, { key: 'body' }); })\`: fills on \`g.plate\` (printed 1-2 px off), ink lines on \`g\` (\`g.ink\` boils); content coordinates = page px unless \`a.camera([...])\`. The film's own things come from \`page.art\` (its generators and the film's assets), in the same ink and plates.
- Motion: \`a.enter({ at, kind: 'slam' | 'slide' | 'pop', rough })\`, \`a.exit(at)\`, \`a.morph(quad, { at })\` (gutters closing), \`a.camera([{ at, x, y, zoom }])\`, \`a.clock({ offset, hold })\`, \`page.camera([...])\` reads the page panel by panel, \`page.shake(at)\`.
- Text: \`page.balloon('BREAD! FRESH BREAD!', { x, y, at, kind: 'speech' | 'radio' | 'thought', tail: a.toPage(x, y) })\`, \`page.caption('AT FIRST LIGHT...', { x, y, at })\`, \`page.sfx('TOK TOK', { x, y, at, size: 6 })\`, \`page.note('WHICH ONE?', { x, y, at })\` (pencil); every word from the narration. Never ctx.text.
Craft (QUALITY.md §6): write the focal point and three human traces in a comment before the code. Panel size = importance; uneven gutters, a panel or letters breaking the frame; ONE accent colour per page (red = the point only); balloons with tails at the speaker; onomatopoeia as big imperfect letters on uneven beats; speed lines stop before the subject; a pause panel before a twist. Traces: pencils past the corners, plates off-register, a thumbprint, a smudge, a pencil margin question. Never: a perfect grid, centred symmetric panels, even timing, decoration without meaning, invented labels.
Style references (line, plates and layout only, never their content): docs/worlds/comic-panels-v2/shots/s1-t6.9.png, s2-t7.9.png, s6-t3.5.png.`;

export const comicStoryLook = defineLook({
  id: 'comic-story',
  label: 'Comic story',
  description:
    'printed comic story panels: uneven hand-ruled panels on newsprint, ink over off-register colour plates, halftone, balloons with tails, captions, onomatopoeia; the camera reads the page',
  rolls: ['A'],
  treatments: ['character-scene', 'metaphor-object', 'title-card'],
  docs: DOCS,
  soundPalette: 'comic',
  variationBudget: 'comic',
  available: true,
  styles: [COMIC_ID],
  experimental: true,
  kit: { templates: [comicPage] },
});
