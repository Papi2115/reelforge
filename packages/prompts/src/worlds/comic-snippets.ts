/**
 * The exact Comic kit calls the prompts quote (packages/kit/src/worlds/comic, the open vocabulary
 * `page.art` of PLAN.md#13.15). Every snippet is a complete, runnable call over `ctx`, `kit` and
 * `page` (a painter call also over the panel pen `g`): the stages test `comic-snippets.test.ts`
 * runs each one through the real kit (its schemas and checks: generator options, layout beats,
 * flashback beat order, spread hold rule, lettering), so the prompt text cannot drift from the
 * API. Values show the shape of a call on topics far from the showcase, never a design to copy.
 */
export const COMIC_SNIPPETS = {
  /** One printed page per shot (phrases need the anchor; a spread holds until the duration). */
  page: 'kit.fx.comicPage({ seed: 41, anchor: ctx.anchor, duration: ctx.shot.duration })',
  /** The project's own cast, props and backdrops (assets/comic/*.json), loaded once per page. */
  assets: 'page.art.load(ctx.worldAssets)',
  /** Panels from beats: the preset follows the count and the weights, backdrops come first. */
  layout:
    "page.layout([{ at: 0, weight: 2, backdrop: 'village' }, { at: 'the bell', weight: 1, backdrop: { preset: 'night', horizon: 0.6 }, enter: 'slam' }], { seed: 41 })",
  /** Why a preset: three beats, the last dominant -> a tall panel on the right. */
  suggest: 'page.art.suggestLayout([1, 1, 2.5])',
  /** Panels that show (almost) nothing for > 0.6 s; must be empty. */
  audit: 'page.audit({ until: ctx.shot.duration }).emptyPanels',
  /** Panels from a preset: the split weights make the panel that matters the biggest. */
  panels: "page.panels('3-up-l', { weights: [0.58, 0.4] })",
  /** A portrait short's page (360x640): a tall splash over two small panels, stacked down. */
  portrait: "page.panels('splash-strip', { weights: [0.62, 0.45] })",
  /** A figure with a pose and an expression (painter call: inside `panel.draw((g, t) => …)`). */
  person:
    "page.art.person(g, { x: 220, y: 330, size: 170, pose: 'point', expression: 'surprised', hat: 'hardhat', outfit: 'overalls', tool: 'clipboard' })",
  /** An animal from a species preset. */
  animal:
    "page.art.animal(g, { x: 430, y: 320, size: 120, species: 'fox', pose: 'alert', flip: true })",
  /** A plant. */
  plant: "page.art.tree(g, { x: 90, y: 340, kind: 'oak', season: 'autumn', size: 260 })",
  /** A whole establishing backdrop in a box. */
  backdrop: "page.art.backdrop(g, { preset: 'desert', time: 'dusk', box: [0, 0, 640, 360] })",
  /** A crowd: back rows flatter, the front row in colour. */
  crowd:
    "page.art.crowd(g, { x0: 40, x1: 600, y: 345, count: 12, rows: 3, size: 150, poses: ['walk', 'stand', 'point'], expression: 'angry' })",
  /** A recurring character of the film, defined once from a generator preset. */
  character:
    "page.art.defineCharacter('keeper', { gen: 'person', description: 'the lighthouse keeper: cap, heavy coat, lantern', hat: 'cap', outfit: 'coat', top: 'cyanDeep', tool: 'lantern', seed: 4 })",
  /** A defined (or project) thing drawn by id, with per-call knobs. */
  cast: "page.art.draw(g, 'keeper', { x: 300, y: 330, size: 180, pose: 'look-up', expression: 'scared' })",
  /** A one-off prop from shape parts (model units, 0,0 = where it stands, up = -y). */
  prop: "page.art.defineProp('weather-vane', { description: 'a weather vane: an arrow on a pole, a cockerel on top', height: 120, parts: [{ shape: 'line', pts: [0, 0, 0, -90], w: 2, color: 'ink' }, { shape: 'poly', pts: [-40, -80, 40, -80, 30, -86, 40, -92, -40, -92], fill: 'sepiaMid' }, { shape: 'ellipse', at: [0, -106], r: [14, 10], fill: 'yellow', shade: 0.4 }] })",
  /** A balloon whose tail points at the speaker's mouth. */
  balloon:
    "page.balloon('THE TIDE IS TURNING!', { x: 470, y: 64, at: 'the tide', tail: [512, 150] })",
  /** A time-stamp caption, slightly off-square. */
  caption: "page.caption('THREE DAYS LATER...', { x: 22, y: 18, at: 0.2, tilt: -1 })",
  /** Onomatopoeia slammed in on uneven beats, letters off-square. */
  sfx: "page.sfx('CRACK', { x: 400, y: 120, at: 'the ice', size: 9, beats: [0, 0.06, 0.15, 0.19, 0.3], angles: [-0.1, 0.06, -0.03, 0.11, -0.07] })",
  /** A pencilled margin note. */
  note: "page.note('WHY SO LATE?', { x: 492, y: 330, at: 2.6, dur: 0.4 })",
  /** A worn rubber stamp with a page hit. */
  stamp: "page.stamp('CLOSED', { x: 330, y: 280, at: 'closed', angle: -0.14 })",
  /** The pause: one almost empty panel, one small detail moving in held steps. */
  pause:
    "page.panel([70, 64, 604, 66, 602, 300, 72, 297], { boil: 0.3 }).draw((g, t) => { g.plate.rect(0, 0, 640, 360, 'greyLight'); g.rect(388 - Math.floor(t / 0.45) * 2, 224, 44, 8, 'greyDark'); })",
  /** A panel slammed onto the page past the margin, and the page hit. */
  slam: "page.panel([402, 34, 628, 28, 640, 186, 396, 192], { border: 3 }).enter({ at: 'the crash', kind: 'slam' })",
  shake: "page.shake('the crash', 5)",
  /** Gutters closing: a panel morphs to a tighter quad. */
  squeeze:
    "page.panels('strip')[1].morph([250, 40, 390, 44, 386, 320, 254, 316], { at: 'ten minutes', dur: 1.5 })",
  /** A page that unfolds downward: a tall narrow column the camera reads (one flow of many). */
  flow: "page.flow({ intent: 'the page reads downward the way the rain runs off the roof into the street', direction: 'down', breadth: 320, beats: [{ at: 0.2, draw: (g, t, [w, h]) => page.art.backdrop(g, { preset: 'village', box: [0, 0, w, h] }) }, { at: 'the street', weight: 1.4, draw: (g, t, [w, h]) => page.art.backdrop(g, { preset: 'city', time: 'night', box: [0, 0, w, h] }) }] })",
  /** One element carried over three panels and the gutters between them (page px). */
  thread:
    "page.thread({ intent: 'one kite string runs from the hand on the ground across the panels to the kite', through: page.panels('strip'), draw: (g, t) => g.line(60, 300, 600, 40, 'ink', 1) })",
  /** The outline of a torn cutaway opening (points to ink and clip to). */
  torn: "page.util.torn(112, 124, 300, 308, 'cut')",
  /** Checklist marks: a pencil tick, a strike-through, the highlighter on the answer. */
  tick: 'page.tick(60, 96, { at: 1.2, dur: 0.16 })',
  strike: "page.strike(60, 232, 130, { at: 'wrong', dur: 0.3, color: 'ink' })",
  highlight: "page.highlight([144, 216, 194, 238], { at: 'right', dur: 0.22, color: 'yellow' })",
  /** The one line lettered large. */
  bigLine: "page.balloon('WE STAY.', { x: 150, y: 134, at: 'stay', size: 2, tail: [40, 214] })",
  /** A flashback: the page re-inked as an old print, two beats on a stair (one of many). */
  flashback:
    "page.flashback({ intent: 'the dam was built because the flood of 1927 drowned the lower town', when: 'IN 1927...', at: 0.3, cover: 'page', arrange: 'stair', beats: [{ at: 0.9, draw: (g, t, [w, h]) => page.art.backdrop(g, { preset: 'village', time: 'dusk', box: [0, 0, w, h] }), weight: 1.3 }, { at: 'the flood', draw: (g, t, [w, h]) => page.art.effect(g, { kind: 'rain', box: [0, 0, w, h], t }), caption: 'THE LOWER TOWN.' }], stamp: { text: '1927', at: 3.4 } })",
  /** A spread: three columns that turn out to be one picture across the fold (one of many). */
  spread:
    "page.spread({ intent: 'the whole herd crosses the plain at once, thousands of animals', art: (g, t) => { page.art.backdrop(g, { preset: 'meadow', box: [-20, -20, 680, 400] }); page.art.animal(g, { x: 420, y: 300, size: 90, species: 'cow', pose: 'run', t }); }, assemble: 'merge', pieces: 'columns', delay: 0.3, dur: 1.6, beats: [3.6, 'the river'] })",
  /**
   * The open breakthrough toolkit: two panels the scene shapes, the second swinging in on its
   * phrase, then the first drags the second down after it (one mechanism of endless ones).
   */
  panelBreak:
    "page.panelBreak({ intent: 'when the tide went out the moored boats sank down onto the harbour mud', at: 0.4, panels: [{ id: 'quay', box: [24, 30, 360, 300], draw: (g, t, [w, h]) => page.art.backdrop(g, { preset: 'ocean', box: [0, 0, w, h] }) }, { id: 'mud', box: [396, 40, 220, 280], shape: 'lean', at: 'the tide', enter: 'swing', from: 'top', draw: (g, t, [w, h]) => page.art.backdrop(g, { preset: 'ocean', time: 'dusk', horizon: 0.3, box: [0, 0, w, h] }) }], moves: [{ target: ['quay', 'mud'], at: 3.2, dur: 0.9, lag: 0.25, to: { y: 36, rotate: -3 } }], gutters: { kind: 'lift' } })",
} as const;

export type ComicSnippet = keyof typeof COMIC_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const comicSnippet = (name: ComicSnippet): string => `\`${COMIC_SNIPPETS[name]}\``;
