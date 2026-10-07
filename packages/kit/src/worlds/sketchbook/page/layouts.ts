/**
 * Composition presets of a look A story page (`kit.fx.sketchPage({ layout })`, then
 * `page.slots()`): where the hero figure, the big label, the second figure, the diagram or the
 * scene strip go (page px), so four story pages in a film do not share one grammar (real test
 * film 2: every A page had small figures bottom-left and a label on top). Each slot is nudged by
 * the page seed (deliberate roughness, never a grid). Rule: the hero figure is >= 25 % of the page
 * height (>= 135 px of 540); every preset's figures are taller. The open-vocabulary presets
 * (PLAN.md#13.15a) change the vertical structure, not only where the figure stands: a map seen
 * from above, one object in close-up, a landscape with a sky band, two columns of facts, a big
 * number (their hero is the map, the object, the drawing: >= 25 % of the page height too).
 */
import { rnd } from '../draw/math.js';

export const LAYOUT_NAMES = [
  'hero-left',
  'facing',
  'tall-diagram',
  'wide-strip',
  'top-down-map',
  'close-up',
  'landscape',
  'two-column',
  'big-number',
] as const;
export type LayoutName = (typeof LAYOUT_NAMES)[number];

/** A figure slot: feet at (x, y), height h; `face` = which way it should turn (pose turn). */
export interface FigureSlot {
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly face: -1 | 0 | 1;
}
/** A text slot: baseline start and cap size. */
export interface TextSlot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly rot: number;
}
/** A box [x, y, w, h] (page px). */
export type BoxSlot = readonly [number, number, number, number];

export interface LayoutSlots {
  readonly name: LayoutName;
  /** The hero figure (always >= 25 % of the page height). */
  readonly hero: FigureSlot;
  /** Other figures (facing: the one opposite; wide-strip: two more along the ground). */
  readonly figures: readonly FigureSlot[];
  /** The one big label. */
  readonly label: TextSlot;
  /** A small note under or beside the label. */
  readonly note: TextSlot;
  /** Room for the named thing: a prop, the diagram, the space between two figures. */
  readonly thing: BoxSlot;
  /** The ground line [x0, y, x1] the figures stand on. */
  readonly ground: readonly [number, number, number];
  /** Two-column pages: the fact boxes under the two drawings. */
  readonly columns?: readonly BoxSlot[];
  /** Landscape pages: the sky band for clouds, sun, birds. */
  readonly sky?: BoxSlot;
}

/** Hero figures are at least this tall (25 % of the 540 px page). */
export const HERO_MIN_HEIGHT = 135;

type Nudge = (base: number, spread: number, salt: number) => number;

const PRESETS: Readonly<Record<LayoutName, (n: Nudge) => Omit<LayoutSlots, 'name'>>> = {
  // Figure large centre-left, the big label beside its head, the thing at its hand.
  'hero-left': (n) => ({
    hero: { x: n(300, 18, 1), y: n(478, 8, 2), h: n(330, 20, 3), face: 1 },
    figures: [],
    label: { x: n(500, 20, 4), y: n(170, 14, 5), size: n(64, 6, 6), rot: n(-3, 2, 7) },
    note: { x: n(520, 20, 8), y: n(232, 10, 9), size: 22, rot: n(-1, 2, 10) },
    thing: [n(470, 20, 11), n(290, 16, 12), 330, 170],
    ground: [n(120, 20, 13), n(480, 6, 14), n(560, 30, 15)],
  }),
  // Two figures facing each other across the page, the label above the gap between them.
  facing: (n) => ({
    hero: { x: n(250, 16, 21), y: n(470, 8, 22), h: n(240, 16, 23), face: 1 },
    figures: [{ x: n(700, 16, 24), y: n(472, 8, 25), h: n(215, 16, 26), face: -1 }],
    label: { x: n(330, 24, 27), y: n(112, 12, 28), size: n(48, 5, 29), rot: n(-2, 2, 30) },
    note: { x: n(380, 24, 31), y: n(166, 10, 32), size: 20, rot: n(1, 2, 33) },
    thing: [n(360, 16, 34), n(250, 16, 35), 230, 150],
    ground: [n(130, 20, 36), n(474, 6, 37), n(840, 20, 38)],
  }),
  // A tall figure on the left, a diagram filling the right, its label under it.
  'tall-diagram': (n) => ({
    hero: { x: n(190, 14, 41), y: n(505, 6, 42), h: n(400, 20, 43), face: 1 },
    figures: [],
    label: { x: n(420, 18, 44), y: n(486, 8, 45), size: n(34, 4, 46), rot: n(-2, 2, 47) },
    note: { x: n(700, 20, 48), y: n(76, 8, 49), size: 20, rot: n(2, 2, 50) },
    thing: [n(400, 14, 51), n(100, 12, 52), n(480, 20, 53), n(330, 16, 54)],
    ground: [n(90, 16, 55), n(508, 4, 56), n(300, 20, 57)],
  }),
  // A wide scene strip across the page: three figures along one ground, title and caption.
  'wide-strip': (n) => ({
    hero: { x: n(470, 24, 61), y: n(420, 8, 62), h: n(230, 16, 63), face: 0 },
    figures: [
      { x: n(190, 20, 64), y: n(418, 8, 65), h: n(170, 14, 66), face: 1 },
      { x: n(760, 20, 67), y: n(422, 8, 68), h: n(185, 14, 69), face: -1 },
    ],
    label: { x: n(90, 16, 70), y: n(110, 10, 71), size: n(46, 5, 72), rot: n(-2, 2, 73) },
    note: { x: n(560, 30, 74), y: n(488, 8, 75), size: 22, rot: n(-1, 2, 76) },
    thing: [n(70, 10, 77), n(150, 10, 78), n(820, 14, 79), n(290, 12, 80)],
    ground: [n(70, 14, 81), n(422, 6, 82), n(890, 14, 83)],
  }),
  // Seen from above: a map fills most of the page (the hero), the label in the free corner.
  'top-down-map': (n) => ({
    hero: { x: n(440, 20, 91), y: n(505, 4, 92), h: n(430, 10, 93), face: 0 },
    figures: [],
    label: { x: n(712, 14, 94), y: n(96, 10, 95), size: n(40, 4, 96), rot: n(-4, 2, 97) },
    note: { x: n(716, 14, 98), y: n(470, 10, 99), size: 20, rot: n(2, 2, 100) },
    thing: [n(120, 12, 101), n(80, 10, 102), n(570, 14, 103), n(410, 8, 104)],
    ground: [n(120, 12, 105), n(492, 4, 106), n(690, 14, 107)],
  }),
  // One object drawn huge (a close-up), the label and a detail callout beside it.
  'close-up': (n) => ({
    hero: { x: n(320, 18, 111), y: n(500, 6, 112), h: n(400, 14, 113), face: 0 },
    figures: [],
    label: { x: n(590, 16, 114), y: n(150, 12, 115), size: n(58, 5, 116), rot: n(-3, 2, 117) },
    note: { x: n(600, 16, 118), y: n(214, 10, 119), size: 22, rot: n(-1, 2, 120) },
    thing: [n(570, 14, 121), n(280, 12, 122), 320, 190],
    ground: [n(110, 16, 123), n(500, 4, 124), n(540, 20, 125)],
  }),
  // A wide landscape: sky band on top, a far middle band, a ground with two figures or trees.
  landscape: (n) => ({
    hero: { x: n(650, 20, 131), y: n(440, 6, 132), h: n(230, 14, 133), face: -1 },
    figures: [{ x: n(250, 20, 134), y: n(444, 6, 135), h: n(150, 10, 136), face: 1 }],
    label: { x: n(90, 16, 137), y: n(104, 10, 138), size: n(44, 4, 139), rot: n(-2, 2, 140) },
    note: { x: n(560, 24, 141), y: n(496, 6, 142), size: 20, rot: n(-1, 2, 143) },
    thing: [n(80, 12, 144), n(250, 10, 145), n(560, 20, 146), n(190, 10, 147)],
    ground: [n(60, 10, 148), n(442, 6, 149), n(900, 10, 150)],
    sky: [n(360, 20, 151), n(48, 6, 152), n(520, 16, 153), n(150, 10, 154)],
  }),
  // Two columns of facts, each under its own drawing (compare two things).
  'two-column': (n) => ({
    hero: { x: n(250, 14, 161), y: n(300, 6, 162), h: n(190, 10, 163), face: 1 },
    figures: [{ x: n(700, 14, 164), y: n(302, 6, 165), h: n(185, 10, 166), face: -1 }],
    label: { x: n(80, 12, 167), y: n(78, 8, 168), size: n(36, 4, 169), rot: n(-1, 1.5, 170) },
    note: { x: n(400, 30, 171), y: n(506, 4, 172), size: 18, rot: n(1, 2, 173) },
    thing: [n(470, 6, 174), n(110, 8, 175), 20, 360],
    ground: [n(90, 12, 176), n(302, 4, 177), n(880, 12, 178)],
    columns: [
      [n(80, 10, 179), n(334, 8, 180), 360, 150],
      [n(520, 10, 181), n(336, 8, 182), 360, 150],
    ],
  }),
  // One huge number is the hero of the text, a drawing beside it says what it counts.
  'big-number': (n) => ({
    hero: { x: n(730, 20, 191), y: n(470, 8, 192), h: n(250, 14, 193), face: -1 },
    figures: [],
    label: { x: n(90, 14, 194), y: n(330, 14, 195), size: n(170, 10, 196), rot: n(-3, 2, 197) },
    note: { x: n(100, 14, 198), y: n(400, 10, 199), size: 30, rot: n(-1, 2, 200) },
    thing: [n(560, 14, 201), n(60, 8, 202), 330, 140],
    ground: [n(560, 14, 203), n(472, 4, 204), n(890, 8, 205)],
  }),
};

/** The slots of a preset for a page seed. */
export function layoutSlots(name: LayoutName, seed: number): LayoutSlots {
  const nudge: Nudge = (base, spread, salt) =>
    Math.round((base + rnd(-spread, spread, seed, salt, 991)) * 10) / 10;
  return { name, ...PRESETS[name](nudge) };
}
