/**
 * IPC payloads of the stage panels (PLAN.md#7.2, #7.6, #7.7): voice-over import / in-app
 * recording (WAV bytes, validated again in main) and the microphone grant, the reports the panels
 * show (voice-over fit, words alignment, ✓/⚠/✗ per shot, sync report, missing props, final review),
 * "Retry with a bigger model", scene runs (rebuild a shot, the review modes, the final review) and
 * shot locks. Merged into ipc-contract.ts.
 */
import {
  finalReviewSchema,
  propsReportSchema,
  scenesReportSchema,
  settingsWhisperModelSchema,
  shotIdSchema,
  syncReportSchema,
  voiceoverRecordSchema,
  voReportSchema,
  wordsReportSchema,
} from '@reelforge/shared';
import { z } from 'zod';
import { stageCommandResultSchema } from './stages-contract.js';

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
  /** `.reelforge/final-review.json`: the quiet review after Scenes built (PLAN.md#11.5). */
  finalReview: finalReviewSchema.nullable(),
});
export type StageReports = z.infer<typeof stageReportsSchema>;

export const SCENE_ACTIONS = [
  'build',
  'fix-what-looks-wrong',
  'phone-legibility',
  'sync-check',
  'final-review',
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
