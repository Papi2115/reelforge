/**
 * IPC payloads of Settings (PLAN.md#6.7): app settings, the "Connect Claude" status, ffmpeg /
 * whisper.cpp detection and the whisper model manager. Merged into the registry of
 * ipc-contract.ts. The Claude status carries only non-identifying fields (never e-mail/org).
 */
import {
  appSettingsPatchSchema,
  appSettingsSchema,
  settingsWhisperModelSchema,
  type AppSettings,
  type AppSettingsPatch,
  type SettingsWhisperModel,
} from '@reelforge/shared';
import { z } from 'zod';

const noPayload = z.null();

export const settingsStateSchema = z.object({
  settings: appSettingsSchema,
  /** Logical CPU cores (export workers range). */
  cores: z.int().min(1),
  /** Where the settings live (shown in the UI). */
  file: z.string(),
});
export type SettingsState = z.infer<typeof settingsStateSchema>;

export const settingsUpdateResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), settings: appSettingsSchema }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type SettingsUpdateResult = z.infer<typeof settingsUpdateResultSchema>;

export const claudeStatusSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('not-installed'),
    installCommand: z.string(),
    searchedDirs: z.int().min(0),
  }),
  z.object({ state: z.literal('not-logged-in'), version: z.string(), loginCommand: z.string() }),
  z.object({
    state: z.literal('connected'),
    version: z.string(),
    aboveTested: z.boolean(),
    authMethod: z.string().nullable(),
    subscriptionType: z.string().nullable(),
  }),
  z.object({ state: z.literal('error'), reason: z.string(), message: z.string() }),
]);
export type ClaudeStatus = z.infer<typeof claudeStatusSchema>;

export const claudeStatusRequestSchema = z.strictObject({
  /** Re-run the check even when a recent result is cached. */
  refresh: z.boolean(),
});

export const claudeLoginResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), command: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ClaudeLoginResult = z.infer<typeof claudeLoginResultSchema>;

export const TOOL_IDS = ['ffmpeg', 'whisper'] as const;
export const toolIdSchema = z.enum(TOOL_IDS);
export type ToolId = z.infer<typeof toolIdSchema>;

export const ffmpegStatusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    path: z.string(),
    source: z.enum(['configured', 'env', 'path', 'common-dir']),
    version: z.string(),
    license: z.enum(['LGPL', 'GPL', 'nonfree']),
    version3: z.boolean(),
    hardwareEncoders: z.array(z.enum(['nvenc', 'qsv', 'amf'])),
    ffprobe: z.boolean(),
  }),
  /** Not found (`configured`: the user's path is wrong) or not usable as ffmpeg. */
  z.object({
    status: z.enum(['missing', 'error']),
    message: z.string(),
    configured: z.boolean(),
  }),
]);
export type FfmpegStatus = z.infer<typeof ffmpegStatusSchema>;

export const whisperStatusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    installs: z.array(
      z.object({
        path: z.string(),
        backend: z.string(),
        source: z.enum(['configured', 'env', 'app-data']),
      }),
    ),
  }),
  z.object({ status: z.literal('missing'), message: z.string(), configured: z.boolean() }),
]);
export type WhisperStatus = z.infer<typeof whisperStatusSchema>;

export const toolsStatusSchema = z.object({
  ffmpeg: ffmpegStatusSchema,
  whisper: whisperStatusSchema,
});
export type ToolsStatus = z.infer<typeof toolsStatusSchema>;

export const toolsStatusRequestSchema = z.strictObject({ refresh: z.boolean() });
export const toolRequestSchema = z.strictObject({ tool: toolIdSchema });

export const toolBrowseResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), tools: toolsStatusSchema }),
  z.object({ status: z.literal('cancelled') }),
  /** The picked file is not a working ffmpeg / whisper-cli; nothing was saved. */
  z.object({ status: z.literal('invalid'), message: z.string() }),
]);
export type ToolBrowseResult = z.infer<typeof toolBrowseResultSchema>;

export const whisperModelsStateSchema = z.object({
  modelsDir: z.string(),
  models: z.array(
    z.object({
      id: settingsWhisperModelSchema,
      /** Approximate download size (for the UI only). */
      approxBytes: z.number().nonnegative(),
      installed: z.boolean(),
    }),
  ),
  /** The voice-activity model every transcription needs (downloaded with the first model). */
  vadInstalled: z.boolean(),
  /** At most one download runs at a time. */
  downloading: settingsWhisperModelSchema.nullable(),
});
export type WhisperModelsState = z.infer<typeof whisperModelsStateSchema>;

export const whisperModelRequestSchema = z.strictObject({ model: settingsWhisperModelSchema });

export const whisperDownloadResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('started') }),
  z.object({ status: z.literal('installed') }),
  z.object({ status: z.literal('busy'), downloading: settingsWhisperModelSchema }),
]);
export type WhisperDownloadResult = z.infer<typeof whisperDownloadResultSchema>;

export const whisperDeleteResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('deleted') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type WhisperDeleteResult = z.infer<typeof whisperDeleteResultSchema>;

export const whisperProgressSchema = z.object({
  model: settingsWhisperModelSchema,
  phase: z.enum(['downloading', 'done', 'failed', 'cancelled']),
  /** Asset being fetched (the model or the VAD model). */
  asset: z.string(),
  receivedBytes: z.number().nonnegative(),
  totalBytes: z.number().nonnegative().nullable(),
  message: z.string().optional(),
});
export type WhisperProgress = z.infer<typeof whisperProgressSchema>;

export const SETTINGS_IPC = {
  settingsGet: { name: 'settings:get', request: noPayload, response: settingsStateSchema },
  settingsUpdate: {
    name: 'settings:update',
    request: appSettingsPatchSchema,
    response: settingsUpdateResultSchema,
  },
  /** `claude --version` + `claude auth status` (no model call). */
  claudeStatus: {
    name: 'claude:status',
    request: claudeStatusRequestSchema,
    response: claudeStatusSchema,
  },
  /** Opens a console window running `claude auth login` (fixed command, built in main). */
  claudeOpenLogin: {
    name: 'claude:open-login',
    request: noPayload,
    response: claudeLoginResultSchema,
  },
  toolsStatus: {
    name: 'tools:status',
    request: toolsStatusRequestSchema,
    response: toolsStatusSchema,
  },
  /** File picker in main; the path is saved only when it is a working binary. */
  toolsBrowse: {
    name: 'tools:browse',
    request: toolRequestSchema,
    response: toolBrowseResultSchema,
  },
  /** Back to auto-detection. */
  toolsReset: { name: 'tools:reset', request: toolRequestSchema, response: toolsStatusSchema },
  whisperModels: { name: 'whisper:models', request: noPayload, response: whisperModelsStateSchema },
  whisperDownload: {
    name: 'whisper:download',
    request: whisperModelRequestSchema,
    response: whisperDownloadResultSchema,
  },
  whisperCancel: { name: 'whisper:cancel', request: whisperModelRequestSchema, response: z.null() },
  whisperDelete: {
    name: 'whisper:delete',
    request: whisperModelRequestSchema,
    response: whisperDeleteResultSchema,
  },
} as const;

export const SETTINGS_PUSH = {
  /** Whisper model download progress / end. */
  whisperProgress: { name: 'whisper:progress', payload: whisperProgressSchema },
} as const;

/** Settings part of `window.reelforge`. */
export interface SettingsApi {
  getSettings(): Promise<SettingsState>;
  updateSettings(patch: AppSettingsPatch): Promise<SettingsUpdateResult>;
  getClaudeStatus(refresh: boolean): Promise<ClaudeStatus>;
  openClaudeLogin(): Promise<ClaudeLoginResult>;
  getToolsStatus(refresh: boolean): Promise<ToolsStatus>;
  browseToolPath(tool: ToolId): Promise<ToolBrowseResult>;
  resetToolPath(tool: ToolId): Promise<ToolsStatus>;
  getWhisperModels(): Promise<WhisperModelsState>;
  downloadWhisperModel(model: SettingsWhisperModel): Promise<WhisperDownloadResult>;
  cancelWhisperDownload(model: SettingsWhisperModel): Promise<null>;
  deleteWhisperModel(model: SettingsWhisperModel): Promise<WhisperDeleteResult>;
  /** Subscribes to download progress; returns the unsubscribe function. */
  onWhisperProgress(listener: (progress: WhisperProgress) => void): () => void;
}

export type { AppSettings, AppSettingsPatch };
