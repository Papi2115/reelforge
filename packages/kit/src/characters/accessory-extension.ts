/**
 * Project accessory extensions (ADR-026): `characters/accessories/<id>.json` in a video project, a
 * few boxes in the pack's voxel idiom attached to one body slot, for a profession the role
 * vocabulary lacks. Data, never code: a strict schema bounds the box count and sizes, keeps every
 * box inside its slot's envelope and connected to the body part (nothing floats), and allows only
 * pack swatches, style tokens or the accessory's colour slots. Drawn like a vocabulary item.
 */
import { z } from 'zod';
import type { Vec3 } from '../types.js';
import { isSpecColor } from './palette.js';
import type { ColorSlot, HeldItem, RoleItem } from './role-types.js';

export const ACCESSORY_SLOTS = ['head', 'torso', 'back', 'hand'] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

export const MAX_ACCESSORY_BOXES = 16;
/** Box side bounds in voxels (1 voxel = 1/12 unit; the head is 8 voxels wide). */
export const ACCESSORY_BOX_SIZE = { min: 0.1, max: 12 } as const;
/** Boxes closer than this (voxels) count as touching. */
const TOUCH = 0.05;

interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

interface SlotFrame {
  /** Where the slot's origin is and what the body part spans (docs). */
  readonly frame: string;
  /** Every box must lie inside. */
  readonly envelope: Aabb;
  /** The body part the boxes hang on (standard body): at least one box touches it. */
  readonly part: Aabb;
}

/** Slot frames in voxels for the standard body (torso and back scale with the body preset). */
export const SLOT_FRAMES: Readonly<Record<AccessorySlot, SlotFrame>> = {
  head: {
    frame:
      'origin = bottom centre of the head; the head spans x -4..4, y 0..7, z -3.5..3.5 (face at z = 3.5)',
    envelope: { min: [-7, -2, -7], max: [7, 13, 7] },
    part: { min: [-4, 0, -3.5], max: [4, 7, 3.5] },
  },
  torso: {
    frame:
      'origin = bottom centre of the torso (hips); the torso spans x -3..3, y 0..7, z -2..2 (chest at z = 2)',
    envelope: { min: [-6, -5, -5], max: [6, 10, 5] },
    part: { min: [-3, 0, -2], max: [3, 7, 2] },
  },
  back: {
    frame: 'same frame as torso; boxes stay behind the body middle (z <= 0), e.g. tanks, packs',
    envelope: { min: [-6, -3, -8], max: [6, 10, 0] },
    part: { min: [-3, 0, -2], max: [3, 7, 2] },
  },
  hand: {
    frame:
      'origin = bottom of the right hand (hand x -1..1, y 0..1.4, z -1..1), arm hanging, +z forward; tools hang below (y < 0); mirrored in the left hand',
    envelope: { min: [-4, -6, -4], max: [4, 4, 6] },
    part: { min: [-1, 0, -1], max: [1, 1.4, 1] },
  },
};

const COLOR_SLOTS: readonly ColorSlot[] = ['color', 'trim', 'detail'];

const colorName = z.string().refine(isSpecColor, {
  message:
    'use a pack swatch (cream, brightTeal, darkSlate, ...) or a style token (hero, accent1, ...)',
});

const boxColor = z
  .string()
  .refine((value) => (COLOR_SLOTS as readonly string[]).includes(value) || isSpecColor(value), {
    message:
      'use a colour slot of the accessory (color, trim, detail), a pack swatch or a style token',
  });

const side = z.number().min(ACCESSORY_BOX_SIZE.min).max(ACCESSORY_BOX_SIZE.max);
const coordinate = z.number().min(-20).max(20);

export const accessoryBoxSchema = z.strictObject({
  /** A colour slot (recolourable by the role) or a fixed swatch/token. */
  color: boxColor,
  /** [centre x, bottom y, centre z] in the slot frame (voxels), like the kit's `cb`. */
  at: z.tuple([coordinate, coordinate, coordinate]),
  /** [width, height, depth] in voxels. */
  size: z.tuple([side, side, side]),
  /** Unlit (a lamp, a screen, a light bar). */
  glow: z.boolean().optional(),
});
export type AccessoryBox = z.output<typeof accessoryBoxSchema>;

export const ACCESSORY_ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

function boxBounds(box: AccessoryBox): Aabb {
  const [x, y, z] = box.at;
  const [w, h, d] = box.size;
  return { min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + h, z + d / 2] };
}

function touches(a: Aabb, b: Aabb): boolean {
  return [0, 1, 2].every(
    (axis) =>
      (a.min[axis] ?? 0) <= (b.max[axis] ?? 0) + TOUCH &&
      (b.min[axis] ?? 0) <= (a.max[axis] ?? 0) + TOUCH,
  );
}

function inside(box: Aabb, envelope: Aabb): boolean {
  return [0, 1, 2].every(
    (axis) =>
      (box.min[axis] ?? 0) >= (envelope.min[axis] ?? 0) - TOUCH &&
      (box.max[axis] ?? 0) <= (envelope.max[axis] ?? 0) + TOUCH,
  );
}

/** Indices of boxes not connected to the body part (directly or through other boxes). */
export function floatingBoxes(slot: AccessorySlot, boxes: readonly AccessoryBox[]): number[] {
  const bounds = boxes.map(boxBounds);
  const reached = new Set<number>();
  const queue: Aabb[] = [SLOT_FRAMES[slot].part];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    bounds.forEach((candidate, index) => {
      if (!reached.has(index) && touches(current, candidate)) {
        reached.add(index);
        queue.push(candidate);
      }
    });
  }
  return bounds.map((_, index) => index).filter((index) => !reached.has(index));
}

export const accessoryExtensionSchema = z
  .strictObject({
    version: z.literal(1).default(1),
    id: z.string().regex(ACCESSORY_ID_PATTERN, 'camelCase id, e.g. policeLight').max(32),
    description: z.string().min(3).max(160),
    slot: z.enum(ACCESSORY_SLOTS),
    /** Default colours of the slots the boxes name (a role may override them like kit items). */
    colors: z.strictObject({
      color: colorName,
      trim: colorName.optional(),
      detail: colorName.optional(),
    }),
    boxes: z.array(accessoryBoxSchema).min(1).max(MAX_ACCESSORY_BOXES),
    notes: z.string().max(500).optional(),
  })
  .superRefine((extension, context) => {
    const { envelope } = SLOT_FRAMES[extension.slot];
    extension.boxes.forEach((box, index) => {
      if (!inside(boxBounds(box), envelope)) {
        context.addIssue({
          code: 'custom',
          path: ['boxes', index],
          message: `the box leaves the ${extension.slot} slot's area (x ${String(envelope.min[0])}..${String(envelope.max[0])}, y ${String(envelope.min[1])}..${String(envelope.max[1])}, z ${String(envelope.min[2])}..${String(envelope.max[2])} voxels)`,
        });
      }
    });
    for (const index of floatingBoxes(extension.slot, extension.boxes)) {
      context.addIssue({
        code: 'custom',
        path: ['boxes', index],
        message: `the box floats: it touches neither the ${extension.slot === 'back' ? 'torso' : extension.slot} nor another box of the accessory`,
      });
    }
  });

export type AccessoryExtensionInput = z.input<typeof accessoryExtensionSchema>;
export type AccessoryExtension = z.output<typeof accessoryExtensionSchema>;

function resolveBoxColor(box: AccessoryBox, slots: Readonly<Record<ColorSlot, string>>): string {
  return (COLOR_SLOTS as readonly string[]).includes(box.color)
    ? slots[box.color as ColorSlot]
    : box.color;
}

/** The extension as a vocabulary item (a `HeldItem` for the hand slot). */
export function accessoryItem(extension: AccessoryExtension): RoleItem | HeldItem {
  const { slot, boxes } = extension;
  const item: RoleItem = {
    id: extension.id,
    description: `${extension.description} (project accessory, ${slot})`,
    colors: Object.fromEntries(
      Object.entries(extension.colors).filter(([, value]) => value !== undefined),
    ),
    draw({ shapes, d, color, trim, detail, mirror }) {
      const torsoFrame = slot === 'torso' || slot === 'back';
      const scale: Vec3 = torsoFrame ? [d.tw / 6, d.th / 7, d.td / 4] : [1, 1, 1];
      const joint =
        slot === 'head' ? 'neck' : slot === 'hand' ? (mirror === 1 ? 'elR' : 'elL') : 'torso';
      const offsetY = slot === 'hand' ? -d.fore : 0;
      const flip = slot === 'hand' ? mirror : 1;
      const shape = shapes(joint);
      for (const box of boxes) {
        const [x, y, z] = box.at;
        const [w, h, depth] = box.size;
        shape.cb(
          resolveBoxColor(box, { color, trim, detail }),
          [x * scale[0] * flip, y * scale[1] + offsetY, z * scale[2]],
          [w * scale[0], h * scale[1], depth * scale[2]],
          box.glow === true ? 'glow' : 'lit',
        );
      }
    },
  };
  return slot === 'hand' ? { ...item, hand: 'right' } : item;
}
