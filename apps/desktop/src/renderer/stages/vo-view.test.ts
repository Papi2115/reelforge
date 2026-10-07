import type { VoReport, WordsReport } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  alignmentView,
  biggerWhisperModel,
  clock,
  cpuTranscriptionHint,
  voFit,
  voiceoverFile,
} from './vo-view.js';

const REPORT: VoReport = {
  version: 1,
  durationS: 21.4,
  scriptWords: 84,
  expectedDurationS: 33.6,
  wordsPerMinute: 235.5,
  verdict: 'too-short',
  messages: ['The recording is 36 % shorter than the script at 150 wpm.'],
  alignment: null,
};

const WORDS: WordsReport = {
  version: 1,
  audio: 'audio/vo.original.wav',
  lang: 'en',
  attempts: [
    { model: 'small', beamSize: null, temperature: null, coverage: 0.8, loop: false, error: null },
    { model: 'small', beamSize: 5, temperature: 0.2, coverage: 0.88, loop: false, error: null },
  ],
  chosen: 1,
  coverage: 0.88,
  mismatches: [{ t: 12.34, tEnd: 13, script: 'sixty one KB', heard: '61 kilobytes' }],
  warnings: [],
};

describe('voice-over view', () => {
  it('compares the length with the script estimate', () => {
    expect(clock(61.6)).toBe('1:02');
    expect(voFit(REPORT)).toEqual({
      tone: 'warn',
      headline: 'Recording 0:21: shorter than the script needs.',
      details: [
        'Script: 84 words ≈ 0:34 at 150 words per minute.',
        'You spoke about 236 words per minute.',
        'The recording is 36 % shorter than the script at 150 wpm.',
      ],
    });
    expect(voFit(null).tone).toBe('none');
    expect(voFit({ ...REPORT, verdict: 'ok', messages: [] }).headline).toBe(
      'Recording 0:21: fits the script.',
    );
  });

  it('shows the alignment quality, the model and the mismatch regions to seek to', () => {
    const view = alignmentView(WORDS);
    expect(view).toMatchObject({
      tone: 'warn',
      headline: 'Alignment fair: 88 % of the script was heard in the recording.',
      model: 'small, 2 attempts',
    });
    expect(view.mismatches).toEqual([
      { key: '0:12.34', t: 12.34, time: '0:12', script: 'sixty one KB', heard: '61 kilobytes' },
    ]);
    expect(alignmentView({ ...WORDS, coverage: 0.5 }).tone).toBe('bad');
    expect(alignmentView(null).mismatches).toEqual([]);
  });

  it('reads the recording and the words from the files when the reports are missing', () => {
    expect(
      voiceoverFile(['audio/vo.original.prev.wav', 'audio/vo.original.wav', 'audio/vo.clean.wav']),
    ).toBe('audio/vo.original.wav');
    expect(voiceoverFile(['audio/vo.original.prev.m4a', 'script.txt'])).toBeNull();
    expect(voFit(null, true)).toEqual({
      tone: 'none',
      headline: 'Not compared with the script yet.',
      details: [],
    });
    expect(voFit(null).headline).toBe('No voice-over yet: import a file or record one.');
    expect(voFit(REPORT, true).headline).toBe('Recording 0:21: shorter than the script needs.');
    const timed = alignmentView(null, true);
    expect(timed.headline).toBe('Words are timed · not compared with the script word by word yet.');
    expect(timed.headline).not.toContain('Run Words timed');
    expect(alignmentView(null).headline).toContain('Run Words timed');
    expect(alignmentView(WORDS, true).headline).toContain('Alignment fair');
  });

  it('offers the next larger whisper model', () => {
    expect(biggerWhisperModel('small')).toBe('medium');
    expect(biggerWhisperModel('medium')).toBe('large-v3-turbo-q5_0');
    expect(biggerWhisperModel('large-v3-turbo-q5_0')).toBeNull();
    expect(biggerWhisperModel(null)).toBeNull();
  });

  it('explains a CPU transcription when a GPU build was tried', () => {
    expect(cpuTranscriptionHint(WORDS)).toBeNull();
    const engine = { backend: 'blas', usedGpu: false, wallMs: 51_000, audioS: 38.2 };
    expect(cpuTranscriptionHint({ ...WORDS, engine: { ...engine, cpuReason: null } })).toBeNull();
    const hint = cpuTranscriptionHint({
      ...WORDS,
      engine: { ...engine, cpuReason: 'CUDA unavailable: no CUDA-capable device is detected' },
    });
    expect(hint).toContain('slow: 51 s for 38 s of audio');
    expect(hint).toContain('because CUDA unavailable: no CUDA-capable device is detected');
    expect(hint).toContain('High performance');
  });
});
