/**
 * Registry definitions of the character pack (ADR-024), bound as `kit.cast.*` (voxel look):
 * mascot, person (the ten cast members), mannequin and role (a person from a role spec). Each
 * call validates its params like every kit definition and gets its own seeded phase.
 */
import { z } from 'zod';
import { KitError } from '../errors.js';
import { scaleParam } from '../props/shared.js';
import { defineProp, type KitTools } from '../registry.js';
import { CAST, CAST_SPECS } from './cast-presets.js';
import { createCharacter, type CharacterObject } from './character.js';
import { EXPRESSIONS, POSES } from './clips.js';
import { buildMannequin } from './mannequin.js';
import { buildMascot, MASCOTS } from './mascots.js';
import { buildRole } from './role-build.js';
import { HELD_PROPS } from './role-held.js';
import { roleSpecSchema, type RoleSpecInput } from './role-spec.js';

const common = {
  pose: z
    .enum(POSES)
    .default('calm')
    .describe('Pose from t = 0; later changes: .pose(name, { at })'),
  energy: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Personality 0..1: anticipation, overshoot, head tilts (default: mascots 1, cast 0.45, mannequin 0.25)',
    ),
  seed: z
    .number()
    .int()
    .min(0)
    .max(999)
    .optional()
    .describe('Phase of idle glances and blinks (default: per call)'),
  scale: scaleParam,
};

const ANCHORS = {
  head: 'top of the head (follows the pose)',
  face: 'centre of the face (follows the pose)',
  hand: 'the hand that holds the prop (right without one)',
  handL: 'left hand',
  handR: 'right hand',
  prop: 'centre of the held prop (the hand without one)',
  feet: 'between the feet (follows jumps)',
};

const METHODS = {
  'update(t)': 'poses everything at t from the cues (call every frame; cues below: build() only)',
  'pose(name, { at })': `cues a pose (${POSES.join(', ')}) at scene time or ctx.anchor(...); blends 0.35 s`,
  'expression(name, { at })': `mascots: cues a face (auto, ${EXPRESSIONS.join(', ')})`,
  'walkTo([x, y, z], { at, speed = 0.8, then = "calm" })':
    'walks in a straight line (parent space), turning into the walk and back; queues after the previous walk',
  'lookAt(target, { at, until })': 'turns the head to a kit object or world [x, y, z]',
  'walkEnd()': 'time the last queued walk arrives',
};

function phaseSeed(tools: KitTools, seed: number | undefined): number {
  return seed ?? tools.rng.int(1, 99);
}

export const mascot = defineProp({
  name: 'mascot',
  description:
    'A mascot of the pack (~2 units tall, faces +z): bulb (channel mascot, glows on "eureka"), screen, fox, bean; 8 poses, 7 expressions with blinking.',
  params: z.object({
    id: z.enum(MASCOTS).describe('Which mascot'),
    expression: z
      .enum(['auto', ...EXPRESSIONS])
      .default('auto')
      .describe(
        'Face from t = 0 (auto = what the pose suggests); later: .expression(name, { at })',
      ),
    light: z.boolean().default(true).describe('Bulb: a point light while it glows'),
    ...common,
  }),
  anchors: ANCHORS,
  methods: METHODS,
  build(params, tools): CharacterObject {
    return createCharacter(tools, buildMascot(tools, params.id, { light: params.light }), {
      kitType: 'mascot',
      pose: params.pose,
      expression: params.expression,
      energy: params.energy,
      scale: params.scale,
      seed: phaseSeed(tools, params.seed),
    });
  },
});

export const person = defineProp({
  name: 'person',
  description:
    'A side-cast member (~1.7 units tall, faces +z): scientist, doctor, engineer, finance, teacher, historian, kid, hacker, detective, astronaut; same 8 poses, blinking dot eyes.',
  params: z.object({
    id: z.enum(CAST).describe('Which cast member'),
    held: z
      .enum(['none', ...HELD_PROPS])
      .optional()
      .describe("Swap the held prop (default: the member's own)"),
    hand: z.enum(['left', 'right']).optional().describe("Hand that holds it (default: the prop's)"),
    ...common,
  }),
  anchors: ANCHORS,
  methods: METHODS,
  build(params, tools): CharacterObject {
    const preset = CAST_SPECS[params.id];
    const held = params.held ?? (typeof preset.held === 'string' ? preset.held : preset.held?.id);
    const spec: RoleSpecInput = {
      ...preset,
      held:
        held === undefined || held === 'none'
          ? undefined
          : params.hand === undefined
            ? held
            : { id: held, hand: params.hand },
    };
    return role.build({ ...params, spec: roleSpecSchema.parse(spec) }, tools);
  },
});

export const mannequin = defineProp({
  name: 'mannequin',
  description:
    'Neutral cream mannequin (~2 units tall, faces +z) with ball joints, no face; realistic proportions for anatomy and diagrams; same 8 poses.',
  params: z.object(common),
  anchors: ANCHORS,
  methods: METHODS,
  build(params, tools): CharacterObject {
    return createCharacter(tools, buildMannequin(tools), {
      kitType: 'mannequin',
      pose: params.pose,
      expression: 'auto',
      energy: params.energy,
      scale: params.scale,
      seed: phaseSeed(tools, params.seed),
    });
  },
});

export const role = defineProp({
  name: 'role',
  description:
    'A person built from a role spec (body, skin, hair, headgear, top + layers, legs, shoes, accessories, held prop; <= 4 outfit colours) in the cast style: new professions as siblings of the pack.',
  params: z.object({
    spec: roleSpecSchema.describe('Role spec (reelforge kit-docs characters)'),
    ...common,
  }),
  anchors: ANCHORS,
  methods: METHODS,
  build(params, tools): CharacterObject {
    return createCharacter(tools, buildRole(tools, params.spec), {
      kitType: params.spec.id,
      pose: params.pose,
      expression: 'auto',
      energy: params.energy,
      scale: params.scale,
      seed: phaseSeed(tools, params.seed),
    });
  },
});

export const CAST_DEFINITIONS = [mascot, person, mannequin, role] as const;

/** A copy of a cast member's role spec (to derive a variant: kit.cast.role({ ...spec, ... })). */
export function castSpec(id: string): RoleSpecInput {
  if (!(CAST as readonly string[]).includes(id)) {
    throw new KitError(
      'invalid-params',
      `kit.cast.spec(id): unknown cast member "${id}" (${CAST.join(', ')})`,
    );
  }
  return structuredClone(CAST_SPECS[id as (typeof CAST)[number]]);
}
