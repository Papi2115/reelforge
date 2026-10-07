/**
 * The exact Sketchbook kit calls the prompts quote (packages/kit/src/worlds/sketchbook, the open
 * vocabulary of PLAN.md#13.15a). Every snippet is a complete, runnable expression over `ctx`, `kit`
 * and `page`: the stages test `sketchbook-snippets.test.ts` runs each one through the real kit (its
 * schemas and checks) on a page whose library holds a project figure `ranger` and a project prop
 * `fire-tower`, so the prompt text cannot drift from the API. The values come from topics far
 * apart (forest, ocean, space station, village, desert, city; kit `examples/sketchbook/open`) and
 * only show the shape of a call: never a design to copy, never the film's content.
 */
export const SKETCHBOOK_SNIPPETS = {
  /** A story page with a composition preset and the project's own cast and props. */
  storyPage:
    "kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, stock: 'cartridge', layout: 'landscape', library: ctx.worldAssets })",
  /** The page after a torn-strip transition. */
  tornPage:
    'kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, torn: true, library: ctx.worldAssets })',
  /** The hero mark: it keeps its time and gets the hand. */
  heroWrite:
    "page.write('16', { x: 110, y: 230, size: 160, hand: 'marker', tool: 'marker', nib: [19, -42, 3], rot: -3, hero: true, at: 0.3 })",
  /** A label that appears by itself while the hand draws something else. */
  appearWrite: "page.write('2,000 m', { x: 640, y: 150, size: 44, appear: 'bloom', at: 1.4 })",
  /** A quick hand-lettered label. */
  quickWrite:
    "page.write('from above', { x: 600, y: 330, size: 22, hand: 'scrawl', quick: true, at: 2.1 })",
  /** Faster lettering for a longer phrase. */
  speedWrite: "page.write('counted one by one', { x: 140, y: 440, size: 26, speed: 1.6, at: 2.8 })",
  /** A plant (any generator kind) drawn huge as the hero, by the hand. */
  plant:
    "page.draw('tree', { type: 'oak', x: 300, y: 470, h: 270, hero: true, at: 0.6, until: 2.4 })",
  /** An animal that blooms in while the hand works elsewhere. */
  animal:
    "page.draw('beast', { type: 'camel', action: 'walk', x: 620, y: 470, h: 150, flip: true, at: 3.4, appear: 'bloom' })",
  /** A pale backdrop that soaks in first. */
  backdrop: "page.draw('dunes', { x: 480, y: 480, w: 900, h: 120, at: 0.2, appear: 'bloom' })",
  /** A person with clothes, a hat, a mood change and a held tool. */
  person:
    "page.person({ x: 250, y: 470, h: 170, action: 'hold', face: 1, mood: [{ at: 0, mood: 'neutral' }, { at: 4, mood: 'surprised' }], clothes: 'overalls', color: 'bicLight', hat: 'brim', holds: 'pitchfork', at: 1.2, until: 2.6 })",
  /** A member of the project's cast (an asset file), the same drawing in every shot. */
  castPerson:
    "page.person({ like: 'ranger', x: 250, y: 470, h: 170, action: 'point', face: 1, at: 1.2 })",
  /** A project prop (an asset file) by id. */
  useProp: "page.use('fire-tower', { x: 120, y: 430, h: 120, at: 0.4, appear: 'bloom' })",
  /** A one-off figure only this shot needs, defined inline. */
  defineFigure:
    "page.defineFigure('astronaut', { body: 'blob', color: 'graphiteLight', hat: 'bubble', hatColor: 'skyPencil', holds: 'wrench', holdSize: 0.3 })",
  /** A one-off prop only this shot needs, drawn with the doodle DSL. */
  defineProp:
    "page.defineProp('roof', { h: 26, doodle: { box: [40, 26], parts: [{ rect: [0, 0, 40, 26], fill: 'coffee' }, { line: [2, 13, 38, 13], sharp: true }] } })",
  /** Tiny spot art (rows of characters, a legend of inks). */
  spot: "page.spot({ rows: ['..oo..o', '.ooooo.', 'oo*ooo.', '.ooooo.', '..oo..o'], legend: { o: { color: 'orange', nib: 'crayon' }, '*': 'ink' }, px: 4 }, { x: 300, y: 200, h: 20, at: 2, appear: 'pop' })",
  /** A map: land, a route, places, the red X on the point. */
  map: "page.diagram('map', { x: 120, y: 110, w: 520, h: 340, land: 'coast', route: [[0.1, 0.8], [0.35, 0.6], [0.7, 0.35]], mark: [0.7, 0.35], places: [{ label: 'well', at: [0.1, 0.8] }, { label: 'market', at: [0.7, 0.35] }], at: 0.5 })",
  /** A hand-ruled bar chart, the bar that is the point in red. */
  chart:
    "page.diagram('bars', { x: 140, y: 450, w: 420, h: 260, bars: [{ value: 30, label: '1950' }, { value: 55, label: 'today' }], values: true, highlight: 1, pen: 'bic', at: 0.6 })",
  /** A callout on a drawing (the label that is the point in red). */
  callout:
    "page.diagram('callout', { x: 420, y: 300, label: '2,000 m', from: [600, 486], size: 40, highlight: 0, at: 5 })",
  /** A pop-up where a rising quantity fills a tube (one mechanism of many). */
  popup:
    "page.popup({ intent: 'three days of rain lift the river from 1 m to 4 m: the tube fills and the count runs up', x: 330, y: 260, w: 420, depth: 200, at: 0.4, elements: [{ kind: 'gauge', id: 'river', u: 110, v: 20, h: 140, level: 0.15, bulb: false, label: 'RIVER', color: 'bic' }, { kind: 'counter', id: 'metres', u: 280, v: 90, from: 1, suffix: ' m', size: 34 }], pull: { at: 2.6, tab: 'ribbon', side: 'right', dur: 1.4, motions: [{ target: 'river', to: { level: 0.95 } }, { target: 'metres', to: { value: 4 }, span: [0.2, 1], ease: 'lin' }], focus: 'metres', callout: 'loop' } })",
  /** A pop-up where a door opens on what was hidden (another mechanism). */
  popupFlap:
    "page.popup({ intent: 'behind the locked door the vault is empty', x: 330, y: 260, w: 420, depth: 200, at: 0.4, elements: [{ kind: 'card', u: 200, v: 60, w: 120, h: 60, text: 'EMPTY', paper: 'sticky' }, { kind: 'flap', id: 'door', u: 200, v: 40, w: 160, h: 110, hinge: 'left', text: 'VAULT' }], pull: { at: 2.4, tab: 'knob', side: 'right', dur: 1.2, motions: [{ target: 'door', to: { open: 1 } }], focus: 'door', callout: 'loop' } })",
  /** An accordion timeline of stages. */
  strip:
    "page.strip({ y: 156, events: [{ label: 'SPRING', note: 'the ice melts', doodle: 'loop' }, { label: 'SUMMER', note: ['the river', 'runs low'] }, { label: 'AUTUMN', note: 'the fish return', doodle: 'figure' }], highlight: 2, at: 0.4, until: 5, pen: 'bic' })",
  /** A flipbook in the page corner (draw every `book.page(k)`). */
  flipbook: 'page.flipbook({ count: 22, at: 0.5, until: 3.5 })',
  /** A sticky note slapped on. */
  sticky: "page.sheet({ x: 560, y: 120, w: 180, h: 160, deg: -4, paper: 'sticky', at: 1.5 })",
  /** The back of a kraft envelope. */
  envelope:
    "page.sheet({ x: 120, y: 90, w: 520, h: 330, deg: -3, paper: 'kraft', envelope: true })",
  /** The page camera: a slow push in on the focal drawing (ctx.camera does nothing on a page). */
  push: 'page.push({ focus: [640, 300], at: 1.5, until: 4, scale: 1.15 })',
  /** A hand-ruled axis, the ruler slid under it and a hatched box. */
  ruled: "page.ruled(120, 420, 760, 420, { tool: 'bic' })",
  ruler: 'page.ruler(140, 432, { at: 0.6, until: 1.8 })',
  fill: "page.fill([200, 300, 260, 300, 260, 410, 200, 410], { color: 'bicLight', dir: -1 })",
} as const;

export type SketchbookSnippet = keyof typeof SKETCHBOOK_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const snippet = (name: SketchbookSnippet): string => `\`${SKETCHBOOK_SNIPPETS[name]}\``;
