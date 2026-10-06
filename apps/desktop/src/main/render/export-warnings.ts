/**
 * The pipeline's export warnings in the app (docs/export.md "Encoder fallback"): one log line per
 * warning, and the lines the user sees in the export dialog (status line and report). A retry of
 * one segment is only logged; the switch of the whole export to the CPU encoder is shown.
 */
import { ENCODER_FALLBACK_MESSAGE, type ExportWarning } from '@reelforge/pipeline';

export function warningLogLine(warning: ExportWarning): string {
  return warning.type === 'encoder-retry'
    ? `encoder ${warning.encoder} failed to open for ${warning.shotId}, retrying: ${warning.detail}`
    : `encoder ${warning.from} failed to open again, the export restarts with ${warning.to}: ${warning.detail}`;
}

/** The line the user sees for a warning; null for a segment retry (it may still succeed). */
export function userWarning(warning: ExportWarning): string | null {
  return warning.type === 'encoder-fallback' ? warning.message : null;
}

/** The user lines of an export's warnings, each once, in order. */
export function userWarnings(warnings: readonly ExportWarning[]): string[] {
  const lines = warnings.flatMap((warning) => {
    const line = userWarning(warning);
    return line === null ? [] : [line];
  });
  return [...new Set(lines)];
}

/** The warning the smoke tests inject through the render test hooks (no GPU failure needed). */
export function simulatedFallbackWarning(): ExportWarning {
  return {
    type: 'encoder-fallback',
    from: 'h264_nvenc',
    to: 'libx264',
    detail: 'InitializeEncoder failed: out of memory (10) [test hook]',
    message: ENCODER_FALLBACK_MESSAGE,
  };
}
