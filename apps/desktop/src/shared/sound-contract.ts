/**
 * IPC payloads of the Sound panel (PLAN.md#8.2): the sound library (built-in synth recipes + the
 * user's files in `audio/sfx`, `audio/ambience`, `audio/music`), the bus gains and music ducking
 * stored in cues.json, the last mix render (LUFS / true peak) and the preview mix of a window
 * around the playhead. Merged into the registry of ipc-contract.ts. Main owns every path: the
 * renderer names sounds and kinds; files come back project-relative (forward slashes).
 */
import { z } from 'zod';
import { stageCommandResultSchema } from './stages-contract.js';
import { BUILTIN_SFX_NAMES } from './timeline-contract.js';

export const SOUND_KINDS = ['sfx', 'ambience', 'music'] as const;
export const soundKindSchema = z.enum(SOUND_KINDS);
export type SoundKind = z.infer<typeof soundKindSchema>;

/** Built-in ambience loops (packages/pipeline AMBIENCE_RECIPES; equality is tested in main). */
export const BUILTIN_AMBIENCE_NAMES = ['room-tone', 'hum', 'wind', 'city'] as const;

/** Where imported files of each kind are copied (project-relative). */
export const SOUND_FOLDERS: Readonly<Record<SoundKind, string>> = {
  sfx: 'audio/sfx',
  ambience: 'audio/ambience',
  music: 'audio/music',
};

/** Audio files the library lists and imports. */
export const SOUND_FILE_EXTENSIONS = ['wav', 'mp3', 'm4a', 'ogg', 'flac'] as const;

const relativeFileSchema = z
  .string()
  .max(260)
  .regex(/^audio\/(sfx|ambience|music)\/[^/\\]+$/, 'expected a file in audio/sfx|ambience|music');

export const librarySoundSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('builtin'),
    kind: z.enum(['sfx', 'ambience']),
    name: z.union([z.enum(BUILTIN_SFX_NAMES), z.enum(BUILTIN_AMBIENCE_NAMES)]),
  }),
  z.strictObject({
    source: z.literal('file'),
    kind: soundKindSchema,
    file: relativeFileSchema,
  }),
]);
export type LibrarySound = z.infer<typeof librarySoundSchema>;

const gainSchema = z.number().min(-60).max(24);

/** cues.json `global`: the voice-over gain and the bus gains (dB, 0 when unset). */
export const mixGainsSchema = z.strictObject({
  voGainDb: gainSchema,
  sfxGainDb: gainSchema,
  ambienceGainDb: gainSchema,
  musicGainDb: gainSchema,
});
export type MixGains = z.infer<typeof mixGainsSchema>;
export const MIX_GAIN_KEYS = ['voGainDb', 'sfxGainDb', 'ambienceGainDb', 'musicGainDb'] as const;
export type MixGainKey = (typeof MIX_GAIN_KEYS)[number];

/** Sidechain ducking of the music by the voice (same fields as the pipeline's DuckingSchema). */
export const duckingSchema = z.strictObject({
  enabled: z.boolean(),
  thresholdDb: z.number().min(-60).max(0),
  ratio: z.number().min(1).max(20),
  attackMs: z.number().min(0.01).max(2000),
  releaseMs: z.number().min(0.01).max(9000),
});
export type Ducking = z.infer<typeof duckingSchema>;

export const mixResultSchema = z.object({
  integratedLufs: z.number(),
  truePeakDbtp: z.number(),
  targetLufs: z.number(),
  truePeakMaxDbtp: z.number(),
  /** The stage's bar: target ± this (PLAN.md#8.3: 1 LU). */
  toleranceLu: z.number(),
  durationS: z.number(),
  warnings: z.array(z.string()),
});
export type MixResult = z.infer<typeof mixResultSchema>;

export const soundStateSchema = z.object({
  projectDir: z.string().nullable(),
  library: z.array(librarySoundSchema),
  gains: mixGainsSchema,
  /** Ducking of the first music cue (all get the same from the panel); null: no music cue. */
  ducking: duckingSchema.nullable(),
  musicCues: z.int().min(0),
  /** cues.json problem (missing is not one: the defaults apply). */
  cuesError: z.string().nullable(),
  mix: z.object({
    exists: z.boolean(),
    /** cues.json changed after the last full mix render. */
    stale: z.boolean(),
    result: mixResultSchema.nullable(),
  }),
  /** Stem files of the last render with stems (project-relative). */
  stems: z.array(z.string()),
});
export type SoundState = z.infer<typeof soundStateSchema>;

export const SOUND_ACTIONS = ['generate-cues', 'default-cues', 'mix', 'mix-stems'] as const;
export const soundActionSchema = z.enum(SOUND_ACTIONS);
export type SoundAction = z.infer<typeof soundActionSchema>;

export const soundImportResultSchema = z.object({
  status: z.enum(['ok', 'cancelled', 'error']),
  message: z.string().nullable(),
  /** Imported files (project-relative). */
  files: z.array(z.string()),
});
export type SoundImportResult = z.infer<typeof soundImportResultSchema>;

export const soundPreviewResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), file: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type SoundPreviewResult = z.infer<typeof soundPreviewResultSchema>;

export const soundMixPatchSchema = z
  .strictObject({ gains: mixGainsSchema.partial().optional(), ducking: duckingSchema.optional() })
  .refine((patch) => patch.gains !== undefined || patch.ducking !== undefined, {
    message: 'nothing to change',
  });
export type SoundMixPatch = z.infer<typeof soundMixPatchSchema>;

export const soundMixResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), message: z.string(), committed: z.boolean() }),
  z.object({ status: z.literal('rejected'), message: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type SoundMixResult = z.infer<typeof soundMixResultSchema>;

/** Longest preview window (pipeline MAX_PREVIEW_WINDOW_S). */
export const PREVIEW_WINDOW_S = 20;

export const mixPreviewResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** Full-length preview mix (project-relative): mix.wav with the window re-rendered. */
    file: z.string(),
    startS: z.number(),
    durationS: z.number(),
    ms: z.number(),
  }),
  /** Nothing to preview yet (no mix.wav / cleaned voice-over), or superseded by a newer request. */
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type MixPreviewResult = z.infer<typeof mixPreviewResultSchema>;

const noPayload = z.null();

export const SOUND_IPC = {
  soundState: { name: 'sound:state', request: noPayload, response: soundStateSchema },
  /** File picker in main (multi-select); copies into the kind's folder. */
  soundImport: {
    name: 'sound:import',
    request: z.strictObject({ kind: soundKindSchema }),
    response: soundImportResultSchema,
  },
  /** A short WAV of a built-in recipe for the library's play button (cached). */
  soundPreview: {
    name: 'sound:preview',
    request: z.strictObject({ sound: librarySoundSchema }),
    response: soundPreviewResultSchema,
  },
  /** Bus gains / ducking into cues.json (validated, atomic, committed). */
  soundSetMix: {
    name: 'sound:set-mix',
    request: soundMixPatchSchema,
    response: soundMixResultSchema,
  },
  /** Generate cues (Claude or default), Render mix (with stems): queued like a sidebar Run. */
  soundRun: {
    name: 'sound:run',
    request: z.strictObject({ action: soundActionSchema }),
    response: stageCommandResultSchema,
  },
  /** Re-renders the mix around `t` (≤ 20 s) after a cue edit, for the preview player. */
  mixPreview: {
    name: 'sound:mix-preview',
    request: z.strictObject({
      t: z
        .number()
        .min(0)
        .max(3 * 60 * 60),
    }),
    response: mixPreviewResultSchema,
  },
} as const;

export interface SoundApi {
  getSoundState(): Promise<SoundState>;
  importSounds(kind: SoundKind): Promise<SoundImportResult>;
  previewSound(sound: LibrarySound): Promise<SoundPreviewResult>;
  setMix(patch: SoundMixPatch): Promise<SoundMixResult>;
  runSound(action: SoundAction): Promise<z.infer<typeof stageCommandResultSchema>>;
  renderMixPreview(t: number): Promise<MixPreviewResult>;
}
