/**
 * Words and pure logic of the "Production line" dialog (PLAN.md#13.9, docs/ui-copy.md): the status
 * chip of a film (the same words everywhere), one plain sentence per film, the line's status strip
 * ("Running · Building film 2 of 5: scenes", "Paused by Claude usage limit — resumes 14:05"), the
 * buttons a film offers, and the "Add topics" parser ("Topic | 6" = a 6-minute film). No React,
 * no IPC.
 */
import type { QueueItemStatus, QueueStep } from '@reelforge/shared';
import { plural } from '../../shared/plural.js';
import {
  MAX_TOPIC_MINUTES,
  MAX_TOPICS_PER_ADD,
  type ChannelQueueView,
  type LineView,
  type QueueAttentionView,
  type QueueItemView,
  type QueueTopicRequest,
} from '../../shared/queue-contract.js';

export const STATUS_WORDS: Readonly<Record<QueueItemStatus, string>> = {
  queued: 'Queued',
  brief: 'Brief',
  scripting: 'Script',
  'needs-approval': 'Needs you',
  'needs-voice': 'Voice needed',
  building: 'Building',
  exporting: 'Exporting',
  done: 'Done',
  failed: 'Failed',
  paused: 'On hold',
};

/** Tone of the chip: muted (waits its turn), work, you, done, problem, held. */
export type ChipTone = 'muted' | 'work' | 'you' | 'done' | 'problem' | 'held';

export const STATUS_TONES: Readonly<Record<QueueItemStatus, ChipTone>> = {
  queued: 'muted',
  brief: 'work',
  scripting: 'work',
  'needs-approval': 'you',
  'needs-voice': 'you',
  building: 'work',
  exporting: 'work',
  done: 'done',
  failed: 'problem',
  paused: 'held',
};

export const STEP_WORDS: Readonly<Record<QueueStep, string>> = {
  project: 'new project',
  brief: 'brief',
  script: 'script',
  approval: 'script approval',
  voiceover: 'voiceover',
  clean: 'audio clean-up',
  words: 'word timing',
  storyboard: 'storyboard',
  assets: 'photos and footage',
  scenes: 'scenes',
  'final-review': 'final review',
  'sound-cues': 'sound design',
  mix: 'mix',
  export: 'export',
  publish: 'publish kit',
};

const PRE_APPROVAL: ReadonlySet<QueueStep> = new Set(['project', 'brief', 'script', 'approval']);

function verbOf(step: QueueStep): string {
  if (PRE_APPROVAL.has(step)) return 'Writing';
  return step === 'export' || step === 'publish' ? 'Exporting' : 'Building';
}

/** "14:05": local wall-clock time of an epoch. */
export function localClock(epochMs: number): string {
  const date = new Date(epochMs);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function percentText(percent: number | null): string {
  return percent === null ? '' : ` · ${String(Math.round(percent))} %`;
}

/** The one sentence under a film's topic. */
export function itemSentence(item: QueueItemView, voiceReady: boolean): string {
  if (item.live !== null) return `${item.live.label}${percentText(item.live.percent)}`;
  const step = item.step;
  switch (item.status) {
    case 'queued':
      return 'Waits for its turn.';
    case 'paused':
      return 'On hold: the line skips it until you resume it.';
    case 'needs-approval':
      return step === 'assets'
        ? 'An asset package is ready. Approve or reject the photos and footage.'
        : 'The script is written. Read it and approve it.';
    case 'needs-voice':
      return voiceReady
        ? 'The channel has a voice now: Generate voice makes it.'
        : 'Record your voiceover (read the approved script) or import a file.';
    case 'failed': {
      const where = step === null ? 'It' : `The ${STEP_WORDS[step]}`;
      return `${where} stopped with a problem: ${item.message ?? 'see the log'}`;
    }
    case 'done': {
      const count = item.warnings.length;
      if (count === 0) return 'Done ✓. The video and the publish kit are ready.';
      const checked = item.reviewed ? ' (checked)' : '';
      return `Done with ${plural(count, 'warning')} ⚠${checked}. The video and the publish kit are ready.`;
    }
    default:
      return step === null
        ? 'Waits for its turn.'
        : `Next: the ${STEP_WORDS[step]} (step ${String(item.stepsDone + 1)} of ${String(item.stepsTotal)}).`;
  }
}

export type StripTone = 'running' | 'you' | 'limit' | 'stopped';

export interface StripView {
  readonly text: string;
  readonly tone: StripTone;
}

export interface StripInput {
  readonly line: LineView;
  readonly channels: readonly ChannelQueueView[];
  readonly attention: readonly QueueAttentionView[];
  /** The channel's name (tab label). */
  readonly nameOf: (channelId: string) => string;
  readonly clock?: (epochMs: number) => string;
}

const WAITING_KINDS: ReadonlySet<QueueAttentionView['kind']> = new Set([
  'approve-script',
  'add-voice',
  'review-assets',
]);

function waitingText(attention: readonly QueueAttentionView[]): string | undefined {
  const waiting = attention.filter((entry) => WAITING_KINDS.has(entry.kind));
  if (waiting.length === 0) return undefined;
  const approvals = waiting.filter((entry) => entry.kind === 'approve-script').length;
  return approvals === waiting.length
    ? `Waiting for your approval (${plural(approvals, 'script')})`
    : `Waiting for you (${plural(waiting.length, 'film')})`;
}

function runningText(input: StripInput): string {
  const current = input.line.current;
  if (current === null) return 'Running';
  const channel = input.channels.find((candidate) => candidate.channelId === current.channelId);
  const items = channel?.items ?? [];
  const index = items.findIndex((item) => item.id === current.itemId);
  const film = index < 0 ? 'a film' : `film ${String(index + 1)} of ${String(items.length)}`;
  const where = input.channels.length > 1 ? `${input.nameOf(current.channelId)}: ` : '';
  return `Running · ${where}${verbOf(current.step)} ${film}: ${STEP_WORDS[current.step]}`;
}

/** The line's status strip. */
export function lineStrip(input: StripInput): StripView {
  const { line } = input;
  const clock = input.clock ?? localClock;
  const until = line.runUntil.kind === 'time' ? ` · until ${line.runUntil.text}` : '';
  switch (line.activity) {
    case 'running':
      return { text: `${runningText(input)}${until}`, tone: 'running' };
    case 'limit':
      return {
        text: `Paused by Claude usage limit — ${line.until === null ? 'resumes by itself' : `resumes ${clock(line.until)}`}`,
        tone: 'limit',
      };
    case 'quiet':
      return {
        text: `Quiet hours — starts again at ${line.until === null ? 'their end' : clock(line.until)}`,
        tone: 'limit',
      };
    case 'waiting':
      return { text: `${waitingText(input.attention) ?? 'Waiting for you'}${until}`, tone: 'you' };
    case 'stopped': {
      if (line.wanted && line.lastEnd === 'idle') {
        const waiting = waitingText(input.attention);
        return waiting === undefined
          ? { text: 'Stopped · every film is done', tone: 'stopped' }
          : { text: waiting, tone: 'you' };
      }
      if (line.wanted) return { text: 'Starting…', tone: 'running' };
      return {
        text: line.problem === null ? 'Stopped' : `Stopped: ${line.problem}`,
        tone: 'stopped',
      };
    }
  }
}

/**
 * The line is on: it runs, or it goes on by itself after your approval (Start is replaced by
 * Stop, which turns that off).
 */
export function lineActive(line: LineView): boolean {
  return line.activity !== 'stopped' || line.wanted;
}

export type ItemActionId =
  | 'open-script'
  | 'approve'
  | 'review-photos'
  | 'add-voice'
  | 'generate-voice'
  | 'retry'
  | 'open-video'
  | 'open-publish'
  | 'mark-checked'
  | 'hold'
  | 'resume'
  | 'open-project';

export interface ItemAction {
  readonly id: ItemActionId;
  readonly label: string;
  readonly primary?: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
}

export const APPROVE_FIRST_HINT = 'Open the script first: read it, then approve it.';

/** The buttons of a film, the next action first. `viewed`: its script was opened here. */
export function itemActions(
  item: QueueItemView,
  voiceReady: boolean,
  viewed: boolean,
): ItemAction[] {
  const actions: ItemAction[] = [];
  const hasProject = item.projectPath !== null;
  if (item.status === 'needs-approval' && item.step === 'approval') {
    actions.push({ id: 'open-script', label: 'Open script', primary: !viewed });
    actions.push({
      id: 'approve',
      label: 'Approve script',
      primary: viewed,
      disabled: !viewed,
      ...(viewed ? {} : { title: APPROVE_FIRST_HINT }),
    });
  } else if (item.status === 'needs-approval' && item.step === 'assets') {
    actions.push({ id: 'review-photos', label: 'Review photos', primary: true });
  } else if (item.status === 'needs-voice') {
    if (voiceReady) actions.push({ id: 'generate-voice', label: 'Generate voice', primary: true });
    actions.push({ id: 'add-voice', label: 'Add voice', primary: !voiceReady });
  } else if (item.status === 'failed') {
    actions.push({ id: 'retry', label: 'Retry', primary: true });
  } else if (item.status === 'done') {
    actions.push({ id: 'open-video', label: 'Open video folder' });
    actions.push({ id: 'open-publish', label: 'Open publish kit' });
    if (item.warnings.length > 0 && !item.reviewed) {
      actions.push({ id: 'mark-checked', label: 'Mark as checked' });
    }
  }
  if (item.status === 'paused') actions.push({ id: 'resume', label: 'Resume', primary: true });
  else if (item.status !== 'done' && item.status !== 'failed') {
    actions.push({ id: 'hold', label: 'Hold' });
  }
  if (hasProject) actions.push({ id: 'open-project', label: 'Open project' });
  return actions;
}

export interface ParsedTopics {
  readonly topics: QueueTopicRequest[];
  readonly errors: string[];
}

const MAX_TOPIC_LENGTH = 500;

/**
 * "Add topics (one per line)": a line is a topic, optionally "| minutes" at its end
 * ("How magnets work | 6"). Empty lines are skipped; every problem names its line.
 */
export function parseTopics(text: string): ParsedTopics {
  const topics: QueueTopicRequest[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const where = `Line ${String(index + 1)}`;
    const bar = line.lastIndexOf('|');
    const topic = (bar < 0 ? line : line.slice(0, bar)).trim();
    const length = bar < 0 ? '' : line.slice(bar + 1).trim();
    if (topic === '') {
      errors.push(`${where}: the topic is empty.`);
      return;
    }
    if (topic.length > MAX_TOPIC_LENGTH) {
      errors.push(`${where}: a topic has at most ${String(MAX_TOPIC_LENGTH)} characters.`);
      return;
    }
    if (length === '') {
      topics.push({ topic });
      return;
    }
    const minutes = Number(length.replace(',', '.'));
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_TOPIC_MINUTES) {
      errors.push(
        `${where}: “${length}” is not a length in minutes (more than 0, at most ${String(MAX_TOPIC_MINUTES)}).`,
      );
      return;
    }
    topics.push({ topic, targetMinutes: minutes });
  });
  if (topics.length > MAX_TOPICS_PER_ADD) {
    errors.push(`At most ${String(MAX_TOPICS_PER_ADD)} topics at once.`);
  }
  return { topics, errors };
}

export const ADD_TOPICS_HINT =
  'Add “| minutes” for a length, e.g. “How magnets work | 6” (else the default length). Films are made in English.';

/** "3 films · 1 needs you · 1 done": the tab's summary. */
export function channelSummary(channel: ChannelQueueView): string {
  if (channel.items.length === 0) return 'No films yet';
  const you = channel.items.filter((item) => STATUS_TONES[item.status] === 'you').length;
  const done = channel.items.filter((item) => item.status === 'done').length;
  return [
    plural(channel.items.length, 'film'),
    ...(you > 0 ? [`${String(you)} need${you === 1 ? 's' : ''} you`] : []),
    ...(done > 0 ? [`${String(done)} done`] : []),
  ].join(' · ');
}
