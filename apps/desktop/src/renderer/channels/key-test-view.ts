/**
 * "Test key" in Settings → Channels (PLAN.md#13.13/#13.14), pure: the one line the key row shows
 * after main asked ElevenLabs about the channel's saved key ("Key works · Creator plan · 12,400
 * characters left", or the problem in plain words). The key itself never reaches the renderer.
 */
import type { VoiceTestKeyResult } from '../../shared/voice-contract.js';
import { groupDigits } from '../stages/voice-view.js';

export const TEST_KEY_LABEL = 'Test key';
export const TEST_KEY_BUSY_TEXT = 'Checking…';
export const TEST_KEY_TITLE = 'Ask ElevenLabs whether the saved key works (no characters are used)';

export interface KeyTestLine {
  readonly tone: 'ok' | 'error';
  readonly text: string;
}

/** ElevenLabs tier id -> plan name: `creator` -> "Creator", `scale_2024_08_10` -> "Scale". */
export function planName(tier: string): string {
  const words = tier
    .trim()
    .replace(/_\d{4}_\d{2}_\d{2}$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (words === '') return 'Unknown';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function charactersLeft(remaining: number): string {
  return `${groupDigits(remaining)} character${Math.round(remaining) === 1 ? '' : 's'} left`;
}

export function keyTestLine(result: VoiceTestKeyResult): KeyTestLine {
  if (result.status === 'ok') {
    return {
      tone: 'ok',
      text: `Key works · ${planName(result.tier)} plan · ${charactersLeft(result.remaining)}`,
    };
  }
  switch (result.kind) {
    case 'key-rejected':
      return {
        tone: 'error',
        text: 'ElevenLabs rejected this key. Paste it again: it may be mistyped, deleted or expired.',
      };
    case 'quota':
      return {
        tone: 'error',
        text: 'ElevenLabs answered that the account needs a payment (or is out of characters).',
      };
    case 'network':
      return {
        tone: 'error',
        text: 'Cannot reach ElevenLabs right now. Check the connection and try again.',
      };
    case 'no-key':
      return { tone: 'error', text: 'No key is saved for this channel.' };
    default:
      return { tone: 'error', text: result.message };
  }
}
