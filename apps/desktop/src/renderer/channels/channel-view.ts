/**
 * Words and pure logic of Channels in the UI (PLAN.md#13.13, ADR-031): Settings → Channels (list,
 * detail form, voice sliders, API key row), the New project form's channel choice, the header and
 * the recent list. No React, no IPC.
 */
import { MAX_CHANNELS, type ChannelPublishDefaults, type ChannelVoice } from '@reelforge/shared';
import type {
  ChannelErrorInfo,
  ChannelView,
  SecretErrorKind,
} from '../../shared/channels-contract.js';

/** Small fixed palette (readable on the dark theme); the first unused one goes to a new channel. */
export const CHANNEL_COLORS = [
  { value: '#ff8a3d', name: 'Orange' },
  { value: '#4fb3ff', name: 'Blue' },
  { value: '#7ee2a2', name: 'Green' },
  { value: '#f2c14e', name: 'Yellow' },
  { value: '#c792ea', name: 'Purple' },
  { value: '#ff6b8b', name: 'Pink' },
  { value: '#5ad1c8', name: 'Teal' },
  { value: '#a0a3b5', name: 'Grey' },
] as const;

export const MAX_CHANNEL_NAME_LENGTH = 80;

export const KEY_SAVED_TEXT = 'Key saved ✓';
export const NO_KEY_TEXT = 'No key';
export const KEY_HINT =
  'Stored encrypted on this computer, never in your project or git. It is never shown again after saving.';
export const DEFAULT_CHANNEL_NOTE =
  'The default channel: projects without a channel belong to it. It cannot be deleted.';
export const PROJECT_CHANNEL_NOTE =
  'A project stays in the channel it was created in. Moving projects between channels comes later.';
export const APP_DEFAULT_STYLE_LABEL = 'Same as Settings → Projects';

type NamedChannel = Pick<ChannelView, 'id' | 'name'>;

/** The first palette color no channel uses; the palette repeats when all are taken. */
export function nextChannelColor(channels: readonly Pick<ChannelView, 'color'>[]): string {
  const used = new Set(channels.map((channel) => channel.color?.toLowerCase()));
  const free = CHANNEL_COLORS.find((color) => !used.has(color.value));
  const fallback = CHANNEL_COLORS[channels.length % CHANNEL_COLORS.length] ?? CHANNEL_COLORS[0];
  return (free ?? fallback).value;
}

export type NameCheck =
  { readonly ok: true; readonly name: string } | { readonly ok: false; readonly message: string };

/** A channel name: not empty, ≤ 80 characters, not the name of another channel. */
export function checkChannelName(
  text: string,
  channels: readonly NamedChannel[],
  selfId: string,
): NameCheck {
  const name = text.trim();
  if (name === '') return { ok: false, message: 'A channel needs a name.' };
  if (name.length > MAX_CHANNEL_NAME_LENGTH) {
    return {
      ok: false,
      message: `Keep the name under ${String(MAX_CHANNEL_NAME_LENGTH)} characters.`,
    };
  }
  const clash = channels.some(
    (channel) => channel.id !== selfId && channel.name.trim().toLowerCase() === name.toLowerCase(),
  );
  return clash
    ? { ok: false, message: 'Another channel already has this name.' }
    : { ok: true, name };
}

/** The letter(s) in the channel's badge: its avatar, else the first letter of its name. */
export function channelInitial(channel: Pick<ChannelView, 'name' | 'avatar'>): string {
  if (channel.avatar !== undefined) return channel.avatar;
  const first = new Intl.Segmenter().segment(channel.name.trim())[Symbol.iterator]().next();
  return first.done === true ? '?' : first.value.segment.toUpperCase();
}

/** The ids with `id` moved one place up (-1) or down (+1); undefined when it cannot move. */
export function moveChannelIds(
  ids: readonly string[],
  id: string,
  delta: -1 | 1,
): string[] | undefined {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return undefined;
  const moved = [...ids];
  moved[from] = ids[to] ?? id;
  moved[to] = id;
  return moved;
}

// ---- Voice ----

export const DEFAULT_VOICE_MODEL = 'eleven_multilingual_v2';

/** ElevenLabs models for long voiceovers (docs/spikes/elevenlabs-api.md; deprecated ones left out). */
export const VOICE_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2: steadiest for long films (default)' },
  { id: 'eleven_v4', label: 'v4: newest, most expressive' },
  { id: 'eleven_v3', label: 'v3: expressive' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5: cheapest and fastest' },
  { id: 'eleven_flash_v2', label: 'Flash v2: fast, English only' },
] as const;

/** The model choices; a saved model this list does not know is kept as an extra choice. */
export function voiceModelChoices(
  saved: string | undefined,
): readonly { readonly id: string; readonly label: string }[] {
  if (saved === undefined || VOICE_MODELS.some((model) => model.id === saved)) return VOICE_MODELS;
  return [...VOICE_MODELS, { id: saved, label: `${saved} (saved earlier)` }];
}

export type VoiceSettingKey = 'stability' | 'similarity' | 'style' | 'speed';

export interface VoiceSlider {
  readonly key: VoiceSettingKey;
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** ElevenLabs' documented default. */
  readonly defaultValue: number;
  readonly unit: 'percent' | 'times';
}

/** Ranges inside the channel schema; speed uses the 0.7–1.2 range the vendor docs cite. */
export const VOICE_SLIDERS: readonly VoiceSlider[] = [
  {
    key: 'stability',
    label: 'Steadiness',
    hint: 'Low: livelier, more varied reading. High: calmer and more even.',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.5,
    unit: 'percent',
  },
  {
    key: 'similarity',
    label: 'Closeness to the voice',
    hint: 'How strictly the reading sticks to the original voice.',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.75,
    unit: 'percent',
  },
  {
    key: 'style',
    label: 'Extra drama',
    hint: 'Exaggerates the voice’s style. 0 is the steadiest.',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0,
    unit: 'percent',
  },
  {
    key: 'speed',
    label: 'Speed',
    hint: 'Reading pace. 1.00× is normal.',
    min: 0.7,
    max: 1.2,
    step: 0.01,
    defaultValue: 1,
    unit: 'times',
  },
];

/** Number of steps of the slider (its integer positions are 0…steps). */
export function sliderSteps(slider: VoiceSlider): number {
  return Math.round((slider.max - slider.min) / slider.step);
}

function clampPosition(slider: VoiceSlider, position: number): number {
  return Math.min(sliderSteps(slider), Math.max(0, Math.round(position)));
}

/** Integer position of `value` on the slider (clamped), so float steps never drift. */
export function sliderPosition(slider: VoiceSlider, value: number): number {
  return clampPosition(slider, (value - slider.min) / slider.step);
}

/** The value of an integer slider position (clamped), rounded to two decimals. */
export function sliderValue(slider: VoiceSlider, position: number): number {
  return Math.round((slider.min + clampPosition(slider, position) * slider.step) * 100) / 100;
}

export function formatVoiceValue(slider: VoiceSlider, value: number): string {
  return slider.unit === 'percent'
    ? `${String(Math.round(value * 100))} %`
    : `${value.toFixed(2)}×`;
}

/** The saved value of a voice setting, else its default. */
export function voiceSettingValue(voice: ChannelVoice | undefined, slider: VoiceSlider): number {
  return voice?.settings?.[slider.key] ?? slider.defaultValue;
}

export interface VoiceChange {
  /** '' removes the voice ID. */
  readonly voiceId?: string;
  readonly model?: string;
  readonly setting?: { readonly key: VoiceSettingKey; readonly value: number };
}

/** The whole voice object after a change (patches replace it as a whole). */
export function voiceWith(voice: ChannelVoice | undefined, change: VoiceChange): ChannelVoice {
  const voiceId = change.voiceId === undefined ? voice?.voiceId : change.voiceId.trim();
  const model = change.model ?? voice?.model;
  const settings =
    change.setting === undefined
      ? voice?.settings
      : { ...voice?.settings, [change.setting.key]: change.setting.value };
  return {
    provider: 'elevenlabs',
    ...(voiceId === undefined || voiceId === '' ? {} : { voiceId }),
    ...(model === undefined ? {} : { model }),
    ...(settings === undefined ? {} : { settings }),
  };
}

/** The voice with its settings back to ElevenLabs' defaults (voice ID and model kept). */
export function voiceWithoutSettings(voice: ChannelVoice | undefined): ChannelVoice {
  return {
    provider: 'elevenlabs',
    ...(voice?.voiceId === undefined ? {} : { voiceId: voice.voiceId }),
    ...(voice?.model === undefined ? {} : { model: voice.model }),
  };
}

// ---- Publishing defaults ----

export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 100;

/** Tags typed as `a, b, c` (commas or new lines): trimmed, no empties or duplicates, capped. */
export function tagsFromText(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH).trim();
    if (tag === '' || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags.slice(0, MAX_TAGS);
}

export function tagsText(tags: readonly string[] | undefined): string {
  return (tags ?? []).join(', ');
}

export interface PublishChange {
  readonly descriptionTemplate?: string;
  readonly tags?: readonly string[];
  readonly creditsStyle?: string;
}

/** Publishing defaults after a change; null when nothing is left (the patch clears them). */
export function publishWith(
  current: ChannelPublishDefaults | undefined,
  change: PublishChange,
): ChannelPublishDefaults | null {
  const description = change.descriptionTemplate ?? current?.descriptionTemplate ?? '';
  const tags = change.tags ?? current?.tags ?? [];
  const credits = (change.creditsStyle ?? current?.creditsStyle ?? '').trim();
  const next: ChannelPublishDefaults = {
    ...(description.trim() === '' ? {} : { descriptionTemplate: description }),
    ...(tags.length === 0 ? {} : { tags: [...tags] }),
    ...(credits === '' ? {} : { creditsStyle: credits }),
  };
  return Object.keys(next).length === 0 ? null : next;
}

// ---- Errors ----

function folderName(dir: string): string {
  const parts = dir.split(/[\\/]+/).filter((part) => part !== '');
  return parts.at(-1) ?? dir;
}

/** A failed channel call in plain words. */
export function channelErrorText(error: ChannelErrorInfo, channelName?: string): string {
  const name = channelName === undefined ? 'This channel' : `“${channelName}”`;
  switch (error.kind) {
    case 'not-found':
      return 'This channel no longer exists. The list was refreshed.';
    case 'invalid':
      return `That value cannot be saved: ${error.message}`;
    case 'corrupt':
      return `The channel list file is damaged, so channels cannot be changed: ${error.message}`;
    case 'unsupported-version':
      return 'The channel list was saved by a newer ReelForge. Update the app to change channels.';
    case 'default-channel':
      return 'The default channel cannot be deleted: projects without a channel belong to it.';
    case 'has-projects': {
      const projects = error.projects ?? [];
      const count = projects.length;
      const list = projects.map(folderName).join(', ');
      const what = count === 1 ? '1 project' : `${String(count)} projects`;
      return `${name} still has ${what}${list === '' ? '' : ` (${list})`}, so it cannot be deleted. Projects cannot move to another channel yet.`;
    }
    case 'limit':
      return `You can have up to ${String(MAX_CHANNELS)} channels.`;
    case 'io':
      return `The channel list could not be saved: ${error.message}`;
  }
}

/** A failed key call in plain words (never contains the key). */
export function secretErrorText(kind: SecretErrorKind): string {
  switch (kind) {
    case 'encryption-unavailable':
      return 'This computer cannot encrypt the key (no system key store), so it was not saved. Keys are never stored in plain text.';
    case 'not-found':
      return 'This channel no longer exists.';
    case 'corrupt':
      return 'The saved keys could not be read (they may come from another computer or user). Enter the key again.';
    case 'io':
      return 'The key could not be saved: a file in the app data folder could not be written.';
  }
}

// ---- Projects and the New project form ----

export interface ChannelList {
  readonly defaultChannelId: string;
  readonly channels: readonly ChannelView[];
}

/** The channel a project or recent entry belongs to (absent or unknown id = the default one). */
export function channelOf(
  list: ChannelList | undefined,
  channelId: string | undefined,
): ChannelView | undefined {
  if (list === undefined) return undefined;
  const byId = (id: string): ChannelView | undefined =>
    list.channels.find((channel) => channel.id === id);
  return (channelId === undefined ? undefined : byId(channelId)) ?? byId(list.defaultChannelId);
}

/** Channels are worth showing (header, recent dots, New project) once there is more than one. */
export function showChannels(list: ChannelList | undefined): list is ChannelList {
  return list !== undefined && list.channels.length > 1;
}

/** The New project form's channel: the one of the most recent project, else the default one. */
export function initialChannelId(
  list: ChannelList,
  recent: readonly { readonly channelId?: string | undefined }[],
): string {
  return channelOf(list, recent[0]?.channelId)?.id ?? list.defaultChannelId;
}

/** The New project form's default style: the channel's, else the one of Settings → Projects. */
export function channelDefaultStyle(
  channel: Pick<ChannelView, 'defaultStyle'> | undefined,
  settingsDefault: string | undefined,
): string | undefined {
  return channel?.defaultStyle ?? settingsDefault;
}
