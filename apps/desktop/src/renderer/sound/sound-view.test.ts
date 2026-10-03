import { describe, expect, it } from 'vitest';
import type { LibrarySound, MixResult } from '../../shared/sound-contract.js';
import {
  DUCKING_OFF,
  DUCKING_PRESET_VALUES,
  duckingPresetOf,
  libraryCue,
} from '../../shared/sound-library.js';
import {
  cueSummaryText,
  decodeSoundDrag,
  encodeSoundDrag,
  formatDb,
  libraryByKind,
  loudnessReadout,
  topSoundsText,
} from './sound-view.js';

const result: MixResult = {
  integratedLufs: -14.1,
  truePeakDbtp: -1.6,
  targetLufs: -14,
  truePeakMaxDbtp: -1,
  toleranceLu: 1,
  durationS: 30,
  warnings: [],
};

describe('sound view', () => {
  it('formats gains with a sign and a typographic minus', () => {
    expect(formatDb(3)).toBe('+3.0 dB');
    expect(formatDb(0)).toBe('0.0 dB');
    expect(formatDb(-6.54)).toBe('−6.5 dB');
  });

  it('checks the mix against −14 LUFS ±1 and ≤ −1 dBTP', () => {
    expect(loudnessReadout(result)).toEqual({
      lufs: '−14.1 LUFS',
      lufsOk: true,
      lufsTarget: 'target −14 ±1',
      peak: '−1.6 dBTP',
      peakOk: true,
      peakTarget: '≤ −1',
    });
    const loud = loudnessReadout({ ...result, integratedLufs: -12.8, truePeakDbtp: -0.4 });
    expect(loud.lufsOk).toBe(false);
    expect(loud.peakOk).toBe(false);
  });

  it('maps ducking settings to the Light / Medium / Strong presets', () => {
    expect(duckingPresetOf(DUCKING_PRESET_VALUES.light)).toBe('light');
    expect(duckingPresetOf(DUCKING_PRESET_VALUES.medium)).toBe('medium');
    expect(duckingPresetOf(DUCKING_PRESET_VALUES.strong)).toBe('strong');
    expect(duckingPresetOf(DUCKING_OFF)).toBe('off');
    expect(duckingPresetOf({ ...DUCKING_PRESET_VALUES.strong, ratio: 12 })).toBe('custom');
    // Medium is the pipeline's default ducking (a cue without `ducking` reads as Medium).
    expect(DUCKING_PRESET_VALUES.medium).toEqual({
      enabled: true,
      thresholdDb: -30,
      ratio: 8,
      attackMs: 20,
      releaseMs: 400,
    });
  });

  it('round-trips the drag payload and refuses anything else', () => {
    const sound: LibrarySound = { source: 'file', kind: 'music', file: 'audio/music/bed.wav' };
    expect(decodeSoundDrag(encodeSoundDrag(sound))).toEqual(sound);
    expect(decodeSoundDrag('{"source":"file","kind":"music","file":"../x.wav"}')).toBeNull();
    expect(decodeSoundDrag('not json')).toBeNull();
  });

  it('groups the library per kind', () => {
    const groups = libraryByKind([
      { source: 'builtin', kind: 'sfx', name: 'hit' },
      { source: 'builtin', kind: 'ambience', name: 'wind' },
      { source: 'file', kind: 'sfx', file: 'audio/sfx/boom.wav' },
    ]);
    expect(groups.sfx).toHaveLength(2);
    expect(groups.ambience).toHaveLength(1);
    expect(groups.music).toEqual([]);
  });
});

describe('libraryCue', () => {
  const context = {
    duration: 40,
    shots: [
      { t0: 0, t1: 12 },
      { t0: 12, t1: 40 },
    ],
    ducking: DUCKING_PRESET_VALUES.strong,
  };

  it('drops sfx as a marker, ambience until the end of its shot, music to the end', () => {
    expect(libraryCue({ source: 'builtin', kind: 'sfx', name: 'pop' }, 3.21749, context)).toEqual({
      track: 'sfx',
      cue: { t: 3.217, name: 'pop' },
    });
    expect(libraryCue({ source: 'builtin', kind: 'ambience', name: 'wind' }, 5, context)).toEqual({
      track: 'ambience',
      cue: { from: 5, to: 12, name: 'wind', gainDb: -28 },
    });
    // Close to a shot end: at least 2 s long.
    expect(
      libraryCue({ source: 'builtin', kind: 'ambience', name: 'hum' }, 11.5, context).cue,
    ).toMatchObject({ from: 11.5, to: 13.5 });
    expect(
      libraryCue({ source: 'file', kind: 'music', file: 'audio/music/bed.wav' }, 8, context),
    ).toEqual({
      track: 'music',
      cue: {
        from: 8,
        to: 40,
        file: 'audio/music/bed.wav',
        gainDb: -18,
        loop: true,
        ducking: DUCKING_PRESET_VALUES.strong,
      },
    });
  });
});

describe('cue summary', () => {
  it('describes the generated sound design in one line', () => {
    const summary = {
      sfx: 14,
      ambience: 1,
      music: 2,
      sounds: ['tick', 'pop', 'glitch', 'hit', 'whoosh', 'chime', 'click'].map((name, index) => ({
        name,
        count: 7 - index,
      })),
      moods: ['calm-tech', 'retro-wave'],
    };
    expect(cueSummaryText(summary)).toBe(
      '14 SFX · 1 ambience bed · 2 music beds (calm-tech, retro-wave)',
    );
    expect(topSoundsText(summary)).toBe(
      'tick ×7, pop ×6, glitch ×5, hit ×4, whoosh ×3, chime ×2 +1 more',
    );
    expect(cueSummaryText({ ...summary, music: 0, ambience: 0, moods: [] })).toBe(
      '14 SFX · 0 ambience beds · 0 music beds',
    );
  });
});
