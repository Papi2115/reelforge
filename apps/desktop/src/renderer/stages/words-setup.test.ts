import { describe, expect, it } from 'vitest';
import type { WhisperProgress, WhisperReadiness } from '../../shared/whisper-contract.js';
import { approxSize, needsWhisper, wordsSetupView } from './words-setup.js';

const MISSING: WhisperReadiness = {
  ready: false,
  model: 'large-v3-turbo-q5_0',
  missing: ['engine', 'vad', 'model'],
  bytes: 596_286_527,
};
const READY: WhisperReadiness = { ...MISSING, ready: true, missing: [], bytes: 0 };

const progress = (phase: WhisperProgress['phase'], kind: 'setup' | 'engine' = 'setup') =>
  ({
    job: { kind },
    phase,
    label: 'Downloading whisper.cpp (CPU build)',
    step: 1,
    steps: 3,
    receivedBytes: 10_000_000,
    totalBytes: 596_286_527,
    bytesPerSecond: null,
    etaS: null,
    message: phase === 'failed' ? 'Could not reach the download server.' : null,
    detail: phase === 'failed' ? 'fetch failed' : null,
  }) satisfies WhisperProgress;

describe('words setup notice', () => {
  it('rounds the size', () => {
    expect(approxSize(596_286_527)).toBe('≈ 600 MB');
    expect(approxSize(869_268_861)).toBe('≈ 870 MB');
  });

  it('stays hidden while nothing is held back or whisper is ready', () => {
    const base = { readiness: MISSING, progress: undefined, held: null, wordsError: null };
    expect(wordsSetupView(base)).toEqual({ kind: 'hidden' });
    expect(wordsSetupView({ ...base, readiness: READY, held: ['words'] })).toEqual({
      kind: 'hidden',
    });
  });

  it('a held Run or a missing-tool failure asks to download and continue', () => {
    const expected = {
      kind: 'needed',
      text: 'Words timed needs the transcription engine (≈ 600 MB, one-time)',
      buttonLabel: 'Download and continue',
    };
    expect(
      wordsSetupView({
        readiness: MISSING,
        progress: undefined,
        held: ['words'],
        wordsError: null,
      }),
    ).toEqual(expected);
    expect(
      wordsSetupView({
        readiness: MISSING,
        progress: undefined,
        held: null,
        wordsError: { kind: 'missing-tool', message: 'needs whisper', issues: [] },
      }),
    ).toEqual(expected);
    expect(
      wordsSetupView({
        readiness: MISSING,
        progress: undefined,
        held: null,
        wordsError: { kind: 'tool', message: 'ffmpeg failed', issues: [] },
      }).kind,
    ).toBe('hidden');
  });

  it('shows the running setup job, then its failure', () => {
    const installing = wordsSetupView({
      readiness: MISSING,
      progress: progress('running'),
      held: ['words'],
      wordsError: null,
    });
    expect(installing.kind === 'installing' && installing.progress.percent).toBe(1);
    expect(
      wordsSetupView({
        readiness: MISSING,
        progress: progress('failed'),
        held: ['words'],
        wordsError: null,
      }),
    ).toEqual({
      kind: 'failed',
      message: 'Could not reach the download server.',
      detail: 'fetch failed',
    });
    // An engine job from Settings is not this notice's download.
    expect(
      wordsSetupView({
        readiness: MISSING,
        progress: progress('failed', 'engine'),
        held: ['words'],
        wordsError: null,
      }).kind,
    ).toBe('needed');
  });

  it('knows which runs need whisper', () => {
    expect(needsWhisper(['clean', 'words'])).toBe(true);
    expect(needsWhisper(['storyboard'])).toBe(false);
  });
});
