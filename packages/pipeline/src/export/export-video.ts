/**
 * "Video exported" stage: render manifest -> per-shot segments (shot-parallel, cached, resumable)
 * -> concat + mux with `audio/mix.wav` -> `out/<title>.mp4`, plus `out/thumb.png` and
 * `out/chapters.txt`. See docs/export.md.
 */
import { availableParallelism } from 'node:os';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { segmentCacheKey, sha256Hex, stableStringify } from './cache-key.js';
import { buildChaptersTxt } from './chapters.js';
import { describeUnknown, type ExportError } from './errors.js';
import type { ExportResult, ExportVideoOptions } from './export-types.js';
import { isSoftwareRenderer } from './frame-source.js';
import { safeOutputName } from './output-name.js';
import { DEFAULT_EXPORT_PRESET, resolveOutputScale } from './presets.js';
import { renderShots, type ShotJob } from './render-shots.js';
import { planShots } from './shot-plan.js';
import { ExportStateWriter, exportPaths, fileExists, readExportState } from './state.js';
import { defaultThumbnailTime, renderThumbnail } from './thumbnail.js';
import { err, ok, type Result } from '../result.js';

export type { ExportProgress, ExportResult, ExportVideoOptions } from './export-types.js';

export function defaultWorkerCount(): number {
  return Math.max(1, Math.floor(availableParallelism() / 2));
}

async function writeTextAtomic(file: string, text: string): Promise<Result<void, ExportError>> {
  const partial = `${file}.partial`;
  try {
    await writeFile(partial, text, 'utf8');
    await rename(partial, file);
    return ok(undefined);
  } catch (error) {
    await rm(partial, { force: true });
    return err({
      kind: 'io',
      message: `cannot write ${file}: ${describeUnknown(error)}`,
      path: file,
    });
  }
}

async function resolveAudio(options: ExportVideoOptions): Promise<string | null> {
  if (options.audio !== undefined) return options.audio;
  const mix = path.join(options.projectDir, 'audio', 'mix.wav');
  return (await fileExists(mix)) ? mix : null;
}

async function pruneSegments(segmentsDir: string, keep: ReadonlySet<string>): Promise<void> {
  // Pruning is housekeeping: an unreadable cache folder just stays as it is.
  const entries = await readdir(segmentsDir).catch((): string[] => []);
  await Promise.all(
    entries
      .filter((name) => !keep.has(name))
      .map((name) => rm(path.join(segmentsDir, name), { force: true })),
  );
}

function validate(options: ExportVideoOptions): Result<void, ExportError> {
  const { manifest, identity } = options;
  const size = `${String(identity.style.width)}x${String(identity.style.height)}`;
  if (
    (manifest.width !== undefined && manifest.width !== identity.style.width) ||
    (manifest.height !== undefined && manifest.height !== identity.style.height)
  ) {
    return err({
      kind: 'invalid-input',
      message: `manifest size ${String(manifest.width)}x${String(manifest.height)} differs from the style size ${size}`,
    });
  }
  if (
    options.workers !== undefined &&
    (!Number.isInteger(options.workers) || options.workers < 1)
  ) {
    return err({ kind: 'invalid-input', message: 'workers must be a positive integer' });
  }
  return ok(undefined);
}

export async function exportVideo(
  options: ExportVideoOptions,
): Promise<Result<ExportResult, ExportError>> {
  const now = options.now ?? (() => performance.now());
  const started = now();
  const signal = options.signal ?? new AbortController().signal;
  const emit = options.onProgress ?? ((): void => undefined);
  const valid = validate(options);
  if (!valid.ok) return valid;
  const { manifest, identity, media } = options;
  const presetId = options.preset ?? DEFAULT_EXPORT_PRESET;
  const scale = resolveOutputScale(presetId, identity.style.width, identity.style.height);
  if (!scale.ok) return scale;
  const plan = planShots(manifest);
  if (plan.totalFrames === 0)
    return err({ kind: 'invalid-input', message: 'the video has no frames' });
  // Validated before rendering: bad chapters should not cost a full render.
  let chaptersText: string | null = null;
  if (options.chapters !== undefined) {
    const text = buildChaptersTxt(options.chapters, plan.durationS);
    if (!text.ok) return text;
    chaptersText = text.value;
  }

  const paths = exportPaths(options.projectDir);
  const output = options.output ?? path.join(paths.outDir, `${safeOutputName(options.title)}.mp4`);
  try {
    await mkdir(paths.segmentsDir, { recursive: true });
    await mkdir(paths.outDir, { recursive: true });
    await mkdir(path.dirname(output), { recursive: true });
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot create export folders: ${describeUnknown(error)}`,
      path: paths.cacheDir,
    });
  }
  const outputKey = stableStringify({
    media: media.outputKey,
    preset: presetId,
    factor: scale.value.factor,
  });
  const jobs: ShotJob[] = plan.shots.map((planned) => {
    const key = segmentCacheKey({
      manifest,
      planned,
      identity,
      outputKey,
      resolveAnchor: options.resolveAnchor,
    });
    return {
      planned,
      key,
      segment: path.join(paths.segmentsDir, `${key}${media.segmentExtension}`),
    };
  });
  const jobKey = sha256Hex(stableStringify({ keys: jobs.map((job) => job.key), output }));
  const previous = await readExportState(paths.stateFile);
  const resumed =
    previous.ok &&
    previous.value !== null &&
    previous.value.jobKey === jobKey &&
    previous.value.status === 'running';

  const cachedFlags = await Promise.all(jobs.map((job) => fileExists(job.segment)));
  const toRender = jobs.filter((_, index) => cachedFlags[index] !== true);
  const cached = jobs.filter((_, index) => cachedFlags[index] === true);
  const shotEntry = (job: ShotJob): { id: string; key: string; frames: number } => ({
    id: job.planned.shot.id,
    key: job.key,
    frames: job.planned.endFrame - job.planned.startFrame,
  });
  const state = new ExportStateWriter(paths.stateFile, {
    version: 1,
    jobKey,
    status: 'running',
    output,
    preset: presetId,
    encoder: media.encoderLabel,
    totalShots: jobs.length,
    finished: cached.map(shotEntry),
  });
  const initialWrite = await state.write();
  if (!initialWrite.ok)
    return err({ kind: 'io', message: initialWrite.error.message, path: paths.stateFile });

  const framesToRender = toRender.reduce(
    (sum, job) => sum + job.planned.endFrame - job.planned.startFrame,
    0,
  );
  const workers = Math.max(1, Math.min(options.workers ?? defaultWorkerCount(), toRender.length));
  emit({
    type: 'plan',
    shots: jobs.length,
    cachedShots: cached.length,
    totalFrames: plan.totalFrames,
    framesToRender,
    workers,
    encoder: media.encoderLabel,
    resumed,
  });
  for (const job of cached) emit({ type: 'shot-done', shotId: job.planned.shot.id, cached: true });

  let renderedFrames = 0;
  let gpu: string | null = null;
  const announced = new Set<number>();
  const renderStarted = now();
  const rendered = await renderShots({
    manifest,
    jobs: toRender,
    workers,
    scale: scale.value,
    media,
    createFrameSource: options.createFrameSource,
    signal,
    events: {
      onSourceOpened(worker, info) {
        if (announced.has(worker)) return;
        announced.add(worker);
        gpu ??= info.gpu;
        emit({ type: 'source', worker, gpu: info.gpu, software: isSoftwareRenderer(info.gpu) });
      },
      onShotStart(job, worker) {
        const frames = job.planned.endFrame - job.planned.startFrame;
        emit({ type: 'shot-start', shotId: job.planned.shot.id, frames, worker });
      },
      onFrame(job, frameInShot) {
        renderedFrames += 1;
        const elapsedS = (now() - renderStarted) / 1000;
        const fps = elapsedS > 0 ? renderedFrames / elapsedS : 0;
        emit({
          type: 'frame',
          shotId: job.planned.shot.id,
          frameInShot,
          shotFrames: job.planned.endFrame - job.planned.startFrame,
          renderedFrames,
          framesToRender,
          fps,
          etaS: fps > 0 ? (framesToRender - renderedFrames) / fps : null,
        });
      },
      async onShotDone(job) {
        const saved = await state.markFinished(shotEntry(job));
        if (!saved.ok)
          return err({ kind: 'io', message: saved.error.message, path: paths.stateFile });
        emit({ type: 'shot-done', shotId: job.planned.shot.id, cached: false });
        return ok(undefined);
      },
    },
  });
  if (!rendered.ok) return rendered;

  emit({ type: 'mux' });
  const audio = await resolveAudio(options);
  const partialOutput = path.join(
    path.dirname(output),
    `${path.basename(output, path.extname(output))}.partial.mp4`,
  );
  const muxed = await media.concatAndMux(
    {
      segments: jobs.map((job) => job.segment),
      workDir: paths.cacheDir,
      audio,
      durationS: plan.durationS,
      output: partialOutput,
    },
    signal,
  );
  if (!muxed.ok) {
    await rm(partialOutput, { force: true });
    return muxed;
  }
  try {
    await rename(partialOutput, output);
  } catch (error) {
    await rm(partialOutput, { force: true });
    return err({
      kind: 'io',
      message: `cannot replace ${output} (is it open in a player?): ${describeUnknown(error)}`,
      path: output,
    });
  }

  let chaptersFile: string | null = null;
  if (chaptersText !== null) {
    chaptersFile = path.join(paths.outDir, 'chapters.txt');
    const written = await writeTextAtomic(chaptersFile, chaptersText);
    if (!written.ok) return written;
  }

  let thumbnail: string | null = null;
  if (options.thumbnailAt !== null) {
    if (signal.aborted) return err({ kind: 'cancelled', message: 'export cancelled' });
    emit({ type: 'thumbnail' });
    thumbnail = path.join(paths.outDir, 'thumb.png');
    const thumb = await renderThumbnail({
      manifest,
      plan,
      t: options.thumbnailAt ?? defaultThumbnailTime(plan),
      width: identity.style.width,
      height: identity.style.height,
      file: thumbnail,
      media,
      createFrameSource: options.createFrameSource,
      signal,
    });
    if (!thumb.ok) return thumb;
  }

  const completed = await state.markComplete();
  if (!completed.ok)
    return err({ kind: 'io', message: completed.error.message, path: paths.stateFile });
  if (options.pruneCache !== false) {
    await pruneSegments(paths.segmentsDir, new Set(jobs.map((job) => path.basename(job.segment))));
  }
  emit({ type: 'done', output });
  return ok({
    output,
    thumbnail,
    chaptersFile,
    renderedShots: toRender.map((job) => job.planned.shot.id),
    cachedShots: cached.map((job) => job.planned.shot.id),
    totalFrames: plan.totalFrames,
    durationS: plan.durationS,
    width: scale.value.outputWidth,
    height: scale.value.outputHeight,
    encoder: media.encoderLabel,
    audio,
    resumed,
    gpu,
    wallMs: now() - started,
  });
}
