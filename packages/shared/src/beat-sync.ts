/**
 * Beat-synced editing (PLAN.md#12.21, ADR-018): the project switch `beatSync` (project.json;
 * absent = `off`), the beat grid `timing/beats.json` (tracked, derived deterministically from the
 * timed words, the acts of the storyboard and the tension map) and the beat-sync report
 * `.reelforge/beat-sync-report.json` (how many cuts and whooshes land on a beat or an accented
 * word). See docs/beat-sync.md.
 */
import { z } from 'zod';

/** Project switch: `off` = nothing snaps (projects made before 2.2), `auto` = on. */
export const BEAT_SYNC_MODES = ['off', 'auto'] as const;
export const beatSyncModeSchema = z.enum(BEAT_SYNC_MODES);
export type BeatSyncMode = z.infer<typeof beatSyncModeSchema>;
/** Projects without the field keep their exact behaviour; new projects get `auto`. */
export const DEFAULT_BEAT_SYNC: BeatSyncMode = 'off';

export function projectBeatSync(project: {
  readonly beatSync?: BeatSyncMode | undefined;
}): BeatSyncMode {
  return project.beatSync ?? DEFAULT_BEAT_SYNC;
}

export const BEATS_FILE_VERSION = 1;
/** Project-relative location (tracked by git, next to words.json). */
export const BEATS_FILE = 'timing/beats.json';

/**
 * Why a word is accented: `phrase` = it opens a phrase (first word, after a pause or a sentence
 * end), `number` = a spoken number, `emphasis` = `word!` or ALL CAPS, `final` = it ends a sentence.
 */
export const ACCENT_KINDS = ['phrase', 'number', 'emphasis', 'final'] as const;
export const accentKindSchema = z.enum(ACCENT_KINDS);
export type AccentKind = z.infer<typeof accentKindSchema>;

const seconds = z.number().nonnegative();

export const beatAccentSchema = z.object({
  /** Index into timing/words.json `words`. */
  word: z.int().nonnegative(),
  /** The word's start (s). */
  t: seconds,
  kind: accentKindSchema,
});
export type BeatAccent = z.infer<typeof beatAccentSchema>;

export const beatActSchema = z
  .object({
    from: seconds,
    to: seconds,
    /** Tempo of the act's music bed (within its mood's range). */
    bpm: z.number().min(40).max(200),
    /** Time of one beat of the act (s, global); the grid is `phaseS + k * 60 / bpm`. */
    phaseS: seconds,
    /** Mood the tempo range came from (the sound stage may still pick another mood). */
    mood: z.string().min(1).optional(),
  })
  .refine((act) => act.to > act.from, { message: 'to must be > from', path: ['to'] });
export type BeatAct = z.infer<typeof beatActSchema>;

export const beatsFileSchema = z.object({
  version: z.literal(BEATS_FILE_VERSION),
  /** Timeline length the grid covers (s). */
  durationS: seconds,
  acts: z.array(beatActSchema),
  /** Every beat of the film (s, global, ascending, rounded to ms). */
  beats: z.array(seconds),
  /** Accented words (ascending by time). */
  accents: z.array(beatAccentSchema),
});
export type BeatsFile = z.infer<typeof beatsFileSchema>;

export const BEAT_SYNC_REPORT_VERSION = 1;
/** App state (git-ignored), written by the Storyboard and Sound cues stages. */
export const BEAT_SYNC_REPORT_FILE = '.reelforge/beat-sync-report.json';
/** Share of cuts on a beat or an accent the report calls good. */
export const BEAT_SYNC_TARGET = 0.9;

const count = z.int().nonnegative();
const share = z.number().min(0).max(1);

export const beatSyncReportSchema = z.object({
  version: z.literal(BEAT_SYNC_REPORT_VERSION),
  /** "On the grid" = within this of a beat or an accent (one frame). */
  frameS: z.number().positive(),
  cuts: z.object({
    total: count,
    onGrid: count,
    fraction: share,
  }),
  /** What the last cut snapping did (absent until the Storyboard stage snapped). */
  nudges: z
    .object({
      moved: count,
      /** Boundaries next to a locked shot (never moved). */
      locked: count,
      /** Boundaries with no beat or accent reachable (kept). */
      kept: count,
      meanMs: z.number().nonnegative(),
      maxMs: z.number().nonnegative(),
      /** The snapped storyboard failed validation, so nothing was moved. */
      reverted: z.boolean(),
    })
    .optional(),
  /** Whooshes (transition sounds) whose peak lands within `windowS` of a beat or accent. */
  whooshes: z
    .object({ total: count, inWindow: count, fraction: share, windowS: z.number().positive() })
    .optional(),
  /** Hits / risers the sound director moved onto the grid. */
  cues: z.object({ snapped: count }).optional(),
  ok: z.boolean(),
});
export type BeatSyncReport = z.infer<typeof beatSyncReportSchema>;
