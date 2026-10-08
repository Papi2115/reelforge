/**
 * Body plans of `art.animal` (PLAN.md#13.15a): one parametric four-legged body per species preset
 * (barrel, legs, neck, head with snout, ears, tail, the feature that names it). Plain data.
 */

export const SPECIES = [
  'deer',
  'horse',
  'dog',
  'wolf',
  'fox',
  'cat',
  'lion',
  'bear',
  'cow',
  'camel',
  'sheep',
  'pig',
  'rabbit',
] as const;
export const EARS = ['point', 'round', 'long', 'floppy', 'side'] as const;
export const TAILS = ['short', 'long', 'bushy', 'curl', 'tuft'] as const;
export const FEATURES = [
  'none',
  'antlers',
  'mane',
  'hump',
  'wool',
  'spots',
  'horns',
  'stripes',
] as const;
export const ANIMAL_POSES = ['stand', 'walk', 'run', 'sit', 'graze', 'leap', 'alert'] as const;

export interface Body {
  /** Body centre height, half length, half height; leg radius. */
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly leg: number;
  /** Neck base -> head centre (offsets from the body's front top), neck radius. */
  readonly neck: readonly [number, number, number];
  /** Head half sizes and snout length. */
  readonly head: readonly [number, number, number];
  readonly ears: (typeof EARS)[number];
  readonly tail: (typeof TAILS)[number];
  readonly feature: (typeof FEATURES)[number];
  readonly fill: string;
  readonly belly: string;
}

export const BODIES: Readonly<Record<(typeof SPECIES)[number], Body>> = {
  deer: {
    y: 60,
    rx: 28,
    ry: 12,
    leg: 2.4,
    neck: [8, -26, 5],
    head: [8, 6, 8],
    ears: 'point',
    tail: 'short',
    feature: 'antlers',
    fill: 'aged',
    belly: 'paper',
  },
  horse: {
    y: 60,
    rx: 33,
    ry: 15,
    leg: 3.6,
    neck: [10, -26, 7.5],
    head: [8, 6.5, 12],
    ears: 'point',
    tail: 'long',
    feature: 'mane',
    fill: 'sepiaMid',
    belly: 'sepiaTan',
  },
  dog: {
    y: 42,
    rx: 27,
    ry: 12,
    leg: 4,
    neck: [6, -20, 7],
    head: [10, 9, 8],
    ears: 'floppy',
    tail: 'curl',
    feature: 'none',
    fill: 'aged',
    belly: 'shade',
  },
  wolf: {
    y: 46,
    rx: 29,
    ry: 12,
    leg: 3.8,
    neck: [7, -20, 7.5],
    head: [10, 8.5, 10],
    ears: 'point',
    tail: 'bushy',
    feature: 'none',
    fill: 'greyMid',
    belly: 'greyLight',
  },
  fox: {
    y: 34,
    rx: 25,
    ry: 10,
    leg: 3,
    neck: [6, -16, 6],
    head: [9, 7.5, 9],
    ears: 'point',
    tail: 'bushy',
    feature: 'none',
    fill: 'yellow',
    belly: 'paper',
  },
  cat: {
    y: 33,
    rx: 24,
    ry: 10,
    leg: 3,
    neck: [5, -16, 6],
    head: [10, 9, 3],
    ears: 'point',
    tail: 'curl',
    feature: 'none',
    fill: 'greyMid',
    belly: 'greyLight',
  },
  lion: {
    y: 50,
    rx: 32,
    ry: 14,
    leg: 5,
    neck: [6, -18, 9],
    head: [12, 11, 6],
    ears: 'round',
    tail: 'tuft',
    feature: 'mane',
    fill: 'yellow',
    belly: 'yellowPale',
  },
  bear: {
    y: 50,
    rx: 35,
    ry: 21,
    leg: 8,
    neck: [6, -14, 11],
    head: [12, 11, 7],
    ears: 'round',
    tail: 'short',
    feature: 'none',
    fill: 'sepiaMid',
    belly: 'sepiaTan',
  },
  cow: {
    y: 58,
    rx: 36,
    ry: 18,
    leg: 4.6,
    neck: [8, -12, 9],
    head: [9, 9, 6],
    ears: 'side',
    tail: 'tuft',
    feature: 'spots',
    fill: 'paper',
    belly: 'paper',
  },
  camel: {
    y: 66,
    rx: 30,
    ry: 13,
    leg: 3,
    neck: [16, -26, 5.5],
    head: [9, 6, 8],
    ears: 'round',
    tail: 'tuft',
    feature: 'hump',
    fill: 'aged',
    belly: 'shade',
  },
  sheep: {
    y: 40,
    rx: 27,
    ry: 17,
    leg: 2.4,
    neck: [4, -8, 6],
    head: [7, 8, 5],
    ears: 'side',
    tail: 'short',
    feature: 'wool',
    fill: 'paper',
    belly: 'shade',
  },
  pig: {
    y: 36,
    rx: 30,
    ry: 16,
    leg: 4,
    neck: [3, -4, 9],
    head: [10, 10, 5],
    ears: 'floppy',
    tail: 'curl',
    feature: 'none',
    fill: 'shade',
    belly: 'shade',
  },
  rabbit: {
    y: 24,
    rx: 18,
    ry: 12,
    leg: 3.4,
    neck: [3, -10, 6],
    head: [8, 7.5, 3],
    ears: 'long',
    tail: 'short',
    feature: 'none',
    fill: 'greyLight',
    belly: 'paper',
  },
};
