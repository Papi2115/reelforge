/**
 * The exact Comic kit calls the prompts quote (packages/kit/src/worlds/comic). Every snippet is a
 * complete, runnable expression over `ctx`, `kit` and `page`: the stages test
 * `comic-snippets.test.ts` runs each one through the real kit (its schemas and checks: flashback
 * beat order, spread hold rule, lettering), so the prompt text cannot drift from the API. Values
 * are an example of the call's shape, never a design to copy.
 */
export const COMIC_SNIPPETS = {
  /** One printed page per shot (phrases need the anchor; a spread holds until the duration). */
  page: 'kit.fx.comicPage({ seed: 41, anchor: ctx.anchor, duration: ctx.shot.duration })',
  /** Panels from a preset: the split weights make the panel that matters the biggest. */
  panels: "page.panels('3-up-l', { weights: [0.58, 0.4] })",
  /** A radio balloon whose tail points at the speaker. */
  balloon:
    "page.balloon('WE ARE GO.', { x: 470, y: 64, at: 'go', kind: 'radio', tail: [512, 150] })",
  /** A time-stamp caption lettered in, slightly off-square. */
  caption: "page.caption('JULY 20, 1969.', { x: 22, y: 18, at: 0.2, tilt: -1, type: 0.4 })",
  /** Onomatopoeia slammed in on uneven beats, letters off-square. */
  sfx: "page.sfx('CLANG', { x: 400, y: 120, at: 'clang', size: 9, beats: [0, 0.06, 0.15, 0.19, 0.3], angles: [-0.1, 0.06, -0.03, 0.11, -0.07] })",
  /** A pencilled margin note. */
  note: "page.note('WHY 1202?', { x: 492, y: 330, at: 2.6, dur: 0.4 })",
  /** A worn rubber stamp with a page hit. */
  stamp: "page.stamp('1202', { x: 330, y: 280, at: 'alarm', angle: -0.14 })",
  /** The pause: one almost empty panel, one small detail moving in held steps. */
  pause:
    "page.panel([70, 64, 604, 66, 602, 300, 72, 297], { boil: 0.3 }).draw((g, t) => { g.plate.rect(0, 0, 640, 360, 'greyLight'); g.rect(388 - Math.floor(t / 0.45) * 2, 224, 44, 8, 'greyDark'); })",
  /** A panel slammed onto the page past the margin, and the page hit. */
  slam: "page.panel([402, 34, 628, 28, 640, 186, 396, 192], { border: 3 }).enter({ at: 'contact', kind: 'slam' })",
  shake: "page.shake('contact', 5)",
  /** Gutters closing: a panel morphs to a tighter quad. */
  squeeze:
    "page.panels('strip')[1].morph([250, 40, 390, 44, 386, 320, 254, 316], { at: 'sixty seconds', dur: 1.5 })",
  /** The outline of a torn cutaway opening (points to ink and clip to). */
  torn: "page.util.torn(112, 124, 300, 308, 'cut')",
  /** Checklist marks: a pencil tick, a strike-through, the highlighter on the answer. */
  tick: 'page.tick(60, 96, { at: 1.2, dur: 0.16 })',
  strike: "page.strike(60, 232, 130, { at: 'abort', dur: 0.3, color: 'ink' })",
  highlight: "page.highlight([144, 216, 194, 238], { at: 'go', dur: 0.22, color: 'yellow' })",
  /** The one line lettered large. */
  bigLine:
    "page.balloon('THE EAGLE\\nHAS LANDED.', { x: 150, y: 134, at: 'landed', size: 2, tail: [40, 214] })",
  /** A flashback: the page re-inked as an old print, two beats on a stair (one of many). */
  flashback:
    "page.flashback({ intent: 'the deadline was set eight years earlier, in 1961: the Moon before the decade was out', when: 'EIGHT YEARS EARLIER...', at: 0.3, cover: 'page', arrange: 'stair', beats: [{ at: 0.9, draw: (g, t, [w, h]) => { g.plate.rect(0, 0, w, h, 'paper'); g.ink([12, h - 14, w / 2, 18, w - 12, h - 20], { closed: false, key: 'goal' }); }, weight: 1.3 }, { at: 'the decade', draw: (g, t, [w, h]) => g.text('1969', 10, h / 2, { scale: 2 }), caption: 'MEANWHILE...' }], stamp: { text: '1961', at: 3.4 } })",
  /** A spread: a small panel pulls back to the one picture across the fold (one of many). */
  spread:
    "page.spread({ intent: 'the landing site is one vast grey plain and Eagle is a speck on it', art: (g, t) => { g.rect(-20, -20, 680, 400, 'greyLight'); g.ink([-20, 252, 300, 244, 660, 250], { closed: false, key: 'horizon' }); }, assemble: 'pull-back', focus: [420, 230], delay: 0.3, dur: 1.6, beats: [3.6, 'tranquility'] })",
} as const;

export type ComicSnippet = keyof typeof COMIC_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const comicSnippet = (name: ComicSnippet): string => `\`${COMIC_SNIPPETS[name]}\``;
