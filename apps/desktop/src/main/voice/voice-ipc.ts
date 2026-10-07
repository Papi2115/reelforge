/**
 * IPC handlers of ElevenLabs voice generation (PLAN.md#13.14), merged into `registerIpc` by
 * main.ts. Every call works on the open project; no response carries the API key.
 */
import type { InvokeHandlers } from '../ipc-router.js';
import type { VoiceService } from './voice-service.js';

export type VoiceHandlers = Pick<
  InvokeHandlers,
  | 'voiceListSentences'
  | 'voiceEstimate'
  | 'voiceGenerate'
  | 'voiceCancel'
  | 'voiceRetake'
  | 'voiceTestKey'
>;

export function voiceHandlers(
  service: VoiceService,
  currentProject: () => string | undefined,
): VoiceHandlers {
  return {
    voiceListSentences: () => service.state(currentProject()),
    voiceEstimate: () => service.estimate(currentProject()),
    voiceGenerate: () => service.generate(currentProject()),
    voiceCancel: () => Promise.resolve(service.cancel()),
    voiceRetake: (request) => service.retake(currentProject(), request.sentenceId),
    voiceTestKey: (request) => service.testKey(request.channelId),
  };
}
