/**
 * Reference text of the character pack (ADR-024) for `reelforge kit-docs characters`, and the
 * id/description listing of everything a scene or a role spec can name. Generated from the pack's
 * own tables, so it cannot drift from the code.
 */
import { CAST, CAST_SPECS, EXAMPLE_ROLES } from './cast-presets.js';
import { EXPRESSIONS, POSES } from './clips.js';
import { MANNEQUIN_INFO } from './mannequin.js';
import { MASCOT_INFO, MASCOTS } from './mascots.js';
import { ACCESSORY_ITEMS } from './role-accessories.js';
import { HELD_ITEMS } from './role-held.js';
import { HAIR_ITEMS, HEADGEAR_ITEMS } from './role-head.js';
import { LAYER_ITEMS } from './role-layers.js';
import {
  BODY_INFO,
  BODY_PRESETS,
  MAX_OUTFIT_COLORS,
  SKIN_COLORS,
  SKIN_TONES,
} from './role-spec.js';
import type { RoleItem } from './role-types.js';

export interface CastListingEntry {
  readonly kind:
    | 'mascot'
    | 'person'
    | 'mannequin'
    | 'body'
    | 'hair'
    | 'headgear'
    | 'layer'
    | 'accessory'
    | 'held';
  readonly id: string;
  readonly description: string;
}

function items(kind: CastListingEntry['kind'], list: readonly RoleItem[]): CastListingEntry[] {
  return list
    .filter((item) => item.id !== 'none')
    .map((item) => ({ kind, id: item.id, description: item.description }));
}

/** Everything a scene (`kit.cast.*`) or a role spec can name, with one line each. */
export function castListing(): CastListingEntry[] {
  return [
    ...MASCOTS.map((id) => ({ kind: 'mascot' as const, id, description: MASCOT_INFO[id] })),
    ...CAST.map((id) => ({
      kind: 'person' as const,
      id,
      description: CAST_SPECS[id].description ?? '',
    })),
    { kind: 'mannequin', id: 'mannequin', description: MANNEQUIN_INFO },
    ...BODY_PRESETS.map((id) => ({ kind: 'body' as const, id, description: BODY_INFO[id] })),
    ...items('hair', HAIR_ITEMS),
    ...items('headgear', HEADGEAR_ITEMS),
    ...items('layer', LAYER_ITEMS),
    ...items('accessory', ACCESSORY_ITEMS),
    ...items('held', HELD_ITEMS),
  ];
}

function slots(item: RoleItem): string {
  const used = Object.entries(item.colors).map(([slot, color]) => `${slot}=${color}`);
  return used.length === 0 ? '' : ` [${used.join(', ')}]`;
}

function section(title: string, list: readonly RoleItem[]): string[] {
  return [
    title,
    ...list
      .filter((item) => item.id !== 'none')
      .map((item) => `  ${item.id}${slots(item)} — ${item.description}`),
  ];
}

/** `reelforge kit-docs characters`. */
export function charactersDocs(): string {
  const example = EXAMPLE_ROLES[0];
  return [
    'kit.cast — the character pack (voxel look; build() only, then call .update(t) every frame)',
    '  kit.cast.mascot(id, { pose?, expression?, energy?, seed?, light?, scale? }) — ~2 units tall, faces +z',
    '  kit.cast.person(id, { pose?, held?, hand?, energy?, seed?, scale? }) — side cast, ~1.7 units',
    '  kit.cast.mannequin({ pose?, energy?, seed?, scale? }) — neutral figure, ~2 units',
    '  kit.cast.role(spec, { pose?, energy?, seed?, scale? }) — a person from a role spec (below)',
    "  kit.cast.spec(id) — a copy of a cast member's role spec, to derive a variant: kit.cast.role({ ...kit.cast.spec('engineer'), id: 'welder', held: 'hammer' })",
    'cues (build() only, before the first update(); at = scene seconds or ctx.anchor(...); a cue at the same time replaces the earlier one):',
    `  .pose(name, { at }) — ${POSES.join(', ')} (blends 0.35 s; anticipation, overshoot, lagging head)`,
    `  .expression(name, { at }) — mascots: auto (the pose's), ${EXPRESSIONS.join(', ')}; blinking is automatic`,
    '  .walkTo([x, y, z], { at, speed = 0.8, then = "calm" }) — parent space; queues after the previous walk; .walkEnd() = arrival time',
    '  .lookAt(objectOr[x, y, z], { at, until }) — head turns to a kit object or world point',
    'anchors (follow the pose): head, face, hand (the holding hand), handL, handR, prop (held prop), feet; bottom = origin',
    'mascots:',
    ...MASCOTS.map((id) => `  ${id} — ${MASCOT_INFO[id]}`),
    'cast (kit.cast.person):',
    ...CAST.map((id) => `  ${id} — ${CAST_SPECS[id].description ?? ''}`),
    `mannequin — ${MANNEQUIN_INFO}`,
    'role spec (JSON, validated; colours = pack swatches like cream/brightTeal/darkSlate or style tokens like accent1):',
    '  { id: camelCase, label, description?, body?, skin?, hair?: { style, color? }, headgear?: item, top: { color },',
    '    layers?: [item], legs: { style?: pants|shorts, color }, shoes: { style?: shoes|boots, color },',
    '    eyes?: { style: dots|glow|none, color? }, accessories?: [item], held?: id | { id, hand?, color?, trim? } }',
    '  item = "id" or { id, color?, trim?, detail? } (slots and defaults in [..] below)',
    `  outfit (top, layers with trim/detail, legs, headgear) <= ${String(MAX_OUTFIT_COLORS)} colours; skin, hair, shoes, accessories, held prop extra`,
    `  body: ${BODY_PRESETS.map((id) => `${id} (${BODY_INFO[id]})`).join('; ')}`,
    `  skin: ${SKIN_TONES.map((id) => `${id} = ${SKIN_COLORS[id]}`).join(', ')}`,
    ...section('  hair styles (color = hair colour):', HAIR_ITEMS),
    ...section('  headgear:', HEADGEAR_ITEMS),
    ...section('  layers (over the top colour, in order):', LAYER_ITEMS),
    ...section('  accessories:', ACCESSORY_ITEMS),
    ...section('  held props:', HELD_ITEMS),
    `example: kit.cast.role(${JSON.stringify(example)}, { pose: 'point' })`,
  ].join('\n');
}
