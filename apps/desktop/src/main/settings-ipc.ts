/**
 * Main-side backend of Settings (PLAN.md#6.7): builds the Claude connection, tools and whisper
 * setup services around the SettingsService and returns their IPC handlers (merged into
 * `registerIpc` by main.ts). Electron-free: dialogs, pushes and the env come in as options.
 */
import { checkConnection } from '@reelforge/claude-bridge';
import {
  WhisperManager,
  discoverWhisperInstalls,
  type WhisperManagerOptions,
} from '@reelforge/pipeline';
import type { AppSettings } from '@reelforge/shared';
import type { ToolId } from '../shared/settings-contract.js';
import type { WhisperProgress } from '../shared/whisper-contract.js';
import { CLAUDE_SEARCH_DIR_ENV } from './app-paths.js';
import { ClaudeConnectionService, detectionEnv } from './claude-connection.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import { openLoginTerminal } from './login-terminal.js';
import { whisperManagerOptions, whisperModel } from './settings-consumers.js';
import type { SettingsService } from './settings-service.js';
import { ToolsService } from './tools-service.js';
import { diskFreeBytes } from './whisper/test-hooks.js';
import { WhisperSetupService } from './whisper/whisper-setup.js';

type SettingsHandlerKey =
  | 'settingsGet'
  | 'settingsUpdate'
  | 'claudeStatus'
  | 'claudeOpenLogin'
  | 'toolsStatus'
  | 'toolsBrowse'
  | 'toolsReset'
  | 'whisperState'
  | 'whisperInstall'
  | 'whisperCancel'
  | 'whisperDelete'
  | 'whisperUseExisting';

export type SettingsHandlers = Pick<InvokeHandlers, SettingsHandlerKey>;

export interface SettingsBackendOptions {
  readonly settings: SettingsService;
  readonly settingsFile: string;
  /** Logical CPU cores. */
  readonly cores: number;
  readonly env: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  /** Test hooks (e.g. the claude search dir) are honoured only in unpackaged runs. */
  readonly isPackaged: boolean;
  /** cwd of the `claude --version` / `auth status` probes. */
  readonly probeCwd: string;
  readonly pickToolFile: (tool: ToolId) => Promise<string | undefined>;
  readonly pushWhisperProgress: (progress: WhisperProgress) => void;
  readonly log: Logger;
  /** Monotonic ms clock. */
  readonly now: () => number;
  /** App-wide whisper options (test hooks: install root, download mirror). */
  readonly whisperBase?: WhisperManagerOptions;
  /** Test hook: Words timed counts as ready (recorded transcriptions without a whisper root). */
  readonly whisperAssumeReady?: boolean;
  /** After a renderer change was saved (e.g. the experimental switch rewrites the CLI launchers). */
  readonly onUpdated?: (before: AppSettings, after: AppSettings) => void;
}

export interface SettingsBackend {
  readonly handlers: SettingsHandlers;
  readonly claude: ClaudeConnectionService;
  readonly whisper: WhisperSetupService;
  /** Aborts a running whisper install (app quit). */
  dispose(): void;
}

export interface ToolPickerOptions {
  readonly title: string;
  readonly buttonLabel: string;
  readonly filters: { name: string; extensions: string[] }[];
  readonly properties: ['openFile'];
}

/** Native "Browse…" dialog for a tool binary. */
export function toolPickerOptions(tool: ToolId, platform: NodeJS.Platform): ToolPickerOptions {
  const binary = tool === 'ffmpeg' ? 'ffmpeg' : 'whisper-cli';
  const windows = platform === 'win32';
  return {
    title: `Locate ${windows ? `${binary}.exe` : binary}`,
    buttonLabel: 'Use this file',
    filters: windows ? [{ name: binary, extensions: ['exe'] }] : [],
    properties: ['openFile'],
  };
}

export function createSettingsBackend(options: SettingsBackendOptions): SettingsBackend {
  const { settings, env, log } = options;
  const searchDir = options.isPackaged ? undefined : env[CLAUDE_SEARCH_DIR_ENV];
  if (searchDir !== undefined) log.warn(`test hook: claude is searched only in ${searchDir}`);
  const claude = new ClaudeConnectionService({
    check: () => checkConnection({ env: detectionEnv(env, searchDir), cwd: options.probeCwd }),
    openTerminal: (action) => openLoginTerminal(action, { platform: options.platform, env }),
    log: log.child('claude'),
    now: options.now,
  });
  const whisperBase = options.whisperBase ?? {};
  const tools = new ToolsService({
    settings,
    pickFile: options.pickToolFile,
    log: log.child('tools'),
    whisperBase,
  });
  const whisper = new WhisperSetupService({
    manager: () => new WhisperManager(whisperManagerOptions(settings.get(), whisperBase)),
    model: () => whisperModel(settings.get()),
    configured: () => settings.get().tools.whisperPath !== null,
    saveConfiguredPath: async (cliPath) => {
      if (cliPath !== null) {
        const located = new WhisperManager({ ...whisperBase, configuredPath: cliPath }).locate();
        if (!located.ok) return located.error.message;
      }
      const saved = await settings.setToolPath('whisperPath', cliPath);
      return saved.status === 'error' ? saved.message : undefined;
    },
    discover: () =>
      discoverWhisperInstalls({
        env,
        platform: options.platform,
        ...(whisperBase.root === undefined ? {} : { root: whisperBase.root }),
      }),
    freeBytes: diskFreeBytes,
    push: options.pushWhisperProgress,
    log: log.child('whisper'),
    now: options.now,
    ...(options.whisperAssumeReady === true ? { assumeReady: true } : {}),
  });

  const handlers: SettingsHandlers = {
    settingsGet: () =>
      Promise.resolve({
        settings: settings.get(),
        cores: options.cores,
        file: options.settingsFile,
      }),
    settingsUpdate: async (patch) => {
      const before = settings.get();
      const result = await settings.update(patch);
      if (result.status === 'ok') options.onUpdated?.(before, result.settings);
      return result;
    },
    claudeStatus: (request) => claude.status(request.refresh),
    claudeOpenLogin: () => claude.openLogin(),
    toolsStatus: (request) => tools.status(request.refresh),
    toolsBrowse: (request) => tools.browse(request.tool),
    toolsReset: (request) => tools.reset(request.tool),
    whisperState: (request) => whisper.state(request.refresh),
    whisperInstall: (request) => whisper.install(request.job),
    whisperCancel: () => {
      whisper.cancel();
      return Promise.resolve(null);
    },
    whisperDelete: (request) => whisper.delete(request.model),
    whisperUseExisting: (request) => whisper.useExisting(request.path),
  };
  return {
    handlers,
    claude,
    whisper,
    dispose: () => {
      whisper.abortAll();
    },
  };
}
