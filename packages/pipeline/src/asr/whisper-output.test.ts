import { describe, expect, it } from 'vitest';
import {
  WhisperJsonSchema,
  calibrateDtw,
  parseVadSegments,
  planChunks,
  shiftWords,
  wordsFromWhisperJson,
} from './whisper-output.js';

/** Shape of a real `whisper-cli -ml 1 -sow -ojf -dtw` chunk (trimmed). */
const CHUNK_JSON: unknown = {
  systeminfo: 'WHISPER : CUDA',
  result: { language: 'en' },
  transcription: [
    {
      offsets: { from: 0, to: 170 },
      text: '',
      tokens: [{ text: '[_BEG_]', p: 0.83, t_dtw: -1 }],
    },
    {
      offsets: { from: 170, to: 390 },
      text: ' In',
      tokens: [{ text: ' In', p: 0.824649, t_dtw: 40 }],
    },
    {
      offsets: { from: 390, to: 2800 },
      text: ' 1993,',
      tokens: [
        { text: ' 1993', p: 0.981214, t_dtw: 190 },
        { text: ',', p: 0.748737, t_dtw: 294 },
      ],
    },
    {
      offsets: { from: 2800, to: 2960 },
      text: ' a',
      tokens: [{ text: ' a', p: 0.811969 }],
    },
  ],
};

describe('wordsFromWhisperJson', () => {
  it('turns -ml 1 segments into words with DTW times and mean token probability', () => {
    const json = WhisperJsonSchema.parse(CHUNK_JSON);
    expect(wordsFromWhisperJson(json)).toEqual([
      { text: 'In', t: 0.17, tEnd: 0.39, p: 0.825, tDtw: 0.4 },
      { text: '1993,', t: 0.39, tEnd: 2.8, p: 0.865, tDtw: 1.9 },
      { text: 'a', t: 2.8, tEnd: 2.96, p: 0.812, tDtw: null },
    ]);
  });

  it('shifts chunk-relative times onto the input timeline', () => {
    const words = wordsFromWhisperJson(WhisperJsonSchema.parse(CHUNK_JSON));
    const shifted = shiftWords(words, 10);
    expect(shifted[0]).toMatchObject({ t: 10.17, tDtw: 10.4 });
    expect(shifted[2]?.tDtw).toBeNull();
  });
});

describe('parseVadSegments', () => {
  it('reads centisecond segments from stdout', () => {
    const stdout = [
      '',
      'Detected 2 speech segments:',
      'Speech segment 0: start = 157.00, end = 797.00',
      'Speech segment 1: start = 871.00, end = 1152.00',
      '',
    ].join('\n');
    expect(parseVadSegments(stdout)).toEqual([
      { start: 1.57, end: 7.97 },
      { start: 8.71, end: 11.52 },
    ]);
  });

  it('ignores the seconds-based stderr format', () => {
    expect(
      parseVadSegments('whisper_vad_segments_from_probs: VAD segment 1: start = 8.71, end = 11.52'),
    ).toEqual([]);
  });
});

describe('planChunks', () => {
  const segments = [
    { start: 1.57, end: 7.97 },
    { start: 8.71, end: 11.52 },
    { start: 12.26, end: 20.83 },
    { start: 24.1, end: 30.49 },
    { start: 31.3, end: 32.89 },
    { start: 33.6, end: 41.53 },
  ];

  it('splits at long pauses, merges short ones and pads', () => {
    expect(planChunks(segments, 43.2)).toEqual([
      { start: 1.32, end: 21.08 },
      { start: 23.85, end: 41.78 },
    ]);
  });

  it('caps chunk length', () => {
    const chunks = planChunks(segments, 43.2, { maxChunkS: 10, padS: 0 });
    expect(chunks).toEqual([
      { start: 1.57, end: 11.52 },
      { start: 12.26, end: 20.83 },
      { start: 24.1, end: 32.89 },
      { start: 33.6, end: 41.53 },
    ]);
  });

  it('clamps padding to the file', () => {
    expect(planChunks([{ start: 0.1, end: 4.9 }], 5)).toEqual([{ start: 0, end: 5 }]);
  });
});

describe('calibrateDtw', () => {
  it('moves starts earlier by the lead and ends at the next start', () => {
    const words = [
      { text: 'a', t: 1, tEnd: 1.4, p: 0.9, tDtw: 1.5 },
      { text: 'b', t: 1.4, tEnd: 1.8, p: 0.9, tDtw: null },
      { text: 'c', t: 1.8, tEnd: 3.5, p: 0.9, tDtw: 2.2 },
    ];
    expect(calibrateDtw(words, 0.2)).toEqual([
      { text: 'a', t: 1.3, tEnd: 2, p: 0.9, tDtw: 1.5 },
      { text: 'b', t: 1.4, tEnd: 2, p: 0.9, tDtw: null },
      { text: 'c', t: 2, tEnd: 3, p: 0.9, tDtw: 2.2 },
    ]);
  });

  it('never produces negative times', () => {
    expect(calibrateDtw([{ text: 'a', t: 0, tEnd: 0.3, p: 1, tDtw: 0.1 }], 0.21)[0]).toMatchObject({
      t: 0,
      tEnd: 0.3,
    });
  });
});
