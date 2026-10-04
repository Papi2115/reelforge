/**
 * Role specs (ADR-024): a JSON description of a side-cast person built from the fixed vocabulary
 * (body preset, skin tone, hair, headgear, top + clothing layers, legs, shoes, eyes, accessories,
 * one held prop), so new professions look like siblings of the pack. Colours are pack swatch
 * names or style tokens; the outfit (top, layers, legs, headgear, with each item's trim/detail)
 * uses at most four distinct colours. The ten cast members are presets of this format.
 */
import { z } from 'zod';
import { isSpecColor } from './palette.js';
import { ACCESSORIES, ACCESSORY_ITEMS } from './role-accessories.js';
import { HELD_ITEMS, HELD_PROPS } from './role-held.js';
import { HAIR_ITEMS, HAIR_STYLES, HEADGEAR, HEADGEAR_ITEMS } from './role-head.js';
import { roleIssueMessages } from './role-errors.js';
import { LAYER_ITEMS, LAYERS } from './role-layers.js';
import { itemTable, type ColorSlot, type RoleItem } from './role-types.js';

export const BODY_PRESETS = ['standard', 'tall', 'broad', 'kid', 'bulky'] as const;
export type BodyPreset = (typeof BODY_PRESETS)[number];

export const BODY_INFO: Readonly<Record<BodyPreset, string>> = {
  standard: 'chibi adult: head 8x7x7, torso 6x7x4, legs 6 (Scientist, Doctor, Teacher, Detective)',
  tall: 'tall and narrow: torso 5.6x8.5, legs 7 (Finance)',
  broad: 'broad and deep torso 7x5 (Historian, Hacker)',
  kid: 'smaller child: torso 5x5, legs 5, short arms (Kid)',
  bulky: 'bulky suit: torso 8x5, thick arms and legs (Astronaut)',
};

export const SKIN_TONES = ['peach', 'tan', 'brown'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];
export const SKIN_COLORS: Readonly<Record<SkinTone, string>> = {
  peach: 'lightOrange',
  tan: 'tan',
  brown: 'rust',
};

/** Outfit colours (top, layers, legs, headgear) a role may use at most. */
export const MAX_OUTFIT_COLORS = 4;

const colorName = z.string().refine(isSpecColor, {
  message:
    'use a pack swatch (cream, brightTeal, darkSlate, ...) or a style token (hero, accent1, ...)',
});

const slots = {
  color: colorName.optional(),
  trim: colorName.optional(),
  detail: colorName.optional(),
};

/** An item given as its id or as { id, color?, trim?, detail? }. */
function itemRef<const T extends readonly [string, ...string[]]>(ids: T) {
  return z
    .union([z.enum(ids), z.object({ id: z.enum(ids), ...slots }).strict()])
    .transform((value) => (typeof value === 'string' ? { id: value } : value));
}

/** Ids a schema accepts (the vocabulary, plus project accessories for project roles). */
type Ids = readonly [string, ...string[]];

/**
 * The role spec schema over an accessory and a held-prop vocabulary: the kit's own
 * (`roleSpecSchema`) or the kit's plus a project's accessory extensions (project-roles.ts).
 */
export function createRoleSpecSchema<A extends Ids, H extends Ids>(accessoryIds: A, heldIds: H) {
  return z
    .object({
      version: z.literal(1).default(1),
      id: z
        .string()
        .regex(/^[a-z][a-zA-Z0-9]*$/, 'camelCase id, e.g. firefighter')
        .max(32),
      label: z.string().min(1).max(40).describe('Display name, e.g. "Firefighter"'),
      description: z.string().max(200).default(''),
      body: z.enum(BODY_PRESETS).default('standard'),
      skin: z.enum(SKIN_TONES).default('peach'),
      hair: z
        .object({ style: z.enum(HAIR_STYLES), color: colorName.optional() })
        .strict()
        .default({ style: 'short' }),
      headgear: itemRef(HEADGEAR).default({ id: 'none' }),
      top: z.object({ color: colorName }).strict().describe('Shirt / torso colour'),
      layers: z.array(itemRef(LAYERS)).max(4).default([]),
      legs: z
        .object({ style: z.enum(['pants', 'shorts']).default('pants'), color: colorName })
        .strict(),
      shoes: z
        .object({ style: z.enum(['shoes', 'boots']).default('shoes'), color: colorName })
        .strict(),
      eyes: z
        .object({
          style: z.enum(['dots', 'glow', 'none']).default('dots'),
          color: colorName.optional(),
        })
        .strict()
        .default({ style: 'dots' }),
      accessories: z.array(itemRef(accessoryIds)).max(4).default([]),
      held: z
        .union([
          z.enum(heldIds),
          z
            .object({
              id: z.enum(heldIds),
              hand: z.enum(['left', 'right']).optional(),
              color: colorName.optional(),
              trim: colorName.optional(),
            })
            .strict(),
        ])
        .transform((value) => (typeof value === 'string' ? { id: value } : value))
        .optional(),
    })
    .strict()
    .superRefine((spec, context) => {
      const colors = outfitColors(spec);
      if (colors.length > MAX_OUTFIT_COLORS) {
        context.addIssue({
          code: 'custom',
          path: ['layers'],
          message: `the outfit uses ${String(colors.length)} colours (${colors.join(', ')}); at most ${String(MAX_OUTFIT_COLORS)} (top, layers with their trim/detail, legs, headgear)`,
        });
      }
    });
}

export const roleSpecSchema = createRoleSpecSchema(ACCESSORIES, HELD_PROPS);

export type RoleSpecInput = z.input<typeof roleSpecSchema>;
export type RoleSpec = z.output<typeof roleSpecSchema>;
/** A role spec over any vocabulary (project accessories included): what the builder draws. */
export type AnyRoleSpec = z.output<ReturnType<typeof createRoleSpecSchema<Ids, Ids>>>;

export interface ItemRef {
  readonly id: string;
  readonly color?: string | undefined;
  readonly trim?: string | undefined;
  readonly detail?: string | undefined;
}

export const HAIR_TABLE = itemTable(HAIR_ITEMS);
export const HEADGEAR_TABLE = itemTable(HEADGEAR_ITEMS);
export const LAYER_TABLE = itemTable(LAYER_ITEMS);
export const ACCESSORY_TABLE = itemTable(ACCESSORY_ITEMS);
export const HELD_TABLE = itemTable(HELD_ITEMS);

/** The colour an item draws `slot` with (the reference's override or the item's default). */
export function slotColor(item: RoleItem, ref: ItemRef, slot: ColorSlot): string | undefined {
  return ref[slot] ?? item.colors[slot];
}

/** Colour names an item reference uses (only the slots the item draws with). */
export function itemColors(item: RoleItem, ref: ItemRef): string[] {
  return (['color', 'trim', 'detail'] as const)
    .filter((slot) => item.colors[slot] !== undefined)
    .map((slot) => slotColor(item, ref, slot))
    .filter((color): color is string => color !== undefined);
}

interface OutfitParts {
  readonly top: { readonly color: string };
  readonly layers: readonly ItemRef[];
  readonly legs: { readonly color: string };
  readonly headgear: ItemRef;
}

/** Distinct outfit colours of a spec (top, layers, legs, headgear). */
export function outfitColors(spec: OutfitParts): string[] {
  const used = [spec.top.color, spec.legs.color];
  const add = (table: ReadonlyMap<string, RoleItem>, ref: ItemRef): void => {
    const item = table.get(ref.id);
    if (item) used.push(...itemColors(item, ref));
  };
  for (const layer of spec.layers) add(LAYER_TABLE, layer);
  add(HEADGEAR_TABLE, spec.headgear);
  return [...new Set(used)];
}

export type RoleSpecResult =
  | { readonly ok: true; readonly spec: RoleSpec }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Validates a role spec (untyped JSON) with readable errors ("did you mean" for vocabulary ids). */
export function validateRoleSpec(input: unknown): RoleSpecResult {
  const parsed = roleSpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, spec: parsed.data };
  return { ok: false, errors: roleIssueMessages(parsed.error, input) };
}
