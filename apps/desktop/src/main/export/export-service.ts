/**
 * The export dialog's main side (PLAN.md#9.1, #9.2): options of the open project, queuing a job
 * (validated again, output path resolved in main, the choices saved as the next defaults), the
 * sidebar's Video exported run through the same queue, resuming an export the app did not finish,
 * the encoder test, the output folder picker, and the extras after an export (chapters.txt, the
 * YouTube suggestions template; the thumbnail comes from the export itself).
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  detectEncoder,
  exportPaths,
  readExportState,
  type ExportProgress,
  type FfmpegError,
  type FfmpegManager,
  type Result,
} from '@reelforge/pipeline';
import { storyboardFileSchema, type AppSettings } from '@reelforge/shared';
import { FILES, inProject } from '@reelforge/stages';
import type {
  EncoderTestResult,
  ExportEnqueueResult,
  ExportFolderResult,
  ExportJob,
  ExportJobRequest,
  ExportOptions,
  ExportOutcome,
  ExportQueueState,
} from '../../shared/export-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';
import type { SettingsService } from '../settings-service.js';
import { exportSettings } from '../settings-consumers.js';
import { writeTextAtomic } from '../timeline-edit-service.js';
import { projectRelative } from '../stages/export-stage.js';
import { projectChapters } from './export-chapters.js';
import { exportOptions, outputPath, validateJob } from './export-options.js';
import { ExportQueue, type ExportExtras, type ExportStart } from './export-queue.js';
import type { YoutubeMetaService } from './youtube-meta.js';

export interface ExportServiceOptions {
  readonly currentProject: () => string | undefined;
  readonly settings: Pick<SettingsService, 'get' | 'update' | 'setExportFolder'>;
  readonly cores: number;
  /** The app's export (ExportController). */
  readonly start: ExportStart;
  readonly cancel: () => void;
  readonly ffmpeg: () => Promise<Result<FfmpegManager, FfmpegError>>;
  readonly youtube: Pick<YoutubeMetaService, 'ensureTemplate'>;
  readonly pickFolder: () => Promise<string | undefined>;
  readonly openPath: (folder: string) => Promise<string>;
  readonly push: (state: ExportQueueState) => void;
  readonly now: () => number;
  readonly log: Logger;
}

async function mtime(file: string): Promise<number | null> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null; // missing
  }
}

/** `auto` workers (max(1, cores / 2)) as a number, like the export does. */
export function resolveWorkers(settings: AppSettings, cores: number): number {
  return exportSettings(settings, cores).workers;
}

export class ExportService {
  readonly queue: ExportQueue;
  private stageJob: string | null = null;

  constructor(private readonly options: ExportServiceOptions) {
    this.queue = new ExportQueue({
      currentProject: options.currentProject,
      start: options.start,
      cancel: options.cancel,
      finish: (dir, job, outcome) => this.finish(dir, job, outcome),
      sizeOf: async (file) => (await stat(file)).size,
      interrupted: (dir) => this.interrupted(dir),
      push: options.push,
      now: options.now,
      log: options.log,
    });
  }

  async dialogOptions(): Promise<ExportOptions | null> {
    const dir = this.options.currentProject();
    if (dir === undefined) return null;
    const [mixTime, cuesTime] = await Promise.all([
      mtime(inProject(dir, FILES.mix)),
      mtime(inProject(dir, FILES.cues)),
    ]);
    return exportOptions({
      dir,
      settings: this.options.settings.get(),
      cores: this.options.cores,
      hasMix: mixTime !== null,
      mixStale: mixTime !== null && cuesTime !== null && cuesTime > mixTime,
    });
  }

  async enqueue(request: ExportJobRequest): Promise<ExportEnqueueResult> {
    const options = await this.dialogOptions();
    if (options === null) return { status: 'invalid', message: 'No project is open.' };
    const problem = validateJob(request, options);
    if (problem !== null) return { status: 'invalid', message: problem };
    const output = outputPath(options.outputDir, request.fileName);
    if (output === null) return { status: 'invalid', message: 'That file name is not usable.' };
    await this.remember(request);
    return this.queue.enqueue(request, output);
  }

  /** The sidebar's Video exported: the last choices, through the queue. */
  async runForStage(listener: (event: ExportProgress) => void): Promise<ExportOutcome> {
    const options = await this.dialogOptions();
    if (options === null) return { status: 'no-project' };
    const settings = this.options.settings.get();
    const request = this.defaultRequest(options, settings);
    const problem = validateJob(request, options);
    if (problem !== null) return { status: 'failed', kind: 'invalid-input', message: problem };
    const output = outputPath(options.outputDir, request.fileName);
    if (output === null) return { status: 'failed', kind: 'io', message: 'Bad output name.' };
    const run = this.queue.run(request, output, listener);
    this.stageJob = run.id;
    try {
      return await run.outcome;
    } finally {
      this.stageJob = null;
    }
  }

  cancelStage(): void {
    if (this.stageJob !== null) this.queue.cancel(this.stageJob);
  }

  async resumeInterrupted(): Promise<ExportEnqueueResult> {
    const options = await this.dialogOptions();
    const dir = this.options.currentProject();
    if (options === null || dir === undefined) {
      return { status: 'invalid', message: 'No project is open.' };
    }
    const interrupted = await this.interrupted(dir);
    if (interrupted === null) return { status: 'invalid', message: 'Nothing to resume.' };
    const request = this.defaultRequest(options, this.options.settings.get());
    const preset = options.presets.find((entry) => entry.id === interrupted.preset);
    return this.enqueue({
      ...request,
      ...(preset === undefined || preset.factor === null ? {} : { preset: preset.id }),
      fileName: path.basename(interrupted.output),
    });
  }

  async testEncoder(encoder: ExportJobRequest['encoder']): Promise<EncoderTestResult> {
    const ffmpeg = await this.options.ffmpeg();
    if (!ffmpeg.ok) return { status: 'error', message: ffmpeg.error.message };
    const settings = this.options.settings.get();
    const prefer = exportSettings(
      { ...settings, performance: { ...settings.performance, encoder } },
      this.options.cores,
    ).encoder;
    const choice = await detectEncoder(ffmpeg.value, { prefer, quality: 'final' });
    if (!choice.ok) return { status: 'error', message: choice.error.message };
    return {
      status: 'ok',
      encoder: choice.value.encoder,
      hardware: choice.value.hardware,
      probes: choice.value.probes.map((probe) => ({ ...probe })),
    };
  }

  async pickFolder(reset: boolean): Promise<ExportFolderResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    const picked = reset ? null : await this.options.pickFolder();
    if (picked === undefined) return { status: 'cancelled' };
    const saved = await this.options.settings.setExportFolder(picked);
    if (saved.status === 'error') return { status: 'error', message: saved.message };
    return { status: 'saved', outputDir: picked ?? path.join(dir, 'out'), custom: picked !== null };
  }

  async openFolder(id: string | null): Promise<{ status: 'ok' | 'error'; message: string | null }> {
    const options = await this.dialogOptions();
    if (options === null) return { status: 'error', message: 'No project is open.' };
    const job = id === null ? undefined : this.queue.job(id);
    const folder = job === undefined ? options.outputDir : path.dirname(job.output);
    try {
      await mkdir(folder, { recursive: true });
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    }
    const problem = await this.options.openPath(folder);
    return problem === '' ? { status: 'ok', message: null } : { status: 'error', message: problem };
  }

  private defaultRequest(options: ExportOptions, settings: AppSettings): ExportJobRequest {
    const usable = options.presets.find((preset) => preset.factor !== null)?.id;
    const wanted = options.presets.find((preset) => preset.id === settings.export.preset);
    return {
      preset: wanted?.factor === null || wanted === undefined ? (usable ?? '1080p30') : wanted.id,
      encoder: settings.performance.encoder,
      quality: settings.export.quality,
      workers: resolveWorkers(settings, this.options.cores),
      fileName: options.defaultFileName,
      includeChapters: settings.export.includeChapters,
      includeThumbnail: settings.export.includeThumbnail,
      thumbnailAt: null,
    };
  }

  /** The dialog's choices become the next defaults (workers equal to `auto` stay `auto`). */
  private async remember(request: ExportJobRequest): Promise<void> {
    const settings = this.options.settings.get();
    const auto = resolveWorkers(
      { ...settings, performance: { ...settings.performance, exportWorkers: 'auto' } },
      this.options.cores,
    );
    const saved = await this.options.settings.update({
      export: {
        preset: request.preset,
        quality: request.quality,
        includeChapters: request.includeChapters,
        includeThumbnail: request.includeThumbnail,
      },
      performance: {
        encoder: request.encoder,
        exportWorkers: request.workers === auto ? 'auto' : request.workers,
      },
    });
    if (saved.status === 'error')
      this.options.log.warn(`export choices not saved: ${saved.message}`);
  }

  private async interrupted(dir: string): Promise<ExportQueueState['interrupted']> {
    const state = await readExportState(exportPaths(dir).stateFile);
    if (!state.ok || state.value === null || state.value.status !== 'running') return null;
    return {
      output: state.value.output,
      preset: state.value.preset,
      finishedShots: state.value.finished.length,
      totalShots: state.value.totalShots,
    };
  }

  /** chapters.txt (YouTube rules) and the YouTube suggestions after a finished export. */
  private async finish(dir: string, job: ExportJob, outcome: ExportOutcome): Promise<ExportExtras> {
    if (outcome.status !== 'done') return { files: [], warnings: [] };
    const files: string[] = [];
    const warnings: string[] = [];
    if (outcome.thumbnail !== null) files.push(projectRelative(dir, outcome.thumbnail));
    try {
      if (job.request.includeChapters) {
        const storyboard = await readProjectJson(dir, FILES.storyboard, storyboardFileSchema);
        const shots = storyboard.status === 'ok' ? storyboard.data.shots : [];
        const chapters = await projectChapters(dir, shots, outcome.durationS);
        if ('text' in chapters) {
          await mkdir(path.join(dir, 'out'), { recursive: true });
          await writeTextAtomic(path.join(dir, 'out', 'chapters.txt'), chapters.text);
          files.push('out/chapters.txt');
        } else {
          warnings.push(`No chapters.txt: ${chapters.problem}`);
        }
      }
      files.push(...(await this.options.youtube.ensureTemplate(dir)));
    } catch (error) {
      warnings.push(`Extras not written: ${describeError(error)}`);
    }
    return { files, warnings };
  }
}
