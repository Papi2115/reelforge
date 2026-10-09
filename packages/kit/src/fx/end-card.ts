/**
 * `kit.fx.endCard` (PLAN.md#13.18): the moving backdrop of a short's fixed end card ("Full video
 * on YT: <channel>", 2 s): voxel stripes sliding across the frame and a play badge that pops in,
 * bobs and shrinks away at the end, in the style's palette. The app writes the end card scene
 * (no Claude turn), so the helper is bound in every kit but kept out of the catalog and kit-docs.
 * The text is engine pixel-font cards (`ctx.text.title`, legible and checked by the card QA);
 * `endCardLayout` places both for a portrait or a landscape frame seen from END_CARD_CAMERA.
 */
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineFx } from '../registry.js';
import { asFx, EASES, progress } from './shared.js';

/** Where the end card scene puts the camera (the layout below is computed for it). */
export const END_CARD_CAMERA = {
  position: [0, 0, 10],
  target: [0, 0, 0],
  fov: 50,
} as const;

/** Height of the frame in units at z = 0 seen from END_CARD_CAMERA. */
export const END_CARD_FRAME_HEIGHT =
  2 * END_CARD_CAMERA.position[2] * Math.tan(((END_CARD_CAMERA.fov / 2) * Math.PI) / 180);

export type EndCardFormat = 'landscape' | 'portrait';

export interface EndCardLayout {
  /** Badge centre, share of the frame height from the top. */
  readonly badgeY: number;
  /** Badge height, share of the frame height. */
  readonly badgeSize: number;
  /** Lead line ("FULL VIDEO ON YT:"): middle at this share of the height, integer scale. */
  readonly leadY: number;
  readonly leadScale: number;
  /** Channel name: top at this share of the height; its scale follows its length. */
  readonly nameY: number;
  readonly nameScales: readonly { readonly maxChars: number; readonly scale: number }[];
}

/**
 * Inside the platform-safe zone: the central 80 % of the width, below the top 12 % and above the
 * bottom 20 % (the Shorts player covers those) in portrait.
 */
const LAYOUTS: Readonly<Record<EndCardFormat, EndCardLayout>> = {
  portrait: {
    badgeY: 0.36,
    badgeSize: 0.15,
    leadY: 0.53,
    leadScale: 2,
    nameY: 0.58,
    nameScales: [
      { maxChars: 10, scale: 4 },
      { maxChars: 14, scale: 3 },
    ],
  },
  landscape: {
    badgeY: 0.32,
    badgeSize: 0.22,
    leadY: 0.58,
    leadScale: 3,
    nameY: 0.66,
    nameScales: [
      { maxChars: 14, scale: 5 },
      { maxChars: 20, scale: 4 },
    ],
  },
};

/** Smallest scale of a long channel name (still ≥ the phone-legibility minimum). */
const MIN_NAME_SCALE = 2;

export function endCardLayout(format: EndCardFormat): EndCardLayout {
  return LAYOUTS[format];
}

/** Integer text scale of a channel name of `name.length` characters in `format`. */
export function endCardNameScale(format: EndCardFormat, name: string): number {
  const length = name.trim().length;
  const fit = LAYOUTS[format].nameScales.find((entry) => length <= entry.maxChars);
  return fit?.scale ?? MIN_NAME_SCALE;
}

/** The lead and the channel name of an end card text: split at its first ": ". */
export function splitEndCardText(text: string): { lead: string | undefined; name: string } {
  const index = text.indexOf(': ');
  if (index < 0) return { lead: undefined, name: text.trim() };
  return { lead: text.slice(0, index + 1).trim(), name: text.slice(index + 2).trim() };
}

export const endCardParams = z.object({
  format: z.enum(['landscape', 'portrait']).default('landscape').describe('ctx.shot.format'),
  duration: z.number().positive().default(2).describe('The shot length (ctx.shot.duration)'),
  plate: z.string().default('accent1').describe('Badge colour (palette name)'),
  mark: z.string().default('text').describe('Play mark colour (palette name)'),
  stripes: z.string().default('groundAlt').describe('Stripe colour (palette name)'),
});

const BADGE_ROWS = 13;
const BADGE_COLUMNS = 19;
const PLAY_MARK = [
  '#.......',
  '###.....',
  '#####...',
  '#######.',
  '########',
  '#######.',
  '#####...',
  '###.....',
  '#.......',
];
const STRIPE_SPACING = 1.6;
const STRIPE_SPEED = 0.9;
const STRIPE_TILT = 0.6;
const POP_IN = 0.35;
const SHRINK_OUT = 0.3;
/** Bob of the badge, share of the frame height. */
const BOB = 0.006;

/** Badge plate with rounded corners and a play mark, 2 voxels deep plus the raised mark. */
function badgeRows(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < BADGE_ROWS; y += 1) {
    let row = '';
    for (let x = 0; x < BADGE_COLUMNS; x += 1) {
      const corner = (x === 0 || x === BADGE_COLUMNS - 1) && (y === 0 || y === BADGE_ROWS - 1);
      row += corner ? '.' : 'p';
    }
    rows.push(row);
  }
  return rows;
}

export const endCard = defineFx({
  name: 'endCard',
  description:
    "A short's end card backdrop (app-built): sliding stripes and a popping play badge. fx.update(t) every frame.",
  params: endCardParams,
  build(params, tools) {
    const { voxel } = tools;
    const frameHeight = END_CARD_FRAME_HEIGHT;
    const frameWidth = frameHeight * (params.format === 'portrait' ? 9 / 16 : 16 / 9);
    const layout = endCardLayout(params.format);
    const object = createKitObject(tools.three, { kitType: 'endCard' });

    const voxelSize = (layout.badgeSize * frameHeight) / BADGE_ROWS;
    const sketch = voxel.sketch([BADGE_COLUMNS, BADGE_ROWS, 3], {
      plate: params.plate,
      mark: { color: params.mark, glow: true },
    });
    sketch.pattern(badgeRows(), { p: 'plate' }, 'xy', [0, 0, 0]);
    sketch.pattern(badgeRows(), { p: 'plate' }, 'xy', [0, 0, 1]);
    sketch.pattern(PLAY_MARK, { '#': 'mark' }, 'xy', [6, 2, 2]);
    const badge = voxel.mesh(sketch.model(), { voxelSize, pivot: 'center' });
    const badgeHome = (0.5 - layout.badgeY) * frameHeight;
    object.add(badge);

    const stripeLength = Math.hypot(frameWidth, frameHeight) * 1.4;
    const stripeCount = Math.ceil((frameWidth + frameHeight) / STRIPE_SPACING) + 2;
    const stripeVoxel = STRIPE_SPACING / 4;
    const stripeModel = voxel.box([1, Math.ceil(stripeLength / stripeVoxel), 1], {
      color: params.stripes,
      glow: true,
    });
    const stripes = Array.from({ length: stripeCount }, () => {
      const stripe = voxel.mesh(stripeModel, { voxelSize: stripeVoxel, pivot: 'center' });
      stripe.rotation.z = STRIPE_TILT;
      object.add(stripe);
      return stripe;
    });
    const span = stripeCount * STRIPE_SPACING;

    return asFx(object, (t) => {
      const shift = (t * STRIPE_SPEED) % STRIPE_SPACING;
      stripes.forEach((stripe, index) => {
        stripe.position.set(index * STRIPE_SPACING - span / 2 + shift, 0, -3);
      });
      const entered = progress(t, 0, POP_IN);
      const left = progress(t, params.duration - SHRINK_OUT, params.duration);
      const scale = EASES.easeOutBack(entered) * (1 - EASES.easeInCubic(left));
      badge.scale.setScalar(Math.max(1e-4, scale));
      badge.visible = entered > 0 && left < 1;
      badge.position.set(0, badgeHome + BOB * frameHeight * Math.sin(t * 5), 0);
      badge.rotation.y = 0.35 * Math.sin(t * 2.4);
    });
  },
});
