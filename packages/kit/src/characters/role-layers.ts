/**
 * Clothing layers of the role vocabulary (ADR-024), worn over the top (shirt) colour. The page's
 * cast wear exactly these boxes (labCoat = Scientist, scrubs = the plain top, hiVis = Engineer,
 * suit + tie = Finance, vNeck + skirt = Teacher, tweed = Historian, hoodie = Hacker, trenchCoat =
 * Detective, spaceSuit = Astronaut); turnoutCoat, chefJacket and apron are new pieces in the same
 * idiom. Coordinates: voxels in the torso joint's space (torso box y 0..th, z +-td/2).
 */
import type { RoleItem } from './role-types.js';

export const LAYERS = [
  'labCoat',
  'hiVis',
  'suit',
  'tie',
  'vNeck',
  'skirt',
  'tweed',
  'hoodie',
  'trenchCoat',
  'spaceSuit',
  'turnoutCoat',
  'chefJacket',
  'apron',
] as const;

export type Layer = (typeof LAYERS)[number];

export const LAYER_ITEMS: readonly RoleItem[] = [
  {
    id: 'labCoat',
    description: 'knee-length open coat over the top; sleeves in the coat colour (Scientist)',
    colors: { color: 'cream' },
    adjust: { sleeves: 'color' },
    draw({ shapes, d, color }) {
      shapes('torso')
        .cb(color, [-1.9, -3.6, 0], [2.6, d.th + 3.6, d.td + 0.6])
        .cb(color, [1.9, -3.6, 0], [2.6, d.th + 3.6, d.td + 0.6])
        .cb(color, [0, -3.6, -0.4], [d.tw + 0.6, d.th + 3.6, d.td - 0.2]);
    },
  },
  {
    id: 'hiVis',
    description: 'high-visibility vest with reflective stripes (trim) (Engineer)',
    colors: { color: 'green', trim: 'cream' },
    draw({ shapes, d, color, trim, under }) {
      shapes('torso')
        .cb(color, [0, 0.5, 0], [d.tw + 0.3, d.th - 1, d.td + 0.3])
        .cb(under, [0, 0.5, d.td / 2 + 0.1], [0.8, d.th - 1, 0.2])
        .cb(trim, [0, 1.6, 0], [d.tw + 0.45, 0.7, d.td + 0.45])
        .cb(trim, [0, 3.8, 0], [d.tw + 0.45, 0.7, d.td + 0.45]);
    },
  },
  {
    id: 'suit',
    description: 'jacket lapels (color) over a shirt (trim); the top is the jacket (Finance)',
    colors: { color: 'midSlate', trim: 'cream' },
    draw({ shapes, d, color, trim }) {
      shapes('torso')
        .cb(trim, [0, d.th - 3, d.td / 2], [2.2, 3, 0.15])
        .cb(color, [-1.5, d.th - 4, d.td / 2 + 0.05], [0.7, 4, 0.15])
        .cb(color, [1.5, d.th - 4, d.td / 2 + 0.05], [0.7, 4, 0.15]);
    },
  },
  {
    id: 'tie',
    description: 'necktie with a knot (Finance)',
    colors: { color: 'pink' },
    draw({ shapes, d, color }) {
      shapes('torso')
        .cb(color, [0, d.th - 5, d.td / 2 + 0.1], [0.9, 4.4, 0.2])
        .cb(color, [0, d.th - 1.3, d.td / 2 + 0.1], [1.4, 1, 0.3]);
    },
  },
  {
    id: 'vNeck',
    description: 'shirt collar showing in a V-neck sweater (Teacher)',
    colors: { color: 'cream' },
    draw({ shapes, d, color }) {
      shapes('torso').cb(color, [0, d.th - 3.2, d.td / 2], [2, 3.2, 0.15]);
    },
  },
  {
    id: 'skirt',
    description: 'skirt over the thighs (Teacher)',
    colors: { color: 'slateBlue' },
    draw({ shapes, d, color }) {
      shapes('torso').cb(color, [0, -2.8, 0], [d.tw + 0.8, 3.2, d.td + 0.8]);
    },
  },
  {
    id: 'tweed',
    description:
      'jacket front (color) with elbow patches (trim) and a shirt collar (detail) (Historian)',
    colors: { color: 'tan', trim: 'rust', detail: 'cream' },
    draw({ shapes, d, color, trim, detail }) {
      shapes('torso')
        .cb(color, [0, 0.6, 0.6], [d.tw - 1, d.th - 2.4, d.td])
        .cb(detail, [0, d.th - 2.5, d.td / 2 + 0.6], [1.8, 2.5, 0.15]);
      shapes('shL').cb(trim, [0, -2.4, 0], [d.aw + 0.15, 1.4, d.aw * 0.8]);
      shapes('shR').cb(trim, [0, -2.4, 0], [d.aw + 0.15, 1.4, d.aw * 0.8]);
    },
  },
  {
    id: 'hoodie',
    description:
      'oversized hoodie: long hem, pocket (trim), drawstrings (detail), sleeves over the hands (Hacker)',
    colors: { color: 'darkSlate', trim: 'midSlate', detail: 'green' },
    adjust: { armW: 0.3, sleeves: 'color', hands: 'color' },
    draw({ shapes, d, color, trim, detail }) {
      shapes('torso')
        .cb(color, [0, -1.6, 0], [d.tw, 1.8, d.td])
        .cb(trim, [0, -0.6, d.td / 2 + 0.05], [4, 2, 0.15])
        .cb(detail, [-0.8, d.th - 3, d.td / 2 + 0.05], [0.3, 2.4, 0.2])
        .cb(detail, [0.8, d.th - 3.4, d.td / 2 + 0.05], [0.3, 2.8, 0.2]);
    },
  },
  {
    id: 'trenchCoat',
    description: 'trench coat with a raised collar, belt (trim) and seam (detail) (Detective)',
    colors: { color: 'tan', trim: 'rust', detail: 'burntOrange' },
    draw({ shapes, d, color, trim, detail }) {
      shapes('torso')
        .cb(color, [0, -4, 0], [d.tw + 0.8, d.th + 4, d.td + 0.8])
        .cb(trim, [0, 1.6, 0], [d.tw + 1, 0.8, d.td + 1])
        .cb(color, [0, d.th - 1, -0.6], [d.tw + 1.4, 2.4, d.td])
        .cb(detail, [0, -4, d.td / 2 + 0.45], [0.4, d.th + 3.4, 0.1]);
    },
  },
  {
    id: 'spaceSuit',
    description: 'space suit: collar ring and gloves (trim), mission patch (detail) (Astronaut)',
    colors: { trim: 'slateGrey', detail: 'orange' },
    adjust: { hands: 'trim' },
    draw({ shapes, d, trim, detail }) {
      shapes('torso')
        .cb(trim, [0, d.th - 0.6, 0], [5, 1, 4])
        .cb(detail, [2, d.th - 3, d.td / 2 + 0.05], [1.6, 1.2, 0.15])
        .cb('darkSlate', [-1.5, 2, d.td / 2 + 0.05], [2, 1.6, 0.15]);
    },
  },
  {
    id: 'turnoutCoat',
    description: 'firefighter turnout coat with reflective bands (trim) on body and sleeves',
    colors: { color: 'tan', trim: 'green' },
    adjust: { sleeves: 'color' },
    draw({ shapes, d, color, trim }) {
      shapes('torso')
        .cb(color, [0, -2.6, 0], [d.tw + 0.8, d.th + 2.6, d.td + 0.8])
        .cb(color, [0, d.th - 1.2, -0.5], [d.tw + 1.2, 2, d.td + 0.2])
        .cb(trim, [0, -1.6, 0], [d.tw + 1, 0.7, d.td + 1])
        .cb(trim, [0, 2.2, 0], [d.tw + 1, 0.7, d.td + 1])
        .cb('darkSlate', [0, -2.6, d.td / 2 + 0.45], [0.5, d.th + 1.6, 0.1]);
      for (const side of ['elL', 'elR']) {
        shapes(side).cb(trim, [0, -d.fore + 1.6, 0], [d.aw + 0.1, 0.6, d.aw + 0.1]);
      }
    },
  },
  {
    id: 'chefJacket',
    description: "double-breasted chef's jacket: stand-up collar, two rows of buttons (detail)",
    colors: { color: 'cream', detail: 'darkSlate' },
    adjust: { sleeves: 'color' },
    draw({ shapes, d, color, detail }) {
      const torso = shapes('torso')
        .cb(color, [0, 0, 0], [d.tw + 0.3, d.th, d.td + 0.3])
        .cb(color, [0, d.th - 0.4, 0], [d.tw - 2.2, 1, d.td - 1]);
      for (const x of [-1.1, 1.1]) {
        for (const y of [1.4, 3, 4.6]) torso.cb(detail, [x, y, d.td / 2 + 0.2], [0.6, 0.6, 0.15]);
      }
    },
  },
  {
    id: 'apron',
    description: 'bib apron from the chest to the knees, with a neck strap',
    colors: { color: 'slateGrey' },
    draw({ shapes, d, color }) {
      shapes('torso')
        .cb(color, [0, -3.4, d.td / 2 + 0.25], [d.tw - 1.2, d.th + 1.6, 0.3])
        .cb(color, [0, d.th - 1.8, d.td / 2 + 0.25], [d.tw - 2.6, 1.6, 0.3])
        .cb(color, [0, 1.2, 0], [d.tw + 0.5, 0.5, d.td + 0.5]);
    },
  },
];
