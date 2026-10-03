/**
 * `cues.json` (PLAN 4.6, written by 8.1 / edited in 8.2): SFX hits, ambience beds and music beds
 * with sidechain ducking, plus global mix settings. Objects are strict so a misspelt key (e.g.
 * `gain` instead of `gainDb`) is reported instead of silently ignored. Times are in seconds on the
 * voice-over timeline; file paths are relative to the project folder (absolute paths also work).
 */
import { z } from 'zod';
import { readJsonFile, writeJsonAtomic, type JsonFileError } from '../schemas/json-file.js';
import type { Result } from '../result.js';
import { AMBIENCE_RECIPES } from './ambience.js';
import { MUSIC_MOODS } from './music/moods.js';
import { SFX_MAX_DURATION_S, SFX_MIN_DURATION_S, SFX_RECIPES } from './sfx.js';

export const CUES_FILE_VERSION = 1;
/** Longest supported timeline (RIFF size limit of the float32 stereo intermediates is ~3.1 h). */
export const MAX_MIX_DURATION_S = 3 * 60 * 60;

const seconds = z.number().nonnegative().max(MAX_MIX_DURATION_S);
const gainDb = z.number().min(-60).max(24);
const fadeS = z.number().nonnegative().max(60);
const filePath = z.string().trim().min(1);
const seed = z.number().int().nonnegative().max(0xffff_ffff);

interface SourceFields {
  readonly name?: string | undefined;
  readonly file?: string | undefined;
}

function exactlyOneSource(value: SourceFields, ctx: z.RefinementCtx): void {
  if ((value.name === undefined) === (value.file === undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: 'set exactly one of `name` (built-in recipe) or `file` (audio file)',
      path: value.name === undefined ? ['name'] : ['file'],
    });
  }
}

function rangeIsOrdered(value: { from: number; to: number }, ctx: z.RefinementCtx): void {
  if (!(value.to > value.from)) {
    ctx.addIssue({ code: 'custom', message: '`to` must be greater than `from`', path: ['to'] });
  }
}

export const SfxCueSchema = z
  .strictObject({
    id: z.string().min(1).optional(),
    /** Start time (s). */
    t: seconds,
    name: z.enum(SFX_RECIPES).optional(),
    file: filePath.optional(),
    gainDb: gainDb.default(0),
    /** -1 = left, 0 = centre, 1 = right. */
    pan: z.number().min(-1).max(1).default(0),
    /** Recipe length override (built-in recipes only). */
    durationS: z.number().min(SFX_MIN_DURATION_S).max(SFX_MAX_DURATION_S).optional(),
    /** Synth seed; defaults to a hash of name + time (stable when other cues are edited). */
    seed: seed.optional(),
  })
  .superRefine(exactlyOneSource);

export const AmbienceCueSchema = z
  .strictObject({
    id: z.string().min(1).optional(),
    from: seconds,
    to: seconds,
    name: z.enum(AMBIENCE_RECIPES).optional(),
    /** A loop file; its end is crossfaded into its start. */
    file: filePath.optional(),
    gainDb: gainDb.default(0),
    fadeInS: fadeS.default(0.5),
    fadeOutS: fadeS.default(0.5),
    seed: seed.optional(),
  })
  .superRefine((value, ctx) => {
    exactlyOneSource(value, ctx);
    rangeIsOrdered(value, ctx);
  });

/** Sidechain ducking of a music cue by the voice-over (ffmpeg `sidechaincompress`). */
export const DuckingSchema = z.strictObject({
  enabled: z.boolean().default(true),
  /** Voice level (dBFS, RMS-detected) above which the music is pulled down. */
  thresholdDb: z.number().min(-60).max(0).default(-30),
  ratio: z.number().min(1).max(20).default(8),
  attackMs: z.number().min(0.01).max(2000).default(20),
  releaseMs: z.number().min(0.01).max(9000).default(400),
});

export const MusicCueSchema = z
  .strictObject({
    id: z.string().min(1).optional(),
    from: seconds,
    to: seconds,
    file: filePath,
    gainDb: gainDb.default(0),
    /** Position in the file that plays at `from` (s). */
    offsetS: seconds.default(0),
    /** Loop the file (crossfaded) when it is shorter than the cue. */
    loop: z.boolean().default(false),
    fadeInS: fadeS.default(1),
    fadeOutS: fadeS.default(2),
    ducking: DuckingSchema.prefault({}),
  })
  .superRefine(rangeIsOrdered);

export const MixGlobalSchema = z.strictObject({
  voGainDb: gainDb.default(0),
  /**
   * Bus gains on top of every cue's own gain (the Sound panel's sliders, PLAN.md#8.2). Optional,
   * not defaulted: files written before they existed keep the same bytes when re-serialized.
   */
  sfxGainDb: gainDb.optional(),
  ambienceGainDb: gainDb.optional(),
  musicGainDb: gainDb.optional(),
  targetLufs: z.number().min(-40).max(-5).default(-14),
  truePeakMaxDbtp: z.number().min(-9).max(0).default(-1),
  /** Timeline length; defaults to the voice-over length. */
  durationS: z.number().positive().max(MAX_MIX_DURATION_S).optional(),
});

export const CuesFileSchema = z.strictObject({
  version: z.literal(CUES_FILE_VERSION),
  global: MixGlobalSchema.prefault({}),
  sfx: z.array(SfxCueSchema).default([]),
  ambience: z.array(AmbienceCueSchema).default([]),
  music: z.array(MusicCueSchema).default([]),
  /**
   * Mood of the generated music bed of each act, in act order: the sound-cues stage renders the
   * beds, and when Claude's turn changes a mood here it re-renders that act's bed. Optional, not
   * defaulted: files without generated music keep the same bytes when re-serialized.
   */
  moods: z.array(z.enum(MUSIC_MOODS)).max(100).optional(),
});

export type SfxCue = z.output<typeof SfxCueSchema>;
export type AmbienceCue = z.output<typeof AmbienceCueSchema>;
export type MusicCue = z.output<typeof MusicCueSchema>;
export type DuckingSettings = z.output<typeof DuckingSchema>;
export type MixGlobal = z.output<typeof MixGlobalSchema>;
export type CuesFile = z.output<typeof CuesFileSchema>;
export type CuesFileInput = z.input<typeof CuesFileSchema>;

export function readCuesFile(filePath: string): Promise<Result<CuesFile, JsonFileError>> {
  return readJsonFile(filePath, CuesFileSchema);
}

export function writeCuesFile(
  filePath: string,
  cues: CuesFileInput,
): Promise<Result<CuesFile, JsonFileError>> {
  return writeJsonAtomic(filePath, CuesFileSchema, cues);
}
