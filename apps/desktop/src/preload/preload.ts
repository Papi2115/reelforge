/**
 * Sandboxed preload (bundled to out/preload/preload.cjs): exposes `window.reelforge`, one named
 * function per IPC channel. Responses are validated with zod before they reach the page.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { z } from 'zod';
import {
  API_GLOBAL,
  IPC,
  IPC_EVENTS,
  IPC_PUSH,
  type InvokeChannel,
  type ReelforgeApi,
} from '../shared/ipc-contract.js';

// The page CSP forbids eval; skip zod's `new Function` probe.
z.config({ jitless: true });

async function invoke<Request extends z.ZodType, Response extends z.ZodType>(
  channel: InvokeChannel<Request, Response>,
  request: z.infer<Request>,
): Promise<z.infer<Response>> {
  const response: unknown = await ipcRenderer.invoke(channel.name, request);
  return channel.response.parse(response);
}

function subscribe<Payload extends z.ZodType>(
  channel: { readonly name: string; readonly payload: Payload },
  listener: (payload: z.infer<Payload>) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, payload: unknown): void => {
    const parsed = channel.payload.safeParse(payload);
    // A malformed push is dropped; main is the only sender, so this is a bug report, not input.
    if (parsed.success) listener(parsed.data);
    else
      ipcRenderer.send(IPC_EVENTS.log.name, {
        level: 'warn',
        scope: 'preload',
        message: `invalid ${channel.name} payload: ${parsed.error.message}`.slice(0, 8_000),
      });
  };
  ipcRenderer.on(channel.name, handler);
  return () => {
    ipcRenderer.removeListener(channel.name, handler);
  };
}

const api: ReelforgeApi = {
  getAppInfo: () => invoke(IPC.appInfo, null),
  getDemoManifest: () => invoke(IPC.demoManifest, null),
  newProject: (request) => invoke(IPC.projectNew, request),
  openProject: () => invoke(IPC.projectOpen, null),
  openRecentProject: (dir) => invoke(IPC.projectOpenRecent, { dir }),
  getRecentProjects: () => invoke(IPC.projectRecent, null),
  getCurrentProject: () => invoke(IPC.projectCurrent, null),
  closeProject: () => invoke(IPC.projectClose, null),
  getProjectHistory: (limit) => invoke(IPC.projectHistory, { limit }),
  revertProject: (hash) => invoke(IPC.projectRevert, { hash }),
  getProjectSnapshot: () => invoke(IPC.projectSnapshot, null),
  getProjectManifest: () => invoke(IPC.projectManifest, null),
  saveSnapshot: (request) => invoke(IPC.snapshotSave, request),
  copySnapshot: (png) => invoke(IPC.snapshotCopy, { png }),
  editTimeline: (request) => invoke(IPC.timelineEdit, request),
  getWaveform: (file) => invoke(IPC.timelineWaveform, { file }),
  onProjectChanged: (listener) => subscribe(IPC_PUSH.projectChanged, listener),
  getSettings: () => invoke(IPC.settingsGet, null),
  updateSettings: (patch) => invoke(IPC.settingsUpdate, patch),
  getClaudeStatus: (refresh) => invoke(IPC.claudeStatus, { refresh }),
  openClaudeLogin: () => invoke(IPC.claudeOpenLogin, null),
  getToolsStatus: (refresh) => invoke(IPC.toolsStatus, { refresh }),
  browseToolPath: (tool) => invoke(IPC.toolsBrowse, { tool }),
  resetToolPath: (tool) => invoke(IPC.toolsReset, { tool }),
  getWhisperModels: () => invoke(IPC.whisperModels, null),
  downloadWhisperModel: (model) => invoke(IPC.whisperDownload, { model }),
  cancelWhisperDownload: (model) => invoke(IPC.whisperCancel, { model }),
  deleteWhisperModel: (model) => invoke(IPC.whisperDelete, { model }),
  onWhisperProgress: (listener) => subscribe(IPC_PUSH.whisperProgress, listener),
  startExport: (request) => invoke(IPC.exportStart, request),
  cancelExport: () => invoke(IPC.exportCancel, null),
  onExportProgress: (listener) => subscribe(IPC_PUSH.exportProgress, listener),
  getChatState: () => invoke(IPC.chatState, null),
  sendChat: (request) => invoke(IPC.chatSend, request),
  removeQueuedChat: (turnId) => invoke(IPC.chatRemove, { turnId }),
  stopChat: () => invoke(IPC.chatStop, null),
  resumeChat: () => invoke(IPC.chatResume, null),
  onChatChanged: (listener) => subscribe(IPC_PUSH.chatChanged, listener),
  getStagesState: () => invoke(IPC.stagesState, null),
  runStages: (stages) => invoke(IPC.stagesRun, { stages: [...stages] }),
  stopStage: (stage) => invoke(IPC.stagesStop, { stage }),
  replaceStage: (stage) => invoke(IPC.stagesReplace, { stage }),
  openStageArtifact: (artifact) => invoke(IPC.stagesOpen, { artifact }),
  getBrief: () => invoke(IPC.briefGet, null),
  saveBrief: (brief) => invoke(IPC.briefSave, brief),
  getScript: () => invoke(IPC.scriptGet, null),
  saveScript: (text) => invoke(IPC.scriptSave, { text }),
  approveScript: () => invoke(IPC.scriptApprove, null),
  onStagesChanged: (listener) => subscribe(IPC_PUSH.stagesChanged, listener),
  log: (entry) => {
    ipcRenderer.send(IPC_EVENTS.log.name, entry);
  },
};

contextBridge.exposeInMainWorld(API_GLOBAL, api);
