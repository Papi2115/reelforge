/**
 * The production line's voice (PLAN.md#13.9, #13.14): a channel with an ElevenLabs voice and a
 * saved key generates its films' voiceovers; without them the film waits ("Voice needed") for a
 * recording or a file. Generation is the app's own (VoiceService: the channel key in main only,
 * resumable takes, the API word times committed); the line's VoiceService instance hands the
 * assembled file back here instead of queueing an import, because the line's executor imports it
 * through the Voiceover step itself.
 */
import { err, ok } from '@reelforge/claude-bridge';
import { loadChannels } from '@reelforge/project';
import type { VoiceProvider } from '@reelforge/stages';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import type { ChannelSecretStore } from '../channels/channel-secrets.js';
import { projectKey } from '../stages/stage-service.js';
import { KEY_NAME } from '../voice/voice-access.js';
import type { VoiceService } from '../voice/voice-service.js';
import { voiceIdOf } from '../voice/voice-settings.js';

/** Does the channel generate its voiceovers (a voice chosen and a key saved)? No network. */
export async function channelVoiceReady(
  channelsFile: string,
  secrets: Pick<ChannelSecretStore, 'has'>,
  channelId: string,
): Promise<boolean> {
  const channels = await loadChannels(channelsFile);
  if (!channels.ok) return false;
  const channel = channels.value.channels.find((candidate) => candidate.id === channelId);
  if (voiceIdOf(channel?.voice) === undefined) return false;
  const has = await secrets.has(channelId, KEY_NAME);
  return has.ok && has.value;
}

/** Keeps the file a finished generation would import, per project, until the line takes it. */
export class GeneratedVoices {
  private readonly files = new Map<string, string>();

  /** VoiceServiceOptions.importVoiceover of the line's VoiceService. */
  readonly importVoiceover = (dir: string, file: string): Promise<StageCommandResult> => {
    this.files.set(projectKey(dir), file);
    return Promise.resolve({ status: 'queued', message: null });
  };

  take(dir: string): string | undefined {
    const key = projectKey(dir);
    const file = this.files.get(key);
    this.files.delete(key);
    return file;
  }
}

export interface LineVoiceOptions {
  /** The line's own VoiceService (its import goes to `voices`). */
  readonly service: Pick<VoiceService, 'generate' | 'cancel'>;
  readonly voices: GeneratedVoices;
}

export function lineVoiceProvider(options: LineVoiceOptions): VoiceProvider {
  return {
    generate: async ({ projectDir, signal }) => {
      if (signal.aborted) return err({ kind: 'cancelled', message: 'stopped' });
      const cancel = (): void => {
        options.service.cancel();
      };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        options.voices.take(projectDir);
        const result = await options.service.generate(projectDir);
        if (result.status === 'cancelled')
          return err({ kind: 'cancelled', message: result.message });
        if (result.status === 'error') return err({ kind: 'failed', message: result.message });
        const file = options.voices.take(projectDir);
        return file === undefined
          ? err({ kind: 'failed', message: 'the generated voiceover file is missing' })
          : ok({ file });
      } finally {
        signal.removeEventListener('abort', cancel);
      }
    },
  };
}
