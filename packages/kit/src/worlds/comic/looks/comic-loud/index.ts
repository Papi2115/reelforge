/**
 * Look `comic-loud` (Comic world, look C, PLAN.md#13.3): the page holds its breath, then hits.
 * The near-empty pause panel before a twist, giant imperfect onomatopoeia breaking out of its
 * panel, a slammed panel with a page hit, the one line lettered large; the rare double-page
 * spread (`page.spread`, showcase shot 9). Same world-level `comicPage` template as looks A and B.
 */
import { defineLook } from '../../../../looks/types.js';
import { comicPage } from '../../page/comic-page.js';
import { COMIC_ID } from '../../style.js';

const DOCS = `Look \`comic-loud\` (world Comic, C roll): the page holds its breath, then hits. ONE \`const page = kit.fx.comicPage({ seed: N, anchor: ctx.anchor, duration: ctx.shot.duration })\`, \`scene.add(page)\`, lay it out in build(), \`page.update(t)\` in update(t). Page px 640x360.
- Hit: \`page.sfx('CLANG', { x, y, at, size: 8-12, beats, angles, rise })\` giant, imperfect, on uneven beats, breaking out of its panel; a panel slams in (\`enter({ at, kind: 'slam' })\`) with \`page.shake(at)\` on the impact; speed lines stop before the subject.
- Pause: before a twist ONE almost empty panel (a wide flat field, one small detail that changes in held steps) for >= 1.5 s, no lettering in it.
- The line: the one sentence that lands in a big balloon (\`page.balloon(text, { size: 2, tail })\`) after a smaller one; a pencilled time or note in the empty margin (\`page.note\`).
- Spread (the film's big picture, at most one per ~60-90 s; a toolkit, never a template): \`page.spread({ intent: 'what the big picture shows', art: (g, t) => ..., assemble: 'merge' | 'unfold' | 'pull-back', pieces: 'grid' | 'columns' | 'halves', focus, insets: [{ box, at, draw }], beats: ['phrase', ...] })\`: one picture across both pages and the fold (a landscape, a crowd, a machine), its title built into it (\`g.standing('TITLE', { x, y0, y1, h0, h1 })\`); it may hold still but never > 4 s without a new beat (narration in \`beats\`, a margin note, an inset). The assembly has no default (merge needs pieces); the showcase's own (merge + grid, unfold) are never yours. Or invent the mechanism with \`page.panelBreak({ intent, fold, panels: [{ id, box, shape, draw: (g, t, [w, h]) => ..., at, enter, from }], moves: [{ target, at, to: { x, y, rotate, scale, box } , lag }], gutters: { kind } })\` (preferred): panels you shape, how each arrives, what moves on which phrase and what the gutters do; the motion must show the claim. Never the same mechanism twice in a film.
Text: page.balloon / caption / sfx / note; never ctx.text.
Craft (QUALITY.md §6): focal point and three human traces in a comment first. Fast-fast-pause; one huge thing and lots of empty paper; red only on the point. Traces: letters off-square, a smudge where the slam landed, plates off register, a pencilled time in the margin, a thumbprint. Never: two loud words at once, decoration around the word, constant motion, a centred symmetric title.
Style references (line, plates and layout only, never their content): docs/worlds/comic-panels-v2/shots/s8-t4.0.png, s10-t7.9.png, s9-t8.9.png.`;

export const comicLoudLook = defineLook({
  id: 'comic-loud',
  label: 'Comic loud',
  description:
    'loud comic moments: the near-empty pause panel before a twist, giant imperfect onomatopoeia breaking the frame, a slammed panel, the one line lettered large; the rare double-page spread',
  rolls: ['C'],
  treatments: ['kinetic-text', 'title-card', 'montage/transition', 'character-scene'],
  docs: DOCS,
  soundPalette: 'comic',
  variationBudget: 'comic',
  available: true,
  styles: [COMIC_ID],
  experimental: true,
  kit: { templates: [comicPage] },
});
