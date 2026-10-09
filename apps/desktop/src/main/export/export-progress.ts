/**
 * Pure parts of the export queue (PLAN.md#9.1): a job's progress from the pipeline's events
 * (percent and label as in the sidebar, ETA, render fps, per-shot frames), its final report and
 * actionable messages for failures.
 */
import type { ExportProgress, ExportWarning } from '@reelforge/pipeline';
import type {
  ExportJob,
  ExportOutcome,
  ExportReport,
  ShotProgress,
} from '../../shared/export-contract.js';
import { userWarning } from '../render/export-warnings.js';
import { exportStep } from '../stages/export-stage.js';

export type JobProgress = ExportJob['progress'];

export const EMPTY_PROGRESS: JobProgress = {
  percent: 0,
  label: 'Waiting',
  etaS: null,
  fps: null,
  totalShots: 0,
  shots: [],
  warning: null,
};

function upsertShot(
  shots: readonly ShotProgress[],
  id: string,
  update: (shot: ShotProgress | undefined) => ShotProgress,
): ShotProgress[] {
  const index = shots.findIndex((shot) => shot.id === id);
  if (index < 0) return [...shots, update(undefined)];
  return shots.map((shot, at) => (at === index ? update(shot) : shot));
}

/** The progress after one event. */
export function applyProgress(progress: JobProgress, event: ExportProgress): JobProgress {
  const step = exportStep(event);
  const base: JobProgress = {
    ...progress,
    ...(step === null ? {} : { label: step.label }),
    ...(step?.percent === null || step === null ? {} : { percent: step.percent }),
  };
  switch (event.type) {
    case 'plan':
      return { ...base, totalShots: event.shots, shots: [] };
    case 'shot-start':
      return {
        ...base,
        shots: upsertShot(base.shots, event.shotId, () => ({
          id: event.shotId,
          frames: event.frames,
          done: 0,
          state: 'rendering',
        })),
      };
    case 'frame':
      return {
        ...base,
        etaS: event.etaS,
        fps: event.fps,
        shots: upsertShot(base.shots, event.shotId, (shot) => ({
          id: event.shotId,
          frames: event.shotFrames,
          done: event.frameInShot,
          state: shot?.state ?? 'rendering',
        })),
      };
    case 'shot-done':
      return {
        ...base,
        shots: upsertShot(base.shots, event.shotId, (shot) => ({
          id: event.shotId,
          frames: shot?.frames ?? 0,
          done: shot?.frames ?? 0,
          state: event.cached ? 'cached' : 'done',
        })),
      };
    case 'mux':
    case 'thumbnail':
      return { ...base, etaS: null };
    case 'done':
      return { ...base, etaS: null, percent: 100 };
    case 'source':
      return base;
  }
}

/**
 * The progress after a warning: the switch to the CPU encoder shows under the status line (and
 * stays through the restarted pass); a segment retry changes nothing.
 */
export function applyWarning(progress: JobProgress, warning: ExportWarning): JobProgress {
  const line = userWarning(warning);
  return line === null ? progress : { ...progress, warning: line };
}

/** The final report of a finished export. */
export function exportReport(
  outcome: Extract<ExportOutcome, { status: 'done' }>,
  progress: JobProgress,
  sizeBytes: number,
  extras: { readonly files: readonly string[]; readonly warnings: readonly string[] },
): ExportReport {
  const totalShots = outcome.renderedShots.length + outcome.cachedShots.length;
  return {
    output: outcome.output,
    durationS: outcome.durationS,
    sizeBytes,
    avgFps: outcome.renderedShots.length === 0 ? null : progress.fps,
    encoder: outcome.encoder,
    gpu: outcome.gpu,
    totalShots,
    renderedShots: outcome.renderedShots.length,
    cachedShots: outcome.cachedShots.length,
    wallMs: outcome.wallMs,
    resumed: outcome.resumed,
    width: outcome.width,
    height: outcome.height,
    extras: [...extras.files],
    warnings: [
      ...new Set([
        ...outcome.warnings,
        ...(progress.warning === null ? [] : [progress.warning]),
        ...extras.warnings,
      ]),
    ],
  };
}

const HINTS: Readonly<Record<string, string>> = {
  'no-ffmpeg': 'ffmpeg was not found: set its path in Settings → Tools, then Resume.',
  'no-encoder':
    'No H.264 encoder works on this machine: choose "CPU (x264)" or update the GPU driver.',
  encoder:
    'The encoder stopped: try "Test encoder", or pick "CPU (x264)" as the encoder, then Resume.',
  'preset-mismatch': 'Pick a preset with a whole scale factor for this style (see the list).',
  'frame-source':
    'A scene failed to render: open Scenes built, fix or rebuild that shot, then Resume.',
  'invalid-input': 'The project is not ready: run Storyboard and Scenes built first.',
  renderer:
    'The render window stopped responding or crashed (not the scene): Resume continues from the finished shots; if it repeats, lower "Export render workers" in Settings → Performance or restart the app.',
  io: 'Check that the folder is writable and the video is not open in a player, then Resume.',
  busy: 'Another export runs: it starts when that one finishes.',
  'no-project': 'Open the project again, then Resume.',
  internal: 'Unexpected error: main.log in the app data folder has the details. Resume retries.',
};

/** What to do about a failed export. */
export function failureHint(kind: string): string {
  return HINTS[kind] ?? 'Resume tries again; finished shots are kept.';
}
