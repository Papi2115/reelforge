/**
 * The production line's export and publish kit (PLAN.md#13.9) as `FilmStep`s, on the app's own
 * services: the export is the sidebar's "Video exported" (runExportStage: same defaults, same
 * pipeline.json status, chapters.txt and the YouTube template after it) on the line's export
 * service, which renders the line's film; the publish kit is the export dialog's "Save to
 * publish/" (PublishService for the film's folder, committed like the app's). A stop aborts the
 * export; finished shots stay cached.
 */
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import { err, ok } from '@reelforge/claude-bridge';
import { stageError, type FilmStep, type StageErrorKind } from '@reelforge/stages';
import type { ExportService } from '../export/export-service.js';
import type { Logger } from '../logger.js';
import { PublishService } from '../publish/publish-service.js';
import { runExportStage } from '../stages/export-stage.js';

export interface LineExportOptions {
  /** The line's export service (its current project is the film being exported). */
  readonly service: Pick<ExportService, 'runForStage' | 'cancelStage'>;
  /** Points the line's render backend and export service at the film first. */
  readonly follow: (projectDir: string) => Promise<void>;
  readonly store: PipelineStateStore;
  readonly log: Logger;
}

/** Export failure kinds that concern the whole line (a tool is missing) vs the film. */
function exportErrorKind(kind: string): StageErrorKind {
  switch (kind) {
    case 'no-ffmpeg':
    case 'missing-tool':
      return 'missing-tool';
    case 'invalid-input':
    case 'not-ready':
      return 'not-ready';
    case 'io':
      return 'io';
    default:
      return 'tool';
  }
}

export function lineExportStep(options: LineExportOptions): FilmStep {
  return async (request) => {
    const { projectDir, signal } = request;
    if (signal.aborted) return err(stageError('cancelled', 'the export was stopped'));
    await options.follow(projectDir);
    const cancel = (): void => {
      options.service.cancelStage();
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await runExportStage(
        {
          start: (listener) => options.service.runForStage(listener),
          cancel,
          store: options.store,
          log: options.log,
        },
        projectDir,
        (step) => {
          request.progress(step.label, step.percent ?? undefined);
        },
      );
      switch (result.status) {
        case 'done':
          return ok({ message: result.message, warnings: result.warnings });
        case 'cancelled':
          return err(stageError('cancelled', 'the export was stopped'));
        case 'failed':
          return err(stageError(exportErrorKind(result.error.kind), result.error.message));
      }
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  };
}

export interface LinePublishOptions {
  /** Commits the saved files (step `publish`); false when it failed. */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<boolean>;
  readonly openPath: (folder: string) => Promise<string>;
  readonly log: Logger;
}

export function linePublishStep(options: LinePublishOptions): FilmStep {
  return async ({ projectDir }) => {
    const publish = new PublishService({ currentProject: () => projectDir, ...options });
    const kit = await publish.kit();
    if (kit.status === 'error') return err(stageError('not-ready', kit.message));
    const saved = await publish.save();
    if (saved.status === 'error') return err(stageError('io', saved.message));
    const warnings = [
      ...kit.kit.warnings,
      ...(kit.kit.chapterProblem === null ? [] : [`Chapters skipped: ${kit.kit.chapterProblem}`]),
      ...kit.kit.unverified.map((title) => `Unverified licence: ${title}`),
    ];
    const count = saved.files.length;
    return ok({
      message: `Publish kit saved to publish/ (${String(count)} file${count === 1 ? '' : 's'})`,
      warnings,
    });
  };
}
