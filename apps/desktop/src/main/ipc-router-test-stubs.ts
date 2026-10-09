/**
 * Test doubles of ipc-router.test.ts: a fake ipcMain and handler stubs per handler group that
 * record each request and answer a fixed response.
 */
import path from 'node:path';
import type { AppInfo } from '../shared/ipc-contract.js';
import type { IpcMainLike, IpcSenderEvent } from './ipc-router.js';
import type { ProjectOpenResult } from '../shared/project-contract.js';
import { defaultAppSettings } from '@reelforge/shared';
import type { ToolsStatus } from '../shared/settings-contract.js';
import type { WhisperState } from '../shared/whisper-contract.js';
import type { SettingsHandlers } from './settings-ipc.js';
import type { SoundHandlers } from './sound/sound-ipc.js';
import type { VariantsHandlers } from './stages/variants-ipc.js';
import type { VoiceHandlers } from './voice/voice-ipc.js';
import type { QueueHandlers } from './queue/queue-ipc.js';
import { defaultLinePrefs } from './queue/line-prefs.js';
import type { ExportHandlers } from './export/export-ipc.js';
import type { AssetsHandlers } from './assets/assets-ipc.js';
import type { ChannelsHandlers } from './channels/channels-ipc.js';
import type { ChannelsResult } from '../shared/channels-contract.js';
import type { HomeHandlers } from './home/home-ipc.js';

export type Listener = (event: IpcSenderEvent, payload: unknown) => unknown;

export class FakeIpcMain implements IpcMainLike {
  readonly handlers = new Map<string, Listener>();
  readonly listeners = new Map<string, Listener>();
  handle(channel: string, listener: Listener): void {
    this.handlers.set(channel, listener);
  }
  on(channel: string, listener: Listener): void {
    this.listeners.set(channel, listener);
  }
  invoke(channel: string, url: string, payload: unknown): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return handler({ senderFrame: { url } }, payload);
  }
}

export const APP_URL = 'reelforge://app/index.html';
export const appInfo: AppInfo = {
  name: 'ReelForge',
  version: '0.0.0',
  electron: '44.4.5',
  chrome: '152',
  platform: 'win32',
  userDataDir: 'C:\\Users\\x\\AppData\\Roaming\\ReelForge',
  dev: false,
};

export const opened: ProjectOpenResult = {
  status: 'opened',
  project: {
    dir: path.join('C:', 'Filmy', 'Mój film'),
    title: 'Mój film',
    language: 'pl',
    style: 'voxel-pixel-crisp640',
    fps: 30,
  },
};

export const WHISPER_STATE: WhisperState = {
  engine: {
    installs: [],
    problem: 'whisper.cpp is not installed',
    configured: false,
    installBackends: ['blas'],
    installBytes: 21_360_234,
    existing: [],
    root: 'C:\\w',
  },
  models: [],
  vadInstalled: false,
  vadBytes: 885_098,
  modelsDir: 'C:\\w\\models',
  recommended: 'large-v3-turbo-q5_0',
  readiness: {
    ready: false,
    model: 'large-v3-turbo-q5_0',
    missing: ['engine', 'vad', 'model'],
    bytes: 596_286_527,
  },
  job: null,
};

/** Own-asset and library actions (PLAN.md#12.12, #12.19). */
export function assetActionStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): Omit<AssetsHandlers, 'assetsState' | 'assetsReview' | 'libraryState'> {
  const none = { status: 'error', message: 'No project is open.' } as const;
  return {
    assetsImport: (request) => record(request, none),
    assetsEdit: (request) => record(request, none),
    assetsRemove: (request) => record(request, none),
    assetsLibrary: (request) => record(request, none),
    libraryEdit: (request) => record(request, none),
    libraryRemove: (request) => record(request, none),
    libraryUse: (request) => record(request, none),
  };
}

/** Settings channels (PLAN.md#6.7); their requests are checked in the test below. */
export function settingsStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): SettingsHandlers {
  const tools: ToolsStatus = {
    ffmpeg: { status: 'missing', message: 'not found', configured: false },
    whisper: { status: 'missing', message: 'not installed', configured: false },
  };
  return {
    settingsGet: (request) =>
      record(request, { settings: defaultAppSettings(), cores: 8, file: 'settings.json' }),
    settingsUpdate: (request) =>
      record(request, { status: 'ok', settings: defaultAppSettings() } as const),
    claudeStatus: (request) =>
      record(request, {
        state: 'not-installed',
        installCommand: 'npm install -g @anthropic-ai/claude-code',
        searchedDirs: 3,
      } as const),
    claudeOpenLogin: (request) => record(request, { status: 'error', message: 'n/a' } as const),
    toolsStatus: (request) => record(request, tools),
    toolsBrowse: (request) => record(request, { status: 'cancelled' } as const),
    toolsReset: (request) => record(request, tools),
    whisperState: (request) => record(request, WHISPER_STATE),
    whisperInstall: (request) => record(request, { status: 'started' } as const),
    whisperCancel: (request) => record(request, null),
    whisperDelete: (request) => record(request, { status: 'deleted' } as const),
    whisperUseExisting: (request) =>
      record(request, { status: 'invalid', message: 'not a detected install' } as const),
  };
}

/** Export dialog + YouTube channels (PLAN.md#9.1, #9.2). */
export function exportStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): Omit<ExportHandlers, 'exportStart' | 'exportCancel'> {
  const queued = { status: 'queued', id: 'export-1' } as const;
  return {
    exportOptions: (request) =>
      record(request, {
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
        chapters: { text: null, problem: null },
        thumbnailDefaultS: null,
        blockers: [],
        warnings: [],
      } as const),
    exportQueue: (request) => record(request, { projectDir: null, jobs: [], interrupted: null }),
    exportEnqueue: (request) => record(request, queued),
    exportCancelJob: (request) => record(request, true),
    exportResumeJob: (request) => record(request, queued),
    exportResumeInterrupted: (request) => record(request, queued),
    exportTestEncoder: (request) => record(request, { status: 'error', message: 'n/a' } as const),
    exportPickFolder: (request) => record(request, { status: 'cancelled' } as const),
    exportOpenFolder: (request) => record(request, { status: 'ok', message: null } as const),
    youtubeMeta: (request) => record(request, null),
    youtubeMetaGenerate: (request) => record(request, { status: 'error', message: 'n/a' } as const),
    copyText: (request) => record(request, { status: 'copied' } as const),
  };
}

/** Sound panel channels (PLAN.md#8.2). */
export function soundStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): SoundHandlers {
  return {
    soundState: (request) =>
      record(request, {
        projectDir: null,
        library: [],
        gains: { voGainDb: 0, sfxGainDb: 0, ambienceGainDb: 0, musicGainDb: 0 },
        ducking: null,
        musicCues: 0,
        cues: null,
        cuesError: null,
        mix: { exists: false, stale: false, result: null, qa: null },
        stems: [],
      }),
    soundImport: (request) =>
      record(request, { status: 'cancelled', message: null, files: [] } as const),
    soundPreview: (request) => record(request, { status: 'ok', file: 'a.wav' } as const),
    soundSetMix: (request) =>
      record(request, { status: 'ok', message: 'Sound', committed: true } as const),
    soundRun: (request) => record(request, { status: 'queued', message: null } as const),
    mixPreview: (request) => record(request, { status: 'unavailable', reason: 'n/a' } as const),
  };
}

/** Channels and channel secrets (PLAN.md#13.13). */
export function channelStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): ChannelsHandlers {
  const list: ChannelsResult = {
    status: 'ok',
    defaultChannelId: 'default',
    channels: [],
    changedId: null,
  };
  const secret = { status: 'ok', present: true } as const;
  return {
    channelsList: (request) => record(request, list),
    channelsCreate: (request) => record(request, list),
    channelsUpdate: (request) => record(request, list),
    channelsDelete: (request) => record(request, list),
    channelsReorder: (request) => record(request, list),
    channelSecretsSet: (request) => record(request, secret),
    channelSecretsHas: (request) => record(request, secret),
    channelSecretsDelete: (request) => record(request, secret),
  };
}

/** ElevenLabs voice channels (PLAN.md#13.14). */
export function voiceStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): VoiceHandlers {
  const failed = { status: 'error', kind: 'no-key', message: 'n/a' } as const;
  return {
    voiceListSentences: (request) =>
      record(request, {
        setup: { status: 'unavailable', message: 'n/a' },
        generated: false,
        scriptChanged: false,
        audioFile: null,
        sentences: [],
        running: null,
      } as const),
    voiceEstimate: (request) => record(request, failed),
    voiceGenerate: (request) => record(request, failed),
    voiceCancel: (request) => record(request, false),
    voiceRetake: (request) => record(request, failed),
    voiceTestKey: (request) => record(request, failed),
  };
}

/** Production line channels (PLAN.md#13.9). */
export function queueStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): QueueHandlers {
  const done = { status: 'ok', message: null } as const;
  return {
    queueState: (request) =>
      record(request, {
        line: {
          activity: 'stopped',
          until: null,
          message: null,
          current: null,
          wanted: false,
          runUntil: { kind: 'idle' },
          lastEnd: null,
          problem: null,
        },
        channels: [],
        attention: [],
        prefs: defaultLinePrefs(),
      } as const),
    queueAddTopics: (request) => record(request, done),
    queueRemove: (request) => record(request, done),
    queueMove: (request) => record(request, done),
    queueHold: (request) => record(request, done),
    queueResume: (request) => record(request, done),
    queueRetry: (request) => record(request, done),
    queueSetOptions: (request) => record(request, done),
    queueStart: (request) => record(request, done),
    queueStop: (request) => record(request, done),
    queueApproveScript: (request) => record(request, done),
    queueOpenProject: (request) => record(request, { status: 'cancelled' } as const),
    queueOpenFolder: (request) => record(request, done),
    queueMarkReviewed: (request) => record(request, done),
    queueWake: (request) => record(request, done),
    queuePrefs: (request) => record(request, defaultLinePrefs()),
  };
}

/** Shot variant channels (PLAN.md#11.3). */
export function variantStubs(
  record: <T>(request: unknown, response: T) => Promise<T>,
): VariantsHandlers {
  return {
    variantsState: (request) => record(request, { projectDir: null, sets: [] }),
    variantsEstimate: (request) =>
      record(request, { text: '≈ 3 Opus turns', turns: 3, model: 'opus' }),
    variantsRun: (request) => record(request, { status: 'queued', message: null } as const),
    variantsClip: (request) => record(request, { status: 'error', message: 'n/a' } as const),
    variantsManifest: (request) => record(request, { status: 'no-storyboard' } as const),
  };
}

/** Home screen channels (PLAN.md#13.16). */
export function homeStubs(record: <T>(request: unknown, response: T) => Promise<T>): HomeHandlers {
  const ok = { status: 'ok' } as const;
  return {
    homeProjects: (request) => record(request, []),
    homeOpen: (request) => record(request, opened),
    homeShowFolder: (request) => record(request, ok),
    homeRename: (request) => record(request, ok),
    homeOverview: (request) => record(request, { status: 'error', message: 'n/a' } as const),
    homeThumbnailUpload: (request) => record(request, { status: 'cancelled' } as const),
    homeThumbnailRemove: (request) => record(request, { status: 'cancelled' } as const),
    homeShowExport: (request) => record(request, ok),
    homeShortsCreate: (request) => record(request, { status: 'ok' as const, shorts: [] }),
    homeShortCaptions: (request) => record(request, ok),
  };
}
