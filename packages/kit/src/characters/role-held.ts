/**
 * Held props of the role vocabulary (ADR-024): drawn in a forearm joint's space below the hand
 * (y < -fore), x mirrored when held in the other hand. The page's cast hold exactly these boxes
 * (flask, clipboard, wrench, briefcase, pointer, scroll, tablet, magnifier); hammer, hose, axe,
 * microphone, laptop, book, phone, spatula, gavel, pitchfork and parcel are new pieces in the same
 * idiom.
 */
import { frame } from './humanoid.js';
import type { HeldItem } from './role-types.js';

export const HELD_PROPS = [
  'flask',
  'clipboard',
  'wrench',
  'briefcase',
  'pointer',
  'scroll',
  'tablet',
  'magnifier',
  'hammer',
  'hose',
  'axe',
  'microphone',
  'laptop',
  'book',
  'phone',
  'spatula',
  'gavel',
  'pitchfork',
  'parcel',
] as const;

export type HeldProp = (typeof HELD_PROPS)[number];

export const HELD_ITEMS: readonly HeldItem[] = [
  {
    id: 'flask',
    hand: 'right',
    description: 'lab flask with glowing liquid (color)',
    colors: { color: 'green' },
    draw({ shapes, d, color, mirror }) {
      const side = mirror === 1 ? 'elR' : 'elL';
      shapes(side)
        .cb('cream', [0, -d.fore - 2.6, 0.6], [1.8, 2.4, 1.8])
        .cb(color, [0, -d.fore - 2.5, 0.6], [1.9, 1.3, 1.9], 'glow')
        .cb('cream', [0, -d.fore - 0.4, 0.6], [0.9, 1, 0.9]);
    },
  },
  {
    id: 'clipboard',
    hand: 'left',
    description: 'clipboard with a sheet',
    colors: { color: 'tan' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb(color, [1.1 * mirror, -d.fore - 2.4, 0.6], [0.4, 3.6, 2.8])
        .cb('cream', [1.35 * mirror, -d.fore - 2.1, 0.6], [0.15, 3, 2.3])
        .cb('darkSlate', [1.1 * mirror, -d.fore + 0.9, 0.6], [0.6, 0.5, 1.2]);
    },
  },
  {
    id: 'wrench',
    hand: 'right',
    description: 'big open-ended wrench',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb(color, [0, -d.fore - 3.2, 0.5], [0.7, 3.4, 0.7])
        .cb(color, [-0.6, -d.fore - 4.4, 0.5], [0.6, 1.4, 0.7])
        .cb(color, [0.6, -d.fore - 4.4, 0.5], [0.6, 1.4, 0.7]);
    },
  },
  {
    id: 'briefcase',
    hand: 'left',
    description: 'briefcase with a handle and a clasp',
    colors: { color: 'rust' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb(color, [0, -d.fore - 3.2, 0], [1.3, 2.8, 3.8])
        .cb('darkSlate', [0, -d.fore - 0.5, 0], [0.5, 0.8, 1.6])
        .cb('lightOrange', [0, -d.fore - 1.4, 0], [1.4, 0.4, 0.8]);
    },
  },
  {
    id: 'pointer',
    hand: 'right',
    description: 'long teacher pointer',
    colors: { color: 'tan' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb(color, [0, -d.fore - 4.6, 0.5], [0.5, 4.8, 0.5])
        .cb('cream', [0, -d.fore - 5, 0.5], [0.6, 0.5, 0.6]);
    },
  },
  {
    id: 'scroll',
    hand: 'left',
    description: 'rolled scroll with dark ends',
    colors: { color: 'cream' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb(color, [0, -d.fore - 0.8, 0.4], [1.2, 1.2, 5])
        .cb('rust', [0, -d.fore - 0.95, 3.2], [1.5, 1.5, 0.6])
        .cb('rust', [0, -d.fore - 0.95, -2.4], [1.5, 1.5, 0.6]);
    },
  },
  {
    id: 'tablet',
    hand: 'left',
    description: 'tablet with a glowing screen (color)',
    colors: { color: 'green' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb('midSlate', [0, -d.fore - 1.2, 1.4], [2.6, 3.2, 0.4])
        .cb(color, [0, -d.fore - 0.9, 1.65], [2.1, 2.6, 0.1], 'glow');
    },
  },
  {
    id: 'magnifier',
    hand: 'right',
    description: 'magnifying glass with a bright lens',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      const tool = shapes(mirror === 1 ? 'elR' : 'elL').cb(
        'darkSlate',
        [0, -d.fore - 2, 0.6],
        [0.6, 2.2, 0.6],
      );
      frame(tool, color, 0, -d.fore - 3.6, 0.6, 3, 3, 0.5);
      tool.cb('cream', [0, -d.fore - 4.6, 0.6], [2, 2, 0.15], 'glow');
    },
  },
  {
    id: 'hammer',
    hand: 'right',
    description: 'claw hammer (the generic tool)',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('tan', [0, -d.fore - 3.4, 0.5], [0.6, 3.6, 0.6])
        .cb(color, [0, -d.fore - 4.5, 0.9], [0.9, 1.1, 3]);
    },
  },
  {
    id: 'hose',
    hand: 'right',
    description: 'fire-hose nozzle (color) with the hose (trim) trailing behind',
    colors: { color: 'slateGrey', trim: 'burntOrange' },
    draw({ shapes, d, color, trim, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb(color, [0, -d.fore - 2.2, 0.6], [1.1, 2.6, 1.1])
        .cb('darkSlate', [0, -d.fore - 3.1, 0.6], [0.7, 0.9, 0.7])
        .cb(trim, [0, -d.fore + 0.2, -0.9], [1.3, 1.3, 1.6])
        .cb(trim, [0, -d.fore - 3.6, -1.8], [1.3, 3.8, 1.3]);
    },
  },
  {
    id: 'axe',
    hand: 'right',
    description: 'long axe: handle, head (color) and a bright edge',
    colors: { color: 'burntOrange' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('tan', [0, -d.fore - 5.4, 0.5], [0.6, 5.6, 0.6])
        .cb(color, [0, -d.fore - 5.4, 1.5], [0.5, 2.2, 1.6])
        .cb('slateGrey', [0, -d.fore - 5.6, 2.6], [0.55, 2.6, 0.6]);
    },
  },
  {
    id: 'microphone',
    hand: 'right',
    description: 'handheld microphone',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('darkSlate', [0, -d.fore - 1.8, 0.6], [0.7, 2.4, 0.7])
        .cb(color, [0, -d.fore - 3, 0.6], [1.4, 1.4, 1.4]);
    },
  },
  {
    id: 'laptop',
    hand: 'left',
    description: 'closed laptop carried at the side',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb(color, [0.2 * mirror, -d.fore - 3.2, 0.4], [0.8, 3.4, 4.2])
        .cb('darkSlate', [0.2 * mirror, -d.fore - 3.2, 0.4], [0.9, 0.4, 4.3]);
    },
  },
  {
    id: 'book',
    hand: 'left',
    description: 'hardback book (color) with cream pages',
    colors: { color: 'teal' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb(color, [1 * mirror, -d.fore - 2.6, 0.6], [1.3, 3.2, 2.6])
        .cb('cream', [1.1 * mirror, -d.fore - 2.4, 0.75], [1, 2.8, 2.4]);
    },
  },
  {
    id: 'phone',
    hand: 'right',
    description: 'smartphone with a lit screen (color)',
    colors: { color: 'brightTeal' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('darkSlate', [0, -d.fore - 1.3, 1.1], [1.3, 2.2, 0.3])
        .cb(color, [0, -d.fore - 1.1, 1.27], [1, 1.8, 0.05], 'glow');
    },
  },
  {
    id: 'spatula',
    hand: 'right',
    description: 'kitchen spatula',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('darkSlate', [0, -d.fore - 2.6, 0.5], [0.5, 2.8, 0.5])
        .cb(color, [0, -d.fore - 4.4, 0.5], [1.8, 1.8, 0.25]);
    },
  },
  {
    id: 'gavel',
    hand: 'right',
    description: "judge's gavel: short handle and a barrel head (color)",
    colors: { color: 'rust' },
    draw({ shapes, d, color, mirror }) {
      shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('tan', [0, -d.fore - 2.8, 0.5], [0.5, 3, 0.5])
        .cb(color, [0, -d.fore - 3.9, 0.9], [1.3, 1.3, 2.6]);
    },
  },
  {
    id: 'pitchfork',
    hand: 'right',
    description: 'pitchfork: long handle, crossbar and three tines (color)',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color, mirror }) {
      const tool = shapes(mirror === 1 ? 'elR' : 'elL')
        .cb('tan', [0, -d.fore - 4.2, 0.5], [0.6, 7.6, 0.6])
        .cb(color, [0, -d.fore - 4.4, 0.5], [0.5, 0.5, 2.8]);
      for (const z of [-0.6, 0.5, 1.6]) tool.cb(color, [0, -d.fore - 5.6, z], [0.4, 1.3, 0.4]);
    },
  },
  {
    id: 'parcel',
    hand: 'left',
    description: 'cardboard parcel (color) with tape (trim) carried at the side (courier)',
    colors: { color: 'tan', trim: 'cream' },
    draw({ shapes, d, color, trim, mirror }) {
      shapes(mirror === 1 ? 'elL' : 'elR')
        .cb(color, [-0.4 * mirror, -d.fore - 3, 0.6], [2.4, 3, 3.2])
        .cb(trim, [-0.4 * mirror, -d.fore - 1.7, 0.6], [2.5, 0.4, 3.3]);
    },
  },
];
