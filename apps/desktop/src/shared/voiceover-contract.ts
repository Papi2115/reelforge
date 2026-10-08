/**
 * IPC payloads of the stage panels (PLAN.md#7.2, #7.6, #7.7): voice-over import / in-app
 * recording (WAV bytes, validated again in main) and the microphone grant, the reports the panels
 * show (voice-over fit, words alignment, ✓/⚠/✗ per shot, sync report, missing props, final review),
 * "Retry with a bigger model", scene runs (rebuild a shot, the review modes, the final review, a
 * world film's look assets), shot locks and the voice timing a sentence redo left out of date.
 * Merged into ipc-contract.ts.
 */
import {
  finalReviewSchema,
  propsReportSchema,
  rolesReportSchema,
  scenesReportSchema,
  settingsWhisperModelSchema,
  shotIdSchema,
  syncReportSchema,
  voiceoverRecordSchema,
  voReportSchema,
  wordsReportSchema,
  worldAssetsReportSchema,
  worldAssetWorldSchema,
} from '@reelforge/shared';
import { z } from 'zod';
import { stageCommandResultSchema } from './stages-contract.js';

/** One designed look asset: an `assets/cast.json` entry, or an asset file the cast does not name. */
export const lookAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** `character`, `prop`, `place`, … (null: a file the cast does not list). */
  kind: z.string().nullable(),
  file: z.string(),
});
export type LookAsset = z.infer<typeof lookAssetSchema>;

/** Listed look assets at most (a cast holds ≤ 160 entries, a world folder ≤ 64 files). */
export const MAX_LOOK_ASSETS = 400;

/** The world-assets step of a world film (PLAN.md#13.15): its report and the designed set. */
export const lookAssetsSchema = z.object({
  world: worldAssetWorldSchema,
  /** `.reelforge/world-assets.json`; null: never designed (or unreadable). */
  report: worldAssetsReportSchema.nullable(),
  /** storyboard.json changed since the set was designed (the next build designs it again). */
  storyboardChanged: z.boolean(),
  assets: z.array(lookAssetSchema).max(MAX_LOOK_ASSETS),
});
export type LookAssets = z.infer<typeof lookAssetsSchema>;

/**
 * A generated voice redone after Words timed (ADR-033): the takes newer than timing/words.json,
 * the sentences they speak and the storyboard shots under them (timing out of date).
 */
export const voiceTimingSchema = z.object({
  shotIds: z.array(shotIdSchema),
  sentenceIds: z.array(z.string()),
  /** ISO time of the newest such take. */
  changedAt: z.iso.datetime(),
});
export type VoiceTiming = z.infer<typeof voiceTimingSchema>;

/** In-app recordings are 48 kHz 16-bit PCM WAV (PLAN.md §3: the clean stage works at 48 kHz). */
export const RECORDING_SAMPLE_RATE = 48_000;
/** 30 minutes of mono 16-bit audio at 48 kHz (+ header). */
export const MAX_RECORDING_BYTES = 30 * 60 * RECORDING_SAMPLE_RATE * 2 + 1024;

const wavBytesSchema = z
  .custom<Uint8Array>((value) => value instanceof Uint8Array, { message: 'expected WAV bytes' })
  .refine((bytes) => bytes.byteLength >= 44 && bytes.byteLength <= MAX_RECORDING_BYTES, {
    message: `a recording must be 44..${String(MAX_RECORDING_BYTES)} bytes`,
  });

export const stageReportsSchema = z.object({
  projectDir: z.string().nullable(),
  /** `.reelforge/voiceover.json`: the imported recording. */
  voiceover: voiceoverRecordSchema.nullable(),
  /** VO <-> script fit (duration vs word count; alignment after Words timed). */
  voReport: voReportSchema.nullable(),
  words: wordsReportSchema.nullable(),
  scenes: scenesReportSchema.nullable(),
  sync: syncReportSchema.nullable(),
  /** `.reelforge/props-report.json`: project props built by Scenes built (kit-ext). */
  props: propsReportSchema.nullable(),
  /** `.reelforge/roles-report.json`: project roles built before Scenes built (PLAN.md#12.20). */
  roles: rolesReportSchema.nullable(),
  /** `.reelforge/final-review.json`: the quiet review after Scenes built (PLAN.md#11.5). */
  finalReview: finalReviewSchema.nullable(),
  /** World films only (null for every other style): the "Look assets" of Scenes built. */
  lookAssets: lookAssetsSchema.nullable(),
  /** Shots whose generated voice changed after Words timed; null when the timing is current. */
  voiceTiming: voiceTimingSchema.nullable(),
});
export type StageReports = z.infer<typeof stageReportsSchema>;

export const SCENE_ACTIONS = [
  'build',
  'fix-what-looks-wrong',
  'phone-legibility',
  'sync-check',
  'final-review',
  /** World films: design the film's own look assets again (scenes keep their status). */
  'world-assets',
] as const;
export const sceneActionSchema = z.enum(SCENE_ACTIONS);
export type SceneActionKey = z.infer<typeof sceneActionSchema>;

const noPayload = z.null();

export const VOICEOVER_IPC = {
  /** File picker in main, then the probe; queues the Voiceover stage (Replace archives the old). */
  voiceoverImport: {
    name: 'voiceover:import',
    request: noPayload,
    response: stageCommandResultSchema,
  },
  /** A finished in-app take: saved by main, then the Voiceover stage imports it. */
  voiceoverRecording: {
    name: 'voiceover:recording',
    request: z.strictObject({ wav: wavBytesSchema }),
    response: stageCommandResultSchema,
  },
  /** Sent on the user's Record click: the next microphone request of this window is granted. */
  micArm: { name: 'voiceover:mic-arm', request: noPayload, response: z.boolean() },
  stagesReports: { name: 'stages:reports', request: noPayload, response: stageReportsSchema },
  /** Words timed again with another whisper model (it must be installed). */
  wordsRetry: {
    name: 'words:retry',
    request: z.strictObject({ model: settingsWhisperModelSchema }),
    response: stageCommandResultSchema,
  },
  /** Scenes built for some shots ("Rebuild this shot") or a review mode (Whole-video chips). */
  scenesRun: {
    name: 'scenes:run',
    request: z.strictObject({
      action: sceneActionSchema,
      shots: z.array(shotIdSchema.max(64)).max(500).nullable(),
    }),
    response: stageCommandResultSchema,
  },
  /** Locks / unlocks shots (`locks.json`, PLAN.md#11.4); main commits the change. */
  shotsLock: {
    name: 'shots:lock',
    request: z.strictObject({
      shotIds: z.array(shotIdSchema.max(64)).min(1).max(500),
      locked: z.boolean(),
    }),
    response: stageCommandResultSchema,
  },
} as const;

export interface VoiceoverApi {
  importVoiceover(): Promise<z.infer<typeof stageCommandResultSchema>>;
  saveRecording(wav: Uint8Array): Promise<z.infer<typeof stageCommandResultSchema>>;
  armMicrophone(): Promise<boolean>;
  getStageReports(): Promise<StageReports>;
  retryWords(
    model: z.infer<typeof settingsWhisperModelSchema>,
  ): Promise<z.infer<typeof stageCommandResultSchema>>;
  runScenes(
    action: SceneActionKey,
    shots: readonly string[] | null,
  ): Promise<z.infer<typeof stageCommandResultSchema>>;
  lockShots(
    shotIds: readonly string[],
    locked: boolean,
  ): Promise<z.infer<typeof stageCommandResultSchema>>;
}
