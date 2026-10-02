/**
 * View model of the export dialog (PLAN.md#9.1, #9.2): labels of presets (with the integer scale
 * factor), encoders and quality profiles, the request the form builds, and the queue's lines —
 * progress, ETA, per-shot frames, the final report ("re-rendered 1 of 12 shots"). Pure.
 */
import type { EncoderPreference, ExportQualityProfile } from '@reelforge/shared';
import type {
  EncoderTestResult,
  ExportJob,
  ExportJobRequest,
  ExportOptions,
  ExportReport,
  PresetOption,
} from '../../shared/export-contract.js';

export const ENCODER_LABELS: Readonly<Record<EncoderPreference, string>> = {
  auto: 'Auto (best available)',
  nvenc: 'NVENC (NVIDIA)',
  qsv: 'Quick Sync (Intel)',
  amf: 'AMF (AMD)',
  cpu: 'CPU (x264)',
};

export const QUALITY_LABELS: Readonly<Record<ExportQualityProfile, string>> = {
  draft: 'Draft (fast)',
  standard: 'Standard',
  high: 'High',
};

export function presetLabel(preset: PresetOption): string {
  const size = `${String(preset.width)}×${String(preset.height)}`;
  return preset.factor === null
    ? `${preset.label} · ${size}`
    : `${preset.label} · ${size} · ×${String(preset.factor)}`;
}

/** `auto` workers as the export resolves them: max(1, cores / 2). */
export function autoWorkers(cores: number): number {
  return Math.max(1, Math.floor(cores / 2));
}

export interface ExportForm {
  readonly preset: ExportJobRequest['preset'];
  readonly encoder: EncoderPreference;
  readonly quality: ExportQualityProfile;
  readonly workers: number;
  readonly fileName: string;
  readonly includeChapters: boolean;
  readonly includeThumbnail: boolean;
  readonly thumbnailAt: number | null;
}

/** The form's first values: the last choices (an unusable preset falls back to a usable one). */
export function initialForm(options: ExportOptions): ExportForm {
  const { defaults } = options;
  const wanted = options.presets.find((preset) => preset.id === defaults.preset);
  const usable = options.presets.find((preset) => preset.factor !== null);
  return {
    preset:
      wanted?.factor === null || wanted === undefined ? (usable?.id ?? defaults.preset) : wanted.id,
    encoder: defaults.encoder,
    quality: defaults.quality,
    workers:
      defaults.workers === 'auto'
        ? autoWorkers(options.cores)
        : Math.min(defaults.workers, options.cores),
    fileName: options.defaultFileName,
    includeChapters: defaults.includeChapters,
    includeThumbnail: defaults.includeThumbnail,
    thumbnailAt: null,
  };
}

/** Why the form cannot be queued (null = it can). */
export function formProblem(form: ExportForm, options: ExportOptions): string | null {
  if (options.blockers.length > 0) return options.blockers[0] ?? null;
  const preset = options.presets.find((entry) => entry.id === form.preset);
  if (preset?.factor === null) return preset.problem;
  if (form.fileName.trim() === '') return 'Name the video file.';
  if (!Number.isInteger(form.workers) || form.workers < 1 || form.workers > options.cores) {
    return `Workers must be 1–${String(options.cores)}.`;
  }
  return null;
}

export function formRequest(form: ExportForm): ExportJobRequest {
  return { ...form, fileName: form.fileName.trim() };
}

/** `1:05`, `12:00`, `1:02:03`. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${secs}`
    : `${String(minutes)}:${secs}`;
}

/** Thumbnail time with tenths, e.g. `0:12.3`. */
export function frameTimeText(seconds: number): string {
  const tenths = Math.floor((seconds % 1) * 10);
  return `${clockText(Math.floor(seconds))}.${String(tenths)}`;
}

export function sizeText(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${String(Math.max(0, Math.round(bytes / 1024)))} KB`;
}

export function fileNameOf(output: string): string {
  return output.split(/[\\/]/).pop() ?? output;
}

/** One line under the progress bar: step, ETA, render speed. */
export function progressLine(job: ExportJob): string {
  const parts = [job.progress.label];
  if (job.status === 'running' && job.progress.etaS !== null) {
    parts.push(`${clockText(job.progress.etaS)} left`);
  }
  if (job.status === 'running' && job.progress.fps !== null) {
    parts.push(`${job.progress.fps.toFixed(1)} fps`);
  }
  return parts.join(' · ');
}

/** `3/12 shots (2 cached)`. */
export function shotsLine(job: ExportJob): string | null {
  const { shots, totalShots } = job.progress;
  if (totalShots === 0) return null;
  const finished = shots.filter((shot) => shot.state !== 'rendering').length;
  const cached = shots.filter((shot) => shot.state === 'cached').length;
  return `${String(finished)}/${String(totalShots)} shots${cached > 0 ? ` (${String(cached)} cached)` : ''}`;
}

/** The final report in one line, e.g. `1:00 · 23.4 MB · 48.2 fps · h264_nvenc (final)`. */
export function reportLine(report: ExportReport): string {
  return [
    clockText(report.durationS),
    `${String(report.width)}×${String(report.height)}`,
    sizeText(report.sizeBytes),
    report.avgFps === null ? null : `${report.avgFps.toFixed(1)} fps`,
    report.encoder,
    `in ${clockText(report.wallMs / 1000)}`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

/** `Re-rendered 1 of 12 shots (11 from the cache)`. */
export function cacheLine(report: ExportReport): string {
  const cached = report.cachedShots > 0 ? ` (${String(report.cachedShots)} from the cache)` : '';
  const resumed = report.resumed ? ', resumed' : '';
  return `Re-rendered ${String(report.renderedShots)} of ${String(report.totalShots)} shots${cached}${resumed}`;
}

/** The encoder test in one line. */
export function encoderTestLine(result: EncoderTestResult): string {
  if (result.status === 'error') return result.message;
  const failed = result.probes.filter((probe) => !probe.ok);
  const fallback =
    failed.length === 0
      ? ''
      : ` (${failed.map((probe) => `${probe.encoder}: ${probe.detail}`).join('; ')})`;
  return `${result.encoder} works${result.hardware ? ' (GPU)' : ' (CPU)'}${fallback}`;
}
