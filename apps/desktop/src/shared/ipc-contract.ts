/**
 * Typed IPC registry shared by main, preload and renderer. Every channel has a zod schema for its
 * payloads; main validates requests, preload validates responses. The renderer never sees channel
 * names: preload exposes one named function per channel (`window.reelforge`), so there is no
 * generic `invoke(channel)` passthrough.
 */
import { renderManifestSchema, type RenderManifest } from '@reelforge/shared';
import { z } from 'zod';
import {
  historyRequestSchema,
  historyResultSchema,
  newProjectRequestSchema,
  openRecentRequestSchema,
  projectOpenFailureSchema,
  projectOpenResultSchema,
  projectSummarySchema,
  recentProjectEntrySchema,
  revertRequestSchema,
  revertResultSchema,
  type HistoryResult,
  type NewProjectRequest,
  type ProjectOpenFailure,
  type ProjectOpenResult,
  type ProjectSummary,
  type RecentProjectEntry,
  type RevertProjectResult,
} from './project-contract.js';
import {
  projectChangedSchema,
  projectManifestResultSchema,
  projectSnapshotResultSchema,
  repairFileRequestSchema,
  repairFileResultSchema,
  type ProjectChangedEvent,
  type ProjectManifestResult,
  type ProjectSnapshotResult,
  type RepairableFile,
  type RepairFileResult,
} from './snapshot-contract.js';
import {
  snapshotCopyRequestSchema,
  snapshotCopyResultSchema,
  snapshotSaveRequestSchema,
  snapshotSaveResultSchema,
  type SnapshotCopyResult,
  type SnapshotSaveRequest,
  type SnapshotSaveResult,
} from './player-contract.js';
import { ASSETS_IPC, type AssetsApi } from './assets-contract.js';
import { PUBLISH_IPC, type PublishApi } from './publish-contract.js';
import { HOOK_LAB_IPC, type HookLabApi } from './hook-lab-contract.js';
import { TASTE_IPC, type TasteApi } from './taste-contract.js';
import { CHAT_IPC, CHAT_PUSH, type ChatApi } from './chat-contract.js';
import { EXPORT_IPC, EXPORT_PUSH, type ExportApi } from './export-contract.js';
import { ONBOARDING_IPC, type OnboardingApi } from './onboarding-contract.js';
import { PROJECT_SETTINGS_IPC, type ProjectSettingsApi } from './project-settings-contract.js';
import { SETTINGS_IPC, type SettingsApi } from './settings-contract.js';
import { TENSION_IPC, type TensionApi } from './tension-contract.js';
import { DIRECTIONS_IPC, type DirectionsApi } from './directions-contract.js';
import { DRAMATURGY_IPC, type DramaturgyApi } from './dramaturgy-contract.js';
import { EDITING_IPC, type EditingApi } from './editing-contract.js';
import { WHISPER_IPC, WHISPER_PUSH, type WhisperApi } from './whisper-contract.js';
import { SOUND_IPC, type SoundApi } from './sound-contract.js';
import { YOUTUBE_IPC, type YoutubeApi } from './youtube-contract.js';
import { STAGES_IPC, STAGES_PUSH, type StagesApi } from './stages-contract.js';
import { VOICEOVER_IPC, type VoiceoverApi } from './voiceover-contract.js';
import { VARIANTS_IPC, type VariantsApi } from './variants-contract.js';
import {
  timelineEditRequestSchema,
  timelineEditResultSchema,
  waveformRequestSchema,
  waveformResultSchema,
  type TimelineEditRequest,
  type TimelineEditResult,
  type WaveformResult,
} from './timeline-contract.js';

/** A request/response channel (`ipcRenderer.invoke` -> `ipcMain.handle`). */
export interface InvokeChannel<Request extends z.ZodType, Response extends z.ZodType> {
  readonly name: string;
  readonly request: Request;
  readonly response: Response;
}

/** A one-way channel: renderer -> main (`send` -> `ipcMain.on`) or main -> renderer (push). */
export interface SendChannel<Payload extends z.ZodType> {
  readonly name: string;
  readonly payload: Payload;
}

export const appInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  electron: z.string(),
  chrome: z.string(),
  platform: z.string(),
  userDataDir: z.string(),
  dev: z.boolean(),
});
export type AppInfo = z.infer<typeof appInfoSchema>;

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export const logLevelSchema = z.enum(LOG_LEVELS);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const rendererLogEntrySchema = z.object({
  level: logLevelSchema,
  scope: z.string().min(1).max(64),
  message: z.string().max(8_000),
});
export type RendererLogEntry = z.infer<typeof rendererLogEntrySchema>;

const noPayload = z.null();

export const IPC = {
  appInfo: {
    name: 'app:info',
    request: noPayload,
    response: appInfoSchema,
  },
  /** Demo video for the preview on the start screen and when a project has no storyboard. */
  demoManifest: {
    name: 'preview:demo-manifest',
    request: noPayload,
    response: renderManifestSchema,
  },
  /** Folder picker (in main) for the parent folder, then a new project inside it. */
  projectNew: {
    name: 'project:new',
    request: newProjectRequestSchema,
    response: projectOpenResultSchema,
  },
  /** Folder picker (in main) for an existing project. */
  projectOpen: {
    name: 'project:open',
    request: noPayload,
    response: projectOpenResultSchema,
  },
  /** Only folders that are in the recent list are accepted. */
  projectOpenRecent: {
    name: 'project:open-recent',
    request: openRecentRequestSchema,
    response: projectOpenResultSchema,
  },
  projectRecent: {
    name: 'project:recent',
    request: noPayload,
    response: z.array(recentProjectEntrySchema),
  },
  projectCurrent: {
    name: 'project:current',
    request: noPayload,
    response: projectSummarySchema.nullable(),
  },
  projectClose: {
    name: 'project:close',
    request: noPayload,
    response: z.null(),
  },
  /** History of the open project, newest first. */
  projectHistory: {
    name: 'project:history',
    request: historyRequestSchema,
    response: historyResultSchema,
  },
  /** Restores the open project to a commit as a new commit (never rewrites history). */
  projectRevert: {
    name: 'project:revert',
    request: revertRequestSchema,
    response: revertResultSchema,
  },
  /** File listing + storyboard / words / cues of the open project (PLAN.md#6.3). */
  projectSnapshot: {
    name: 'project:snapshot',
    request: noPayload,
    response: projectSnapshotResultSchema,
  },
  /** Restores a damaged document from history / resets damaged app state (PLAN.md#10.2). */
  projectRepairFile: {
    name: 'project:repair-file',
    request: repairFileRequestSchema,
    response: repairFileResultSchema,
  },
  /** Restores project.json of the project that just failed to open, then opens it. */
  projectRestoreFailedOpen: {
    name: 'project:restore-failed-open',
    request: noPayload,
    response: projectOpenResultSchema,
  },
  /** Render manifest of the open project for the preview, when it can be built. */
  projectManifest: {
    name: 'project:manifest',
    request: noPayload,
    response: projectManifestResultSchema,
  },
  /** Saves a preview frame (PNG) into `<project>/out/snapshots/` (PLAN.md#6.4). */
  snapshotSave: {
    name: 'snapshot:save',
    request: snapshotSaveRequestSchema,
    response: snapshotSaveResultSchema,
  },
  /** Puts a preview frame (PNG) on the system clipboard. */
  snapshotCopy: {
    name: 'snapshot:copy',
    request: snapshotCopyRequestSchema,
    response: snapshotCopyResultSchema,
  },
  /** Applies timeline edits to storyboard.json / cues.json and commits (PLAN.md#6.5). */
  timelineEdit: {
    name: 'timeline:edit',
    request: timelineEditRequestSchema,
    response: timelineEditResultSchema,
  },
  /** Waveform peaks of a project audio file (decoded by ffmpeg in main, cached). */
  timelineWaveform: {
    name: 'timeline:waveform',
    request: waveformRequestSchema,
    response: waveformResultSchema,
  },
  /** Settings, Connect Claude, ffmpeg/whisper paths, whisper models (PLAN.md#6.7). */
  ...SETTINGS_IPC,
  /** whisper.cpp install, models and Words timed readiness. */
  ...WHISPER_IPC,
  /** Video export of the open project (hidden render windows + ffmpeg). */
  ...EXPORT_IPC,
  /** Claude chat panel (PLAN.md#6.6). */
  ...CHAT_IPC,
  /** Pipeline sidebar and the Brief -> Script documents (PLAN.md#6.8, #7.1). */
  ...STAGES_IPC,
  /** Voice-over import/recording, stage reports, words retry, scene runs (PLAN.md#7.2-7.7). */
  ...VOICEOVER_IPC,
  /** Shot variants: cards, estimate, generate / pick, clips, preview manifest (PLAN.md#11.3). */
  ...VARIANTS_IPC,
  /** Sound panel: library, bus gains, ducking, mix renders and the preview mix (PLAN.md#8.2). */
  ...SOUND_IPC,
  /** YouTube suggestions of an export and copying text (PLAN.md#9.2). */
  ...YOUTUBE_IPC,
  /** Example project and the Help menu (PLAN.md#10.3). */
  ...ONBOARDING_IPC,
  /** Per-project options in project.json: look mode, ambient variation (PLAN.md#12.1, #12.8). */
  ...PROJECT_SETTINGS_IPC,
  /** Tension panel: curve edits, Reset, "Propose with Claude" (PLAN.md#12.22). */
  ...TENSION_IPC,
  /** Dramaturgy section: interrupt/loop report, reveal moments (PLAN.md#12.25-12.27). */
  ...DRAMATURGY_IPC,
  /** Live co-direction: directions.json (PLAN.md#12.14). */
  ...DIRECTIONS_IPC,
  /** Editing section: beat-sync report, repetition list with Apply / Ignore (PLAN.md#12.21, #12.23). */
  ...EDITING_IPC,
  /** Asset research: research mode, assets, package review, credits (PLAN.md#12.10). */
  ...ASSETS_IPC,
  /** Publish kit and the Sources panel: claims.json, Check sources (PLAN.md#12.17, #12.18). */
  ...PUBLISH_IPC,
  /** Hook lab in the Script step: three alternative openings (PLAN.md#12.16). */
  ...HOOK_LAB_IPC,
  /** Settings → Taste: the local taste profile, reset, export (PLAN.md#12.13). */
  ...TASTE_IPC,
} as const satisfies Record<string, InvokeChannel<z.ZodType, z.ZodType>>;

export const IPC_EVENTS = {
  log: { name: 'log:write', payload: rendererLogEntrySchema },
} as const satisfies Record<string, SendChannel<z.ZodType>>;

/** Main -> renderer pushes (`webContents.send` -> `ipcRenderer.on`), validated in preload. */
export const IPC_PUSH = {
  /** Files of the open project changed on disk (debounced). */
  projectChanged: { name: 'project:changed', payload: projectChangedSchema },
  /** Opening a project failed on a damaged project.json (the start screen offers a restore). */
  projectOpenFailed: { name: 'project:open-failed', payload: projectOpenFailureSchema },
  ...WHISPER_PUSH,
  ...EXPORT_PUSH,
  ...CHAT_PUSH,
  ...STAGES_PUSH,
} as const satisfies Record<string, SendChannel<z.ZodType>>;

export type InvokeChannels = typeof IPC;
export type InvokeChannelKey = keyof InvokeChannels;
export type RequestOf<Key extends InvokeChannelKey> = z.infer<InvokeChannels[Key]['request']>;
export type ResponseOf<Key extends InvokeChannelKey> = z.infer<InvokeChannels[Key]['response']>;

/** The API preload exposes on `window.reelforge`. */
export interface ReelforgeApi
  extends
    SettingsApi,
    WhisperApi,
    ExportApi,
    ChatApi,
    StagesApi,
    VoiceoverApi,
    VariantsApi,
    SoundApi,
    YoutubeApi,
    OnboardingApi,
    ProjectSettingsApi,
    TensionApi,
    DramaturgyApi,
    DirectionsApi,
    EditingApi,
    AssetsApi,
    PublishApi,
    HookLabApi,
    TasteApi {
  getAppInfo(): Promise<AppInfo>;
  getDemoManifest(): Promise<RenderManifest>;
  newProject(request: NewProjectRequest): Promise<ProjectOpenResult>;
  openProject(): Promise<ProjectOpenResult>;
  openRecentProject(dir: string): Promise<ProjectOpenResult>;
  getRecentProjects(): Promise<RecentProjectEntry[]>;
  getCurrentProject(): Promise<ProjectSummary | null>;
  closeProject(): Promise<null>;
  getProjectHistory(limit: number): Promise<HistoryResult>;
  revertProject(hash: string): Promise<RevertProjectResult>;
  getProjectSnapshot(): Promise<ProjectSnapshotResult>;
  getProjectManifest(): Promise<ProjectManifestResult>;
  repairProjectFile(file: RepairableFile): Promise<RepairFileResult>;
  restoreFailedOpen(): Promise<ProjectOpenResult>;
  /** Subscribes to `projectOpenFailed`; returns the unsubscribe function. */
  onProjectOpenFailed(listener: (failure: ProjectOpenFailure) => void): () => void;
  saveSnapshot(request: SnapshotSaveRequest): Promise<SnapshotSaveResult>;
  copySnapshot(png: Uint8Array): Promise<SnapshotCopyResult>;
  editTimeline(request: TimelineEditRequest): Promise<TimelineEditResult>;
  getWaveform(file: string): Promise<WaveformResult>;
  /** Subscribes to `projectChanged`; returns the unsubscribe function. */
  onProjectChanged(listener: (event: ProjectChangedEvent) => void): () => void;
  log(entry: RendererLogEntry): void;
}

/** Name of the `contextBridge` global. */
export const API_GLOBAL = 'reelforge';
