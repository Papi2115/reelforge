/**
 * Look `sketch-loud` (Sketchbook world, look C, PLAN.md#13.6): the loud paper moments. A chisel
 * marker slams one huge hand-lettered word or number onto the page, the red pen corrects it; a
 * flipbook in the page corner riffles years past; sticky notes and sheets are slapped on; the rare
 * pop-up card stands up from the page (`page.popup`, showcase shot 5). Same
 * notebook, same `sketchPage` as look A (a world-level template).
 */
import { defineLook } from '../../../../looks/types.js';
import { sketchPage } from '../../page/sketch-page.js';
import { SKETCHBOOK_ID } from '../../style.js';

const DOCS = `Look \`sketch-loud\` (world Sketchbook, C roll): a loud moment of paper, short and rare. ONE \`kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, stock: 'lined', page: N, anchor: ctx.anchor })\`; draw in build(), \`page.update(t)\` in update(t). Page coordinates 960x540.
- The word: \`page.write('365', { x, y, size: 150-180, hand: 'marker', tool: 'marker', nib: [19, -42, 3], rot: -3 })\` written fast (~1 s), crooked, off-centre, one word or number only; a smudge where the hand dragged through it.
- The correction: a beat (>= 0.5 s still), then \`tool: 'red'\` strikes / inserts / circles on the point; a small pencil afterthought (\`hand: 'scrawl', tool: 'pencil'\`).
- Flipbook: \`const book = page.flipbook({ count: 22, at, until })\`; draw each \`book.page(k)\` (the same doodle, the changing number huge in marker), \`pen: false\` on the page.
- Slaps: \`page.sheet({ ..., paper: 'sticky', at })\` or a paper sheet with \`at\` (falls, squashes, then tape), marker text \`attach: sheet.frame()\`.
- Pop-up (the film's one 2.5D page, at most one per ~60-90 s): \`page.popup({ x: 380, y: 272, w: 412, depth: 196, at, elements: [{ kind: 'arm', u: 220, length: 160, piece: 'sun', angle: 23, swing: -19 }, { kind: 'block', u: 236, band: 'MARCH', text: '21' }, { kind: 'tag', lines: ['spring', 'equinox'] }, { kind: 'note', text }], pull: { at } })\`: the pencil hand opens it, \`pull\` = the red pen pulls the tab and the arm leaves its notch (red loop + arrow follow); <= 6 elements (block / arm / cutout with a felt figure / tag / note), words from the narration; no other writing on the card or while it opens and pulls.
Text: always \`page.write\` (ctx.text and ctx.annotate are the engine pixel font, not a hand).
Craft (QUALITY.md): focal point and three traces in a comment first. One huge thing, lots of empty paper; never two loud words; red only on the point. Traces: the marker blots, a crooked baseline, a smudge, a hand-ruled underline that hooks, tape at an angle. Never: a centred symmetric title, drop shadows on letters, decoration around the word, constant motion.
References: docs/worlds/sketchbook-v2/shots/s1-t6.0.png (marker "365?", red strikes the doubt and inserts ".24", pencil "not quite."), s6-t1.0.png (flipbook: the corner lifts under the thumb, AD 325 huge), s6-t5.0.png (1582: the sun slid to 11 March, the pencil ring still on 21).`;

export const sketchLoudLook = defineLook({
  id: 'sketch-loud',
  label: 'Sketch loud',
  description:
    'loud notebook moments: one huge marker word the red pen corrects, a flipbook riffled in the page corner, notes slapped onto the page',
  rolls: ['C'],
  treatments: ['kinetic-text', 'title-card', 'montage/transition'],
  docs: DOCS,
  soundPalette: 'sketchbook',
  variationBudget: 'sketchbook',
  available: true,
  styles: [SKETCHBOOK_ID],
  experimental: true,
  kit: { templates: [sketchPage] },
});
