/**
 * Hardware encoder open failures (docs/export.md "Encoder fallback"): `detectEncoder` can probe
 * NVENC fine and the real session still fail to open moments later when the GPU is busy or out of
 * memory (`InitializeEncoder failed: out of memory (10)` on a 6 GB laptop GPU). Such a failure is
 * retried once per segment after a short delay; a second one switches the export to libx264.
 */
import type { ExportError } from './errors.js';

/** ffmpeg stderr lines of an encoder that could not open a session. */
export const ENCODER_OPEN_FAILURE_PATTERNS: readonly RegExp[] = [
  /InitializeEncoder failed/i,
  /OpenEncodeSessionEx failed/i,
  /Error while opening encoder/i,
  /No capable devices found/i,
  /out of memory/i,
];

/** What the app shows when an export switches to the CPU encoder. */
export const ENCODER_FALLBACK_MESSAGE = 'GPU encoder unavailable, using CPU for this export';

/** Pause before the one retry of a segment whose hardware encoder failed to open. */
export const DEFAULT_ENCODER_RETRY_DELAY_MS = 1500;

/** Per-worker delay of the first segment open with a hardware encoder (no simultaneous opens). */
export const DEFAULT_ENCODER_STAGGER_MS = 400;

function failureLines(error: ExportError): string[] {
  if (error.kind !== 'encoder') return [];
  const tail = error.ffmpeg?.kind === 'exit-code' ? error.ffmpeg.stderrTail : '';
  return [...tail.split('\n'), error.message].filter((line) => line.trim() !== '');
}

function matchingLine(error: ExportError): string | undefined {
  return failureLines(error).find((line) =>
    ENCODER_OPEN_FAILURE_PATTERNS.some((pattern) => pattern.test(line)),
  );
}

/** True when an encoder error says the encoder could not open (not a bad frame or a kill). */
export function isEncoderOpenFailure(error: ExportError): boolean {
  return matchingLine(error) !== undefined;
}

/** The stderr line naming the open failure (for logs and warnings), else the error message. */
export function openFailureDetail(error: ExportError): string {
  return (matchingLine(error) ?? error.message).trim();
}

/** Waits `ms` unless `signal` aborts first; true when the whole delay passed. */
export function abortableDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (ms <= 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
