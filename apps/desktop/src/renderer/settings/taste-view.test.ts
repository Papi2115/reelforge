import { describe, expect, it } from 'vitest';
import type { TasteState } from '../../shared/taste-contract.js';
import { preferenceBar, profileStatus, signalSummary } from './taste-view.js';

const STATE: Extract<TasteState, { status: 'ok' }> = {
  status: 'ok',
  learning: 'auto',
  profile: 'Prefers orbit camera moves.',
  preferences: [],
  signals: { pick: 2, keep: 1, discard: 0, lock: 1, rebuild: 1 },
  minSignals: 3,
  updatedAt: '2026-10-04T10:00:00.000Z',
  file: 'C:\\Users\\x\\AppData\\Roaming\\ReelForge\\taste.json',
};

describe('taste view', () => {
  it('draws a centred bar per preference with a readable description', () => {
    expect(preferenceBar('orbit camera moves', 0.75)).toEqual({
      side: 'like',
      widthPercent: 37.5,
      text: '+75',
      description: 'Prefers orbit camera moves: 75 %',
    });
    expect(preferenceBar('violet backgrounds', -0.4)).toMatchObject({
      side: 'dislike',
      widthPercent: 20,
      text: '−40',
    });
  });

  it('counts the decisions', () => {
    expect(signalSummary(STATE.signals)).toBe(
      '2 variant picks · 1 current scene kept · 0 sets discarded · 1 lock · 1 rebuild',
    );
  });

  it('says whether the prompts get the profile', () => {
    expect(profileStatus(STATE)).toBe(
      'The storyboard and scene prompts get this profile as a soft preference.',
    );
    expect(profileStatus({ ...STATE, learning: 'off', profile: null })).toContain('off');
    const few = {
      ...STATE,
      profile: null,
      signals: { ...STATE.signals, pick: 0, keep: 0, lock: 0, rebuild: 1 },
    };
    expect(profileStatus(few)).toBe('Learning: 1 decision so far, the profile is used from 3 on.');
    expect(profileStatus({ ...STATE, profile: null })).toContain('no clear preference');
  });
});
