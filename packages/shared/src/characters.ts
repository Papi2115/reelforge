/**
 * Characters of a project (PLAN.md#12.20, ADR-025): which people a film is made with and which
 * mascot (if any) appears in it. `characters` = `pack` (the character pack `kit.cast`, ADR-024) or
 * `classic` (the old hoodie hero `kit.props.character`); absent = `classic`, so projects made
 * before 2.3.5 build exactly as before. `mascot` = one of the pack's four mascots or `none`; it is
 * only in effect with the pack (`projectMascot`). The ids mirror `MASCOTS` / `CAST` of
 * packages/kit (a test in packages/stages keeps them in sync).
 */
import { z } from 'zod';

export const CHARACTER_MODES = ['pack', 'classic'] as const;
export const characterModeSchema = z.enum(CHARACTER_MODES);
export type CharacterMode = z.infer<typeof characterModeSchema>;

/** Projects without the field (made before 2.3.5) keep the classic hero. */
export const DEFAULT_CHARACTER_MODE: CharacterMode = 'classic';

/** The pack's mascots (= `MASCOTS` of packages/kit). */
export const MASCOT_IDS = ['bulb', 'screen', 'fox', 'bean'] as const;
export type MascotId = (typeof MASCOT_IDS)[number];

export const MASCOT_CHOICES = ['none', ...MASCOT_IDS] as const;
export const mascotChoiceSchema = z.enum(MASCOT_CHOICES);
export type MascotChoice = z.infer<typeof mascotChoiceSchema>;

export const DEFAULT_MASCOT_CHOICE: MascotChoice = 'none';

/** The pack's side cast, `kit.cast.person(id)` (= `CAST` of packages/kit). */
export const CAST_PERSON_IDS = [
  'scientist',
  'doctor',
  'engineer',
  'finance',
  'teacher',
  'historian',
  'kid',
  'hacker',
  'detective',
  'astronaut',
] as const;
export type CastPersonId = (typeof CAST_PERSON_IDS)[number];

/** Name and personality of a mascot: the settings cards and the prompts use the same words. */
export interface MascotProfile {
  readonly label: string;
  /** One line, for the settings card. */
  readonly blurb: string;
  /** How it behaves on screen, for the prompts. */
  readonly personality: string;
}

export const MASCOT_PROFILES: Readonly<Record<MascotId, MascotProfile>> = {
  bulb: {
    label: 'Bulb',
    blurb: 'The channel mascot: a lightbulb head that lights up on every idea.',
    personality:
      'curious and upbeat, the "aha" helper; its bulb glows and flickers in the `eureka` pose',
  },
  screen: {
    label: 'Screen',
    blurb: 'A small robot whose face is a pixel display; precise and a bit deadpan.',
    personality:
      'precise and a bit deadpan, at home with data, charts and UI; its 12x8 pixel face shows the expressions and flashes on `alarm`',
  },
  fox: {
    label: 'Fox',
    blurb: 'A curious fox in a teal scarf; playful, quick, wags its tail when happy.',
    personality:
      'playful, quick and nosy; its tail wags fast on `joy`, the ears flatten on surprise or alarm',
  },
  bean: {
    label: 'Bean',
    blurb: 'A pink bean with huge eyes and a sprout; easily amazed, reads even tiny.',
    personality:
      'sweet and easily amazed, the best reactor; huge eyes and a sprout that reads even small on screen',
  },
};

/**
 * Impersonal jobs a mascot may do in a shot: never a person whose identity matters (docs/
 * characters.md, "Mascot rules").
 */
export const MASCOT_ROLES = [
  'pointer',
  'demonstrator',
  'carrier',
  'reactor',
  'viewer',
  'sign-holder',
] as const;
export type MascotRole = (typeof MASCOT_ROLES)[number];

export const MAX_MASCOT_ACTION_LENGTH = 120;

/** `shot.mascot` in storyboard.json: the mascot's job in that shot. */
export const shotMascotSchema = z.object({
  role: z.enum(MASCOT_ROLES),
  /** What it does, in plain words ("points at the 2007 bar"). */
  action: z.string().min(1).max(MAX_MASCOT_ACTION_LENGTH),
});
export type ShotMascot = z.infer<typeof shotMascotSchema>;

/** Id of a role (a person in the pack's style), kebab case, e.g. `firefighter`. */
export const roleIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'role id must be kebab case, e.g. firefighter')
  .max(40);

/**
 * A person the story needs that the pack does not have (storyboard `newRoles`, pack projects
 * only): the app builds it as a role spec in the pack's style before the scenes.
 */
export const newRoleSchema = z.object({
  id: roleIdSchema,
  /** One line: what they wear and hold ("firefighter in a helmet and turnout coat, axe"). */
  description: z.string().min(1).max(200),
});
export type NewRole = z.infer<typeof newRoleSchema>;

interface CharacterFields {
  readonly characters?: CharacterMode | undefined;
  readonly mascot?: MascotChoice | undefined;
}

export function projectCharacters(project: CharacterFields): CharacterMode {
  return project.characters ?? DEFAULT_CHARACTER_MODE;
}

/** The mascot in effect: the chosen one with the pack, `none` with the classic hero. */
export function projectMascot(project: CharacterFields): MascotChoice {
  if (projectCharacters(project) !== 'pack') return 'none';
  return project.mascot ?? DEFAULT_MASCOT_CHOICE;
}

export function isMascotId(value: string): value is MascotId {
  return (MASCOT_IDS as readonly string[]).includes(value);
}

export function isCastPersonId(value: string): value is CastPersonId {
  return (CAST_PERSON_IDS as readonly string[]).includes(value);
}
