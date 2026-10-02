import { describe, expect, it } from 'vitest';
import { MOOD_PRESETS, MUSIC_MOODS, pattern } from './moods.js';
import { defaultStructure, generateScore, isDrumVoice, scoreScale, type Score } from './score.js';
import {
  SCALE_MODES,
  chordPitchClasses,
  degreeToMidi,
  keyName,
  scalePitchClasses,
  voiceLead,
  type ChordColor,
  type ScaleMode,
} from './theory.js';

describe('theory', () => {
  it('builds diatonic chords that stay in the key for every mode, degree and colour', () => {
    const colors: ChordColor[] = ['triad', 'seventh', 'add9', 'sus2', 'sus4', 'ninth'];
    for (const mode of Object.keys(SCALE_MODES) as ScaleMode[]) {
      const key = { tonic: 9, mode };
      const scale = scalePitchClasses(key);
      for (let degree = 0; degree < 7; degree++) {
        for (const color of colors) {
          for (const pc of chordPitchClasses(key, { degree, color })) expect(scale).toContain(pc);
        }
      }
    }
    expect(chordPitchClasses({ tonic: 0, mode: 'major' }, { degree: 4, color: 'seventh' })).toEqual(
      [7, 11, 2, 5],
    );
    expect(degreeToMidi({ tonic: 0, mode: 'major' }, 7, 3)).toBe(60);
    expect(keyName({ tonic: 2, mode: 'dorian' })).toBe('D dorian');
  });

  it('voice-leads with small steps and covers every chord tone', () => {
    const first = voiceLead([0, 4, 7], null, 55, 76, 3);
    const second = voiceLead([5, 9, 0], first, 55, 76, 3);
    expect(new Set(second.map((note) => note % 12))).toEqual(new Set([5, 9, 0]));
    const moved = second.reduce(
      (sum, note, index) => sum + Math.abs(note - (first[index] ?? 0)),
      0,
    );
    expect(moved).toBeLessThanOrEqual(6);
    for (const note of [...first, ...second]) {
      expect(note).toBeGreaterThanOrEqual(55);
      expect(note).toBeLessThanOrEqual(76);
    }
  });

  it('parses 16-step patterns and rejects other lengths', () => {
    expect(pattern('x.o.-...X.......').map((step) => step.chance)).toEqual([
      1, 0, 0.6, 0, 0.3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(() => pattern('x...')).toThrow();
  });
});

describe('defaultStructure', () => {
  it('arranges intro / main / break / main / outro covering every bar', () => {
    for (const bars of [4, 10, 16, 24, 40, 64]) {
      const structure = defaultStructure(bars);
      expect(structure.reduce((sum, section) => sum + section.bars, 0)).toBe(bars);
      expect(structure.every((section) => section.bars > 0)).toBe(true);
    }
    expect(defaultStructure(32).map((section) => section.kind)).toEqual([
      'intro',
      'main',
      'break',
      'main',
      'outro',
    ]);
  });
});

const scores: readonly Score[] = MUSIC_MOODS.map((mood) =>
  generateScore({ mood, seed: 11, durationS: 60 }),
);

describe.each(scores)('$mood score', (score) => {
  const preset = MOOD_PRESETS[score.mood];

  it('fits the requested length exactly with a tempo near the mood range', () => {
    expect(score.durationS).toBeCloseTo(60, 6);
    expect(score.bpm).toBeGreaterThanOrEqual(preset.bpm[0] * 0.93);
    expect(score.bpm).toBeLessThanOrEqual(preset.bpm[1] * 1.07);
  });

  it('only plays notes of the key; pads and bass play chord tones', () => {
    const scale = scoreScale(score);
    for (const note of score.notes) {
      if (isDrumVoice(note.voice)) continue;
      expect(scale).toContain(note.midi % 12);
      if (note.voice === 'pad' || note.voice === 'bass') {
        const bar = score.bars[Math.floor((note.time + 0.01) / score.barS)];
        expect(bar?.pitchClasses).toContain(note.midi % 12);
      }
    }
  });

  it('takes chord roots from a library progression in the first main section', () => {
    const main = score.bars.filter((bar) => bar.section === 'main');
    const firstMainEnd = main.findIndex(
      (bar, index) => index > 0 && bar.index !== (main[index - 1]?.index ?? 0) + 1,
    );
    const section = firstMainEnd === -1 ? main : main.slice(0, firstMainEnd);
    const matches = preset.progressions.some((progression) =>
      section.every((bar, index) => {
        const chord = progression[Math.floor(index / preset.barsPerChord) % progression.length];
        return chord?.degree === bar.chord.degree && chord.color === bar.chord.color;
      }),
    );
    expect(section.length).toBeGreaterThan(0);
    expect(matches).toBe(true);
  });

  it('keeps the bass short, moving and out of drone territory', () => {
    const bass = score.notes.filter((note) => note.voice === 'bass');
    for (const note of bass) {
      expect(note.length).toBeLessThanOrEqual((60 / score.bpm) * 1.01);
      expect(note.midi).toBeGreaterThanOrEqual(40);
    }
    // Same pitch repeated back to back never spans more than 4 s.
    let runStart = bass[0]?.time ?? 0;
    for (let index = 1; index < bass.length; index++) {
      const note = bass[index];
      const previous = bass[index - 1];
      if (note === undefined || previous === undefined) continue;
      if (note.midi !== previous.midi) runStart = note.time;
      expect(note.time + note.length - runStart).toBeLessThanOrEqual(4);
    }
  });

  it('changes density with the section energy', () => {
    const perBar = (kind: string): number => {
      const bars = score.bars.filter((bar) => bar.section === kind);
      const notes = score.notes.filter((note) =>
        bars.some((bar) => Math.floor(note.time / score.barS) === bar.index),
      );
      return notes.length / Math.max(1, bars.length);
    };
    expect(perBar('main')).toBeGreaterThan(perBar('intro'));
  });
});

describe('generateScore', () => {
  it('is deterministic per seed and varies between seeds', () => {
    const options = { mood: 'calm-tech', seed: 5, durationS: 30 } as const;
    expect(generateScore(options)).toEqual(generateScore(options));
    const sequence = (score: Score): string =>
      score.notes
        .filter((note) => note.voice === 'arp' || note.voice === 'pad')
        .map((note) => note.midi)
        .join(',');
    const seeds = [1, 2, 3, 4].map((seed) => sequence(generateScore({ ...options, seed })));
    expect(new Set(seeds).size).toBe(4);
  });

  it('honours a fixed bpm, key, structure and energy', () => {
    const score = generateScore({
      mood: 'retro-wave',
      seed: 3,
      durationS: 20,
      bpm: 90,
      key: { tonic: 4, mode: 'minor' },
      structure: [{ kind: 'main', bars: 8, energy: 1 }],
    });
    expect(score.bpm).toBe(90);
    expect(score.key).toEqual({ tonic: 4, mode: 'minor' });
    expect(score.bars).toHaveLength(8);
    expect(score.bars.every((bar) => bar.energy === 1)).toBe(true);
    const calm = generateScore({ mood: 'retro-wave', seed: 3, durationS: 40, energy: 0 });
    const intense = generateScore({ mood: 'retro-wave', seed: 3, durationS: 40, energy: 1 });
    expect(intense.notes.length).toBeGreaterThan(calm.notes.length);
  });
});
