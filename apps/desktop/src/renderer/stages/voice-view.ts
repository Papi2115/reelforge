/**
 * View model of ElevenLabs generation in the Voiceover panel (PLAN.md#13.14), pure: the setup
 * pointer when the channel lacks a voice or key, the estimate line before spending characters,
 * the progress line, a retake's shot impact and the sentence rows. Counts are grouped with commas
 * regardless of the OS locale (the films are English).
 */
import type {
  VoiceEstimateResult,
  VoiceProgress,
  VoiceRetakeResult,
  VoiceSentence,
  VoiceSetup,
} from '../../shared/voice-contract.js';
import { clock } from './vo-view.js';

/** 12345 -> "12,345". */
export function groupDigits(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function plural(count: number, word: string): string {
  return `${groupDigits(count)} ${word}${count === 1 ? '' : 's'}`;
}

export interface SetupPointer {
  /** "To generate the voice with ElevenLabs, add a voice and key for this channel." */
  readonly text: string;
  /** The project's channel: "Open Channels" selects it in Settings → Channels. */
  readonly channelId: string;
}

export const OPEN_CHANNELS_LABEL = 'Open Channels';

/** What the project's channel still lacks (next to "Open Channels"); null when it is ready. */
export function setupPointer(setup: VoiceSetup): SetupPointer | null {
  if (setup.status === 'ready') return null;
  if (setup.status === 'unavailable') return null;
  const voice = setup.missing.includes('voice');
  const key = setup.missing.includes('key');
  const what = voice && key ? 'a voice and key' : voice ? 'a voice' : 'a key';
  return {
    text: `To generate the voice with ElevenLabs, add ${what} for this channel.`,
    channelId: setup.channelId,
  };
}

export interface EstimateView {
  /** "About 5,400 characters · 35% of your remaining 15,000". */
  readonly line: string;
  readonly details: readonly string[];
  readonly warning: string | null;
  /** Nothing would be sent (every paragraph already generated). */
  readonly free: boolean;
  readonly confirmLabel: string;
}

function shareText(share: number): string {
  return share > 0 && share < 0.01 ? '<1%' : `${String(Math.round(share * 100))}%`;
}

export function estimateView(
  estimate: Extract<VoiceEstimateResult, { status: 'ok' }>,
): EstimateView {
  const free = estimate.pendingCharacters === 0;
  const amount = `About ${plural(estimate.estimatedCredits, 'character')}`;
  const quota =
    estimate.remaining === null
      ? 'quota unknown'
      : estimate.share === null
        ? 'nothing left on the account'
        : `${shareText(estimate.share)} of your remaining ${groupDigits(estimate.remaining)}`;
  const details: string[] = [];
  if (estimate.reusedParagraphs > 0) {
    details.push(
      `${groupDigits(estimate.reusedParagraphs)} of ${plural(estimate.paragraphs, 'paragraph')} already generated: reused for free.`,
    );
  }
  if (estimate.quotaNote !== null) details.push(estimate.quotaNote);
  return {
    line: free ? 'Every paragraph is already generated: nothing to pay.' : `${amount} · ${quota}`,
    details,
    warning: estimate.warning,
    free,
    confirmLabel: free
      ? 'Use the generated voice'
      : `Generate (${plural(estimate.estimatedCredits, 'character')})`,
  };
}

export interface ProgressView {
  /** 0..100, null before the paragraph count is known. */
  readonly percent: number | null;
  readonly line: string;
}

export function progressView(progress: VoiceProgress): ProgressView {
  if (progress.phase === 'importing') {
    return { percent: 100, line: 'Importing the generated voice-over…' };
  }
  if (progress.total === 0) return { percent: null, line: 'Checking the ElevenLabs account…' };
  const spent =
    progress.characters === 0
      ? ''
      : ` · ${plural(progress.characters, 'character')} sent (about ${groupDigits(progress.costSoFar)} used)`;
  const what = progress.phase === 'retaking' ? 'Speaking the paragraph again' : 'Paragraph';
  const step =
    progress.phase === 'retaking'
      ? what
      : `${what} ${String(Math.min(progress.done + 1, progress.total))} of ${String(progress.total)}`;
  return {
    percent: Math.round((progress.done / progress.total) * 100),
    line: `${step}${spent}`,
  };
}

/** What a finished "Redo this sentence" changed, in one or two sentences. */
export function retakeSummary(result: Extract<VoiceRetakeResult, { status: 'ok' }>): string {
  const redone =
    result.sentenceIds.length > 1
      ? `Redone the whole paragraph (${String(result.sentenceIds.length)} sentences).`
      : 'Redone.';
  const changed =
    result.changedShotIds.length === 0
      ? ' No storyboard shot is under it yet.'
      : ` Shots that changed: ${result.changedShotIds.join(', ')} (the voice under them is new).`;
  const sign = result.shiftS > 0 ? '+' : '−';
  const shifted =
    result.shiftedShotIds.length === 0
      ? ''
      : ` ${plural(result.shiftedShotIds.length, 'later shot')} move by ${sign}${Math.abs(result.shiftS).toFixed(2)} s.`;
  return `${redone}${changed}${shifted}`;
}

export interface SentenceRow {
  readonly id: string;
  readonly text: string;
  /** "0:07", or "—" when the time is unknown. */
  readonly time: string;
  /** The span to play; null when the time is unknown. */
  readonly span: { readonly start: number; readonly end: number } | null;
  /** "2 takes" when it was redone. */
  readonly takes: string | null;
  readonly redoHint: string;
}

export function sentenceRows(sentences: readonly VoiceSentence[]): SentenceRow[] {
  return sentences.map((sentence) => ({
    id: sentence.id,
    text: sentence.text,
    time: sentence.start === null ? '—' : clock(sentence.start),
    span:
      sentence.start !== null && sentence.end !== null && sentence.end > sentence.start
        ? { start: sentence.start, end: sentence.end }
        : null,
    takes: sentence.takes > 1 ? plural(sentence.takes, 'take') : null,
    redoHint: `The whole paragraph is spoken again (about ${plural(sentence.redoCharacters, 'character')}).`,
  }));
}
