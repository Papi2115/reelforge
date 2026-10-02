/**
 * "Listen to mix" after an edit (PLAN.md#8.2): re-renders ≤ 20 s of the mix around the playhead
 * (pipeline `mixPreview`, the full mix's master gain) and splices it into a full-length copy of
 * the current preview (mix.wav at first), so earlier edits stay audible too. Every render writes a
 * new file (`.reelforge/cache/preview/mix-preview-<n>.wav`): the player switches to it by URL
 * while the previous one may still be read; older ones are deleted. Requests are serialized and
 * only the newest waiting one runs (a burst of edits costs one render).
 */
import { copyFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  CuesFileSchema,
  MixReportSchema,
  mixPreview,
  type FfmpegError,
  type FfmpegManager,
  type Result,
} from '@reelforge/pipeline';
import { FILES, REPORTS, inProject } from '@reelforge/stages';
import { PREVIEW_WINDOW_S, type MixPreviewResult } from '../../shared/sound-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';
import { readWavLayout, spliceWav, wavSeconds } from './wav-splice.js';

export const PREVIEW_DIR = '.reelforge/cache/preview';
/** The window starts this long before the playhead (the edit is usually just ahead of it). */
export const PREVIEW_LEAD_S = 5;
const PREVIEW_FILE = /^mix-preview-\d+\.wav$/;

export interface MixPreviewServiceOptions {
  readonly currentProject: () => string | undefined;
  readonly ffmpeg: () => Promise<Result<FfmpegManager, FfmpegError>>;
  readonly log: Logger;
  readonly now?: () => number;
}

/** [start, start + duration) of the window around `t` inside a `total`-second mix. */
export function previewWindow(
  t: number,
  totalS: number,
): { readonly startS: number; readonly durationS: number } {
  const durationS = Math.min(PREVIEW_WINDOW_S, Math.max(0, totalS));
  const startS = Math.min(Math.max(0, t - PREVIEW_LEAD_S), Math.max(0, totalS - durationS));
  return { startS: Math.round(startS * 1000) / 1000, durationS };
}

interface PreviewBase {
  readonly dir: string;
  /** mtime of the mix.wav the preview was made from (a new full render resets the chain). */
  readonly mixMtimeMs: number;
  readonly file: string;
}

function unavailable(reason: string): MixPreviewResult {
  return { status: 'unavailable', reason };
}

async function mtimeOf(file: string): Promise<number | null> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null; // missing
  }
}

export class MixPreviewService {
  private queue: Promise<unknown> = Promise.resolve();
  private latest = 0;
  private counter = 0;
  private base: PreviewBase | undefined;

  constructor(private readonly options: MixPreviewServiceOptions) {}

  /** Renders the window around `t`; a request overtaken by a newer one resolves `unavailable`. */
  render(t: number): Promise<MixPreviewResult> {
    this.latest += 1;
    const id = this.latest;
    const run = this.queue.then(() =>
      id === this.latest ? this.renderNow(t) : unavailable('superseded by a newer edit'),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async renderNow(t: number): Promise<MixPreviewResult> {
    const started = this.options.now?.() ?? performance.now();
    const dir = this.options.currentProject();
    if (dir === undefined) return unavailable('No project is open.');
    const mixPath = inProject(dir, FILES.mix);
    const voPath = inProject(dir, FILES.voClean);
    const [mixMtimeMs, voMtime] = await Promise.all([mtimeOf(mixPath), mtimeOf(voPath)]);
    if (mixMtimeMs === null) return unavailable('Render the mix first (Render mix).');
    if (voMtime === null) return unavailable('The cleaned voice-over is missing.');
    const cues = await readProjectJson(dir, FILES.cues, CuesFileSchema);
    if (cues.status === 'error') return { status: 'error', message: cues.error.message };
    const layout = await readWavLayout(mixPath);
    if (layout === null) return { status: 'error', message: 'audio/mix.wav is not a PCM WAV' };
    const window = previewWindow(t, wavSeconds(layout));
    if (window.durationS <= 0) return unavailable('The mix is empty.');
    const ffmpeg = await this.options.ffmpeg();
    if (!ffmpeg.ok) return { status: 'error', message: ffmpeg.error.message };
    const report = await readProjectJson(dir, REPORTS.mix, MixReportSchema);
    const previewDir = inProject(dir, PREVIEW_DIR);
    const windowFile = path.join(previewDir, 'window.wav');
    const rendered = await mixPreview(
      cues.status === 'ok' ? cues.data : CuesFileSchema.parse({ version: 1 }),
      {
        ffmpeg: ffmpeg.value,
        voPath,
        outputPath: windowFile,
        baseDir: dir,
        workDir: previewDir,
        startS: window.startS,
        durationS: window.durationS,
        gainDb: report.status === 'ok' ? report.data.gainDb : null,
      },
    );
    if (!rendered.ok) {
      this.options.log.warn(`mix preview failed: ${rendered.error.message}`);
      return { status: 'error', message: rendered.error.message };
    }
    try {
      const file = await this.splice(dir, mixPath, mixMtimeMs, windowFile, window.startS);
      const ms = (this.options.now?.() ?? performance.now()) - started;
      this.options.log.info(
        `mix preview ${window.startS.toFixed(1)}+${window.durationS.toFixed(1)} s in ${String(Math.round(ms))} ms`,
      );
      return { status: 'ok', file, ...window, ms };
    } catch (error) {
      return { status: 'error', message: `preview not written: ${describeError(error)}` };
    } finally {
      await rm(windowFile, { force: true });
    }
  }

  /** New full-length preview = previous preview (or mix.wav) with the window spliced in. */
  private async splice(
    dir: string,
    mixPath: string,
    mixMtimeMs: number,
    windowFile: string,
    startS: number,
  ): Promise<string> {
    const previous =
      this.base?.dir === dir && this.base.mixMtimeMs === mixMtimeMs ? this.base.file : undefined;
    const source =
      previous !== undefined && (await mtimeOf(inProject(dir, previous))) !== null
        ? inProject(dir, previous)
        : mixPath;
    this.counter += 1;
    const relative = `${PREVIEW_DIR}/mix-preview-${String(this.counter)}.wav`;
    const target = inProject(dir, relative);
    await copyFile(source, target);
    const problem = await spliceWav(target, windowFile, startS);
    if (problem !== null) throw new Error(problem);
    this.base = { dir, mixMtimeMs, file: relative };
    await this.prune(
      dir,
      [relative, previous].filter((file) => file !== undefined),
    );
    return relative;
  }

  /** Deletes older preview files (keeps the new one and the one the player may still read). */
  private async prune(dir: string, keep: readonly string[]): Promise<void> {
    const folder = inProject(dir, PREVIEW_DIR);
    const kept = new Set(keep.map((file) => path.posix.basename(file)));
    const names = await readdir(folder).catch((): string[] => []);
    await Promise.all(
      names
        .filter((name) => PREVIEW_FILE.test(name) && !kept.has(name))
        .map((name) => rm(path.join(folder, name), { force: true })),
    );
  }
}
