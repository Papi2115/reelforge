/**
 * Sandboxed preload (bundled to out/preload/preload.cjs): exposes `window.reelforge`, one named
 * function per IPC channel. Responses are validated with zod before they reach the page.
 */
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { z } from 'zod';
import {
  API_GLOBAL,
  IPC,
  IPC_EVENTS,
  IPC_PUSH,
  type InvokeChannel,
  type ReelforgeApi,
} from '../shared/ipc-contract.js';
import type { QueueItemRef } from '../shared/queue-contract.js';

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

/** Only the two ids (the requests are strict: a whole item view would be refused). */
function refOf(ref: QueueItemRef): QueueItemRef {
  return { channelId: ref.channelId, itemId: ref.itemId };
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
  repairProjectFile: (file) => invoke(IPC.projectRepairFile, { file }),
  restoreFailedOpen: () => invoke(IPC.projectRestoreFailedOpen, null),
  onProjectOpenFailed: (listener) => subscribe(IPC_PUSH.projectOpenFailed, listener),
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
  getWhisperState: (refresh) => invoke(IPC.whisperState, { refresh }),
  installWhisper: (job) => invoke(IPC.whisperInstall, { job }),
  cancelWhisperInstall: () => invoke(IPC.whisperCancel, null),
  deleteWhisperModel: (model) => invoke(IPC.whisperDelete, { model }),
  useExistingWhisper: (file) => invoke(IPC.whisperUseExisting, { path: file }),
  onWhisperProgress: (listener) => subscribe(IPC_PUSH.whisperProgress, listener),
  startExport: (request) => invoke(IPC.exportStart, request),
  cancelExport: () => invoke(IPC.exportCancel, null),
  onExportProgress: (listener) => subscribe(IPC_PUSH.exportProgress, listener),
  getExportOptions: () => invoke(IPC.exportOptions, null),
  getExportQueue: () => invoke(IPC.exportQueue, null),
  enqueueExport: (request) => invoke(IPC.exportEnqueue, request),
  cancelExportJob: (id) => invoke(IPC.exportCancelJob, { id }),
  resumeExportJob: (id) => invoke(IPC.exportResumeJob, { id }),
  resumeInterruptedExport: () => invoke(IPC.exportResumeInterrupted, null),
  testEncoder: (encoder) => invoke(IPC.exportTestEncoder, { encoder }),
  pickExportFolder: (reset) => invoke(IPC.exportPickFolder, { reset }),
  openExportFolder: (id) => invoke(IPC.exportOpenFolder, { id }),
  onExportQueueChanged: (listener) => subscribe(IPC_PUSH.exportQueueChanged, listener),
  getYoutubeMeta: () => invoke(IPC.youtubeMeta, null),
  generateYoutubeMeta: () => invoke(IPC.youtubeMetaGenerate, null),
  copyText: (text) => invoke(IPC.copyText, { text }),
  getChatState: () => invoke(IPC.chatState, null),
  sendChat: (request) => invoke(IPC.chatSend, request),
  removeQueuedChat: (turnId) => invoke(IPC.chatRemove, { turnId }),
  stopChat: () => invoke(IPC.chatStop, null),
  resumeChat: () => invoke(IPC.chatResume, null),
  resumeChatTurn: (turnId) => invoke(IPC.chatResumeTurn, { turnId }),
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
  importVoiceover: () => invoke(IPC.voiceoverImport, null),
  saveRecording: (wav) => invoke(IPC.voiceoverRecording, { wav }),
  armMicrophone: () => invoke(IPC.micArm, null),
  getStageReports: () => invoke(IPC.stagesReports, null),
  retryWords: (model) => invoke(IPC.wordsRetry, { model }),
  runScenes: (action, shots) =>
    invoke(IPC.scenesRun, { action, shots: shots === null ? null : [...shots] }),
  lockShots: (shotIds, locked) => invoke(IPC.shotsLock, { shotIds: [...shotIds], locked }),
  getVariantsState: () => invoke(IPC.variantsState, null),
  estimateVariants: (count) => invoke(IPC.variantsEstimate, { count }),
  runVariants: (shotId, op) => invoke(IPC.variantsRun, { shotId, op }),
  getVariantClip: (shotId, key) => invoke(IPC.variantsClip, { shotId, key }),
  getVariantManifest: (shotId, key) => invoke(IPC.variantsManifest, { shotId, key }),
  getSoundState: () => invoke(IPC.soundState, null),
  importSounds: (kind) => invoke(IPC.soundImport, { kind }),
  previewSound: (sound) => invoke(IPC.soundPreview, { sound }),
  setMix: (patch) => invoke(IPC.soundSetMix, patch),
  runSound: (action) => invoke(IPC.soundRun, { action }),
  renderMixPreview: (t) => invoke(IPC.mixPreview, { t }),
  openExampleProject: () => invoke(IPC.projectOpenExample, null),
  openHelpTarget: (target) => invoke(IPC.helpOpen, { target }),
  getProjectSettings: () => invoke(IPC.projectSettingsGet, null),
  updateProjectSettings: (patch) => invoke(IPC.projectSettingsUpdate, patch),
  saveTension: (request) => invoke(IPC.tensionSave, request),
  resetTension: () => invoke(IPC.tensionReset, null),
  proposeTension: () => invoke(IPC.tensionPropose, null),
  getDramaturgy: () => invoke(IPC.dramaturgyState, null),
  decideMoment: (request) => invoke(IPC.momentDecide, request),
  getDirections: () => invoke(IPC.directionsState, null),
  applyDirection: (request) => invoke(IPC.directionApply, request),
  getEditing: () => invoke(IPC.editingState, null),
  actOnRepetition: (request) => invoke(IPC.repetitionAction, request),
  getAssetsState: () => invoke(IPC.assetsState, null),
  reviewAssets: (request) => invoke(IPC.assetsReview, request),
  getPublishKit: () => invoke(IPC.publishKit, null),
  savePublishKit: () => invoke(IPC.publishSave, null),
  openPublishFolder: () => invoke(IPC.publishOpenFolder, null),
  getClaimsState: () => invoke(IPC.claimsState, null),
  checkSources: () => invoke(IPC.claimsCheck, null),
  editClaim: (request) => invoke(IPC.claimsEdit, request),
  getHookLab: () => invoke(IPC.hookLabState, null),
  generateHooks: () => invoke(IPC.hookLabGenerate, null),
  pickHook: (request) => invoke(IPC.hookLabPick, request),
  discardHooks: (number) => invoke(IPC.hookLabDiscard, { number }),
  getTasteState: () => invoke(IPC.tasteState, null),
  resetTaste: () => invoke(IPC.tasteReset, null),
  exportTaste: () => invoke(IPC.tasteExport, null),
  listChannels: () => invoke(IPC.channelsList, null),
  createChannel: (input) => invoke(IPC.channelsCreate, input),
  updateChannel: (id, patch) => invoke(IPC.channelsUpdate, { id, patch }),
  deleteChannel: (id) => invoke(IPC.channelsDelete, { id }),
  reorderChannels: (ids) => invoke(IPC.channelsReorder, { ids: [...ids] }),
  setChannelSecret: (request) => invoke(IPC.channelSecretsSet, request),
  hasChannelSecret: (request) => invoke(IPC.channelSecretsHas, request),
  deleteChannelSecret: (request) => invoke(IPC.channelSecretsDelete, request),
  getVoiceState: () => invoke(IPC.voiceListSentences, null),
  estimateVoice: () => invoke(IPC.voiceEstimate, null),
  generateVoice: () => invoke(IPC.voiceGenerate, null),
  cancelVoice: () => invoke(IPC.voiceCancel, null),
  retakeSentence: (sentenceId) => invoke(IPC.voiceRetake, { sentenceId }),
  testVoiceKey: (channelId) => invoke(IPC.voiceTestKey, { channelId }),
  onVoiceProgress: (listener) => subscribe(IPC_PUSH.voiceProgress, listener),
  importAssets: (request) => invoke(IPC.assetsImport, request),
  editAsset: (request) => invoke(IPC.assetsEdit, request),
  removeAsset: (id) => invoke(IPC.assetsRemove, { id }),
  setAssetInLibrary: (request) => invoke(IPC.assetsLibrary, request),
  droppedFilePaths: (files) => files.map((file) => webUtils.getPathForFile(file)),
  getLibraryState: (query) => invoke(IPC.libraryState, query),
  editLibraryEntry: (request) => invoke(IPC.libraryEdit, request),
  removeLibraryEntry: (sha256) => invoke(IPC.libraryRemove, { sha256 }),
  useLibraryEntry: (sha256) => invoke(IPC.libraryUse, { sha256 }),
  getQueueState: () => invoke(IPC.queueState, null),
  addQueueTopics: (channelId, topics) =>
    invoke(IPC.queueAddTopics, {
      channelId,
      topics: topics.map((topic) =>
        topic.targetMinutes === undefined
          ? { topic: topic.topic }
          : { topic: topic.topic, targetMinutes: topic.targetMinutes },
      ),
    }),
  removeQueueItem: (ref) => invoke(IPC.queueRemove, refOf(ref)),
  moveQueueItem: (ref, index) => invoke(IPC.queueMove, { ...refOf(ref), index }),
  holdQueueItem: (ref) => invoke(IPC.queueHold, refOf(ref)),
  resumeQueueItem: (ref) => invoke(IPC.queueResume, refOf(ref)),
  retryQueueItem: (ref) => invoke(IPC.queueRetry, refOf(ref)),
  setQueueOptions: (channelId, patch) => invoke(IPC.queueSetOptions, { channelId, patch }),
  startLine: (runUntil) => invoke(IPC.queueStart, { runUntil }),
  stopLine: () => invoke(IPC.queueStop, null),
  approveQueueScript: (ref) => invoke(IPC.queueApproveScript, refOf(ref)),
  openQueueProject: (ref, panel) => invoke(IPC.queueOpenProject, { ...refOf(ref), panel }),
  openQueueFolder: (ref, folder) => invoke(IPC.queueOpenFolder, { ...refOf(ref), folder }),
  markQueueReviewed: (ref) => invoke(IPC.queueMarkReviewed, refOf(ref)),
  wakeLine: () => invoke(IPC.queueWake, null),
  updateLinePrefs: (patch) => invoke(IPC.queuePrefs, patch),
  onQueueChanged: (listener) => subscribe(IPC_PUSH.queueChanged, listener),
  onQueueShowItem: (listener) => subscribe(IPC_PUSH.queueShowItem, listener),
  log: (entry) => {
    ipcRenderer.send(IPC_EVENTS.log.name, entry);
  },
};

contextBridge.exposeInMainWorld(API_GLOBAL, api);
