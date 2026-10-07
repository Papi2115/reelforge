/**
 * Vehicles, buildings and items of the open vocabulary: 8-bit templates with one colour per row,
 * a few seeded bits (a lit window, a dent) and a suggested NUSIZ stretch for the big ones (a
 * castle is a player at size 4, as a 2600 would draw it). Every result passes the sprite
 * validator; colours can be overridden per part.
 */
import { hash } from '../../core/math.js';
import type { SpriteSpec } from '../sprite.js';
import { art } from './bits.js';

export const VEHICLES = ['car', 'truck', 'boat', 'rocket', 'cart', 'plane'] as const;
export const BUILDINGS = ['hut', 'house', 'castle', 'tower', 'factory', 'office'] as const;
export const ITEMS = ['key', 'gem', 'coin', 'potion', 'document', 'flag', 'heart'] as const;

export type Vehicle = (typeof VEHICLES)[number];
export type Building = (typeof BUILDINGS)[number];
export type Item = (typeof ITEMS)[number];

interface Template {
  readonly frames: readonly (readonly string[])[];
  /** Part letter per row: m = main ink, s = second, d = dark, l = light, a = accent. */
  readonly parts: string;
  readonly ink: Readonly<Record<string, string>>;
  readonly size?: 1 | 2 | 4;
  readonly fps?: number;
}

const VEHICLE_ART: Record<Vehicle, Template> = {
  car: {
    frames: [art('..####..', '.#.##.#.', '########', '########', '.##..##.'), art('..####..', '.#.##.#.', '########', '########', '.#.#.#..')],
    parts: 'mmmsd', ink: { m: 'orange', s: 'rust', d: 'greyDark' }, fps: 8,
  },
  truck: {
    frames: [art('.....###', '.....#.#', '########', '########', '.##...##')],
    parts: 'mmssd', ink: { m: 'gold', s: 'teak', d: 'greyDark' },
  },
  boat: {
    frames: [art('...#....', '...##...', '...###..', '...####.', '...#....', '########', '.######.', '..####..'), art('...#....', '...##...', '...###..', '...####.', '...#....', '########', '.######.', '..####..')],
    parts: 'llllsmmd', ink: { l: 'cream', s: 'walnut', m: 'teak', d: 'walnut' },
  },
  rocket: {
    frames: [art('...##...', '..####..', '..#..#..', '..####..', '..####..', '.######.', '##.##.##', '..#..#..', '...##...'), art('...##...', '..####..', '..#..#..', '..####..', '..####..', '.######.', '##.##.##', '...##...', '..#..#..')],
    parts: 'ammmmmsla', ink: { a: 'orange', m: 'white', s: 'grey', l: 'gold' }, fps: 10,
  },
  cart: {
    frames: [art('#......#', '########', '.######.', '.#....#.')],
    parts: 'mmsd', ink: { m: 'teak', s: 'walnut', d: 'greyDark' },
  },
  plane: {
    frames: [art('#...#...', '#..###..', '########', '...###..', '....#...')],
    parts: 'smmms', ink: { m: 'grey', s: 'greyDark' },
  },
}; // prettier-ignore

const BUILDING_ART: Record<Building, Template> = {
  hut: { frames: [art('...##...', '..####..', '.######.', '########', '.#.##.#.', '.######.', '.##..##.')], parts: 'sssslll', ink: { s: 'tan', l: 'teak' }, size: 2 },
  house: { frames: [art('...##...', '..####..', '.######.', '########', '.######.', '.#.##.#.', '.######.', '.###.##.')], parts: 'ssssmmmm', ink: { s: 'rust', m: 'cream' }, size: 2 },
  castle: { frames: [art('#.#..#.#', '###..###', '###..###', '########', '########', '##.##.##', '########', '###..###')], parts: 'mmmmmsmm', ink: { m: 'grey', s: 'greyDark' }, size: 4 },
  tower: { frames: [art('.#.##.#.', '.######.', '..####..', '..#..#..', '..####..', '..####..', '..#..#..', '..####..', '..####..', '..#..#..')], parts: 'mmmmmmmmmm', ink: { m: 'grey' }, size: 2 },
  factory: { frames: [art('.#......', '.#......', '.#.#.#..', '########', '########', '#.#.#.#.', '########', '###..###')], parts: 'ddmmmmmm', ink: { d: 'greyDark', m: 'teak' }, size: 4 },
  office: { frames: [art('########', '#.#.#.#.', '########', '#.#.#.#.', '########', '#.#.#.#.', '########', '#.#.#.#.', '########', '###..###')], parts: 'mlmlmlmlmm', ink: { m: 'greyDark', l: 'greyDark' }, size: 2 },
}; // prettier-ignore

const ITEM_ART: Record<Item, Template> = {
  key: { frames: [art('.##.....', '#..#####', '.##..#.#')], parts: 'mmm', ink: { m: 'gold' } },
  gem: { frames: [art('..##....', '.####...', '######..', '.####...', '..##....'), art('..##....', '.#.##...', '######..', '.####...', '..##....')], parts: 'llmmd', ink: { l: 'aqua', m: 'teal', d: 'tealDark' }, fps: 4 },
  coin: { frames: [art('.####...', '##..##..', '##..##..', '.####...'), art('..##....', '..##....', '..##....', '..##....')], parts: 'mmmm', ink: { m: 'gold' }, fps: 5 },
  potion: { frames: [art('..##....', '..##....', '.####...', '######..', '######..', '.####...')], parts: 'ddmmmm', ink: { d: 'tan', m: 'aqua' } },
  document: { frames: [art('#####...', '#...##..', '######..', '#....#..', '######..', '#....#..', '######..')], parts: 'mmmmmmm', ink: { m: 'cream' } },
  flag: { frames: [art('#####...', '#####...', '####....', '#.......', '#.......', '#.......'), art('####....', '#####...', '#####...', '#.......', '#.......', '#.......')], parts: 'mmmsss', ink: { m: 'orange', s: 'grey' }, fps: 4 },
  heart: { frames: [art('.##.##..', '#######.', '.#####..', '..###...', '...#....')], parts: 'mmmmm', ink: { m: 'crimson' } },
}; // prettier-ignore

function fromTemplate(
  describe: string,
  t: Template,
  colours: Readonly<Record<string, string>> | undefined,
  seed: number,
  roughRows: number,
): SpriteSpec {
  const ink = { ...t.ink, ...colours };
  // seeded roughness: one bit of a row nudged (never the outline's top row)
  const frames = t.frames.map((rows) =>
    rows.map((row, y) => {
      if (roughRows === 0 || y === 0 || hash(seed, y, 11) > roughRows / rows.length) return row;
      const x = Math.floor(hash(seed, y, 12) * 8);
      const bit = row[x] === '#' && row[x - 1] === '#' && row[x + 1] === '#' ? '.' : row[x];
      return row.slice(0, x) + (bit ?? '.') + row.slice(x + 1);
    }),
  );
  return {
    describe,
    frames,
    colours: Array.from(t.parts).map((part) => ink[part] ?? 'grey'),
    fps: t.fps ?? 6,
    size: t.size ?? 1,
    rowH: 2,
  };
}

export function vehicle(p: { type: Vehicle; seed: number; colours?: Record<string, string> }) {
  return fromTemplate(p.type, VEHICLE_ART[p.type], p.colours, p.seed, 0);
}

export function building(p: {
  type: Building;
  seed: number;
  lit?: boolean | undefined;
  colours?: Record<string, string>;
}): SpriteSpec {
  const base = BUILDING_ART[p.type];
  // lit windows at night: the window rows turn gold and their bits flip (lit glass, dark piers)
  const t: Template =
    p.lit === true
      ? {
          ...base,
          frames: base.frames.map((rows) =>
            rows.map((row, y) =>
              base.parts[y] === 'l'
                ? Array.from(row)
                    .map((b) => (b === '#' ? '.' : '#'))
                    .join('')
                : row,
            ),
          ),
        }
      : base;
  const lit = p.lit === true ? { l: 'gold' } : {};
  return fromTemplate(p.type, t, { ...lit, ...p.colours }, p.seed, p.type === 'office' ? 3 : 1);
}

export function item(p: { type: Item; seed: number; colours?: Record<string, string> }) {
  return fromTemplate(p.type, ITEM_ART[p.type], p.colours, p.seed, 0);
}
