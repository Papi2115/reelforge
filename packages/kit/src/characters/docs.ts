/**
 * Reference text of the character pack (ADR-024) for `reelforge kit-docs characters`, and the
 * id/description listing of everything a scene or a role spec can name. Generated from the pack's
 * own tables, so it cannot drift from the code.
 */
import { ACCESSORY_SLOTS, MAX_ACCESSORY_BOXES, SLOT_FRAMES } from './accessory-extension.js';
import { CAST, CAST_SPECS, EXAMPLE_ROLES } from './cast-presets.js';
import { EXPRESSIONS, POSES } from './clips.js';
import { MANNEQUIN_INFO } from './mannequin.js';
import { MASCOT_INFO, MASCOTS } from './mascots.js';
import { REACTION_INFO, REACTIONS } from './reactions.js';
import { ACCESSORY_ITEMS } from './role-accessories.js';
import { HELD_ITEMS } from './role-held.js';
import { HAIR_ITEMS, HEADGEAR_ITEMS } from './role-head.js';
import { NO_PROJECT_CAST, type ProjectCast } from './project-roles.js';
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
    | 'role'
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

/**
 * Everything a scene (`kit.cast.*`) or a role spec can name, with one line each; with a project
 * cast also its roles (`role`) and accessories (`accessory`, marked as project ones).
 */
export function castListing(project: ProjectCast = NO_PROJECT_CAST): CastListingEntry[] {
  return [
    ...MASCOTS.map((id) => ({ kind: 'mascot' as const, id, description: MASCOT_INFO[id] })),
    ...CAST.map((id) => ({
      kind: 'person' as const,
      id,
      description: CAST_SPECS[id].description ?? '',
    })),
    { kind: 'mannequin', id: 'mannequin', description: MANNEQUIN_INFO },
    ...[...project.roles.values()].map((role) => ({
      kind: 'role' as const,
      id: role.spec.id,
      description: `${role.spec.label}: ${role.spec.description} (project role, ${role.file})`,
    })),
    ...BODY_PRESETS.map((id) => ({ kind: 'body' as const, id, description: BODY_INFO[id] })),
    ...items('hair', HAIR_ITEMS),
    ...items('headgear', HEADGEAR_ITEMS),
    ...items('layer', LAYER_ITEMS),
    ...items('accessory', ACCESSORY_ITEMS),
    ...items('held', HELD_ITEMS),
    ...[...project.accessories.values()].map((accessory) => ({
      kind: accessory.slot === 'hand' ? ('held' as const) : ('accessory' as const),
      id: accessory.id,
      description: `${accessory.description} (project accessory, ${accessory.slot})`,
    })),
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

/** The project's roles and accessories (empty without any). */
function projectSection(project: ProjectCast): string[] {
  const roles = [...project.roles.values()];
  const accessories = [...project.accessories.values()];
  if (roles.length === 0 && accessories.length === 0) return [];
  return [
    'project roles (characters/roles/<id>.json; kit.cast.person(id) or kit.cast.role(id), kit.cast.spec(id) for a variant):',
    ...roles.map((role) => `  ${role.spec.id} — ${role.spec.label}: ${role.spec.description}`),
    ...(accessories.length === 0
      ? []
      : [
          'project accessories (characters/accessories/<id>.json; hand ones go in held, the others in accessories):',
          ...accessories.map(
            (accessory) => `  ${accessory.id} (${accessory.slot}) — ${accessory.description}`,
          ),
        ]),
  ];
}

/** The accessory extension format (for professions the vocabulary lacks). */
function accessoryFormat(): string[] {
  return [
    `accessory extension (only when the vocabulary lacks an essential piece): characters/accessories/<id>.json = { id, description, slot: ${ACCESSORY_SLOTS.join('|')}, colors: { color, trim?, detail? }, boxes: [{ color: color|trim|detail|swatch, at: [x, bottomY, z], size: [w, h, d], glow? }] }`,
    `  1-${String(MAX_ACCESSORY_BOXES)} boxes in voxels (1/12 unit), each touching the body part or another box; frames:`,
    ...ACCESSORY_SLOTS.map((slot) => `  ${slot}: ${SLOT_FRAMES[slot].frame}`),
  ];
}

/** `reelforge kit-docs characters` (with the project's roles and accessories when given). */
export function charactersDocs(project: ProjectCast = NO_PROJECT_CAST): string {
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
    "  .reaction(name, { at, toward }) — a short human beat on top of the pose, timed to the key word (at: ctx.anchor('phrase'), a few frames before it lands); its face wins over earlier expression cues while it plays; mascots react in their own anatomy (Bulb's glass flickers, Screen glitches to O_O, Fox flicks its ears and puffs its tail, Bean wobbles and squints); keep the face visible (front or three-quarter, >= 1/4 of the frame height):",
    ...REACTIONS.map((name) => `    ${name} — ${REACTION_INFO[name]}`),
    '    glance-camera: toward = the camera position you give ctx.camera.set (default: straight out along +z)',
    '  .walkTo([x, y, z], { at, speed = 0.8, then = "calm" }) — parent space; queues after the previous walk; .walkEnd() = arrival time',
    '  .lookAt(objectOr[x, y, z], { at, until }) — head turns to a kit object or world point',
    '  point raises the right arm along the way the body faces (+z): to point at a thing, turn the whole character toward it (rotation.y = Math.atan2(dx, dz)), three-quarter to the camera; lookAt turns only the head',
    'staging (so people read at 640x360): kit.env.lights preset default or dramatic on them (noir turns skin and outfits violet: keep a dark mood in the set, not on the faces); faces front or three-quarter to the camera, never only a back; the person a shot is about at least ~1/4 of the frame height',
    'anchors (follow the pose): head, face, hand (the holding hand), handL, handR, prop (held prop), feet; bottom = origin',
    'mascots:',
    ...MASCOTS.map((id) => `  ${id} — ${MASCOT_INFO[id]}`),
    'cast (kit.cast.person):',
    ...CAST.map((id) => `  ${id} — ${CAST_SPECS[id].description ?? ''}`),
    `mannequin — ${MANNEQUIN_INFO}`,
    ...projectSection(project),
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
    ...accessoryFormat(),
    `example: kit.cast.role(${JSON.stringify(example)}, { pose: 'point' })`,
  ].join('\n');
}
