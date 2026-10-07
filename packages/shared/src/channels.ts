/**
 * Channels (PLAN.md#13.13, ADR-031): `<app data>/channels.json`, a DYNAMIC list of the user's
 * YouTube channels (the number changes; never a fixed set). A channel carries what new projects of
 * that channel start with: default style/world, genre preset, ElevenLabs voice, publish defaults,
 * its own taste profile and a projects folder. Projects point at a channel with
 * `project.json#channelId`; absent = the default channel (projects made before 3.1 are unchanged).
 *
 * NO secrets here: API keys live encrypted (Electron safeStorage) in
 * `<app data>/channel-secrets.bin.json` (`channelSecretsFileSchema`), never in channels.json,
 * a project folder, a log or a commit.
 */
import { z } from 'zod';
import { stylePresetIdSchema } from './style-preset.js';
import { TASTE_PROFILE_FILE } from './taste-profile.js';

export const CHANNELS_FILE_VERSION = 1;
/** File name in the app data folder. */
export const CHANNELS_FILE = 'channels.json';
/** Id of the channel the first run creates; existing projects belong to it (no rewrite). */
export const DEFAULT_CHANNEL_ID = 'default';
export const DEFAULT_CHANNEL_NAME = 'Default';
export const MAX_CHANNELS = 50;
export const MAX_CHANNEL_ID_LENGTH = 48;

/** Stable kebab-case id (derived from the first name; never changes on rename). */
export const channelIdSchema = z
  .string()
  .max(MAX_CHANNEL_ID_LENGTH)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'channel ids are kebab-case, e.g. "voxplain"');
export type ChannelId = z.infer<typeof channelIdSchema>;

export const channelColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'colors are #rrggbb');

/** Voice providers a channel can use (13.14 generates voice-overs through it). */
export const VOICE_PROVIDERS = ['elevenlabs'] as const;

const unitSchema = z.number().min(0).max(1);

/**
 * Voice of the channel. Every field is optional until configured. Ranges are deliberately loose:
 * the vendor's exact limits are checked against its docs in 13.14 before they are enforced.
 */
export const channelVoiceSchema = z.strictObject({
  provider: z.enum(VOICE_PROVIDERS),
  voiceId: z.string().trim().min(1).max(128).optional(),
  /** Vendor model id, e.g. a multilingual model. */
  model: z.string().trim().min(1).max(128).optional(),
  settings: z
    .strictObject({
      stability: unitSchema.optional(),
      similarity: unitSchema.optional(),
      style: unitSchema.optional(),
      speed: z.number().min(0.25).max(4).optional(),
    })
    .optional(),
});
export type ChannelVoice = z.infer<typeof channelVoiceSchema>;

/** What the publish kit of the channel's projects starts with (PLAN.md#12.17). */
export const channelPublishDefaultsSchema = z.strictObject({
  /** Description skeleton; the publish kit fills in the film's parts. */
  descriptionTemplate: z.string().max(5_000).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  /** How credits are written (free text until 13.11 fixes a list). */
  creditsStyle: z.string().trim().min(1).max(64).optional(),
});
export type ChannelPublishDefaults = z.infer<typeof channelPublishDefaultsSchema>;

/** Taste profile id: `taste-<id>.json` in the app data folder. */
export const tasteProfileIdSchema = channelIdSchema;

/** Fields the user edits (create input = these; the store adds `id` and `createdAt`). */
const editableChannelShape = {
  name: z.string().trim().min(1).max(80),
  color: channelColorSchema.optional(),
  /** Avatar initial(s); absent = the name's first letter. */
  avatar: z.string().trim().min(1).max(4).optional(),
  /** Style / world id new projects of the channel start with; null = the app's default style. */
  defaultStyle: stylePresetIdSchema.nullable().optional(),
  /** Genre preset id (mapping comes with 13.8); null = none. */
  genrePreset: z.string().trim().min(1).max(64).nullable().optional(),
  voice: channelVoiceSchema.optional(),
  publishDefaults: channelPublishDefaultsSchema.optional(),
  /**
   * The channel's taste profile (`taste-<id>.json`); absent = the app-wide `taste.json` (what the
   * default channel keeps, so the profile learned before 3.1 stays in use).
   */
  tasteProfile: tasteProfileIdSchema.optional(),
  /** One profile per world of the channel (`taste-<id>--<style>.json`). Absent = off. */
  tastePerWorld: z.boolean().optional(),
  /** Folder new projects of the channel are suggested in (absolute); absent = ask. */
  projectsDir: z.string().min(1).max(4_096).optional(),
  notes: z.string().max(5_000).optional(),
};

export const channelSchema = z.object({
  id: channelIdSchema,
  ...editableChannelShape,
  defaultStyle: editableChannelShape.defaultStyle.unwrap().default(null),
  genrePreset: editableChannelShape.genrePreset.unwrap().default(null),
  createdAt: z.iso.datetime(),
});
export type Channel = z.output<typeof channelSchema>;

export const channelsFileSchema = z
  .object({
    version: z.literal(CHANNELS_FILE_VERSION),
    /** Projects without `channelId` (or with a channel that is gone) belong to this one. */
    defaultChannelId: channelIdSchema,
    /** In the user's order. */
    channels: z.array(channelSchema).min(1).max(MAX_CHANNELS),
  })
  .superRefine((file, context) => {
    const ids = new Set<string>();
    for (const [index, channel] of file.channels.entries()) {
      if (ids.has(channel.id)) {
        context.addIssue({
          code: 'custom',
          path: ['channels', index, 'id'],
          message: `duplicate channel id "${channel.id}"`,
        });
      }
      ids.add(channel.id);
    }
    if (!ids.has(file.defaultChannelId)) {
      context.addIssue({
        code: 'custom',
        path: ['defaultChannelId'],
        message: `default channel "${file.defaultChannelId}" is not in the list`,
      });
    }
  });
export type ChannelsFile = z.output<typeof channelsFileSchema>;

/**
 * A new channel: the editable fields (strict: unknown keys, ids and secrets are refused). No
 * defaults, so input and output types match (it is an IPC request too).
 */
export const channelInputSchema = z.strictObject(editableChannelShape);
export type ChannelInput = z.infer<typeof channelInputSchema>;

/**
 * A change: only the fields given; `null` clears an optional field. Nested objects (voice,
 * publish defaults) are replaced as a whole, not merged.
 */
export const channelPatchSchema = z.strictObject({
  name: editableChannelShape.name.optional(),
  color: channelColorSchema.nullable().optional(),
  avatar: z.string().trim().min(1).max(4).nullable().optional(),
  defaultStyle: stylePresetIdSchema.nullable().optional(),
  genrePreset: z.string().trim().min(1).max(64).nullable().optional(),
  voice: channelVoiceSchema.nullable().optional(),
  publishDefaults: channelPublishDefaultsSchema.nullable().optional(),
  tasteProfile: tasteProfileIdSchema.nullable().optional(),
  tastePerWorld: z.boolean().nullable().optional(),
  projectsDir: z.string().min(1).max(4_096).nullable().optional(),
  notes: z.string().max(5_000).nullable().optional(),
});
export type ChannelPatch = z.infer<typeof channelPatchSchema>;

/** Applies a patch (null = remove the field) and re-validates. */
export function applyChannelPatch(channel: Channel, patch: ChannelPatch): Channel {
  const nullable = new Set(['defaultStyle', 'genrePreset']);
  const changes = Object.entries(patch).filter(([, value]) => value !== undefined);
  const cleared = new Set(
    changes.filter(([key, value]) => value === null && !nullable.has(key)).map(([key]) => key),
  );
  const kept = Object.entries(channel).filter(([key]) => !cleared.has(key));
  const set = changes.filter(([key]) => !cleared.has(key));
  return channelSchema.parse(Object.fromEntries([...kept, ...set]));
}

/** The first run's channel: every existing project belongs to it. */
export function defaultChannelsFile(now: Date): ChannelsFile {
  return channelsFileSchema.parse({
    version: CHANNELS_FILE_VERSION,
    defaultChannelId: DEFAULT_CHANNEL_ID,
    channels: [
      { id: DEFAULT_CHANNEL_ID, name: DEFAULT_CHANNEL_NAME, createdAt: now.toISOString() },
    ],
  });
}

/**
 * `voxplain`, `voxplain-2`, …: a kebab slug of the name (diacritics dropped, `ł` → `l`), unique
 * among `taken`; `channel` when the name has no latin letters or digits.
 */
export function channelIdFromName(name: string, taken: ReadonlySet<string>): ChannelId {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_CHANNEL_ID_LENGTH - 4)
    .replace(/-+$/g, '');
  const base = slug === '' ? 'channel' : slug;
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${String(suffix)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type ChannelAssignment =
  /** project.json names this channel. */
  | 'explicit'
  /** No `channelId`: the default channel. */
  | 'default'
  /** `channelId` names a channel that no longer exists: the default channel. */
  | 'missing';

export interface ProjectChannel {
  readonly channel: Channel;
  readonly assignment: ChannelAssignment;
}

/** The channel a project belongs to (absent or unknown `channelId` = the default channel). */
export function channelForProject(
  channels: ChannelsFile,
  project: { readonly channelId?: string | undefined },
): ProjectChannel {
  const fallback = channels.channels.find((channel) => channel.id === channels.defaultChannelId);
  // channelsFileSchema guarantees the default channel is in the list.
  if (fallback === undefined) throw new Error('channels file without its default channel');
  if (project.channelId === undefined) return { channel: fallback, assignment: 'default' };
  const named = channels.channels.find((channel) => channel.id === project.channelId);
  return named === undefined
    ? { channel: fallback, assignment: 'missing' }
    : { channel: named, assignment: 'explicit' };
}

/**
 * File name (in the app data folder) of the taste profile a channel's project uses: the app-wide
 * `taste.json` without a channel profile; `taste-<id>.json`; with `tastePerWorld`, one per style
 * (`taste-<id>--<style>.json`).
 */
export function channelTasteProfileFile(
  channel: Pick<Channel, 'tasteProfile' | 'tastePerWorld'>,
  style?: string,
): string {
  if (channel.tasteProfile === undefined) return TASTE_PROFILE_FILE;
  const perWorld = channel.tastePerWorld === true && style !== undefined;
  return perWorld
    ? `taste-${channel.tasteProfile}--${stylePresetIdSchema.parse(style)}.json`
    : `taste-${channel.tasteProfile}.json`;
}

// ---- Secrets (separate file, ciphertext only) ----

export const CHANNEL_SECRETS_FILE_VERSION = 1;
/** File name in the app data folder; never inside a project, never committed. */
export const CHANNEL_SECRETS_FILE = 'channel-secrets.bin.json';

/** Named secrets a channel can hold. */
export const CHANNEL_SECRET_NAMES = ['elevenlabs-api-key'] as const;
export const channelSecretNameSchema = z.enum(CHANNEL_SECRET_NAMES);
export type ChannelSecretName = z.infer<typeof channelSecretNameSchema>;

/** Longest secret value accepted (API keys are far shorter). */
export const MAX_CHANNEL_SECRET_LENGTH = 4_096;

const base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'not base64');

/** `{ secrets: { <channel id>: { <secret name>: <base64 of the safeStorage ciphertext> } } }`. */
export const channelSecretsFileSchema = z.object({
  version: z.literal(CHANNEL_SECRETS_FILE_VERSION),
  secrets: z.record(channelIdSchema, z.partialRecord(channelSecretNameSchema, base64Schema)),
});
export type ChannelSecretsFile = z.infer<typeof channelSecretsFileSchema>;
