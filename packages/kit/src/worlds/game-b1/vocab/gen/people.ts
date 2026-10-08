/**
 * People of the open vocabulary: one 8-bit humanoid base (head, shoulders, two arms, legs in two
 * walk frames, facing right) dressed by a hat, a held tool and a uniform; roles are presets of
 * the three (a ranger, a miner, a sailor, a knight, an astronaut, a clerk, a farmer, a kid) and
 * every part can be overridden. One colour per row means the uniform is read in horizontal
 * bands (the sailor's stripes, the knight's plate), the way 2600 people were.
 */
import type { SpriteSpec } from '../sprite.js';
import { pick } from './bits.js';

export const HATS = ['none', 'brim', 'helmet', 'cap', 'helm', 'bubble', 'straw', 'hood'] as const;
export const TOOLS = [
  'none',
  'axe',
  'pick',
  'sword',
  'briefcase',
  'lantern',
  'document',
  'flag',
  'staff',
] as const;
export const ROLES = [
  'plain',
  'ranger',
  'miner',
  'sailor',
  'knight',
  'astronaut',
  'clerk',
  'farmer',
  'kid',
] as const;

export type Hat = (typeof HATS)[number];
export type Tool = (typeof TOOLS)[number];
export type Role = (typeof ROLES)[number];

export interface Outfit {
  readonly hat: Hat;
  readonly tool: Tool;
  readonly skin: string;
  readonly hair: string;
  readonly hatColour: string;
  readonly top: string;
  /** Second shirt ink (stripes, plate); = top for a plain shirt. */
  readonly band: string;
  readonly legs: string;
}

const PLAIN: Outfit = {
  hat: 'none',
  tool: 'none',
  skin: 'tan',
  hair: 'walnut',
  hatColour: 'walnut',
  top: 'teal',
  band: 'teal',
  legs: 'blue',
};

export const ROLE_OUTFITS: Record<Role, Outfit> = {
  plain: PLAIN,
  ranger: { ...PLAIN, hat: 'brim', tool: 'axe', hatColour: 'teak', top: 'avocado', band: 'oliveDark', legs: 'walnut' },
  miner: { ...PLAIN, hat: 'helmet', tool: 'pick', hatColour: 'gold', top: 'blue', band: 'blue', legs: 'greyDark' },
  sailor: { ...PLAIN, hat: 'cap', tool: 'none', hatColour: 'cream', top: 'blue', band: 'cream', legs: 'blue' },
  knight: { ...PLAIN, hat: 'helm', tool: 'sword', hatColour: 'grey', skin: 'grey', top: 'grey', band: 'greyDark', legs: 'greyDark' },
  astronaut: { ...PLAIN, hat: 'bubble', tool: 'none', hatColour: 'white', skin: 'gold', top: 'cream', band: 'white', legs: 'cream' },
  clerk: { ...PLAIN, hat: 'none', tool: 'briefcase', hair: 'walnutDark', top: 'cream', band: 'cream', legs: 'greyDark' },
  farmer: { ...PLAIN, hat: 'straw', tool: 'staff', hatColour: 'gold', top: 'orange', band: 'blue', legs: 'blue' },
  kid: { ...PLAIN, hat: 'cap', tool: 'none', hatColour: 'orange', top: 'orange', band: 'gold', legs: 'blue' },
}; // prettier-ignore

/** Hat rows (above the head) and whether the hat replaces the hair row. */
const HAT_ROWS: Record<Hat, readonly string[]> = {
  none: [],
  brim: ['..###...', '.######.'],
  helmet: ['..###...', '.#####..'],
  cap: ['..###...', '..#####.'],
  helm: ['..###...', '..###...'],
  bubble: ['.####...', '#.....#.'],
  straw: ['..###...', '########'],
  hood: ['..###...', '.#####..'],
};

interface Row {
  readonly bits: string;
  readonly ink: keyof Outfit;
}

function body(walk: number, tool: Tool, hat: Hat): Row[] {
  const head = (
    [
      { bits: hat === 'none' ? '..###...' : '', ink: 'hair' },
      {
        bits: hat === 'helm' ? '..#.##..' : hat === 'bubble' ? '#.##.#..' : '..####..',
        ink: 'skin',
      },
      {
        bits: hat === 'bubble' ? '.####...' : '..###...',
        ink: hat === 'bubble' ? 'hatColour' : 'skin',
      },
    ] satisfies Row[]
  ).filter((row) => row.bits !== '');
  const torso: Row[] = [
    { bits: '.#####..', ink: 'top' },
    { bits: '#.###.#.', ink: 'band' },
    { bits: '#.###.#.', ink: 'top' },
    { bits: '..###...', ink: 'legs' },
  ];
  const legs: Row[] =
    walk === 0
      ? [
          { bits: '..#.#...', ink: 'legs' },
          { bits: '..#.#...', ink: 'legs' },
          { bits: '..##.##.', ink: 'hair' },
        ]
      : [
          { bits: '.#...#..', ink: 'legs' },
          { bits: '#.....#.', ink: 'legs' },
          { bits: '##....##', ink: 'hair' },
        ];
  const rows = [...head, ...torso, ...legs];
  const hand = head.length + 2; // the front hand's row
  const mark = (row: number, x: number) => {
    const r = rows[row];
    if (r !== undefined) rows[row] = { ...r, bits: r.bits.slice(0, x) + '#' + r.bits.slice(x + 1) };
  };
  const tools: Record<Tool, readonly (readonly [number, number])[]> = {
    none: [],
    axe: [[hand - 3, 7], [hand - 3, 6], [hand - 2, 7], [hand - 1, 7], [hand, 7]],
    pick: [[hand - 3, 6], [hand - 3, 7], [hand - 2, 7], [hand - 1, 7], [hand, 7]],
    sword: [[hand - 4, 7], [hand - 3, 7], [hand - 2, 7], [hand - 1, 7], [hand, 7], [hand, 6]],
    briefcase: [[hand + 1, 6], [hand + 1, 7], [hand + 2, 6], [hand + 2, 7]],
    lantern: [[hand + 1, 7], [hand + 2, 7]],
    document: [[hand - 1, 7], [hand, 7], [hand + 1, 7]],
    flag: [[hand - 5, 7], [hand - 5, 6], [hand - 4, 7], [hand - 4, 6], [hand - 3, 7], [hand - 2, 7], [hand - 1, 7], [hand, 7]],
    staff: [[hand - 4, 7], [hand - 3, 7], [hand - 2, 7], [hand - 1, 7], [hand, 7], [hand + 1, 7], [hand + 2, 7]],
  }; // prettier-ignore
  for (const [row, x] of tools[tool]) mark(row, x);
  return rows;
}

export interface PersonParams {
  readonly role: Role;
  readonly seed: number;
  readonly hat?: Hat | undefined;
  readonly tool?: Tool | undefined;
  readonly colours?:
    { readonly [K in Exclude<keyof Outfit, 'hat' | 'tool'>]?: string | undefined } | undefined;
}

export function person(p: PersonParams): SpriteSpec {
  const outfit: Outfit = {
    ...ROLE_OUTFITS[p.role],
    ...(p.hat === undefined ? {} : { hat: p.hat }),
    ...(p.tool === undefined ? {} : { tool: p.tool }),
    ...Object.fromEntries(Object.entries(p.colours ?? {}).filter(([, v]) => v !== undefined)),
  };
  const hatRows = HAT_ROWS[outfit.hat];
  const frames = [0, 1].map((walk) => [
    ...hatRows,
    ...body(walk, outfit.tool, outfit.hat).map((r) => r.bits),
  ]);
  // seeded roughness: a tuft of hair or a crooked brim, never a twin of the next one
  const first = frames[0];
  if (first !== undefined && outfit.hat === 'none' && pick(p.seed, 1, 0, 2) === 0)
    frames.forEach((rows) => {
      rows[0] = '..##.#..';
    });
  const inks = [
    ...hatRows.map(() => outfit.hatColour),
    ...body(0, outfit.tool, outfit.hat).map((r) => outfit[r.ink]),
  ];
  return {
    describe: p.role === 'plain' ? 'person' : p.role,
    frames,
    colours: inks.map(String),
    fps: 6,
    rowH: 2,
  };
}
