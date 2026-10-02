/**
 * Main-side backend of Settings (PLAN.md#6.7): builds the Claude connection, tools and whisper
 * model services around the SettingsService and returns their IPC handlers (merged into
 * `registerIpc` by main.ts). Electron-free: dialogs, pushes and the env come in as options.
 */
import { checkConnection } from '@reelforge/claude-bridge';
import { WhisperManager } from '@reelforge/pipeline';
import type { WhisperProgress, ToolId } from '../shared/settings-contract.js';
import { CLAUDE_SEARCH_DIR_ENV } from './app-paths.js';
import { ClaudeConnectionService, detectionEnv } from './claude-connection.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import { openLoginTerminal } from './login-terminal.js';
import { whisperManagerOptions } from './settings-consumers.js';
import type { SettingsService } from './settings-service.js';
import { ToolsService } from './tools-service.js';
import { WhisperModelsService, whisperModelStore } from './whisper-models.js';

type SettingsHandlerKey =
  | 'settingsGet'
  | 'settingsUpdate'
  | 'claudeStatus'
  | 'claudeOpenLogin'
  | 'toolsStatus'
  | 'toolsBrowse'
  | 'toolsReset'
  | 'whisperModels'
  | 'whisperDownload'
  | 'whisperCancel'
  | 'whisperDelete';

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
}

export interface SettingsBackend {
  readonly handlers: SettingsHandlers;
  readonly claude: ClaudeConnectionService;
  /** Aborts a running model download (app quit). */
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
  const tools = new ToolsService({
    settings,
    pickFile: options.pickToolFile,
    log: log.child('tools'),
  });
  const whisper = new WhisperModelsService({
    store: whisperModelStore(new WhisperManager(whisperManagerOptions(settings.get()))),
    push: options.pushWhisperProgress,
    log: log.child('whisper'),
    now: options.now,
  });

  const handlers: SettingsHandlers = {
    settingsGet: () =>
      Promise.resolve({
        settings: settings.get(),
        cores: options.cores,
        file: options.settingsFile,
      }),
    settingsUpdate: (patch) => settings.update(patch),
    claudeStatus: (request) => claude.status(request.refresh),
    claudeOpenLogin: () => claude.openLogin(),
    toolsStatus: (request) => tools.status(request.refresh),
    toolsBrowse: (request) => tools.browse(request.tool),
    toolsReset: (request) => tools.reset(request.tool),
    whisperModels: () => Promise.resolve(whisper.state()),
    whisperDownload: (request) => Promise.resolve(whisper.download(request.model)),
    whisperCancel: (request) => {
      whisper.cancel(request.model);
      return Promise.resolve(null);
    },
    whisperDelete: (request) => whisper.delete(request.model),
  };
  return {
    handlers,
    claude,
    dispose: () => {
      whisper.abortAll();
    },
  };
}
