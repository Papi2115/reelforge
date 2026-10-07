import { describe, expect, it } from 'vitest';
import type { VoiceTestKeyResult } from '../../shared/voice-contract.js';
import { keyTestLine, planName } from './key-test-view.js';

const OK: VoiceTestKeyResult = {
  status: 'ok',
  tier: 'creator',
  remaining: 12_400,
  limit: 100_000,
  resetsOn: '2026-11-01',
};

function problem(kind: Extract<VoiceTestKeyResult, { status: 'error' }>['kind']) {
  return { status: 'error', kind, message: `main says ${kind}` } as const;
}

describe('key test view', () => {
  it('names the ElevenLabs plan', () => {
    expect(planName('creator')).toBe('Creator');
    expect(planName('scale_2024_08_10')).toBe('Scale');
    expect(planName('growing_business')).toBe('Growing business');
    expect(planName('  ')).toBe('Unknown');
  });

  it('writes the plan and the characters left when the key works', () => {
    expect(keyTestLine(OK)).toEqual({
      tone: 'ok',
      text: 'Key works · Creator plan · 12,400 characters left',
    });
    expect(keyTestLine({ ...OK, tier: 'free', remaining: 1 }).text).toBe(
      'Key works · Free plan · 1 character left',
    );
  });

  it('says what went wrong in plain words', () => {
    expect(keyTestLine(problem('key-rejected'))).toEqual({
      tone: 'error',
      text: 'ElevenLabs rejected this key. Paste it again: it may be mistyped, deleted or expired.',
    });
    expect(keyTestLine(problem('quota')).text).toContain('needs a payment');
    expect(keyTestLine(problem('network')).text).toBe(
      'Cannot reach ElevenLabs right now. Check the connection and try again.',
    );
    expect(keyTestLine(problem('no-key')).text).toBe('No key is saved for this channel.');
    // Anything else: main's own plain sentence.
    expect(keyTestLine(problem('forbidden'))).toEqual({
      tone: 'error',
      text: 'main says forbidden',
    });
  });
});
