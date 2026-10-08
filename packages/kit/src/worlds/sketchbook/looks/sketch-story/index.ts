/**
 * Look `sketch-story` (Sketchbook world, look A, PLAN.md#13.6): felt-tip story pages. A visible
 * hand draws the story on blank cartridge paper of one spiral notebook: crude stick people with
 * props and reacting faces, the thing the narrator names, coloured-pencil fills that go out of the
 * lines, one red correction on the point. Looks B (`sketch-graph`) and C (`sketch-loud`) share its
 * world-level `sketchPage` template.
 */
import { defineLook } from '../../../../looks/types.js';
import { SKETCHBOOK_ID } from '../../style.js';
import { sketchPage } from '../../page/sketch-page.js';

const DOCS = `Look \`sketch-story\` (world Sketchbook, A roll): one notebook page per shot, drawn live by a hand with a felt-tip. Build ONE \`kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, stock: 'cartridge', page: N, anchor: ctx.anchor })\`, \`scene.add\` it, draw on it in build(), call \`page.update(t)\` in update(t). Page coordinates are 960x540 whatever the frame size; keep ink inside x 60-900, y 40-500.
- Text: \`page.write('300 years', { x, y, size: 25, hand: 'scrawl', at, until })\` (hands print/scrawl/marker/type; cap size >= 13).
- People: \`page.figure({ x, y, h: 220, pose: [{ at: 0, armR: [26, 10] }, { at: 4.7, to: 5.15, armR: [126, 118] }], expression: [{ at: 0, mouth: 'flat' }, { at: 6.9, mouth: 'o' }], until })\`; props via \`attach: fig.head()\` (head-radius units) or \`fig.joint('handL')\` (offsets).
- Marks: stroke, fill (pencil hatch), arrow (two strokes), loop, underline, crossOut; traces: tape, coffeeRing, clip, sticky, smudge; inserts: \`page.sheet({...})\` (a taped sheet, a sticky note, a kraft envelope).
- Text: always \`page.write\` (ctx.text and ctx.annotate are the engine pixel font, not a hand).
- Times: \`at\`/\`until\` in seconds or a spoken phrase; each method returns { at, end } to chain on (a mark waiting for the hand returns its real times); with \`duration\` the hand is off the subject for the last 0.4 s.
- One hand: it draws the key thing (figures, the hero mark: \`hero: true\`, default the largest text); small labels, numbers and words may appear on their own while it works elsewhere (\`appear: 'bloom' | 'pop' | 'type'\`, \`parallel: true\` = bloom), and a secondary write it cannot reach in time blooms in by itself. Writing is brisk (12 letters ~1.1 s; \`speed\` up to 2, \`quick: true\` for labels): never letter text with \`page.stroke\`.
- Open vocabulary: draw THIS film's nouns: \`page.draw(kind, { type, x, y, h })\` (animals, plants, backdrops, buildings, vehicles, objects, tools, instruments, icons, effects), \`page.person({ action, mood, clothes, hat, holds })\`, your own \`page.doodle({ box, parts })\` / \`page.spot\`, \`page.diagram(kind, spec)\`; a recurring character = \`defineFigure\` + \`person({ like })\`.
- Compose: pass \`layout: 'hero-left' | 'facing' | 'tall-diagram' | 'wide-strip' | 'top-down-map' | 'close-up' | 'landscape' | 'two-column' | 'big-number'\` and place with \`page.slots()\` ({ hero, figures, label, note, thing: [x, y, w, h], ground }); vary the layout page to page; the hero figure is >= 25 % of the page height (h >= 135).
Craft (QUALITY.md): write the focal point and three human traces in a comment before the code. ONE focal point, off-centre, with negative space; red ink ONLY for the correction on the point; <= 6 elements; a still beat >= 0.4 s before the red. Keep figures crude (loop heads, stick limbs, faces that react) - never polish, never centre, never symmetric. Traces: a crossed-out word with its correction, a two-stroke arrow, fills out of the lines, an uneven underline, a margin doubt in pencil, a smudge or tape. Never: decoration without meaning, invented labels, uniform spacing/timing, constant motion, the hand parked over the subject (\`keepClear\`).
Style references (line, paper and layout only, never their content): docs/worlds/sketchbook-v2/shots/s2-t6.0.png, s4-t7.4.png, s9-t7.6.png.`;

export const sketchStoryLook = defineLook({
  id: 'sketch-story',
  label: 'Sketch story',
  description:
    'felt-tip story pages in a spiral notebook: a visible hand draws crude stick people, the named thing and a red correction on the point; pencil fills, line boil',
  rolls: ['A'],
  treatments: ['metaphor-object', 'character-scene', 'title-card'],
  docs: DOCS,
  soundPalette: 'sketchbook',
  variationBudget: 'sketchbook',
  available: true,
  styles: [SKETCHBOOK_ID],
  experimental: true,
  kit: { templates: [sketchPage] },
});
