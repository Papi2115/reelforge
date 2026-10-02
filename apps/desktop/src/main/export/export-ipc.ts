/**
 * IPC handlers of the export dialog and its YouTube extras (PLAN.md#9.1, #9.2), merged into
 * `registerIpc` by main.ts; the legacy one-shot export keeps going straight to the controller.
 */
import type { ExportOptions } from '../../shared/export-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { ExportController } from '../render/export-controller.js';
import type { ExportService } from './export-service.js';
import type { YoutubeMetaService } from './youtube-meta.js';

export type ExportHandlers = Pick<
  InvokeHandlers,
  | 'exportStart'
  | 'exportCancel'
  | 'exportOptions'
  | 'exportQueue'
  | 'exportEnqueue'
  | 'exportCancelJob'
  | 'exportResumeJob'
  | 'exportResumeInterrupted'
  | 'exportTestEncoder'
  | 'exportPickFolder'
  | 'exportOpenFolder'
  | 'youtubeMeta'
  | 'youtubeMetaGenerate'
  | 'copyText'
>;

const NO_PROJECT: ExportOptions = {
  projectDir: null,
  title: '',
  defaultFileName: 'video.mp4',
  outputDir: '',
  customOutputDir: false,
  render: null,
  presets: [],
  cores: 1,
  defaults: {
    preset: '1080p30',
    encoder: 'auto',
    quality: 'standard',
    workers: 'auto',
    includeChapters: true,
    includeThumbnail: true,
  },
  chapters: { text: null, problem: 'No project is open.' },
  thumbnailDefaultS: null,
  blockers: ['No project is open.'],
  warnings: [],
};

export interface ExportHandlerOptions {
  readonly controller: ExportController;
  readonly service: ExportService;
  readonly youtube: YoutubeMetaService;
  readonly copyText: (text: string) => Promise<Awaited<ReturnType<InvokeHandlers['copyText']>>>;
}

export function exportHandlers(options: ExportHandlerOptions): ExportHandlers {
  const { controller, service, youtube } = options;
  return {
    exportStart: (request) => controller.start(request),
    exportCancel: () => Promise.resolve(controller.cancel()),
    exportOptions: async () => (await service.dialogOptions()) ?? NO_PROJECT,
    exportQueue: () => service.queue.state(),
    exportEnqueue: (request) => service.enqueue(request),
    exportCancelJob: (request) => Promise.resolve(service.queue.cancel(request.id)),
    exportResumeJob: (request) => Promise.resolve(service.queue.resume(request.id)),
    exportResumeInterrupted: () => service.resumeInterrupted(),
    exportTestEncoder: (request) => service.testEncoder(request.encoder),
    exportPickFolder: (request) => service.pickFolder(request.reset),
    exportOpenFolder: (request) => service.openFolder(request.id),
    youtubeMeta: () => youtube.get(),
    youtubeMetaGenerate: () => youtube.generate(),
    copyText: (request) => options.copyText(request.text),
  };
}
