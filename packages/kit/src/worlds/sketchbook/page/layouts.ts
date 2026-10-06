/**
 * Composition presets of a look A story page (`kit.fx.sketchPage({ layout })`, then
 * `page.slots()`): where the hero figure, the big label, the second figure, the diagram or the
 * scene strip go (page px), so four story pages in a film do not share one grammar (real test
 * film 2: every A page had small figures bottom-left and a label on top). Each slot is nudged by
 * the page seed (deliberate roughness, never a grid). Rule: the hero figure is >= 25 % of the page
 * height (>= 135 px of 540); every preset's figures are taller.
 */
import { rnd } from '../draw/math.js';

export const LAYOUT_NAMES = ['hero-left', 'facing', 'tall-diagram', 'wide-strip'] as const;
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
};

/** The slots of a preset for a page seed. */
export function layoutSlots(name: LayoutName, seed: number): LayoutSlots {
  const nudge: Nudge = (base, spread, salt) =>
    Math.round((base + rnd(-spread, spread, seed, salt, 991)) * 10) / 10;
  return { name, ...PRESETS[name](nudge) };
}
