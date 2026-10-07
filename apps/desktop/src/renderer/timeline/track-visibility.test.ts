import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { WaveformView } from './draw-timeline.js';
import { EMPTY_CUES, wordParts, type TimelineModel } from './timeline-model.js';
import { timelineToolsUsable, unusableTracks } from './track-visibility.js';

const shot: StoryboardShot = {
  id: 's01',
  t0: 0,
  t1: 2,
  treatment: 'title-card',
  intent: 'x',
  scene: 'scenes/s01.js',
};
const EMPTY: TimelineModel = { shots: [], ...wordParts([]), cues: EMPTY_CUES };
const NO_AUDIO: WaveformView = { kind: 'message', text: 'No voiceover yet', missing: true };
const READING: WaveformView = { kind: 'message', text: 'Reading the waveform…' };

function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

describe('unusableTracks', () => {
  it('leaves one line on an empty timeline', () => {
    expect(sorted(unusableTracks(EMPTY, NO_AUDIO))).toEqual([
      'ambience',
      'audio',
      'cards',
      'cues',
      'shots',
    ]);
  });

  it('shows the audio and the cues once there is a voiceover', () => {
    expect(sorted(unusableTracks(EMPTY, READING))).toEqual([
      'ambience',
      'cards',
      'narration',
      'shots',
    ]);
  });

  it('shows every row with content and never the Cards row', () => {
    const full: TimelineModel = {
      shots: [shot],
      ...wordParts([{ text: 'Doom', t: 0.3, tEnd: 0.6 }]),
      cues: { sfx: [], ambience: [{ from: 0, to: 1, label: 'hum', gainDb: 0 }], music: [] },
    };
    expect(sorted(unusableTracks(full, READING))).toEqual(['cards']);
  });
});

describe('timelineToolsUsable', () => {
  it('offers Tension and Tracks once there are timed words', () => {
    expect(timelineToolsUsable(EMPTY)).toBe(false);
    expect(timelineToolsUsable({ ...EMPTY, ...wordParts([{ text: 'a', t: 0, tEnd: 1 }]) })).toBe(
      true,
    );
  });
});
