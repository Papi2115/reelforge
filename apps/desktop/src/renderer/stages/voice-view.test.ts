import { describe, expect, it } from 'vitest';
import type { VoiceEstimateResult, VoiceProgress } from '../../shared/voice-contract.js';
import {
  estimateView,
  groupDigits,
  progressView,
  retakeSummary,
  sentenceRows,
  setupPointer,
} from './voice-view.js';

type OkEstimate = Extract<VoiceEstimateResult, { status: 'ok' }>;

const ESTIMATE: OkEstimate = {
  status: 'ok',
  characters: 5_400,
  pendingCharacters: 5_400,
  paragraphs: 12,
  reusedParagraphs: 0,
  estimatedCredits: 5_400,
  remaining: 15_000,
  share: 0.36,
  summary: 'about 5,400 characters (36% of your remaining 15,000)',
  warning: null,
  quotaNote: null,
};

const PROGRESS: VoiceProgress = {
  projectDir: 'C:\\films\\a',
  phase: 'generating',
  done: 2,
  total: 8,
  characters: 1_234,
  costSoFar: 1_234,
  note: null,
  finished: false,
};

describe('voice view', () => {
  it('groups digits independent of the locale', () => {
    expect(groupDigits(5_400)).toBe('5,400');
    expect(groupDigits(1_234_567)).toBe('1,234,567');
    expect(groupDigits(12)).toBe('12');
  });

  it('points to Settings → Channels for what is missing', () => {
    const base = { status: 'missing', channelId: 'c', channelName: 'C' } as const;
    expect(setupPointer({ ...base, missing: ['voice', 'key'] })).toBe(
      'To generate the voice with ElevenLabs, add a voice and key for this channel in Settings → Channels.',
    );
    expect(setupPointer({ ...base, missing: ['key'] })).toContain('add a key for this channel');
    expect(setupPointer({ ...base, missing: ['voice'] })).toContain('add a voice for this channel');
    expect(
      setupPointer({ status: 'ready', channelId: 'c', channelName: 'C', voiceId: 'v', model: 'm' }),
    ).toBeNull();
    expect(setupPointer({ status: 'unavailable', message: 'No project is open.' })).toBeNull();
  });

  it('writes the estimate line before spending', () => {
    expect(estimateView(ESTIMATE)).toEqual({
      line: 'About 5,400 characters · 36% of your remaining 15,000',
      details: [],
      warning: null,
      free: false,
      confirmLabel: 'Generate (5,400 characters)',
    });
    const offline = estimateView({
      ...ESTIMATE,
      remaining: null,
      share: null,
      reusedParagraphs: 4,
      quotaNote: 'Quota unknown: Cannot reach ElevenLabs right now.',
    });
    expect(offline.line).toBe('About 5,400 characters · quota unknown');
    expect(offline.details).toEqual([
      '4 of 12 paragraphs already generated: reused for free.',
      'Quota unknown: Cannot reach ElevenLabs right now.',
    ]);
    expect(estimateView({ ...ESTIMATE, share: 0.004 }).line).toContain('<1% of your remaining');
    const free = estimateView({ ...ESTIMATE, pendingCharacters: 0, estimatedCredits: 0 });
    expect(free).toMatchObject({ free: true, confirmLabel: 'Use the generated voice' });
  });

  it('shows the progress of paragraphs, characters and retries', () => {
    expect(progressView(PROGRESS)).toEqual({
      percent: 25,
      line: 'Paragraph 3 of 8 · 1,234 characters sent (about 1,234 used)',
    });
    expect(progressView({ ...PROGRESS, total: 0, done: 0 })).toEqual({
      percent: null,
      line: 'Checking the ElevenLabs account…',
    });
    expect(progressView({ ...PROGRESS, phase: 'importing' }).line).toBe(
      'Importing the generated voice-over…',
    );
    expect(progressView({ ...PROGRESS, phase: 'retaking', done: 0, total: 1 }).line).toBe(
      'Speaking the paragraph again · 1,234 characters sent (about 1,234 used)',
    );
  });

  it('says which shots a retake changed and which only move', () => {
    expect(
      retakeSummary({
        status: 'ok',
        sentenceIds: ['p01-s00', 'p01-s01'],
        changedShotIds: ['s02', 's03'],
        shiftedShotIds: ['s04', 's05'],
        shiftS: -0.4,
        characters: 44,
      }),
    ).toBe(
      'Redone the whole paragraph (2 sentences). Shots that changed: s02, s03 (the voice under them is new). 2 later shots move by −0.40 s.',
    );
    expect(
      retakeSummary({
        status: 'ok',
        sentenceIds: ['p00-s00'],
        changedShotIds: [],
        shiftedShotIds: [],
        shiftS: 0,
        characters: 10,
      }),
    ).toBe('Redone. No storyboard shot is under it yet.');
  });

  it('builds sentence rows with play spans and the redo cost', () => {
    expect(
      sentenceRows([
        {
          id: 'p00-s00',
          paragraph: 0,
          text: 'Doom runs.',
          start: 0,
          end: 0.8,
          takes: 1,
          redoCharacters: 10,
        },
        {
          id: 'p01-s00',
          paragraph: 1,
          text: 'Calculator.',
          start: null,
          end: null,
          takes: 3,
          redoCharacters: 1_200,
        },
      ]),
    ).toEqual([
      {
        id: 'p00-s00',
        text: 'Doom runs.',
        time: '0:00',
        span: { start: 0, end: 0.8 },
        takes: null,
        redoHint: 'The whole paragraph is spoken again (about 10 characters).',
      },
      {
        id: 'p01-s00',
        text: 'Calculator.',
        time: '—',
        span: null,
        takes: '3 takes',
        redoHint: 'The whole paragraph is spoken again (about 1,200 characters).',
      },
    ]);
  });
});
