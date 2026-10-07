/**
 * Animal sprites of the open vocabulary, 8 bits wide, facing right, two frames each (flap, swim,
 * walk, crawl): birds, fish, quadrupeds built from traits (neck, legs, horns or antlers, a hump, a
 * tail: a deer, a horse, a camel, a dog, a cow, a bear), insects and reptiles. Seeded roughness;
 * the result goes through the sprite validator like a hand-drawn sprite.
 */
import type { SpriteSpec } from '../sprite.js';
import { art, chance, pick } from './bits.js';

export function bird(p: { seed: number; colour?: string | undefined }): SpriteSpec {
  const span = pick(p.seed, 1, 0, 1);
  const up = art(span ? '#......#' : '.#....#.', '.#....#.', '..#..#..', '...##...');
  const down = art('........', '...##...', '..#..#..', span ? '#......#' : '.#....#.');
  return { describe: 'bird', frames: [up, down], colours: p.colour ?? 'cream', fps: 5, rowH: 2 };
}

export function fish(p: {
  seed: number;
  colour?: string | undefined;
  stripe?: string | undefined;
}) {
  const long = chance(p.seed, 2, 0.5);
  const a = art(
    long ? '..####..' : '...###..',
    '#.#####.',
    '.####.##',
    '#.#####.',
    long ? '..####..' : '...###..',
  );
  const b = art(a[0] ?? '', '.######.', '#####.##', '.######.', a[4] ?? '');
  const main = p.colour ?? 'gold';
  return {
    describe: 'fish',
    frames: [a, b],
    colours: [main, main, p.stripe ?? 'orange', main, main],
    fps: 4,
  } satisfies SpriteSpec;
}

export type Horns = 'none' | 'antlers' | 'horns' | 'ears';

export interface QuadrupedParams {
  readonly seed: number;
  readonly neck: number;
  readonly legs: number;
  readonly horns: Horns;
  readonly hump: boolean;
  readonly tail: boolean;
  readonly bulk: number;
  readonly colour?: string | undefined;
  readonly legColour?: string | undefined;
  readonly hornColour?: string | undefined;
}

const HORN_ROWS: Record<Horns, readonly string[]> = {
  none: [],
  antlers: ['....#..#', '....#.#.'],
  horns: ['.....#.#'],
  ears: ['.....#..'],
};

/** Bitwise OR of two DSL rows. */
function or(a: string, b: string): string {
  return Array.from(a)
    .map((ch, i) => (ch === '#' || b[i] === '#' ? '#' : '.'))
    .join('');
}

function quadFrame(p: QuadrupedParams, walk: number): { rows: string[]; parts: string[] } {
  const rows: string[] = [];
  const parts: string[] = [];
  const push = (bits: string, part: string): void => {
    rows.push(bits);
    parts.push(part);
  };
  for (const row of HORN_ROWS[p.horns]) push(row, 'horn');
  push('.....##.', 'head');
  push(chance(p.seed, 3, 0.5) ? '.....###' : '....####', 'head');
  const neck = Math.max(0, Math.min(3, Math.round(p.neck)));
  for (let i = 0; i < neck; i += 1) push(i === neck - 1 ? '....##..' : '.....##.', 'neck');
  const above = rows.length - 1;
  if (p.tail) rows[above] = or(rows[above] ?? '', '#.......');
  if (p.hump) {
    rows[above] = or(rows[above] ?? '', '..###...');
    if (above > 0) rows[above - 1] = or(rows[above - 1] ?? '', '...#....');
  }
  const bulk = Math.max(2, Math.min(3, Math.round(p.bulk)));
  for (let i = 0; i < bulk; i += 1) push(i === bulk - 1 ? '.#####..' : '.######.', 'body');
  const legs = Math.max(2, Math.min(4, Math.round(p.legs)));
  for (let i = 0; i < legs; i += 1)
    push(walk === 0 || i === 0 ? '.#...#..' : i === legs - 1 ? '#.#.#.#.' : '.#.#.#..', 'leg');
  return { rows, parts };
}

export function quadruped(p: QuadrupedParams): SpriteSpec {
  const a = quadFrame(p, 0);
  const b = quadFrame(p, 1);
  const ink: Record<string, string> = {
    horn: p.hornColour ?? 'tan',
    head: p.colour ?? 'teak',
    neck: p.colour ?? 'teak',
    body: p.colour ?? 'teak',
    leg: p.legColour ?? 'walnut',
  };
  return {
    describe: 'four-legged animal',
    frames: [a.rows, b.rows],
    colours: a.parts.map((part) => ink[part] ?? 'teak'),
    fps: 6,
    rowH: 2,
  };
}

export type InsectType = 'bee' | 'locust' | 'beetle' | 'butterfly';

export function insect(p: { type: InsectType; seed: number }): SpriteSpec {
  const kinds: Record<InsectType, { frames: string[][]; colours: string[] }> = {
    bee: {
      frames: [
        art('..#.#...', '.#####..', '######.#', '.#####..'),
        art('........', '.#####..', '######.#', '.#####..'),
      ],
      colours: ['aqua', 'gold', 'walnutDark', 'gold'],
    },
    locust: {
      frames: [
        art('.####...', '#######.', '.##.##.#', '#..#..#.'),
        art('........', '#######.', '.##.##.#', '.#..#..#'),
      ],
      colours: ['aqua', 'avocado', 'avocado', 'oliveDark'],
    },
    beetle: {
      frames: [
        art('..###...', '.#####.#', '.######.', '#.#.#.#.'),
        art('..###...', '.#####.#', '.######.', '.#.#.#.#'),
      ],
      colours: ['greyDark', 'teal', 'tealDark', 'void'],
    },
    butterfly: {
      frames: [
        art('##...##.', '###.###.', '.#####..', '##.#.##.'),
        art('........', '.##.##..', '..###...', '.#.#.#..'),
      ],
      colours: ['orange', 'gold', 'walnutDark', 'orange'],
    },
  };
  const k = kinds[p.type];
  return { describe: p.type, frames: k.frames, colours: k.colours, fps: 8, rowH: 2 };
}

export type ReptileType = 'lizard' | 'snake' | 'turtle';

export function reptile(p: { type: ReptileType; seed: number }): SpriteSpec {
  if (p.type === 'snake')
    return {
      describe: 'snake',
      frames: [art('......##', '.##..##.', '#..##...'), art('.....##.', '##..##..', '..##....')],
      colours: ['avocado', 'avocado', 'oliveDark'],
      fps: 4,
      rowH: 2,
    };
  if (p.type === 'turtle')
    return {
      describe: 'turtle',
      frames: [
        art('..###...', '.#####..', '#######.', '.#...#.#'),
        art('..###...', '.#####..', '#######.', '#...#..#'),
      ],
      colours: ['avocado', 'oliveDark', 'avocado', 'tan'],
      fps: 3,
      rowH: 2,
    };
  const flick = pick(p.seed, 1, 0, 1);
  return {
    describe: 'lizard',
    frames: [
      art('.#...#..', flick ? '#######.' : '.#######', '..#...#.'),
      art('..#...#.', flick ? '#######.' : '.#######', '.#...#..'),
    ],
    colours: ['oliveDark', 'avocado', 'oliveDark'],
    fps: 6,
    rowH: 2,
  };
}
