/**
 * Registers the typed IPC channels (src/shared/ipc-contract.ts) on `ipcMain`. Requests are
 * validated with zod and accepted only from frames of the renderer origin; responses are
 * validated again in preload. Structural `IpcMainLike` keeps this testable without Electron.
 */
import type { z } from 'zod';
import {
  IPC,
  IPC_EVENTS,
  type InvokeChannel,
  type InvokeChannelKey,
  type RendererLogEntry,
  type RequestOf,
  type ResponseOf,
} from '../shared/ipc-contract.js';
import type { Logger } from './logger.js';

export interface IpcSenderEvent {
  readonly senderFrame: { readonly url: string } | null;
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: IpcSenderEvent, payload: unknown) => unknown): void;
  on(channel: string, listener: (event: IpcSenderEvent, payload: unknown) => void): void;
}

export type InvokeHandlers = {
  readonly [Key in InvokeChannelKey]: (request: RequestOf<Key>) => Promise<ResponseOf<Key>>;
};

export interface IpcRouterOptions {
  readonly handlers: InvokeHandlers;
  /** Renderer log entries (`window.reelforge.log`). */
  readonly onRendererLog: (entry: RendererLogEntry) => void;
  /** True for frames allowed to call main (the app window's renderer origin). */
  readonly isTrustedSender: (frameUrl: string) => boolean;
  readonly log: Logger;
}

function senderUrl(event: IpcSenderEvent): string {
  return event.senderFrame?.url ?? '<destroyed frame>';
}

export function registerIpc(ipcMain: IpcMainLike, options: IpcRouterOptions): void {
  const { handlers, isTrustedSender, log } = options;

  function registerInvoke<Request extends z.ZodType, Response extends z.ZodType>(
    channel: InvokeChannel<Request, Response>,
    handler: (request: z.infer<Request>) => Promise<z.infer<Response>>,
  ): void {
    ipcMain.handle(channel.name, async (event, payload) => {
      const from = senderUrl(event);
      if (!isTrustedSender(from)) {
        log.warn(`refused ${channel.name} from untrusted frame ${from}`);
        throw new Error(`${channel.name}: untrusted sender`);
      }
      const request = channel.request.safeParse(payload);
      if (!request.success) {
        log.warn(`invalid ${channel.name} request: ${request.error.message}`);
        throw new Error(`${channel.name}: invalid request`);
      }
      return handler(request.data);
    });
  }

  // One line per channel; ipc-router.test.ts checks that every channel of IPC is registered.
  registerInvoke(IPC.appInfo, handlers.appInfo);
  registerInvoke(IPC.demoManifest, handlers.demoManifest);
  registerInvoke(IPC.projectNew, handlers.projectNew);
  registerInvoke(IPC.projectOpen, handlers.projectOpen);
  registerInvoke(IPC.projectOpenRecent, handlers.projectOpenRecent);
  registerInvoke(IPC.projectRecent, handlers.projectRecent);
  registerInvoke(IPC.projectCurrent, handlers.projectCurrent);
  registerInvoke(IPC.projectClose, handlers.projectClose);
  registerInvoke(IPC.projectHistory, handlers.projectHistory);
  registerInvoke(IPC.projectRevert, handlers.projectRevert);
  registerInvoke(IPC.projectSnapshot, handlers.projectSnapshot);
  registerInvoke(IPC.projectManifest, handlers.projectManifest);
  registerInvoke(IPC.projectRepairFile, handlers.projectRepairFile);
  registerInvoke(IPC.projectRestoreFailedOpen, handlers.projectRestoreFailedOpen);
  registerInvoke(IPC.snapshotSave, handlers.snapshotSave);
  registerInvoke(IPC.snapshotCopy, handlers.snapshotCopy);
  registerInvoke(IPC.timelineEdit, handlers.timelineEdit);
  registerInvoke(IPC.timelineWaveform, handlers.timelineWaveform);
  registerInvoke(IPC.settingsGet, handlers.settingsGet);
  registerInvoke(IPC.settingsUpdate, handlers.settingsUpdate);
  registerInvoke(IPC.claudeStatus, handlers.claudeStatus);
  registerInvoke(IPC.claudeOpenLogin, handlers.claudeOpenLogin);
  registerInvoke(IPC.toolsStatus, handlers.toolsStatus);
  registerInvoke(IPC.toolsBrowse, handlers.toolsBrowse);
  registerInvoke(IPC.toolsReset, handlers.toolsReset);
  registerInvoke(IPC.whisperState, handlers.whisperState);
  registerInvoke(IPC.whisperInstall, handlers.whisperInstall);
  registerInvoke(IPC.whisperCancel, handlers.whisperCancel);
  registerInvoke(IPC.whisperDelete, handlers.whisperDelete);
  registerInvoke(IPC.whisperUseExisting, handlers.whisperUseExisting);
  registerInvoke(IPC.exportStart, handlers.exportStart);
  registerInvoke(IPC.exportCancel, handlers.exportCancel);
  registerInvoke(IPC.exportOptions, handlers.exportOptions);
  registerInvoke(IPC.exportQueue, handlers.exportQueue);
  registerInvoke(IPC.exportEnqueue, handlers.exportEnqueue);
  registerInvoke(IPC.exportCancelJob, handlers.exportCancelJob);
  registerInvoke(IPC.exportResumeJob, handlers.exportResumeJob);
  registerInvoke(IPC.exportResumeInterrupted, handlers.exportResumeInterrupted);
  registerInvoke(IPC.exportTestEncoder, handlers.exportTestEncoder);
  registerInvoke(IPC.exportPickFolder, handlers.exportPickFolder);
  registerInvoke(IPC.exportOpenFolder, handlers.exportOpenFolder);
  registerInvoke(IPC.youtubeMeta, handlers.youtubeMeta);
  registerInvoke(IPC.youtubeMetaGenerate, handlers.youtubeMetaGenerate);
  registerInvoke(IPC.copyText, handlers.copyText);
  registerInvoke(IPC.chatState, handlers.chatState);
  registerInvoke(IPC.chatSend, handlers.chatSend);
  registerInvoke(IPC.chatRemove, handlers.chatRemove);
  registerInvoke(IPC.chatStop, handlers.chatStop);
  registerInvoke(IPC.chatResume, handlers.chatResume);
  registerInvoke(IPC.chatResumeTurn, handlers.chatResumeTurn);
  registerInvoke(IPC.stagesState, handlers.stagesState);
  registerInvoke(IPC.stagesRun, handlers.stagesRun);
  registerInvoke(IPC.stagesStop, handlers.stagesStop);
  registerInvoke(IPC.stagesReplace, handlers.stagesReplace);
  registerInvoke(IPC.stagesOpen, handlers.stagesOpen);
  registerInvoke(IPC.briefGet, handlers.briefGet);
  registerInvoke(IPC.briefSave, handlers.briefSave);
  registerInvoke(IPC.scriptGet, handlers.scriptGet);
  registerInvoke(IPC.scriptSave, handlers.scriptSave);
  registerInvoke(IPC.scriptApprove, handlers.scriptApprove);
  registerInvoke(IPC.voiceoverImport, handlers.voiceoverImport);
  registerInvoke(IPC.voiceoverRecording, handlers.voiceoverRecording);
  registerInvoke(IPC.micArm, handlers.micArm);
  registerInvoke(IPC.stagesReports, handlers.stagesReports);
  registerInvoke(IPC.wordsRetry, handlers.wordsRetry);
  registerInvoke(IPC.scenesRun, handlers.scenesRun);
  registerInvoke(IPC.shotsLock, handlers.shotsLock);
  registerInvoke(IPC.variantsState, handlers.variantsState);
  registerInvoke(IPC.variantsEstimate, handlers.variantsEstimate);
  registerInvoke(IPC.variantsRun, handlers.variantsRun);
  registerInvoke(IPC.variantsClip, handlers.variantsClip);
  registerInvoke(IPC.variantsManifest, handlers.variantsManifest);
  registerInvoke(IPC.soundState, handlers.soundState);
  registerInvoke(IPC.soundImport, handlers.soundImport);
  registerInvoke(IPC.soundPreview, handlers.soundPreview);
  registerInvoke(IPC.soundSetMix, handlers.soundSetMix);
  registerInvoke(IPC.soundRun, handlers.soundRun);
  registerInvoke(IPC.mixPreview, handlers.mixPreview);
  registerInvoke(IPC.projectOpenExample, handlers.projectOpenExample);
  registerInvoke(IPC.helpOpen, handlers.helpOpen);

  const logChannel = IPC_EVENTS.log;
  ipcMain.on(logChannel.name, (event, payload) => {
    const from = senderUrl(event);
    if (!isTrustedSender(from)) {
      log.warn(`dropped ${logChannel.name} from untrusted frame ${from}`);
      return;
    }
    const entry = logChannel.payload.safeParse(payload);
    if (!entry.success) {
      log.warn(`invalid ${logChannel.name} payload: ${entry.error.message}`);
      return;
    }
    options.onRendererLog(entry.data);
  });
}
