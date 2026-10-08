/**
 * Builds the Sound panel's services for main.ts (PLAN.md#8.2): the SoundService (state, imports,
 * previews, gains/ducking in the timeline editor's write queue, stage runs through the
 * StageService queue) and the MixPreviewService (ffmpeg of the current settings, re-located when
 * the configured path changes).
 */
import { FfmpegManager, type FfmpegError, type Result } from '@reelforge/pipeline';
import type { AppSettings } from '@reelforge/shared';
import type { StageRequest } from '@reelforge/stages';
import type { SoundKind } from '../../shared/sound-contract.js';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import type { Logger } from '../logger.js';
import type { ProjectService } from '../project-service.js';
import { ffmpegLocateOptions } from '../settings-consumers.js';
import type { TimelineEditService } from '../timeline-edit-service.js';
import { MixPreviewService } from './mix-preview-service.js';
import { soundHandlers, type SoundHandlers } from './sound-ipc.js';
import { SoundService } from './sound-service.js';

/** ffmpeg of the current settings; created once per configured path. */
export function settingsFfmpeg(
  settings: () => AppSettings,
): () => Promise<Result<FfmpegManager, FfmpegError>> {
  let cached:
    | { readonly key: string; readonly manager: Promise<Result<FfmpegManager, FfmpegError>> }
    | undefined;
  return () => {
    const key = settings().tools.ffmpegPath ?? '';
    if (cached?.key !== key) {
      cached = { key, manager: FfmpegManager.create(ffmpegLocateOptions(settings())) };
    }
    return cached.manager;
  };
}

export interface SoundBackendOptions {
  readonly projects: ProjectService;
  readonly settings: () => AppSettings;
  readonly edits: TimelineEditService;
  readonly enqueue: (requests: readonly StageRequest[]) => Promise<StageCommandResult>;
  readonly pickFiles: (kind: SoundKind) => Promise<readonly string[] | undefined>;
  readonly log: Logger;
}

export function createSoundBackend(options: SoundBackendOptions): SoundHandlers {
  const { projects, log } = options;
  const currentProject = (): string | undefined => projects.currentProject()?.dir;
  const sound = new SoundService({
    currentProject,
    pickFiles: options.pickFiles,
    enqueue: options.enqueue,
    exclusive: (task) => options.edits.exclusive(task),
    commit: async (_dir, message, paths) => {
      const result = await projects.autocommit(message, { kind: 'manual', paths });
      if (!result.ok) log.warn(`sound change not committed: ${result.error.message}`);
      return result.ok && result.value.status === 'committed';
    },
    log,
  });
  const preview = new MixPreviewService({
    currentProject,
    ffmpeg: settingsFfmpeg(options.settings),
    log: log.child('preview'),
  });
  return soundHandlers(sound, preview);
}
