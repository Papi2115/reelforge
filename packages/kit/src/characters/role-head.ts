/**
 * Hair styles and headgear of the role vocabulary (ADR-024). The styles the page's cast wears are
 * its exact boxes (messy = Scientist, slick = Finance, bun = Teacher, bald = Historian, cropped =
 * Engineer, neckline = Detective, fringe = Kid; scrubCap, hardHat, capBack, hood, fedora,
 * spaceHelmet); the others (short, long, cap, beanie, fireHelmet, chefHat) are new pieces in the
 * same idiom. Coordinates: voxels in the neck joint's space (head box from y 0 to hh, z +-hd/2).
 */
import type { RoleItem } from './role-types.js';

export const HAIR_STYLES = [
  'none',
  'short',
  'messy',
  'slick',
  'bun',
  'bald',
  'cropped',
  'neckline',
  'fringe',
  'long',
] as const;

export const HEADGEAR = [
  'none',
  'scrubCap',
  'hardHat',
  'cap',
  'capBack',
  'beanie',
  'hood',
  'fedora',
  'spaceHelmet',
  'fireHelmet',
  'chefHat',
] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Headgear = (typeof HEADGEAR)[number];

const none: RoleItem = { id: 'none', description: 'nothing', colors: {}, draw: () => undefined };

/** Hair items draw with `color` = the spec's hair colour. */
export const HAIR_ITEMS: readonly RoleItem[] = [
  none,
  {
    id: 'short',
    description: 'short neat hair',
    colors: { color: 'indigo' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1, -0.3], [d.hw + 0.3, 1.4, d.hd + 0.1])
        .cb(color, [0, 2, -d.hd / 2 - 0.15], [d.hw + 0.3, d.hh - 3, 0.6])
        .cb(color, [-d.hw / 2 - 0.15, 3.5, -1], [0.5, 2.5, d.hd - 2])
        .cb(color, [d.hw / 2 + 0.15, 3.5, -1], [0.5, 2.5, d.hd - 2]);
    },
  },
  {
    id: 'messy',
    description: 'wild tufts (Scientist)',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1, -0.5], [d.hw + 0.4, 1.8, d.hd])
        .cb(color, [0, 1.5, -d.hd / 2 - 0.3], [d.hw + 0.4, d.hh - 1, 0.8])
        .cb(color, [-d.hw / 2 - 0.8, d.hh - 3.2, -0.8], [1.6, 2.4, 3.6])
        .cb(color, [d.hw / 2 + 0.9, d.hh - 2.6, -1], [1.8, 2.2, 3])
        .cb(color, [-2, d.hh + 0.6, -0.5], [2, 1.6, 2])
        .cb(color, [1.4, d.hh + 0.6, -1.5], [2.2, 2.2, 2])
        .cb(color, [0, d.hh + 0.6, 1.4], [1.6, 1.2, 1.6]);
    },
  },
  {
    id: 'slick',
    description: 'slicked-back hair with a quiff (Finance)',
    colors: { color: 'indigo' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1, -0.5], [d.hw + 0.3, 1.6, d.hd])
        .cb(color, [0, 1.6, -d.hd / 2 - 0.15], [d.hw + 0.3, d.hh - 2, 0.6])
        .cb(color, [-0.8, d.hh - 0.3, d.hd / 2 - 1.1], [d.hw - 1.6, 1, 2.2])
        .cb(color, [-d.hw / 2 - 0.15, 3.5, -1], [0.5, 3, d.hd - 2])
        .cb(color, [d.hw / 2 + 0.15, 3.5, -1], [0.5, 3, d.hd - 2]);
    },
  },
  {
    id: 'bun',
    description: 'hair up in a bun (Teacher)',
    colors: { color: 'burntOrange' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.2, -0.3], [d.hw + 0.3, 1.8, d.hd + 0.1])
        .cb(color, [0, 0.8, -d.hd / 2 - 0.2], [d.hw + 0.3, d.hh - 1, 0.8])
        .cb(color, [-d.hw / 2 - 0.15, 2, -0.8], [0.5, 4.5, d.hd - 1.4])
        .cb(color, [d.hw / 2 + 0.15, 2, -0.8], [0.5, 4.5, d.hd - 1.4])
        .cb(color, [0, d.hh + 0.4, -1.4], [3, 2.6, 3]);
    },
  },
  {
    id: 'bald',
    description: 'bald top, hair round the sides and back (Historian)',
    colors: { color: 'cream' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [-d.hw / 2 - 0.2, 2.6, -1], [0.8, 2.6, d.hd - 2])
        .cb(color, [d.hw / 2 + 0.2, 2.6, -1], [0.8, 2.6, d.hd - 2])
        .cb(color, [0, 2, -d.hd / 2 - 0.2], [d.hw, 2.6, 0.5]);
    },
  },
  {
    id: 'cropped',
    description: 'cropped hair showing at the back under a hat (Engineer)',
    colors: { color: 'darkSlate' },
    draw({ shapes, d, color }) {
      shapes('neck').cb(color, [0, 2.4, -d.hd / 2 - 0.2], [d.hw, 2.6, 0.6]);
    },
  },
  {
    id: 'neckline',
    description: 'hair at the nape under a hat brim (Detective)',
    colors: { color: 'darkSlate' },
    draw({ shapes, d, color }) {
      shapes('neck').cb(color, [0, 1.2, -d.hd / 2 - 0.15], [d.hw, 2.6, 0.5]);
    },
  },
  {
    id: 'fringe',
    description: 'a fringe peeking out under a cap (Kid)',
    colors: { color: 'indigo' },
    draw({ shapes, d, color }) {
      shapes('neck').cb(color, [-1.5, d.hh - 2, d.hd / 2 + 0.1], [3, 0.8, 0.4]);
    },
  },
  {
    id: 'long',
    description: 'shoulder-length hair',
    colors: { color: 'rust' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1, -0.3], [d.hw + 0.4, 1.5, d.hd + 0.2])
        .cb(color, [0, -1.5, -d.hd / 2 - 0.3], [d.hw + 0.4, d.hh + 0.5, 1.2])
        .cb(color, [-d.hw / 2 - 0.25, -0.6, -0.6], [0.7, d.hh - 0.4, d.hd - 1.4])
        .cb(color, [d.hw / 2 + 0.25, -0.6, -0.6], [0.7, d.hh - 0.4, d.hd - 1.4])
        .cb(color, [1.2, d.hh - 1.6, d.hd / 2 - 0.2], [d.hw - 2.6, 1, 0.8]);
    },
  },
];

export const HEADGEAR_ITEMS: readonly RoleItem[] = [
  none,
  {
    id: 'scrubCap',
    description: 'surgical scrub cap (Doctor)',
    colors: { color: 'teal' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.6, 0], [d.hw + 0.3, 2.2, d.hd + 0.3])
        .cb(color, [0, d.hh + 0.5, -0.3], [d.hw - 1.4, 0.7, d.hd - 1.2]);
    },
  },
  {
    id: 'hardHat',
    description: 'hard hat with a brim (Engineer)',
    colors: { color: 'lightOrange' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.3, 0], [d.hw + 0.6, 2.7, d.hd + 0.6])
        .cb(color, [0, d.hh + 1.4, 0], [2, 0.6, d.hd])
        .cb(color, [0, d.hh - 1.3, 0], [d.hw + 1.6, 0.5, d.hd + 1.6])
        .cb(color, [0, d.hh - 1.3, d.hd / 2 + 1.2], [d.hw, 0.5, 1.2]);
    },
  },
  {
    id: 'cap',
    description: 'baseball cap, peak forward',
    colors: { color: 'brightTeal' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.6, 0], [d.hw + 0.3, 2.1, d.hd + 0.3])
        .cb(color, [0, d.hh - 1.6, d.hd / 2 + 1.1], [d.hw - 2, 0.5, 2.2]);
    },
  },
  {
    id: 'capBack',
    description: 'baseball cap worn backwards (Kid)',
    colors: { color: 'brightTeal' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.6, 0], [d.hw + 0.3, 2.1, d.hd + 0.3])
        .cb(color, [0, d.hh - 1.6, -d.hd / 2 - 1.1], [d.hw - 2, 0.5, 2.2]);
    },
  },
  {
    id: 'beanie',
    description: 'knitted beanie with a cuff and a bobble (trim)',
    colors: { color: 'pink', trim: 'cream' },
    draw({ shapes, d, color, trim }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.6, 0], [d.hw + 0.4, 2.6, d.hd + 0.4])
        .cb(trim, [0, d.hh - 1.8, 0], [d.hw + 0.6, 0.9, d.hd + 0.6])
        .cb(trim, [0, d.hh + 1, 0], [1.6, 1.4, 1.6]);
    },
  },
  {
    id: 'hood',
    description: 'pointed hood up, face in shadow (Hacker)',
    colors: { color: 'darkSlate' },
    adjust: { coversHead: true, headD: 0.4, eyeX: -0.1, eyeY: -0.3 },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb('black', [0, 0, -0.4], [d.hw - 0.6, d.hh - 0.6, d.hd - 0.6])
        .cb(color, [0, d.hh - 1.8, -0.4], [d.hw + 1, 2.4, d.hd + 0.4])
        .cb(color, [0, -0.4, -d.hd / 2 - 0.4], [d.hw + 1, d.hh, 1.4])
        .cb(color, [-d.hw / 2 - 0.1, -0.4, 0], [1.2, d.hh - 1, d.hd + 0.6])
        .cb(color, [d.hw / 2 + 0.1, -0.4, 0], [1.2, d.hh - 1, d.hd + 0.6])
        .cb(color, [0, d.hh + 0.6, -1], [3.4, 1.2, d.hd - 2])
        .cb(color, [0, d.hh + 1.8, -2], [1.6, 1, 2.4]);
    },
  },
  {
    id: 'fedora',
    description: 'wide-brimmed hat with a band (trim) (Detective)',
    colors: { color: 'darkSlate', trim: 'rust' },
    draw({ shapes, d, color, trim }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.4, 0], [d.hw + 3.2, 0.5, d.hd + 3.2])
        .cb(color, [0, d.hh - 1, 0], [d.hw - 0.6, 3, d.hd - 0.8])
        .cb(trim, [0, d.hh - 0.9, 0], [d.hw - 0.4, 0.7, d.hd - 0.6]);
    },
  },
  {
    id: 'spaceHelmet',
    description: 'bubble helmet with a visor (trim) instead of a face (Astronaut)',
    colors: { color: 'cream', trim: 'teal' },
    adjust: { coversHead: true, hidesEyes: true },
    draw({ shapes, color, trim }) {
      const visor = (x: number, y: number, z: number): string =>
        z > 1.5 && y > 1.8 && y < 5.8 && Math.abs(x) < 3.8
          ? x > 1.2 && x < 2.4 && y > 4.2
            ? color
            : trim
          : color;
      shapes('neck').vox(
        visor,
        [-6, -1, -6],
        [6, 10, 6],
        (x, y, z) => x * x + (y - 3.8) ** 2 + z * z <= 28,
      );
    },
  },
  {
    id: 'fireHelmet',
    description: 'firefighter helmet: dome, crest, long rear brim, front shield (trim)',
    colors: { color: 'burntOrange', trim: 'lightOrange' },
    draw({ shapes, d, color, trim }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.3, 0], [d.hw + 0.8, 2.8, d.hd + 0.8])
        .cb(color, [0, d.hh + 1.5, -0.6], [1.2, 0.9, d.hd - 1])
        .cb(color, [0, d.hh - 1.5, -1.2], [d.hw + 2, 0.5, d.hd + 3.4])
        .cb(trim, [0, d.hh - 0.9, d.hd / 2 + 0.5], [2.4, 2.4, 0.4]);
    },
  },
  {
    id: 'chefHat',
    description: "tall chef's toque with a puffed top",
    colors: { color: 'cream' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, d.hh - 1.5, 0], [d.hw + 0.3, 1.8, d.hd + 0.3])
        .cb(color, [0, d.hh + 0.3, 0], [d.hw - 0.6, 2.4, d.hd - 0.6])
        .cb(color, [0, d.hh + 2.4, 0], [d.hw + 1.2, 2.2, d.hd + 1.2])
        .cb(color, [0, d.hh + 4.6, 0], [d.hw - 0.6, 0.6, d.hd - 0.6]);
    },
  },
];
