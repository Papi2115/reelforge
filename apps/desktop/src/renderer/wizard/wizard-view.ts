/**
 * The New project wizard (PLAN.md#13.16): four steps (Topic → Channel and genre → Style → Voice and
 * create), what each step needs before Next, the brief it saves, the voice choices of the channel
 * and the review lines. The genre / style / scenes-per-minute rules are the old form's
 * (project/genre-view.ts). Pure: no React, no IPC.
 */
import type { ChannelView } from '../../shared/channels-contract.js';
import { styleLabel } from '../../shared/style-choices.js';
import type { BriefInput } from '../../shared/stages-contract.js';
import { checkChannelName } from '../channels/channel-view.js';
import { GENRE_NONE_LABEL, genreLabel } from '../project/genre-view.js';

export const WIZARD_STEPS = ['topic', 'channel', 'style', 'voice'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WIZARD_STEP_TITLES: Readonly<Record<WizardStep, string>> = {
  topic: 'Topic',
  channel: 'Channel and genre',
  style: 'Style',
  voice: 'Voice and create',
};

/** The brief's default length, as the Script step's brief form. */
export const DEFAULT_MINUTES = '8';
export const MIN_MINUTES = 0.5;
export const MAX_MINUTES = 60;

export const ENGLISH_NOTE =
  'Films are made in English (another language: More options in the last step).';
export const ABOUT_HINT =
  'A few sentences for the script: the angle, what must be in it, who it is for. Empty = the title is the brief.';

/** The channel the project goes to: one of the list, or a new one made when it is created. */
export type ChannelChoice =
  | { readonly kind: 'existing'; readonly id: string }
  | { readonly kind: 'new'; readonly name: string };

export type VoicePlan = 'generate' | 'record' | 'later';

export interface WizardDraft {
  readonly title: string;
  readonly about: string;
  readonly minutes: string;
  readonly channel: ChannelChoice | undefined;
}

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

/** The step after / before `step`; undefined at the ends. */
export function nextWizardStep(step: WizardStep, delta: 1 | -1): WizardStep | undefined {
  return WIZARD_STEPS[stepIndex(step) + delta];
}

/** Target length in minutes, or why it is not one. */
export function parseMinutes(text: string): number | string {
  const value = Number(text.replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(value)) return 'Enter the length in minutes, e.g. 8.';
  if (value < MIN_MINUTES || value > MAX_MINUTES) {
    return `The length must be between ${String(MIN_MINUTES)} and ${String(MAX_MINUTES)} minutes.`;
  }
  return value;
}

/** Why the step cannot go on yet (one sentence); undefined = ready. */
export function stepProblem(
  step: WizardStep,
  draft: WizardDraft,
  channels: readonly ChannelView[],
): string | undefined {
  switch (step) {
    case 'topic': {
      if (draft.title.trim() === '') return 'Give the video a title.';
      const minutes = parseMinutes(draft.minutes);
      return typeof minutes === 'string' ? minutes : undefined;
    }
    case 'channel': {
      if (draft.channel?.kind !== 'new') return undefined;
      const check = checkChannelName(draft.channel.name, channels, '');
      return check.ok ? undefined : check.message;
    }
    case 'style':
    case 'voice':
      return undefined;
  }
}

/** The first step with a problem (Create jumps back there); undefined = all ready. */
export function firstProblemStep(
  draft: WizardDraft,
  channels: readonly ChannelView[],
): WizardStep | undefined {
  return WIZARD_STEPS.find((step) => stepProblem(step, draft, channels) !== undefined);
}

/** A step dot can be clicked when every step before it is ready. */
export function canReachStep(
  target: WizardStep,
  draft: WizardDraft,
  channels: readonly ChannelView[],
): boolean {
  return WIZARD_STEPS.slice(0, stepIndex(target)).every(
    (step) => stepProblem(step, draft, channels) === undefined,
  );
}

/** The brief saved right after the project is made (the Script step starts from it). */
export function wizardBrief(draft: WizardDraft, language: BriefInput['language']): BriefInput {
  const minutes = parseMinutes(draft.minutes);
  const about = draft.about.trim();
  return {
    topic: about === '' ? draft.title.trim() : about,
    language,
    targetMinutes: typeof minutes === 'number' ? minutes : Number(DEFAULT_MINUTES),
    tone: '',
    audience: '',
    notes: '',
  };
}

export interface VoiceOption {
  readonly id: VoicePlan;
  readonly label: string;
  readonly hint: string;
  /** Why it cannot be chosen; undefined = available. */
  readonly unavailable?: string;
}

/** The channel can generate voices: a voice and a key are saved. */
export function canGenerateVoice(channel: ChannelView | undefined): boolean {
  return channel?.voice?.voiceId !== undefined && channel.secrets['elevenlabs-api-key'];
}

export function voiceOptions(channel: ChannelView | undefined, isNew: boolean): VoiceOption[] {
  const missing = isNew
    ? 'A new channel has no ElevenLabs voice yet: add one in Settings → Channels.'
    : 'This channel has no ElevenLabs voice and key yet: add them in Settings → Channels.';
  return [
    {
      id: 'generate',
      label: 'Generate it with ElevenLabs',
      hint: 'After you approve the script, the Voiceover step makes the voice with the channel’s ElevenLabs voice.',
      ...(canGenerateVoice(channel) ? {} : { unavailable: missing }),
    },
    {
      id: 'record',
      label: 'Record or import it myself',
      hint: 'After you approve the script, record it in the app or import an audio file.',
    },
    {
      id: 'later',
      label: 'Decide later',
      hint: 'The Voiceover step offers every way once the script is approved.',
    },
  ];
}

/** The plan shown first: generate when the channel can, else decide later. */
export function defaultVoicePlan(channel: ChannelView | undefined): VoicePlan {
  return canGenerateVoice(channel) ? 'generate' : 'later';
}

export interface ReviewInput {
  readonly draft: WizardDraft;
  readonly channelName: string | undefined;
  readonly genre: string | null;
  readonly style: string | undefined;
  readonly voice: VoicePlan;
  readonly language: BriefInput['language'];
}

const VOICE_WORDS: Readonly<Record<VoicePlan, string>> = {
  generate: 'ElevenLabs (after the script)',
  record: 'You record or import it',
  later: 'Decided later',
};

/** The review list of the last step: [label, value]. */
export function reviewLines(input: ReviewInput): [string, string][] {
  const minutes = parseMinutes(input.draft.minutes);
  const lines: [string, string][] = [
    ['Title', input.draft.title.trim()],
    ['Length', typeof minutes === 'number' ? `about ${String(minutes)} min` : '—'],
  ];
  if (input.channelName !== undefined) {
    const isNew = input.draft.channel?.kind === 'new';
    lines.push(['Channel', isNew ? `${input.channelName} (new)` : input.channelName]);
  }
  lines.push(['Genre', input.genre === null ? GENRE_NONE_LABEL : genreLabel(input.genre)]);
  lines.push(['Style', input.style === undefined ? 'Same as Settings' : styleLabel(input.style)]);
  lines.push(['Voice', VOICE_WORDS[input.voice]]);
  if (input.language !== 'en') lines.push(['Language', 'Polski']);
  return lines;
}
