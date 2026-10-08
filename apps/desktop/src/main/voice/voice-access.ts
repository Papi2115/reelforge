/**
 * Who may call ElevenLabs for a project (PLAN.md#13.14, CLAUDE.md §3.4 exception: only the main
 * process, only with the project's channel key): the channel's voice, its key from the encrypted
 * secret store, the approved script. The key is read here, handed straight to the client (a
 * private field) and never logged, pushed or returned.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  ElevenLabsClient,
  type FetchLike,
  type RetryPolicy,
  type VoiceClientEvent,
} from '@reelforge/pipeline';
import type { Channel } from '@reelforge/shared';
import type { VoiceProblem, VoiceSetup } from '../../shared/voice-contract.js';
import type { ChannelSecretStore } from '../channels/channel-secrets.js';
import { APPROVAL_REASON } from '../stages/stage-state.js';
import { NO_KEY_MESSAGE, NO_VOICE_MESSAGE, problem } from './voice-errors.js';
import type { VoiceProject } from './voice-project.js';
import { voiceIdOf, voiceModelOf } from './voice-settings.js';

export const KEY_NAME = 'elevenlabs-api-key';

export interface ClientFactoryOptions {
  /** Test hook: a local fake server instead of api.elevenlabs.io. */
  readonly baseUrl?: string | undefined;
  readonly fetch?: FetchLike | undefined;
  readonly retry?: Partial<RetryPolicy> | undefined;
}

export function createClient(
  apiKey: string,
  options: ClientFactoryOptions,
  onEvent?: (event: VoiceClientEvent) => void,
  retry?: Partial<RetryPolicy>,
): ElevenLabsClient {
  const policy = { ...options.retry, ...retry };
  return new ElevenLabsClient({
    apiKey,
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    retry: policy,
    ...(onEvent === undefined ? {} : { onEvent }),
  });
}

/** The channel's key (main only); `no-key` when none is stored. */
export async function channelKey(
  secrets: Pick<ChannelSecretStore, 'get'>,
  channelId: string,
): Promise<Result<string, VoiceProblem>> {
  const stored = await secrets.get(channelId, KEY_NAME);
  if (!stored.ok) {
    return err(
      problem('failed', `The saved ElevenLabs key cannot be read: ${stored.error.message}`),
    );
  }
  return stored.value === undefined ? err(problem('no-key', NO_KEY_MESSAGE)) : ok(stored.value);
}

/** Setup line of the panel (no network): voice chosen + key saved for the project's channel. */
export async function voiceSetup(
  project: VoiceProject,
  secrets: Pick<ChannelSecretStore, 'has'>,
): Promise<VoiceSetup> {
  const { channel } = project;
  if (channel === null) {
    return {
      status: 'unavailable',
      message: `Channels cannot be read: ${project.channelProblem ?? 'unknown error'}`,
    };
  }
  const has = await secrets.has(channel.id, KEY_NAME);
  const voiceId = voiceIdOf(channel.voice);
  const missing: ('voice' | 'key')[] = [
    ...(voiceId === undefined ? (['voice'] as const) : []),
    ...(has.ok && has.value ? [] : (['key'] as const)),
  ];
  if (voiceId === undefined || missing.length > 0) {
    return { status: 'missing', channelId: channel.id, channelName: channel.name, missing };
  }
  return {
    status: 'ready',
    channelId: channel.id,
    channelName: channel.name,
    voiceId,
    model: voiceModelOf(channel.voice),
  };
}

export interface VoiceAccess {
  readonly channel: Channel;
  readonly voiceId: string;
  readonly key: string;
  readonly scriptText: string;
}

/** Everything a request needs, or the first thing missing in plain words. */
export async function voiceAccess(
  project: VoiceProject,
  secrets: Pick<ChannelSecretStore, 'get'>,
): Promise<Result<VoiceAccess, VoiceProblem>> {
  const { channel } = project;
  if (channel === null) {
    return err(problem('failed', `Channels cannot be read: ${project.channelProblem ?? ''}`));
  }
  const voiceId = voiceIdOf(channel.voice);
  if (voiceId === undefined) return err(problem('no-voice', NO_VOICE_MESSAGE));
  if (project.scriptText === null || project.scriptText.trim() === '') {
    return err(problem('not-approved', 'Write and approve the script first.'));
  }
  if (!project.approved) return err(problem('not-approved', APPROVAL_REASON));
  if (project.manifestProblem !== null) {
    return err(problem('failed', `audio/takes/takes.json is damaged: ${project.manifestProblem}`));
  }
  const key = await channelKey(secrets, channel.id);
  if (!key.ok) return key;
  return ok({ channel, voiceId, key: key.value, scriptText: project.scriptText });
}
