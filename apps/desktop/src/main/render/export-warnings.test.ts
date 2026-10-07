import { ENCODER_FALLBACK_MESSAGE, type ExportWarning } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import {
  simulatedFallbackWarning,
  userWarning,
  userWarnings,
  warningLogLine,
} from './export-warnings.js';

const RETRY: ExportWarning = {
  type: 'encoder-retry',
  encoder: 'h264_nvenc',
  shotId: 's02',
  detail: 'InitializeEncoder failed: out of memory (10)',
  message: 'GPU encoder failed to open for shot s02; retrying',
};

const FALLBACK: ExportWarning = {
  type: 'encoder-fallback',
  from: 'h264_nvenc',
  to: 'libx264',
  detail: 'InitializeEncoder failed: out of memory (10)',
  message: ENCODER_FALLBACK_MESSAGE,
};

describe('export warnings', () => {
  it('logs retries and the fallback with the ffmpeg detail', () => {
    expect(warningLogLine(RETRY)).toBe(
      'encoder h264_nvenc failed to open for s02, retrying: InitializeEncoder failed: out of memory (10)',
    );
    expect(warningLogLine(FALLBACK)).toBe(
      'encoder h264_nvenc failed to open again, the export restarts with libx264: InitializeEncoder failed: out of memory (10)',
    );
  });

  it('shows the user only the switch to the CPU encoder, once', () => {
    expect(userWarning(RETRY)).toBeNull();
    expect(userWarning(FALLBACK)).toBe('GPU encoder unavailable, using CPU for this export');
    expect(userWarnings([RETRY, FALLBACK, RETRY, FALLBACK])).toEqual([ENCODER_FALLBACK_MESSAGE]);
    expect(userWarnings([RETRY])).toEqual([]);
  });

  it('simulates the real fallback warning for the smoke tests', () => {
    expect(userWarning(simulatedFallbackWarning())).toBe(ENCODER_FALLBACK_MESSAGE);
  });
});
