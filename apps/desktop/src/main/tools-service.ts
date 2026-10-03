/**
 * ffmpeg / whisper.cpp in Settings (PLAN.md#6.7): what auto-detection (or the user's path) found,
 * with version and licence flag; "Browse…" through main's own file picker. A picked path is saved
 * only when it is a working binary, so a typo never replaces a good auto-detected install.
 */
import {
  FfmpegManager,
  WhisperManager,
  type FfmpegError,
  type LocateOptions,
  type Result,
  type WhisperError,
  type WhisperInstall,
  type WhisperLocateOptions,
} from '@reelforge/pipeline';
import type { AppSettings } from '@reelforge/shared';
import type {
  FfmpegStatus,
  ToolBrowseResult,
  ToolId,
  ToolsStatus,
  WhisperStatus,
} from '../shared/settings-contract.js';
import type { Logger } from './logger.js';
import { ffmpegLocateOptions, whisperManagerOptions } from './settings-consumers.js';
import type { SettingsService, ToolPathKey } from './settings-service.js';

/** The parts of a probed `FfmpegManager` the settings page shows. */
export type ProbedFfmpeg = Pick<FfmpegManager, 'binary' | 'info'>;

export interface ToolProbes {
  readonly ffmpeg: (options: LocateOptions) => Promise<Result<ProbedFfmpeg, FfmpegError>>;
  readonly whisper: (options: WhisperLocateOptions) => Result<WhisperInstall[], WhisperError>;
}

export const realToolProbes: ToolProbes = {
  ffmpeg: (options) => FfmpegManager.create(options),
  whisper: (options) => new WhisperManager(options).locate(),
};

export interface ToolsServiceOptions {
  readonly settings: SettingsService;
  /** Native file picker; undefined when cancelled. */
  readonly pickFile: (tool: ToolId) => Promise<string | undefined>;
  readonly log: Logger;
  readonly probes?: ToolProbes;
  /** App-wide whisper options (test hooks: install root). */
  readonly whisperBase?: WhisperLocateOptions;
}

const PATH_KEYS: Readonly<Record<ToolId, ToolPathKey>> = {
  ffmpeg: 'ffmpegPath',
  whisper: 'whisperPath',
};

function ffmpegStatusOf(
  result: Result<ProbedFfmpeg, FfmpegError>,
  configured: boolean,
): FfmpegStatus {
  if (!result.ok) {
    return {
      status: result.error.kind === 'not-found' ? 'missing' : 'error',
      message: result.error.message,
      configured,
    };
  }
  const { binary, info } = result.value;
  return {
    status: 'found',
    path: binary.ffmpegPath,
    source: binary.source,
    version: info.version,
    license: info.license,
    version3: info.version3,
    hardwareEncoders: [...info.capabilities.hardwareH264],
    ffprobe: binary.ffprobePath !== null,
  };
}

function whisperStatusOf(
  result: Result<WhisperInstall[], WhisperError>,
  configured: boolean,
): WhisperStatus {
  if (!result.ok) return { status: 'missing', message: result.error.message, configured };
  return {
    status: 'found',
    installs: result.value.map((install) => ({
      path: install.cliPath,
      backend: install.backend,
      source: install.source,
    })),
  };
}

export class ToolsService {
  private readonly probes: ToolProbes;
  /** ffmpeg probing spawns three processes: reuse it until the configured path changes. */
  private ffmpegCache: { readonly key: string; readonly status: FfmpegStatus } | undefined;

  constructor(private readonly options: ToolsServiceOptions) {
    this.probes = options.probes ?? realToolProbes;
  }

  private async ffmpegStatus(settings: AppSettings, refresh: boolean): Promise<FfmpegStatus> {
    const key = settings.tools.ffmpegPath ?? '';
    if (!refresh && this.ffmpegCache?.key === key) return this.ffmpegCache.status;
    const status = ffmpegStatusOf(
      await this.probes.ffmpeg(ffmpegLocateOptions(settings)),
      settings.tools.ffmpegPath !== null,
    );
    this.ffmpegCache = { key, status };
    return status;
  }

  private whisperStatus(settings: AppSettings): WhisperStatus {
    return whisperStatusOf(
      this.probes.whisper(whisperManagerOptions(settings, this.options.whisperBase)),
      settings.tools.whisperPath !== null,
    );
  }

  async status(refresh: boolean): Promise<ToolsStatus> {
    const settings = this.options.settings.get();
    return {
      ffmpeg: await this.ffmpegStatus(settings, refresh),
      whisper: this.whisperStatus(settings),
    };
  }

  async browse(tool: ToolId): Promise<ToolBrowseResult> {
    const picked = await this.options.pickFile(tool);
    if (picked === undefined) return { status: 'cancelled' };
    const problem = await this.validate(tool, picked);
    if (problem !== undefined) {
      this.options.log.warn(`rejected ${tool} path ${picked}: ${problem}`);
      return { status: 'invalid', message: problem };
    }
    const saved = await this.options.settings.setToolPath(PATH_KEYS[tool], picked);
    if (saved.status === 'error') return { status: 'invalid', message: saved.message };
    this.options.log.info(`${tool} path set to ${picked}`);
    return { status: 'saved', tools: await this.status(true) };
  }

  async reset(tool: ToolId): Promise<ToolsStatus> {
    const saved = await this.options.settings.setToolPath(PATH_KEYS[tool], null);
    if (saved.status === 'error') this.options.log.warn(saved.message);
    return this.status(true);
  }

  /** Undefined when `file` is a working binary of `tool`, else the reason. */
  private async validate(tool: ToolId, file: string): Promise<string | undefined> {
    if (tool === 'ffmpeg') {
      const probed = await this.probes.ffmpeg({ configuredPath: file });
      return probed.ok ? undefined : probed.error.message;
    }
    const located = this.probes.whisper({ ...this.options.whisperBase, configuredPath: file });
    return located.ok ? undefined : located.error.message;
  }
}
