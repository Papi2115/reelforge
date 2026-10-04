/**
 * Film-level repetition control (PLAN.md#12.23, ADR-019): `.reelforge/repetitions.json` lists
 * what repeats too often across the whole film — the same visual (look + treatment + kit
 * definitions) or chart/template, the same transition style, the same SFX recipe, the same
 * narration phrase — each with a proposal (re-pick the SFX or transition, build a variant of the
 * shot, or report only) and the user's decision (open / applied / ignored). See docs/repetition.md.
 */
import { z } from 'zod';

/**
 * Project switch: `off` = no analysis (projects made before 2.2), `auto` = the final review and
 * the Sound cues stage analyse the film. Absent = `off`; new projects get `auto`.
 */
export const REPETITION_CONTROL_MODES = ['off', 'auto'] as const;
export const repetitionControlModeSchema = z.enum(REPETITION_CONTROL_MODES);
export type RepetitionControlMode = z.infer<typeof repetitionControlModeSchema>;
export const DEFAULT_REPETITION_CONTROL: RepetitionControlMode = 'off';

export function projectRepetitionControl(project: {
  readonly repetitionControl?: RepetitionControlMode | undefined;
}): RepetitionControlMode {
  return project.repetitionControl ?? DEFAULT_REPETITION_CONTROL;
}

export const REPETITIONS_VERSION = 1;
/** App state (git-ignored); the readable report sits next to it. */
export const REPETITIONS_FILE = '.reelforge/repetitions.json';
export const REPETITIONS_REPORT_FILE = '.reelforge/repetitions.md';

export const REPETITION_KINDS = ['visual', 'template', 'transition', 'sfx', 'phrase'] as const;
export const repetitionKindSchema = z.enum(REPETITION_KINDS);
export type RepetitionKind = z.infer<typeof repetitionKindSchema>;

export const repetitionSeveritySchema = z.enum(['info', 'warning']);
export type RepetitionSeverity = z.infer<typeof repetitionSeveritySchema>;

/**
 * What Apply does: `sfx` re-picks the repeated cues' recipes (cues.json, no Claude),
 * `transition` re-picks the repeated transition styles (storyboard.json), `variant` queues a
 * shot-variant build with a hint (the user picks as usual), `none` = report only (phrases).
 */
export const repetitionActionSchema = z.enum(['sfx', 'transition', 'variant', 'none']);
export type RepetitionAction = z.infer<typeof repetitionActionSchema>;

export const repetitionStatusSchema = z.enum(['open', 'applied', 'ignored']);
export type RepetitionStatus = z.infer<typeof repetitionStatusSchema>;

export const repetitionOccurrenceSchema = z.object({
  t: z.number().nonnegative(),
  shotId: z.string().min(1).optional(),
  /** cues.json sfx id (SFX repetitions). */
  cueId: z.string().min(1).optional(),
});
export type RepetitionOccurrence = z.infer<typeof repetitionOccurrenceSchema>;

export const repetitionChangeSchema = z.object({
  /** Shot (transition / variant) or cue id (sfx) the change touches. */
  target: z.string().min(1),
  from: z.string().min(1),
  /** The replacement (recipe / style id; the hint for a variant). */
  to: z.string().min(1),
});
export type RepetitionChange = z.infer<typeof repetitionChangeSchema>;

export const repetitionItemSchema = z.object({
  /** Stable across runs for the same finding (kind + what repeats + where). */
  id: z.string().min(1),
  kind: repetitionKindSchema,
  severity: repetitionSeveritySchema,
  /** What repeats ("whoosh", "crt-zoom", "retro-ui · ui-mockup · retroWindow", "the old engine"). */
  subject: z.string().min(1),
  /** One readable line ("whoosh 4× in 30 s (12.0–38.5 s)"). */
  text: z.string().min(1),
  occurrences: z.array(repetitionOccurrenceSchema).min(2),
  action: repetitionActionSchema,
  /** The proposed replacements; empty when nothing can change (locked or no alternative). */
  changes: z.array(repetitionChangeSchema),
  /** Every occurrence that would change is in a locked shot. */
  locked: z.boolean(),
  status: repetitionStatusSchema,
});
export type RepetitionItem = z.infer<typeof repetitionItemSchema>;

export const repetitionThresholdsSchema = z.object({
  /** Same visual signature twice within this many seconds. */
  visualWindowS: z.number().positive(),
  /** Same chart/template this many times ... */
  templateCount: z.int().min(2),
  /** ... within this window (s). */
  templateWindowS: z.number().positive(),
  /** Same transition style twice within this many seconds. */
  transitionWindowS: z.number().positive(),
  /** Same SFX recipe this many times ... */
  sfxCount: z.int().min(2),
  /** ... within this window (s); two in a row (no other cue between) count at any distance. */
  sfxWindowS: z.number().positive(),
  /** Two consecutive same-recipe cues closer than this are one designed series. */
  sfxSeriesS: z.number().nonnegative(),
  /** Phrases of this many words or more ... */
  phraseWords: z.int().min(2),
  /** ... repeated this many times ... */
  phraseCount: z.int().min(2),
  /** ... within this window (s). */
  phraseWindowS: z.number().positive(),
});
export type RepetitionThresholds = z.infer<typeof repetitionThresholdsSchema>;

export const DEFAULT_REPETITION_THRESHOLDS: RepetitionThresholds = {
  visualWindowS: 45,
  templateCount: 3,
  templateWindowS: 60,
  transitionWindowS: 20,
  sfxCount: 3,
  sfxWindowS: 30,
  sfxSeriesS: 1,
  phraseWords: 3,
  phraseCount: 3,
  phraseWindowS: 60,
};

const count = z.int().nonnegative();

export const repetitionsFileSchema = z.object({
  version: z.literal(REPETITIONS_VERSION),
  thresholds: repetitionThresholdsSchema,
  items: z.array(repetitionItemSchema),
  counts: z.object({
    visual: count,
    template: count,
    transition: count,
    sfx: count,
    phrase: count,
    /** Items still open (not applied or ignored). */
    open: count,
  }),
});
export type RepetitionsFile = z.infer<typeof repetitionsFileSchema>;
