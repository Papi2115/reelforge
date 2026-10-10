/**
 * The direction plan of a Grim Ink (`c-cam`) film (PLAN.md#14.16, docs/worlds/c-cam-DIRECTION.md):
 * `direction.json` in the project root (tracked) holds the film's narrative accents planned BEFORE
 * the shots exist: motifs, the cast with ONE signature gag each (setup -> escalations -> payoff on
 * narration beats), the beats with their intent and framing progression, the accidents, the climax
 * extreme close-up and the title frame (the opening poster = the thumbnail). Claude writes it
 * (`source: 'claude'`); when Claude fails the stage writes a minimal plan from the script
 * (`fallback`). The storyboard's shots carry `direction` refs into it (beat ids, gag people,
 * their framing progression). The rule checks live in `@reelforge/prompts` (validators/direction*).
 */
import { z } from 'zod';

export const DIRECTION_FILE_VERSION = 1;
/** Project-relative location (tracked by git, like storyboard.json). */
export const DIRECTION_FILE = 'direction.json';

/** Framing sizes of a progression (docs/worlds/c-cam-DIRECTION.md §2). */
export const DIRECTION_FRAMINGS = ['wide', 'medium', 'close', 'ecu', 'ots', 'reverse'] as const;
export const directionFramingSchema = z.enum(DIRECTION_FRAMINGS);
export type DirectionFraming = z.infer<typeof directionFramingSchema>;

/** Framings that must state why they are that close. */
export const CLOSE_FRAMINGS: readonly DirectionFraming[] = ['close', 'ecu'];

/** What a beat does for the story. */
export const BEAT_INTENTS = [
  'setup',
  'reveal',
  'reaction',
  'cause-effect',
  'tension',
  'punchline',
  'breath',
] as const;
export const beatIntentSchema = z.enum(BEAT_INTENTS);
export type BeatIntent = z.infer<typeof beatIntentSchema>;

/** Where a plan came from: Claude, or the stage's minimal plan when Claude failed. */
export const DIRECTION_SOURCES = ['claude', 'fallback'] as const;
export type DirectionSource = (typeof DIRECTION_SOURCES)[number];

/** A beat, cast or motif id: `b03`, `nightPorter`, `key-ring`. */
export const directionIdSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/, 'an id is a letter then letters, digits, - or _');

const text = (max: number) => z.string().trim().min(1).max(max);

/** One framing of a progression: its size, what it frames and (close / ECU) why. */
export const framingStepSchema = z.object({
  framing: directionFramingSchema,
  subject: text(160),
  /** The narrative reason (information, emotion, cause -> effect, consequence); required for close/ecu. */
  why: text(200).optional(),
});
export type FramingStep = z.infer<typeof framingStepSchema>;

export const directionSpanSchema = z.object({
  t0: z.number().nonnegative(),
  t1: z.number().positive(),
  /** The narration of the beat, quoted from the script. */
  text: text(400),
});

export const directionBeatSchema = z.object({
  id: directionIdSchema,
  span: directionSpanSchema,
  intent: beatIntentSchema,
  camera: z.object({
    progression: z.array(framingStepSchema).min(1).max(8),
    /** A Dutch tilt on this tense beat. */
    tilt: z.boolean().optional(),
  }),
  /** The small physical mishap of this beat (not in the narration, motivated by it). */
  accident: text(240).optional(),
  /** Cast ids whose signature gag plays on this beat. */
  gagRefs: z.array(directionIdSchema).max(4),
});
export type DirectionBeat = z.infer<typeof directionBeatSchema>;

export const gagArcSchema = z.object({
  setup: directionIdSchema,
  escalations: z.array(directionIdSchema).max(12),
  payoff: directionIdSchema,
  /** Why the gag belongs to the story (never decoration). */
  why: text(240),
});

export const directionCastSchema = z.object({
  id: directionIdSchema,
  /** Who this person is in the film (job, exaggeration axis). */
  role: text(200).optional(),
  signatureGag: z.object({
    /** A kit gag kind (`reelforge kit-docs people`), checked against the kit's list. */
    kind: z.string().trim().min(1).max(40),
    /** The film's own variation of the gag. */
    note: text(200).optional(),
    arc: gagArcSchema,
  }),
});
export type DirectionCast = z.infer<typeof directionCastSchema>;

export const directionMotifSchema = z.object({
  id: directionIdSchema,
  object: text(120),
  meaning: text(200),
});

export const directionClimaxSchema = z.object({
  beatRef: directionIdSchema,
  /** The object or instrument the extreme close-up frames. */
  ecuSubject: text(160),
  why: text(240),
});

/** The opening poster (= the thumbnail): `ink.titleCard` draws it in the first shot. */
export const titleFrameSchema = z.object({
  /** The 1-3 main people (cast ids). */
  cast: z.array(directionIdSchema).min(1).max(3),
  /** At most 6 words, from the script's own framing (checked by the validator). */
  title: text(80),
  subtitle: text(80).optional(),
  background: z.object({ placeId: directionIdSchema, why: text(200) }),
  /** Acting that sells the premise, one entry per title person. */
  acting: z
    .array(
      z.object({
        person: directionIdSchema,
        pose: text(40),
        expr: text(40),
        note: text(160).optional(),
      }),
    )
    .min(1)
    .max(3),
  accentObject: text(120),
});
export type TitleFrame = z.infer<typeof titleFrameSchema>;

export const directionFileSchema = z.object({
  version: z.literal(DIRECTION_FILE_VERSION),
  source: z.enum(DIRECTION_SOURCES).optional(),
  /** sha256 of script.txt + timing/words.json the plan was made from (the stage's cache key). */
  inputsHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  titleFrame: titleFrameSchema,
  motifs: z.array(directionMotifSchema).max(12),
  cast: z.array(directionCastSchema).min(1).max(6),
  beats: z.array(directionBeatSchema).min(1).max(200),
  climax: directionClimaxSchema,
  /** Beat ids that carry an accident (each beat has its `accident` text). */
  accidents: z.array(directionIdSchema).max(20),
});
export type DirectionFile = z.infer<typeof directionFileSchema>;

/** A storyboard shot's refs into the plan (Grim Ink only; optional everywhere else). */
export const shotDirectionRefsSchema = z.object({
  /** Beat ids the shot covers (none on the title frame). */
  beats: z.array(directionIdSchema).max(12).optional(),
  /** Cast ids whose signature gag plays in the shot. */
  gags: z.array(directionIdSchema).max(4).optional(),
  /** The shot's framing progression, in cut order. */
  framings: z.array(framingStepSchema).min(1).max(8),
  /** The shot is the title frame (the first shot). */
  titleFrame: z.boolean().optional(),
});
export type ShotDirectionRefs = z.infer<typeof shotDirectionRefsSchema>;

/** The size sequence of a progression, e.g. `wide>ecu>close`. */
export function framingSequence(steps: readonly Pick<FramingStep, 'framing'>[]): string {
  return steps.map((step) => step.framing).join('>');
}
