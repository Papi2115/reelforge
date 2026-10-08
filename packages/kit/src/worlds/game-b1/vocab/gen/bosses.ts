/**
 * Bosses and effects of the open vocabulary. A boss is a silhouette made from a few traits (a
 * body: blob, storm cloud, flood wave, deadline clock, locust swarm, tower, beast; eyes, a mouth,
 * arms, a crown), two frames of menace, drawn as one player stretched to size 4 (32 units) the
 * way 2600 dragons were. The swarm is a small player copied three times (NUSIZ) that the 2600's
 * flicker eats. Effects (explosion, splash, smoke, sparkle, dust) are one-shot frame strips.
 */
import type { SpriteSpec } from '../sprite.js';
import { Bits, art, chance } from './bits.js';
import { insect } from './animals.js';

export const BOSS_BODIES = ['blob', 'cloud', 'wave', 'clock', 'swarm', 'tower', 'beast'] as const;
export const EFFECTS = ['explosion', 'splash', 'smoke', 'sparkle', 'dust'] as const;

export type BossBody = (typeof BOSS_BODIES)[number];
export type Effect = (typeof EFFECTS)[number];

export interface BossParams {
  readonly body: BossBody;
  readonly seed: number;
  readonly eyes: number;
  readonly mouth: 'teeth' | 'grin' | 'none';
  readonly arms: boolean;
  readonly crown: boolean;
  readonly colour?: string | undefined;
  readonly accent?: string | undefined;
}

/** Body rows per frame (frame 1 = the menace: a pulse, a strike, a moved hand). */
const BODIES: Record<Exclude<BossBody, 'swarm'>, readonly (readonly string[])[]> = {
  blob: [
    art('..####..', '.######.', '########', '########', '########', '########', '########', '.######.', '##.##.##'),
    art('..####..', '.######.', '########', '########', '########', '########', '########', '.######.', '.##.##.#'),
  ],
  cloud: [
    art('..##.##.', '.#######', '########', '########', '########', '.######.', '........', '........', '........'),
    art('.##.##..', '########', '########', '########', '########', '.######.', '...##...', '..##....', '...#....'),
  ],
  wave: [
    art('...####.', '..##..##', '.##....#', '.##.....', '###.....', '####....', '######..', '########', '########'),
    art('....####', '...##..#', '..##....', '.###....', '####....', '#####...', '#######.', '########', '########'),
  ],
  clock: [
    art('..####..', '.#....#.', '#...#..#', '#...#..#', '#...###.', '#......#', '.#....#.', '..####..', '.#....#.'),
    art('..####..', '.#....#.', '#......#', '#......#', '#...###.', '#...#..#', '.#..#.#.', '..####..', '#......#'),
  ],
  tower: [
    art('.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.##..##.'),
    art('.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '##....##'),
  ],
  beast: [
    art('##....##', '.######.', '########', '########', '########', '########', '.######.', '.#.##.#.', '.#....#.'),
    art('#......#', '.######.', '########', '########', '########', '########', '.######.', '#..##..#', '#......#'),
  ],
}; // prettier-ignore

const HOLLOW: readonly BossBody[] = ['clock'];
const DEFAULT_INK: Record<BossBody, string> = {
  blob: 'mauve',
  cloud: 'grey',
  wave: 'blue',
  clock: 'cream',
  swarm: 'avocado',
  tower: 'greyDark',
  beast: 'teak',
};

function face(rows: string[], p: BossParams): { rows: string[]; teethRow: number } {
  const b = new Bits(8, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < 8; x += 1) if (row[x] === '#') b.set(x, y);
  });
  const hollow = HOLLOW.includes(p.body);
  const eyeRow = p.body === 'cloud' ? 2 : p.body === 'wave' ? 4 : 2;
  const eyes = Math.max(0, Math.min(3, Math.round(p.eyes)));
  const eyeXs = eyes === 1 ? [4] : eyes === 2 ? [2, 5] : eyes === 3 ? [1, 4, 6] : [];
  const nudge = chance(p.seed, 1, 0.5) ? 0 : 1;
  for (const x of eyeXs) b.set(p.body === 'wave' ? Math.min(7, x - 1 + nudge) : x, eyeRow, hollow);
  let teethRow = -1;
  if (p.mouth !== 'none' && p.body !== 'clock') {
    teethRow = eyeRow + 2;
    const row = p.mouth === 'teeth' ? '.#.#.#.#' : '.######.';
    for (let x = 0; x < 8; x += 1) b.set(x, teethRow, row[x] === '#');
  }
  if (p.arms)
    for (const y of [eyeRow + 1, eyeRow + 2]) {
      b.set(0, y);
      b.set(7, y);
    }
  return { rows: b.rows(), teethRow };
}

export function boss(p: BossParams): SpriteSpec {
  const ink = p.colour ?? DEFAULT_INK[p.body];
  if (p.body === 'swarm') {
    const bug = insect({ type: 'locust', seed: p.seed });
    return { ...bug, describe: 'swarm boss', colours: ink, copies: 3, gap: 'close', fps: 10 };
  }
  const accent = p.accent ?? (p.body === 'clock' ? 'gold' : 'cream');
  const built = BODIES[p.body].map((rows) => face([...rows], p));
  const crown = p.crown ? ['#.#..#.#', '########'] : [];
  const frames = built.map((f) => [...crown, ...f.rows]);
  const teeth = built[0]?.teethRow ?? -1;
  const bodyRows = built[0]?.rows.length ?? 0;
  const colours = [
    ...crown.map(() => 'gold'),
    ...Array.from({ length: bodyRows }, (_, y) => {
      if (y === teeth) return accent;
      if (p.body === 'cloud' && y >= 6) return 'gold';
      if (p.body === 'clock' && (y === 0 || y === 7)) return accent;
      return ink;
    }),
  ];
  return { describe: `${p.body} boss`, frames, colours, size: 4, fps: 3, rowH: 2 };
}

const EFFECT_ART: Record<Effect, { frames: readonly (readonly string[])[]; colours: string[] }> = {
  explosion: {
    frames: [
      art('........', '........', '...##...', '..####..', '...##...', '........'),
      art('........', '..#..#..', '.#.##.#.', '..####..', '.#.##.#.', '..#..#..'),
      art('.#....#.', '#..##..#', '..#..#..', '.#....#.', '..#..#..', '#..##..#'),
      art('#......#', '........', '.#....#.', '........', '.#....#.', '#......#'),
      art('........', '#......#', '........', '........', '........', '#......#'),
    ],
    colours: ['rust', 'orange', 'gold', 'cream', 'gold', 'orange'],
  },
  splash: {
    frames: [
      art('........', '........', '...##...', '..####..'),
      art('........', '.#....#.', '..#..#..', '.######.'),
      art('#......#', '.#....#.', '........', '##....##'),
      art('#......#', '........', '........', '........'),
    ],
    colours: ['aqua', 'aqua', 'teal', 'teal'],
  },
  smoke: {
    frames: [
      art('........', '........', '...##...', '..####..'),
      art('........', '..##....', '.####...', '..##.##.'),
      art('.##.....', '####.##.', '.##.####', '.....##.'),
      art('##......', '##..##..', '....##..', '........'),
    ],
    colours: ['grey', 'grey', 'greyDark', 'greyDark'],
  },
  sparkle: {
    frames: [art('...#....', '..###...', '...#....'), art('.#...#..', '...#....', '.#...#..'), art('........', '...#....', '........')],
    colours: ['white', 'gold', 'white'],
  },
  dust: {
    frames: [art('........', '.#....#.', '##....##'), art('#......#', '........', '#......#'), art('........', '#......#', '........')],
    colours: ['tan', 'teak', 'teak'],
  },
}; // prettier-ignore

export function effect(p: { type: Effect; colour?: string | undefined }): SpriteSpec {
  const e = EFFECT_ART[p.type];
  return {
    describe: p.type,
    frames: e.frames.map((rows) => [...rows]),
    colours: p.colour ?? e.colours,
    fps: 12,
    rowH: 2,
  };
}
