/**
 * Mascot expressions (ADR-024), 1:1 from the concept page: voxel faces (eye shape and size, brow
 * raise and tilt, mouth, pupil look) and the 12x8 pixel bitmaps of Screen's display, plus the
 * seeded blink schedule (a pure function of time: same t and seed, same lids).
 */
import type { Expression } from './clips.js';
import { bump, hash } from './math.js';

export type EyeShape = 'open' | 'happy' | 'wide' | 'half';
export type MouthShape = 'smile' | 'grin' | 'o' | 'flat' | 'small' | 'side';
export const MOUTH_SHAPES: readonly MouthShape[] = ['smile', 'grin', 'o', 'flat', 'small', 'side'];

/** Pairs are [right eye, left eye]. */
export interface FaceExpression {
  readonly eye: EyeShape;
  readonly size: readonly [number, number];
  /** Brow raise, voxels. */
  readonly brow: readonly [number, number];
  /** Brow tilt; > 0 lifts the inner end. */
  readonly tilt: readonly [number, number];
  readonly mouth: MouthShape;
  /** Pupil (or eye) offset [x, y]. */
  readonly look: readonly [number, number];
}

export const FACE_EXPRESSIONS: Readonly<Record<Expression, FaceExpression>> = {
  neutral: {
    eye: 'open',
    size: [1, 1],
    brow: [0, 0],
    tilt: [0, 0],
    mouth: 'smile',
    look: [0, 0],
  },
  joy: {
    eye: 'happy',
    size: [1, 1],
    brow: [0.8, 0.8],
    tilt: [0.1, 0.1],
    mouth: 'grin',
    look: [0, 0],
  },
  curious: {
    eye: 'open',
    size: [0.9, 1.2],
    brow: [-0.2, 1.4],
    tilt: [-0.2, 0.2],
    mouth: 'small',
    look: [0.6, 0.3],
  },
  surprised: {
    eye: 'wide',
    size: [1, 1],
    brow: [1.6, 1.6],
    tilt: [0.15, 0.15],
    mouth: 'o',
    look: [0, 0],
  },
  thinking: {
    eye: 'open',
    size: [1, 1],
    brow: [1.0, -0.3],
    tilt: [0.25, -0.35],
    mouth: 'side',
    look: [-0.7, 0.8],
  },
  sceptical: {
    eye: 'half',
    size: [1, 1],
    brow: [-0.4, 1.0],
    tilt: [-0.35, 0.1],
    mouth: 'flat',
    look: [0.4, 0],
  },
  alarm: {
    eye: 'wide',
    size: [1.1, 1.1],
    brow: [1.8, 1.8],
    tilt: [0.3, 0.3],
    mouth: 'o',
    look: [0, 0],
  },
};

/**
 * Lid opening (1 open, 0.1 closed) at global time t: a blink every 3.3-4.7 s (period from the
 * seed), sometimes a double blink.
 */
export function blinkAt(t: number, seed: number): number {
  const period = 3.3 + 1.4 * hash(seed);
  const x = t + seed * 1.7;
  const n = Math.floor(x / period);
  const phase = x - n * period;
  const one = (v: number): number => 1 - 0.9 * bump(0, 0.05, 0.08, 0.16, v);
  return hash(n + seed * 13) > 0.65 ? Math.min(one(phase), one(phase - 0.22)) : one(phase);
}

/** Screen's face: 5 eye rows + 3 mouth rows of 12 pixels ('#' lit). */
export interface ScreenFace {
  readonly eyes: readonly string[];
  readonly mouth: readonly string[];
  /** The eyes never close (happy arcs, the alarm bar). */
  readonly noBlink?: boolean;
  /** Animated "..." in the mouth row (thinking). */
  readonly dots?: boolean;
  /** Pixel colour: the alarm face is pink and flashes. */
  readonly alarm?: boolean;
}

export const SCREEN_FACES: Readonly<Record<Expression, ScreenFace>> = {
  neutral: {
    eyes: ['............', '............', '..##....##..', '..##....##..', '............'],
    mouth: ['............', '....####....', '............'],
  },
  joy: {
    eyes: ['............', '..##....##..', '.#..#..#..#.', '............', '............'],
    mouth: ['..#......#..', '...######...', '............'],
    noBlink: true,
  },
  curious: {
    eyes: ['.###........', '.#.#....##..', '.###....##..', '............', '............'],
    mouth: ['............', '.....##.....', '............'],
  },
  surprised: {
    eyes: ['.###....###.', '.#.#....#.#.', '.###....###.', '............', '............'],
    mouth: ['.....##.....', '.....##.....', '............'],
  },
  thinking: {
    eyes: ['.##....##...', '.##....##...', '............', '............', '............'],
    mouth: ['............', '............', '...#..#..#..'],
    dots: true,
  },
  sceptical: {
    eyes: ['............', '..###.......', '........##..', '..###...##..', '............'],
    mouth: ['............', '......###...', '............'],
  },
  alarm: {
    eyes: ['.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....'],
    mouth: ['............', '.....##.....', '............'],
    noBlink: true,
    alarm: true,
  },
};

export const SCREEN_BLINK_EYES: readonly string[] = [
  '............',
  '............',
  '............',
  '..##....##..',
  '............',
];

export const SCREEN_COLUMNS = 12;
export const SCREEN_ROWS = 8;

/** Pixel colour index of Screen's display: 0 background, 1 lit, 2 alarm, 3 alarm flash. */
export type ScreenPixel = 0 | 1 | 2 | 3;

/** The 12x8 display (row-major, top row first) for an expression at global time t. */
export function screenPixels(expression: Expression, t: number, blink: number): ScreenPixel[] {
  const face = SCREEN_FACES[expression];
  const eyes = blink < 0.5 && face.noBlink !== true ? SCREEN_BLINK_EYES : face.eyes;
  const dots = face.dots === true ? Math.floor(t * 3) % 4 : 3;
  const flash = face.alarm === true && Math.floor(t * 4) % 2 === 1;
  const lit: ScreenPixel = face.alarm === true ? (flash ? 3 : 2) : 1;
  const pixels: ScreenPixel[] = [];
  [...eyes, ...face.mouth].forEach((row, y) => {
    for (let x = 0; x < SCREEN_COLUMNS; x += 1) {
      const on = row[x] === '#' && !(face.dots === true && y === 7 && x > 3 * dots);
      pixels.push(on ? lit : 0);
    }
  });
  return pixels;
}
