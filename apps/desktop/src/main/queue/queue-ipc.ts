/**
 * IPC handlers of the production line (PLAN.md#13.9), merged into `registerIpc` by main.ts, and
 * the hook that tells the line about decisions made in the app itself (an approved script, an
 * imported or generated voiceover, a reviewed asset package, a channel's voice or key saved), so a
 * waiting film goes on without a click in the Production line dialog; a changed channel list
 * reaches the dialog's tabs.
 */
import { IPC } from '../../shared/ipc-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { QueueService } from './queue-service.js';

export type QueueHandlers = Pick<
  InvokeHandlers,
  | 'queueState'
  | 'queueAddTopics'
  | 'queueRemove'
  | 'queueMove'
  | 'queueHold'
  | 'queueResume'
  | 'queueRetry'
  | 'queueSetOptions'
  | 'queueStart'
  | 'queueStop'
  | 'queueApproveScript'
  | 'queueOpenProject'
  | 'queueOpenFolder'
  | 'queueMarkReviewed'
  | 'queueWake'
  | 'queuePrefs'
>;

export function queueHandlers(service: QueueService): QueueHandlers {
  return {
    queueState: () => service.state(),
    queueAddTopics: (request) => service.addTopics(request.channelId, request.topics),
    queueRemove: (ref) => service.remove(ref),
    queueMove: (request) => service.move(request, request.index),
    queueHold: (ref) => service.hold(ref),
    queueResume: (ref) => service.resume(ref),
    queueRetry: (ref) => service.retry(ref),
    queueSetOptions: (request) => service.setOptions(request.channelId, request.patch),
    queueStart: (request) => Promise.resolve(service.start(request.runUntil)),
    queueStop: () => service.stop(),
    queueApproveScript: (ref) => service.approveScript(ref),
    queueOpenProject: (request) => service.openProject(request),
    queueOpenFolder: (request) => service.openFolder(request, request.folder),
    queueMarkReviewed: (ref) => service.markReviewed(ref),
    queueWake: () => Promise.resolve(service.wake()),
    queuePrefs: (patch) => service.updatePrefs(patch),
  };
}

/**
 * Channels whose answer may open a waiting film's gate: the app's own approval, a voiceover
 * imported, recorded or generated, a reviewed asset package, a channel's voice or key saved (and
 * a changed channel list, which the dialog's tabs show).
 */
export const LINE_GATE_CHANNELS: ReadonlySet<string> = new Set(
  [
    IPC.scriptApprove,
    IPC.voiceoverImport,
    IPC.voiceoverRecording,
    IPC.voiceGenerate,
    IPC.assetsReview,
    IPC.channelsCreate,
    IPC.channelsUpdate,
    IPC.channelsDelete,
    IPC.channelsReorder,
    IPC.channelSecretsSet,
  ].map((channel) => channel.name),
);
