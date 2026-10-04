/**
 * Accessories of the role vocabulary (ADR-024): face and body details that do not count towards
 * the outfit's four colours. The page's cast wear exactly these boxes (goggles = Scientist; mask,
 * stethoscope, badge = Doctor; glassesSquare = Finance; glassesRound = Teacher; beard = Historian;
 * backpack = Kid; lifePack = Astronaut); airTank and neckerchief are new.
 */
import { INK } from './face.js';
import { frame } from './humanoid.js';
import type { RoleItem } from './role-types.js';

export const ACCESSORIES = [
  'goggles',
  'mask',
  'glassesSquare',
  'glassesRound',
  'beard',
  'stethoscope',
  'badge',
  'backpack',
  'lifePack',
  'airTank',
  'neckerchief',
] as const;

export type Accessory = (typeof ACCESSORIES)[number];

export const ACCESSORY_ITEMS: readonly RoleItem[] = [
  {
    id: 'goggles',
    description: 'lab goggles pushed up on the forehead: band (color), lenses (trim)',
    colors: { color: 'darkSlate', trim: 'brightTeal' },
    draw({ shapes, d, color, trim }) {
      shapes('neck')
        .cb(color, [0, d.hh - 2.4, 0], [d.hw + 0.3, 0.9, d.hd + 0.3])
        .cb(trim, [-1.7, d.hh - 2.6, d.hd / 2 + 0.2], [2.2, 1.5, 0.6])
        .cb(trim, [1.7, d.hh - 2.6, d.hd / 2 + 0.2], [2.2, 1.5, 0.6]);
    },
  },
  {
    id: 'mask',
    description: 'surgical face mask with a strap',
    colors: { color: 'cream' },
    draw({ shapes, d, color }) {
      shapes('neck')
        .cb(color, [0, 0.4, d.hd / 2], [d.hw - 1.8, 2.4, 0.5])
        .cb(color, [0, 1.8, 0], [d.hw + 0.2, 0.4, d.hd - 2]);
    },
  },
  {
    id: 'glassesSquare',
    description: 'rectangular glasses',
    colors: { color: INK },
    draw({ shapes, d, color }) {
      const head = shapes('neck');
      frame(head, color, -1.6, 2.6, d.hd / 2 + 0.2, 2.2, 1.7, 0.3);
      frame(head, color, 1.6, 2.6, d.hd / 2 + 0.2, 2.2, 1.7, 0.3);
      head.cb(color, [0, 3.1, d.hd / 2 + 0.2], [1, 0.3, 0.3]);
    },
  },
  {
    id: 'glassesRound',
    description: 'small round-ish glasses',
    colors: { color: INK },
    draw({ shapes, d, color }) {
      const head = shapes('neck');
      frame(head, color, -1.6, 2.6, d.hd / 2 + 0.2, 2, 1.6, 0.25);
      frame(head, color, 1.6, 2.6, d.hd / 2 + 0.2, 2, 1.6, 0.25);
      head.cb(color, [0, 3.0, d.hd / 2 + 0.2], [1.2, 0.25, 0.25]);
    },
  },
  {
    id: 'beard',
    description:
      'big beard, moustache, sideburns and bushy brows in the hair colour; eyes sit higher',
    colors: {},
    adjust: { eyeY: 0.4 },
    draw({ shapes, d, hair }) {
      shapes('neck')
        .cb(hair, [0, -2, d.hd / 2 - 1.2], [d.hw - 0.6, 4.6, 2.8])
        .cb(hair, [0, 1.6, d.hd / 2 + 0.1], [3.8, 0.8, 0.5])
        .cb(hair, [-d.hw / 2 - 0.1, 0.5, 0.6], [0.8, 3.4, d.hd - 2])
        .cb(hair, [d.hw / 2 + 0.1, 0.5, 0.6], [0.8, 3.4, d.hd - 2])
        .cb(hair, [-1.7, 4.5, d.hd / 2 + 0.1], [2, 0.8, 0.5])
        .cb(hair, [1.7, 4.5, d.hd / 2 + 0.1], [2, 0.8, 0.5]);
    },
  },
  {
    id: 'stethoscope',
    description: 'stethoscope round the neck: tubes (color), chest piece (trim)',
    colors: { color: 'darkSlate', trim: 'slateGrey' },
    draw({ shapes, d, color, trim }) {
      shapes('torso')
        .cb(color, [0, d.th - 0.5, -0.3], [d.tw - 1.4, 0.6, d.td + 0.4])
        .cb(color, [-1.6, d.th - 4, d.td / 2 + 0.1], [0.6, 3.6, 0.3])
        .cb(color, [1.6, d.th - 3, d.td / 2 + 0.1], [0.6, 2.6, 0.3])
        .cb(trim, [-1.6, d.th - 4.8, d.td / 2 + 0.2], [1.3, 1.2, 0.5]);
    },
  },
  {
    id: 'badge',
    description: 'name badge on the chest',
    colors: { color: 'cream' },
    draw({ shapes, d, color }) {
      shapes('torso').cb(color, [1.9, 4, d.td / 2 + 0.05], [1.4, 1.6, 0.15]);
    },
  },
  {
    id: 'backpack',
    description: 'big backpack with straps over the shoulders',
    colors: { color: 'pink' },
    draw({ shapes, d, color }) {
      shapes('torso')
        .cb(color, [0, 0.4, -d.td / 2 - 1.6], [d.tw - 0.2, d.th + 0.6, 3.2])
        .cb(color, [0, 1, -d.td / 2 - 3.3], [d.tw - 1.4, 2.4, 0.4])
        .cb(color, [-1.4, 1.2, d.td / 2 + 0.05], [0.7, d.th - 1.2, 0.2])
        .cb(color, [1.4, 1.2, d.td / 2 + 0.05], [0.7, d.th - 1.2, 0.2])
        .cb(color, [-1.4, d.th - 0.3, 0], [0.7, 0.6, d.td + 0.4])
        .cb(color, [1.4, d.th - 0.3, 0], [0.7, 0.6, d.td + 0.4]);
    },
  },
  {
    id: 'lifePack',
    description: 'life-support backpack',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color }) {
      shapes('torso').cb(color, [0, 0.5, -d.td / 2 - 1.3], [d.tw - 1, d.th - 0.5, 2.6]);
    },
  },
  {
    id: 'airTank',
    description:
      'breathing-air cylinder on the back (color) with a valve and shoulder straps (trim)',
    colors: { color: 'slateGrey', trim: 'darkSlate' },
    draw({ shapes, d, color, trim }) {
      shapes('torso')
        .cb(color, [0, 0.4, -d.td / 2 - 1.3], [2.6, d.th - 1.4, 2.6])
        .cb(trim, [0, d.th - 1, -d.td / 2 - 1.3], [1, 1.2, 1])
        .cb(trim, [-1.5, 1, d.td / 2 + 0.45], [0.7, d.th - 1.6, 0.2])
        .cb(trim, [1.5, 1, d.td / 2 + 0.45], [0.7, d.th - 1.6, 0.2])
        .cb(trim, [-1.5, d.th - 0.4, 0], [0.7, 0.6, d.td + 0.9])
        .cb(trim, [1.5, d.th - 0.4, 0], [0.7, 0.6, d.td + 0.9]);
    },
  },
  {
    id: 'neckerchief',
    description: 'knotted neckerchief at the collar',
    colors: { color: 'pink' },
    draw({ shapes, d, color }) {
      shapes('torso')
        .cb(color, [0, d.th - 1.4, 0], [d.tw - 1.6, 1, d.td + 0.6])
        .cb(color, [0, d.th - 2.6, d.td / 2 + 0.35], [1.4, 1.4, 0.4]);
    },
  },
];
