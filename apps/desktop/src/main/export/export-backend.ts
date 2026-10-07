/**
 * Builds the export dialog's services for main.ts (PLAN.md#9.1, #9.2): the ExportService (queue
 * on the render backend's ExportController), the YouTube suggestions (Claude through the app's
 * shared SessionManager) and their IPC handlers.
 */
import type { FfmpegError, FfmpegManager, Result } from '@reelforge/pipeline';
import type { ClaudeRunner } from '@reelforge/stages';
import type { ExportQueueState } from '../../shared/export-contract.js';
import { copyTextToClipboard } from '../clipboard.js';
import type { Logger } from '../logger.js';
import type { ProjectService } from '../project-service.js';
import type { ExportController } from '../render/export-controller.js';
import type { SettingsService } from '../settings-service.js';
import { exportHandlers, type ExportHandlers } from './export-ipc.js';
import { ExportService } from './export-service.js';
import { YoutubeMetaService } from './youtube-meta.js';

export interface ExportBackendOptions {
  readonly projects: ProjectService;
  readonly settings: SettingsService;
  readonly cores: number;
  readonly controller: ExportController;
  readonly claude: ClaudeRunner;
  readonly ffmpeg: () => Promise<Result<FfmpegManager, FfmpegError>>;
  readonly pickFolder: () => Promise<string | undefined>;
  readonly openPath: (folder: string) => Promise<string>;
  readonly push: (state: ExportQueueState) => void;
  readonly log: Logger;
}

export interface ExportBackend {
  readonly handlers: ExportHandlers;
  readonly service: ExportService;
}

export function createExportBackend(options: ExportBackendOptions): ExportBackend {
  const currentProject = (): string | undefined => options.projects.currentProject()?.dir;
  const youtube = new YoutubeMetaService({
    currentProject,
    claude: options.claude,
    settings: () => options.settings.get(),
    now: () => new Date(),
    log: options.log.child('youtube'),
  });
  const service = new ExportService({
    currentProject,
    settings: options.settings,
    cores: options.cores,
    start: (request, listener, output, onWarning) =>
      options.controller.start(request, listener, output, onWarning),
    cancel: () => {
      options.controller.cancel();
    },
    ffmpeg: options.ffmpeg,
    youtube,
    pickFolder: options.pickFolder,
    openPath: options.openPath,
    push: options.push,
    now: () => Date.now(),
    log: options.log.child('queue'),
  });
  return {
    service,
    handlers: exportHandlers({
      controller: options.controller,
      service,
      youtube,
      copyText: copyTextToClipboard,
    }),
  };
}
