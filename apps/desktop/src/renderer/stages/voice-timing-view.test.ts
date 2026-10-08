import { describe, expect, it } from 'vitest';
import type { StagesState } from '../../shared/stages-contract.js';
import type { VoiceTiming } from '../../shared/voiceover-contract.js';
import {
  retimeButton,
  RETIME_STAGES,
  staleSentenceIds,
  voiceChangedShots,
  voiceTimingText,
} from './voice-timing-view.js';

const TIMING: VoiceTiming = {
  shotIds: ['s02', 's03'],
  sentenceIds: ['p01-s00', 'p01-s01'],
  changedAt: '2026-10-07T11:00:00.000Z',
};

function state(patch: Partial<StagesState> = {}): StagesState {
  return { projectDir: 'C:/p', stages: [], running: null, queue: [], pause: null, ...patch };
}

describe('voice timing view', () => {
  it('names the shots whose timing is out of date', () => {
    expect(voiceTimingText(TIMING)).toBe(
      'Voice changed — timing out of date for 2 shots: s02, s03. Re-time cleans the audio and times the words again.',
    );
    expect(voiceTimingText({ ...TIMING, shotIds: [] })).toContain('no storyboard shot');
    expect(voiceTimingText(null)).toBeNull();
  });

  it('marks shots and sentences, nothing when the timing is current', () => {
    expect([...voiceChangedShots(TIMING)]).toEqual(['s02', 's03']);
    expect(staleSentenceIds(TIMING).has('p01-s01')).toBe(true);
    expect(voiceChangedShots(null).size).toBe(0);
    expect(staleSentenceIds(undefined).size).toBe(0);
  });

  it('re-times with the existing stages: Audio cleaned, then Words timed', () => {
    expect(RETIME_STAGES).toEqual(['clean', 'words']);
  });

  it('waits while the voice-over, cleaning or timing runs or waits', () => {
    expect(retimeButton(state(), false).disabled).toBe(false);
    expect(retimeButton(state({ queue: ['words'] }), false).disabled).toBe(true);
    expect(retimeButton(undefined, true).disabled).toBe(true);
    const running = state({
      running: {
        stage: 'voiceover',
        label: null,
        percent: null,
        startedAt: 0,
        steps: [],
        paused: null,
        action: null,
        targets: null,
        shots: {},
      },
    });
    expect(retimeButton(running, false)).toEqual({
      disabled: true,
      title: 'The voice-over, Audio cleaned or Words timed is running or queued.',
    });
  });
});
