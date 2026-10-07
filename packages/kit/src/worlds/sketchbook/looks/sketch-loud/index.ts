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

const DOCS = `Look \`sketch-loud\` (world Sketchbook, C roll): a loud moment of paper, short and rare. ONE \`kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, stock: 'lined', page: N, anchor: ctx.anchor })\`, \`scene.add(page)\` in build() (a page never added renders a blank frame), draw on it in build(), \`page.update(t)\` in update(t). Page coordinates 960x540.
- The word: \`page.write('300', { x, y, size: 150-180, hand: 'marker', tool: 'marker', nib: [19, -42, 3], rot: -3 })\` written fast (~1 s), crooked, off-centre, one word or number only; a smudge where the hand dragged through it.
- The correction: a beat (>= 0.5 s still), then \`tool: 'red'\` strikes / inserts / circles on the point; a small pencil afterthought (\`hand: 'scrawl', tool: 'pencil'\`).
- Flipbook: \`const book = page.flipbook({ count: 22, at, until })\`; draw each \`book.page(k)\` (the same doodle, the changing number huge in marker), \`pen: false\` on the page.
- Slaps: \`page.sheet({ ..., paper: 'sticky', at })\` or a paper sheet with \`at\` (falls, squashes, then tape), marker text \`attach: sheet.frame()\`.
- Pop-up (the film's one 2.5D page, at most one per ~60-90 s), a toolkit, never a template: \`page.popup({ intent: 'the claim the motion shows', x, y, w, depth, at, elements: [...], pull: { at, tab: 'tab' | 'ribbon' | 'knob' | 'lever', side: 'left' | 'right' | 'bottom', motions: [{ target: 'id', to: { level: 1 }, span: [0, 1], ease }], drive: (p, t) => ({ id: { value: n } }), callout: 'loop' } })\`. Pieces (<= 8, give the moving ones an \`id\`): block / cutout stand on the fold (own \`at\` = rise on a word; \`rise\`, \`slide\`), and on the backdrop arm (\`angle\`), card (\`x\`, \`y\`, \`rotate\`, \`scale\`, \`show\`), flap (a door, \`open\`), gauge (\`level\`), wheel/gear (\`angle\`), counter (\`value\`), window (sliding \`index\`), scale (pointer \`value\`); tag, note. A cutout or card carries the film's own figure or prop with \`asset: '<id>'\` (ctx.worldAssets, defineFigure / defineProp) so the subject itself moves. The pull MUST move something that shows the claim; invent the mechanism for YOUR claim and never reuse one in a film (e.g. a tube filling, a door opening on what it hid, a number sliding into a window, a gear turning a counter, a pointer swinging on a scale). Words from the narration; no other writing on the card while it opens and pulls.
- One hand: it draws the key thing (figures, the hero mark: \`hero: true\`, default the largest text); small labels, numbers and words may appear on their own while it works elsewhere (\`appear: 'bloom' | 'pop' | 'type'\`, \`parallel: true\` = bloom), and a secondary write it cannot reach in time blooms in by itself. Writing is brisk (12 letters ~1.1 s; \`speed\` up to 2, \`quick: true\` for labels): never letter text with \`page.stroke\`.
Text: always \`page.write\` (ctx.text and ctx.annotate are the engine pixel font, not a hand).
Craft (QUALITY.md): focal point and three traces in a comment first. One huge thing, lots of empty paper; never two loud words; red only on the point. Traces: the marker blots, a crooked baseline, a smudge, a hand-ruled underline that hooks, tape at an angle. Never: a centred symmetric title, drop shadows on letters, decoration around the word, constant motion.
Style references (line, paper and layout only, never their content): docs/worlds/sketchbook-v2/shots/s1-t6.0.png, s6-t1.0.png, s6-t5.0.png.`;

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
