/**
 * UI state of the whisper.cpp setup (Settings → Tools, the Words timed blocking notice, first-run
 * "Prepare tools"): main's state plus the pushed install progress, reduced into views for the
 * engine card, the model rows and the progress line. Pure; components feed it events.
 */
import type { SettingsWhisperModel } from '@reelforge/shared';
import type { WhisperJob, WhisperProgress, WhisperState } from '../../shared/whisper-contract.js';

export interface WhisperSetupView {
  readonly state: WhisperState | undefined;
  /** Latest progress (kept after the end to show a failure until the next job). */
  readonly progress: WhisperProgress | undefined;
  /** Last refused action (busy, delete failed, invalid path). */
  readonly error: string | undefined;
}

export type WhisperSetupEvent =
  | { readonly type: 'loaded'; readonly state: WhisperState }
  | { readonly type: 'progress'; readonly progress: WhisperProgress }
  | { readonly type: 'error'; readonly message: string | undefined };

export const EMPTY_WHISPER_SETUP: WhisperSetupView = {
  state: undefined,
  progress: undefined,
  error: undefined,
};

export function reduceWhisperSetup(
  view: WhisperSetupView,
  event: WhisperSetupEvent,
): WhisperSetupView {
  switch (event.type) {
    case 'loaded':
      // A job running in main (e.g. started from another view) shows its progress here too.
      return {
        ...view,
        state: event.state,
        progress: event.state.job ?? view.progress,
      };
    case 'error':
      return { ...view, error: event.message };
    case 'progress':
      return {
        ...view,
        progress: event.progress,
        error: event.progress.phase === 'running' ? undefined : view.error,
      };
  }
}

/** Downloads above this ask first ("Download 574 MB?"). */
export const CONFIRM_ABOVE_BYTES = 200_000_000;

export const needsConfirm = (bytes: number): boolean => bytes > CONFIRM_ABOVE_BYTES;

/** `574041195` -> `574 MB`, `1533763059` -> `1.5 GB`. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${String(Math.round(bytes / 1e6))} MB`;
  return `${String(Math.max(1, Math.round(bytes / 1e3)))} kB`;
}

/** `75` -> `1:15`, `3725` -> `1:02:05`. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const s = String(total % 60).padStart(2, '0');
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

export const jobsEqual = (a: WhisperJob, b: WhisperJob): boolean =>
  a.kind === b.kind && (a.kind !== 'model' || (b.kind === 'model' && a.model === b.model));

export interface ProgressView {
  readonly running: boolean;
  /** 0..100. */
  readonly percent: number;
  /** "Downloading whisper.cpp (CPU build) · step 1 of 3". */
  readonly label: string;
  /** "120 MB of 596 MB · 5.2 MB/s · 1:32 left". */
  readonly detail: string;
}

export function progressView(progress: WhisperProgress): ProgressView {
  const percent =
    progress.totalBytes > 0
      ? Math.min(100, Math.floor((progress.receivedBytes / progress.totalBytes) * 100))
      : 0;
  const parts = [`${formatBytes(progress.receivedBytes)} of ${formatBytes(progress.totalBytes)}`];
  if (progress.bytesPerSecond !== null && progress.bytesPerSecond > 0)
    parts.push(`${formatBytes(progress.bytesPerSecond)}/s`);
  if (progress.etaS !== null) parts.push(`${formatDuration(progress.etaS)} left`);
  const step =
    progress.steps > 1 ? ` · step ${String(progress.step)} of ${String(progress.steps)}` : '';
  return {
    running: progress.phase === 'running',
    percent: progress.phase === 'done' ? 100 : percent,
    label: `${progress.label ?? 'Preparing'}${step}`,
    detail: parts.join(' · '),
  };
}

const BACKEND_LABELS: Readonly<Record<string, string>> = {
  cuda: 'CUDA (NVIDIA GPU)',
  blas: 'CPU (OpenBLAS)',
  cpu: 'CPU',
  custom: 'your own build',
};

export const backendLabel = (backend: string): string => BACKEND_LABELS[backend] ?? backend;

export interface EngineCardView {
  readonly installed: boolean;
  /** "Installed: CUDA (NVIDIA GPU) + CPU (OpenBLAS) · whisper.cpp 1.9.4" / "Not installed". */
  readonly headline: string;
  /** Install button label with its size, null when there is nothing to install. */
  readonly installLabel: string | null;
  readonly installBytes: number;
  /** The CUDA build cannot see the GPU: transcription will run on the CPU. */
  readonly gpuWarning: string | null;
  /** This card's job runs. */
  readonly busy: boolean;
  /** Another whisper job runs (buttons wait). */
  readonly blocked: boolean;
}

export function engineCardView(view: WhisperSetupView): EngineCardView | undefined {
  const { state, progress } = view;
  if (state === undefined) return undefined;
  const { engine } = state;
  const running = progress?.phase === 'running' ? progress.job : undefined;
  const installed = engine.installs.length > 0;
  const version = engine.installs
    .map((install) => install.version)
    .find((found): found is string => found !== null);
  const backends = [...new Set(engine.installs.map((install) => backendLabel(install.backend)))];
  const cuda = engine.installs.find((install) => install.backend === 'cuda');
  return {
    installed,
    headline: installed
      ? `Installed: ${backends.join(' + ')}${version === undefined ? '' : ` · whisper.cpp ${version}`}`
      : 'Not installed',
    installLabel:
      !installed && engine.installBytes > 0
        ? `Install (${formatBytes(engine.installBytes)})`
        : null,
    installBytes: engine.installBytes,
    gpuWarning:
      cuda !== undefined && cuda.cuda === 'unavailable'
        ? `The NVIDIA GPU is not available to whisper.cpp (${cuda.cudaReason ?? 'CUDA error'}): transcription runs on the CPU, which is much slower.`
        : null,
    busy: running !== undefined && (running.kind === 'engine' || running.kind === 'setup'),
    blocked: running !== undefined,
  };
}

export type ModelRowStatus = 'installed' | 'missing' | 'downloading';

export interface ModelRowView {
  readonly id: SettingsWhisperModel;
  readonly sizeLabel: string;
  readonly bytes: number;
  readonly status: ModelRowStatus;
  readonly statusLabel: string;
  readonly recommended: boolean;
  readonly canDownload: boolean;
  readonly canCancel: boolean;
  readonly canDelete: boolean;
}

export function modelRows(view: WhisperSetupView): ModelRowView[] {
  const { state, progress } = view;
  if (state === undefined) return [];
  const running = progress?.phase === 'running' ? progress.job : undefined;
  return state.models.map((model) => {
    const downloading =
      running !== undefined &&
      ((running.kind === 'model' && running.model === model.id) ||
        (running.kind === 'setup' && state.readiness.model === model.id && !model.installed));
    const status: ModelRowStatus = downloading
      ? 'downloading'
      : model.installed
        ? 'installed'
        : 'missing';
    const percent = downloading && progress !== undefined ? progressView(progress).percent : null;
    return {
      id: model.id,
      sizeLabel: formatBytes(model.bytes),
      bytes: model.bytes + (state.vadInstalled ? 0 : state.vadBytes),
      status,
      statusLabel:
        status === 'downloading'
          ? `Downloading ${String(percent ?? 0)} %`
          : status === 'installed'
            ? 'Installed'
            : 'Not downloaded',
      recommended: model.id === state.recommended,
      canDownload: running === undefined && !model.installed,
      canCancel: downloading,
      canDelete: model.installed && !downloading,
    };
  });
}
