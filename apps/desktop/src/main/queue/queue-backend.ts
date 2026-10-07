/**
 * Builds the production line for main.ts (PLAN.md#13.9, ADR-034) from the app's real services:
 * the queues in `<app data>/queues`, the StageRunners and pipeline.json store the sidebar uses
 * (one runner per project, never a second store), the app's Claude runner and account-wide
 * LimitGuard (the line pauses with the chat on a usage limit), the channel's ElevenLabs voice on
 * its own VoiceService instance, and an own render backend for the film being made (Claude's
 * `reelforge` commands and the export render that film, whichever project is open), the export
 * and publish kit of the app. The QueueService holds the one QueueRunner of the app.
 */
import path from 'node:path';
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import { loadChannels } from '@reelforge/project';
import type { FfmpegManager } from '@reelforge/pipeline';
import { QUEUES_DIR } from '@reelforge/shared';
import {
  QueueRunner,
  QueueStore,
  StageQueueExecutor,
  limitSignalFromGuard,
  type ClaudeRunner,
} from '@reelforge/stages';
import type { LimitGuard } from '@reelforge/claude-bridge';
import type { QueueState } from '../../shared/queue-contract.js';
import type { AppLayout } from '../app-paths.js';
import type { ChannelSecretStore } from '../channels/channel-secrets.js';
import { outputFolder } from '../export/export-options.js';
import { ExportService } from '../export/export-service.js';
import { YoutubeMetaService } from '../export/youtube-meta.js';
import type { Logger } from '../logger.js';
import type { RendererSource } from '../navigation-policy.js';
import type { ManualCommit } from '../project-commits.js';
import type { ProjectService } from '../project-service.js';
import { RenderBackend } from '../render/render-backend.js';
import type { SettingsService } from '../settings-service.js';
import { settingsFfmpeg } from '../sound/sound-backend.js';
import type { StageService } from '../stages/stage-service.js';
import { VoiceService } from '../voice/voice-service.js';
import { LineExecutor } from './line-executor.js';
import type { LineNotice } from './line-notices.js';
import { LinePrefsStore, linePrefsFile } from './line-prefs.js';
import { lineProjectFactory } from './line-projects.js';
import { lineExportStep, linePublishStep } from './line-steps.js';
import { channelVoiceReady, GeneratedVoices, lineVoiceProvider } from './line-voice.js';
import { queueHandlers, type QueueHandlers } from './queue-ipc.js';
import { QueueService } from './queue-service.js';

export interface QueueBackendOptions {
  readonly userDataDir: string;
  readonly channelsFile: string;
  readonly source: RendererSource;
  readonly layout: AppLayout;
  readonly cores: number;
  readonly settings: SettingsService;
  readonly projects: ProjectService;
  readonly stages: StageService;
  readonly pipelineStore: PipelineStateStore;
  readonly claude: ClaudeRunner;
  readonly guard: LimitGuard;
  readonly secrets: ChannelSecretStore;
  /** Test hook: the fake ElevenLabs server. */
  readonly elevenLabsUrl: string | undefined;
  readonly voiceFfmpeg: () => Promise<Pick<FfmpegManager, 'run'> | null>;
  /** Path-limited commits of the stages (voiceover) and of app edits (publish kit). */
  readonly stagesCommit: ManualCommit;
  readonly appCommit: ManualCommit;
  readonly defaultProjectsDir: () => string;
  readonly openPath: (target: string) => Promise<string>;
  readonly push: (state: QueueState) => void;
  readonly notify: (notice: LineNotice) => void;
  readonly log: Logger;
}

export interface QueueBackend {
  readonly service: QueueService;
  readonly handlers: QueueHandlers;
  /** Env of a Claude child working in the line's film (its render service), if any. */
  readonly render: Pick<RenderBackend, 'serviceEnv'>;
  dispose(): Promise<void>;
}

async function channelIdsOf(channelsFile: string, log: Logger): Promise<string[]> {
  const channels = await loadChannels(channelsFile);
  if (channels.ok) return channels.value.channels.map((channel) => channel.id);
  log.warn(`channels unreadable, the production line sees none: ${channels.error.message}`);
  return [];
}

export function createQueueBackend(options: QueueBackendOptions): QueueBackend {
  const { log, settings, pipelineStore } = options;
  /** The film the line's render backend and export serve. */
  let lineDir: string | undefined;
  const render = new RenderBackend({
    source: options.source,
    layout: options.layout,
    settings: () => settings.get(),
    cores: options.cores,
    currentProject: () => lineDir,
    pushProgress: () => undefined,
    log: log.child('render'),
  });
  const follow = async (dir: string): Promise<void> => {
    lineDir = dir;
    await render.followProject(dir);
  };
  const exportService = new ExportService({
    currentProject: () => lineDir,
    settings,
    cores: options.cores,
    start: (request, listener, output, onWarning) =>
      render.exports.start(request, listener, output, onWarning),
    cancel: () => {
      render.exports.cancel();
    },
    ffmpeg: settingsFfmpeg(() => settings.get()),
    youtube: new YoutubeMetaService({
      currentProject: () => lineDir,
      claude: options.claude,
      settings: () => settings.get(),
      now: () => new Date(),
      log: log.child('youtube'),
    }),
    pickFolder: () => Promise.resolve(undefined),
    openPath: options.openPath,
    push: () => undefined,
    now: () => Date.now(),
    log: log.child('export'),
  });

  const voiceReady = (channelId: string): Promise<boolean> =>
    channelVoiceReady(options.channelsFile, options.secrets, channelId);
  const voices = new GeneratedVoices();
  const voiceService = new VoiceService({
    channelsFile: options.channelsFile,
    secrets: options.secrets,
    store: pipelineStore,
    baseUrl: options.elevenLabsUrl,
    ffmpeg: options.voiceFfmpeg,
    importVoiceover: voices.importVoiceover,
    voiceoverBusy: (dir) => options.stages.isBusyWith(dir, 'voiceover'),
    commit: async (dir, message, paths) => {
      await options.stagesCommit(dir, message, 'voiceover', paths);
    },
    push: (progress) => {
      executor.voiceProgress(progress);
    },
    log: log.child('voice'),
  });
  const executor: LineExecutor = new LineExecutor(
    { follow, voiceReady },
    lineVoiceProvider({ service: voiceService, voices }),
    (voiceFor) =>
      new StageQueueExecutor({
        runnerFor: (dir) => options.stages.runnerFor(dir),
        pipelineStore,
        claude: options.claude,
        voiceFor,
        exportFilm: lineExportStep({
          service: exportService,
          follow,
          store: pipelineStore,
          log: log.child('export'),
        }),
        publishKit: linePublishStep({
          commit: async (dir, message, paths) =>
            (await options.appCommit(dir, message, 'publish', paths)).ok,
          openPath: options.openPath,
          log: log.child('publish'),
        }),
        finalReview: () => settings.get().scenes.finalReview,
      }),
  );

  const store = new QueueStore(path.join(options.userDataDir, QUEUES_DIR));
  const projects = lineProjectFactory({
    channelsFile: options.channelsFile,
    defaultProjectsDir: options.defaultProjectsDir,
    settings: () => settings.get(),
    templateDir: options.layout.projectTemplateDir,
    stylesDir: options.layout.stylesDir,
  });
  const limits = limitSignalFromGuard(options.guard);
  const service = new QueueService({
    store,
    createRunner: (hooks) => new QueueRunner({ store, projects, executor, limits, ...hooks }),
    channelIds: () => channelIdsOf(options.channelsFile, log),
    voiceReady,
    prefs: new LinePrefsStore(linePrefsFile(options.userDataDir), log),
    push: options.push,
    notify: options.notify,
    openProject: (dir) => options.projects.openKnown(dir),
    openPath: options.openPath,
    videoFolder: (dir) => outputFolder(dir, settings.get()),
    log,
  });
  let disposed: Promise<void> | undefined;
  return {
    service,
    handlers: queueHandlers(service),
    render,
    dispose: () => {
      disposed ??= (async () => {
        voiceService.cancel();
        await service.dispose();
        await render.dispose();
      })();
      return disposed;
    },
  };
}
