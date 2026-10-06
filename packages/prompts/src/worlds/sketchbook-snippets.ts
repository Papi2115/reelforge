/**
 * The exact Sketchbook kit calls the prompts quote (packages/kit/src/worlds/sketchbook). Every
 * snippet is a complete, runnable expression over `ctx`, `kit` and `page`: the stages test
 * `sketchbook-snippets.test.ts` runs each one through the real kit (its schemas and checks), so
 * the prompt text cannot drift from the API. Values are an example of the call's shape, never a
 * design to copy.
 */
export const SKETCHBOOK_SNIPPETS = {
  /** A story page with a composition preset (look A); `page.slots()` gives its places. */
  storyPage:
    "kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, stock: 'cartridge', layout: 'facing' })",
  /** The page after a torn-strip transition. */
  tornPage:
    'kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, torn: true })',
  /** The hero mark: it keeps its time and gets the hand. */
  heroWrite:
    "page.write('1518', { x: 110, y: 230, size: 160, hand: 'marker', tool: 'marker', nib: [19, -42, 3], rot: -3, hero: true, at: 0.3 })",
  /** A label that appears by itself while the hand draws something else. */
  appearWrite: "page.write('400', { x: 640, y: 150, size: 44, appear: 'bloom', at: 1.4 })",
  /** A quick hand-lettered label. */
  quickWrite:
    "page.write('ST VITUS', { x: 600, y: 330, size: 22, hand: 'scrawl', quick: true, at: 2.1 })",
  /** Faster lettering for a longer phrase. */
  speedWrite: "page.write('fifteen a day', { x: 140, y: 440, size: 26, speed: 1.6, at: 2.8 })",
  /** A pop-up: a flap opens on a counter that runs (one mechanism of many). */
  popup:
    "page.popup({ intent: 'the dancers grow from 1 to 400 in a month: the square fills up', x: 330, y: 260, w: 420, depth: 200, at: 0.4, elements: [{ kind: 'counter', id: 'dancers', u: 140, v: 70, from: 1, size: 34 }, { kind: 'flap', id: 'square', u: 140, v: 40, w: 150, h: 90, hinge: 'left', text: 'JULY' }, { kind: 'cutout', u: 300, w: 80, h: 110, depth: 60, draw: 'figure', pose: 'cheer' }], pull: { at: 2.6, tab: 'ribbon', side: 'right', dur: 1.4, motions: [{ target: 'square', to: { open: 1 } }, { target: 'dancers', to: { value: 400 }, span: [0.2, 1], ease: 'lin' }], focus: 'dancers', callout: 'loop' } })",
  /** An accordion timeline. */
  strip:
    "page.strip({ y: 156, events: [{ label: '14 JULY', note: 'first dance', doodle: 'figure' }, { label: 'AUGUST', note: ['dozens', 'dancing'] }, { label: 'SEPTEMBER', note: 'it ended' }], highlight: 2, at: 0.4, until: 5, pen: 'bic' })",
  /** A flipbook in the page corner (draw every `book.page(k)`). */
  flipbook: 'page.flipbook({ count: 22, at: 0.5, until: 3.5 })',
  /** A sticky note slapped on. */
  sticky: "page.sheet({ x: 560, y: 120, w: 180, h: 160, deg: -4, paper: 'sticky', at: 1.5 })",
  /** The back of a kraft envelope. */
  envelope:
    "page.sheet({ x: 120, y: 90, w: 520, h: 330, deg: -3, paper: 'kraft', envelope: true })",
  /** A hand-ruled axis, the ruler slid under it and a hatched box. */
  ruled: "page.ruled(120, 420, 760, 420, { tool: 'bic' })",
  ruler: 'page.ruler(140, 432, { at: 0.6, until: 1.8 })',
  fill: "page.fill([200, 300, 260, 300, 260, 410, 200, 410], { color: 'bicLight', dir: -1 })",
} as const;

export type SketchbookSnippet = keyof typeof SKETCHBOOK_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const snippet = (name: SketchbookSnippet): string => `\`${SKETCHBOOK_SNIPPETS[name]}\``;
