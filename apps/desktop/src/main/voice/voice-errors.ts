/**
 * Engine errors of voice generation -> plain-English problems for the Voiceover panel
 * (PLAN.md#13.14). Every message is redacted with the key once more before it leaves main (the
 * engine already redacts; this is the second belt).
 */
import { redactSecret, type VoiceError } from '@reelforge/pipeline';
import type { VoiceProblem, VoiceProblemKind } from '../../shared/voice-contract.js';

export function problem(kind: VoiceProblemKind, message: string): VoiceProblem {
  return { status: 'error', kind, message };
}

export const NO_KEY_MESSAGE =
  'No ElevenLabs key is saved for this channel: add one in Settings → Channels.';
export const NO_VOICE_MESSAGE =
  'This channel has no ElevenLabs voice yet: choose one in Settings → Channels.';

/** The engine's detail ("HTTP 401: …"), trimmed; empty when it adds nothing. */
function detail(error: VoiceError, key: string): string {
  const text = redactSecret(error.message, key).trim();
  return text === '' || text === 'cancelled' ? '' : ` (${text})`;
}

export function voiceProblem(error: VoiceError, key: string): VoiceProblem {
  const more = detail(error, key);
  switch (error.kind) {
    case 'auth':
      return problem(
        'key-rejected',
        'ElevenLabs rejected the key of this channel. Check it in Settings → Channels.',
      );
    case 'payment':
      return problem(
        'quota',
        'The ElevenLabs account is out of characters (or needs a payment). Nothing more was spent; paragraphs already made are kept.',
      );
    case 'forbidden':
      return problem(
        'forbidden',
        `The ElevenLabs key is not allowed to do this (missing permission or plan feature)${more}.`,
      );
    case 'rate-limit':
      return problem(
        'rate-limited',
        'ElevenLabs stayed busy (rate limited) after several retries. Try again in a minute: paragraphs already made are kept.',
      );
    case 'network':
    case 'timeout':
    case 'server':
    case 'http':
      return problem(
        'network',
        `Cannot reach ElevenLabs right now${more}. Check the connection and try again: paragraphs already made are kept.`,
      );
    case 'stale-manifest':
      return problem(
        'script-changed',
        'The script changed since the voice was generated: Generate again first (only changed paragraphs cost characters).',
      );
    case 'aborted':
      return problem('failed', 'Cancelled.');
    case 'validation':
    case 'invalid-response':
    case 'invalid-input':
    case 'alignment':
    case 'decode':
    case 'io':
      return problem('failed', `Voice generation failed${more}.`);
  }
}

/** Retry notice for the progress line, e.g. "ElevenLabs is busy (rate limited), retrying in 4 s…". */
export function retryNote(error: VoiceError, delayMs: number): string {
  const seconds = Math.max(1, Math.round(delayMs / 1000));
  const why =
    error.kind === 'rate-limit'
      ? 'ElevenLabs is busy (rate limited)'
      : error.kind === 'server'
        ? 'ElevenLabs had a server error'
        : 'The connection to ElevenLabs failed';
  return `${why}, retrying in ${String(seconds)} s…`;
}
