/**
 * IPC payloads of Channels (PLAN.md#13.13, ADR-031): the dynamic channel list in
 * `<userData>/channels.json` and the per-channel secrets (the ElevenLabs API key) kept encrypted
 * by main. The renderer can SET or DELETE a secret and ask whether one is stored; it can never
 * read a value back: no response here carries one (secret responses are strict objects, so a
 * value slipped into them fails validation in preload). Merged into ipc-contract.ts.
 */
import {
  MAX_CHANNEL_SECRET_LENGTH,
  MAX_CHANNELS,
  channelIdSchema,
  channelInputSchema,
  channelPatchSchema,
  channelSchema,
  channelSecretNameSchema,
  type ChannelInput,
  type ChannelPatch,
  type ChannelSecretName,
} from '@reelforge/shared';
import { z } from 'zod';

/** Which secrets the channel has stored (booleans only). */
export const channelSecretFlagsSchema = z.strictObject({
  'elevenlabs-api-key': z.boolean(),
} satisfies Record<ChannelSecretName, z.ZodBoolean>);
export type ChannelSecretFlags = z.infer<typeof channelSecretFlagsSchema>;

export const channelViewSchema = channelSchema.extend({
  /** The channel projects without a channel belong to (cannot be deleted). */
  isDefault: z.boolean(),
  secrets: channelSecretFlagsSchema,
});
export type ChannelView = z.infer<typeof channelViewSchema>;

export const CHANNEL_ERROR_KINDS = [
  'not-found',
  'invalid',
  'corrupt',
  'unsupported-version',
  'default-channel',
  'has-projects',
  'limit',
  'io',
] as const;

export const channelErrorInfoSchema = z.object({
  kind: z.enum(CHANNEL_ERROR_KINDS),
  message: z.string(),
  /** `has-projects`: the project folders still in the channel. */
  projects: z.array(z.string()).optional(),
});
export type ChannelErrorInfo = z.infer<typeof channelErrorInfoSchema>;

/** Every channel call answers with the whole list (small), so the UI just re-renders it. */
export const channelsResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    defaultChannelId: channelIdSchema,
    channels: z.array(channelViewSchema).max(MAX_CHANNELS),
    /** The created / updated / deleted channel; null for list and reorder. */
    changedId: channelIdSchema.nullable(),
  }),
  z.object({ status: z.literal('error'), error: channelErrorInfoSchema }),
]);
export type ChannelsResult = z.infer<typeof channelsResultSchema>;

export const channelUpdateRequestSchema = z.strictObject({
  id: channelIdSchema,
  patch: channelPatchSchema,
});
export const channelIdRequestSchema = z.strictObject({ id: channelIdSchema });
export const channelReorderRequestSchema = z.strictObject({
  ids: z.array(channelIdSchema).min(1).max(MAX_CHANNELS),
});

export const channelSecretRequestSchema = z.strictObject({
  channelId: channelIdSchema,
  name: channelSecretNameSchema,
});
export type ChannelSecretRequest = z.infer<typeof channelSecretRequestSchema>;

export const channelSecretSetRequestSchema = channelSecretRequestSchema.extend({
  value: z.string().trim().min(1).max(MAX_CHANNEL_SECRET_LENGTH),
});
export type ChannelSecretSetRequest = z.infer<typeof channelSecretSetRequestSchema>;

export const SECRET_ERROR_KINDS = [
  /** The OS cannot encrypt (no keychain / DPAPI); nothing is stored in plain text. */
  'encryption-unavailable',
  'not-found',
  'corrupt',
  'io',
] as const;
export type SecretErrorKind = (typeof SECRET_ERROR_KINDS)[number];

/** Never carries the secret: `present` says whether one is stored. */
export const channelSecretResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok'), present: z.boolean() }),
  z.strictObject({
    status: z.literal('error'),
    kind: z.enum(SECRET_ERROR_KINDS),
    message: z.string(),
  }),
]);
export type ChannelSecretResult = z.infer<typeof channelSecretResultSchema>;

const noPayload = z.null();

export const CHANNELS_IPC = {
  channelsList: { name: 'channels:list', request: noPayload, response: channelsResultSchema },
  channelsCreate: {
    name: 'channels:create',
    request: channelInputSchema,
    response: channelsResultSchema,
  },
  channelsUpdate: {
    name: 'channels:update',
    request: channelUpdateRequestSchema,
    response: channelsResultSchema,
  },
  /** Refused for the default channel and for channels with projects (`has-projects`). */
  channelsDelete: {
    name: 'channels:delete',
    request: channelIdRequestSchema,
    response: channelsResultSchema,
  },
  channelsReorder: {
    name: 'channels:reorder',
    request: channelReorderRequestSchema,
    response: channelsResultSchema,
  },
  channelSecretsSet: {
    name: 'channel-secrets:set',
    request: channelSecretSetRequestSchema,
    response: channelSecretResultSchema,
  },
  channelSecretsHas: {
    name: 'channel-secrets:has',
    request: channelSecretRequestSchema,
    response: channelSecretResultSchema,
  },
  channelSecretsDelete: {
    name: 'channel-secrets:delete',
    request: channelSecretRequestSchema,
    response: channelSecretResultSchema,
  },
} as const;

export interface ChannelsApi {
  listChannels(): Promise<ChannelsResult>;
  createChannel(input: ChannelInput): Promise<ChannelsResult>;
  updateChannel(id: string, patch: ChannelPatch): Promise<ChannelsResult>;
  deleteChannel(id: string): Promise<ChannelsResult>;
  reorderChannels(ids: readonly string[]): Promise<ChannelsResult>;
  /** Stores (encrypted, in main) a channel secret; the value never comes back. */
  setChannelSecret(request: ChannelSecretSetRequest): Promise<ChannelSecretResult>;
  hasChannelSecret(request: ChannelSecretRequest): Promise<ChannelSecretResult>;
  deleteChannelSecret(request: ChannelSecretRequest): Promise<ChannelSecretResult>;
}
