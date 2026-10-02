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
  projectOpenResultSchema,
  projectSummarySchema,
  recentProjectEntrySchema,
  revertRequestSchema,
  revertResultSchema,
  type HistoryResult,
  type NewProjectRequest,
  type ProjectOpenResult,
  type ProjectSummary,
  type RecentProjectEntry,
  type RevertProjectResult,
} from './project-contract.js';
import {
  projectChangedSchema,
  projectManifestResultSchema,
  projectSnapshotResultSchema,
  type ProjectChangedEvent,
  type ProjectManifestResult,
  type ProjectSnapshotResult,
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
} as const satisfies Record<string, InvokeChannel<z.ZodType, z.ZodType>>;

export const IPC_EVENTS = {
  log: { name: 'log:write', payload: rendererLogEntrySchema },
} as const satisfies Record<string, SendChannel<z.ZodType>>;

/** Main -> renderer pushes (`webContents.send` -> `ipcRenderer.on`), validated in preload. */
export const IPC_PUSH = {
  /** Files of the open project changed on disk (debounced). */
  projectChanged: { name: 'project:changed', payload: projectChangedSchema },
} as const satisfies Record<string, SendChannel<z.ZodType>>;

export type InvokeChannels = typeof IPC;
export type InvokeChannelKey = keyof InvokeChannels;
export type RequestOf<Key extends InvokeChannelKey> = z.infer<InvokeChannels[Key]['request']>;
export type ResponseOf<Key extends InvokeChannelKey> = z.infer<InvokeChannels[Key]['response']>;

/** The API preload exposes on `window.reelforge`. */
export interface ReelforgeApi {
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
  saveSnapshot(request: SnapshotSaveRequest): Promise<SnapshotSaveResult>;
  copySnapshot(png: Uint8Array): Promise<SnapshotCopyResult>;
  /** Subscribes to `projectChanged`; returns the unsubscribe function. */
  onProjectChanged(listener: (event: ProjectChangedEvent) => void): () => void;
  log(entry: RendererLogEntry): void;
}

/** Name of the `contextBridge` global. */
export const API_GLOBAL = 'reelforge';
