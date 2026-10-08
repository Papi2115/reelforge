import { describe, expect, it } from 'vitest';
import type { TasteState } from '../../shared/taste-contract.js';
import {
  preferenceBar,
  profileStatus,
  scopeNote,
  scopeTitle,
  signalSummary,
  worldChoices,
} from './taste-view.js';

const STATE: Extract<TasteState, { status: 'ok' }> = {
  status: 'ok',
  learning: 'auto',
  profile: 'Prefers orbit camera moves.',
  preferences: [],
  signals: { pick: 2, keep: 1, discard: 0, lock: 1, rebuild: 1 },
  minSignals: 3,
  updatedAt: '2026-10-04T10:00:00.000Z',
  file: 'C:\\Users\\x\\AppData\\Roaming\\ReelForge\\taste.json',
  scope: {
    channelId: 'default',
    channelName: 'Default',
    color: null,
    channelLearning: null,
    fromProject: true,
    perWorld: false,
    world: null,
    worlds: [],
    channels: [{ id: 'default', name: 'Default', color: null }],
  },
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

  it('names the profile shown and where it comes from', () => {
    expect(scopeTitle(STATE.scope)).toBe('Default');
    expect(scopeNote(STATE.scope)).toBe(
      'The channel of the open project. Every film of this channel learns and uses this profile.',
    );
    const crime = {
      ...STATE.scope,
      channelId: 'crime',
      channelName: 'Crime',
      fromProject: false,
      perWorld: true,
      world: 'unknown-world',
      worlds: ['unknown-world'],
    };
    expect(scopeTitle(crime)).toBe('Crime · unknown-world');
    expect(scopeNote(crime)).toBe(
      'No project is open: pick a channel. This channel keeps a separate profile for each world.',
    );
    expect(worldChoices(crime)).toEqual([{ id: 'unknown-world', label: 'unknown-world' }]);
    expect(scopeNote({ ...STATE.scope, channelId: null, channelName: null })).toMatch(
      /cannot be read/,
    );
    expect(scopeTitle({ ...STATE.scope, channelId: null, channelName: null })).toBe(
      'Default channel',
    );
  });
});
