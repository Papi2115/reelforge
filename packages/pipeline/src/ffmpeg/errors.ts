/** Every expected ffmpeg failure, discriminated by `kind`. Library code returns these, never throws. */
export type FfmpegError =
  | {
      readonly kind: 'not-found';
      readonly message: string;
      /** Candidate paths that were checked, in order. */
      readonly searched: readonly string[];
    }
  | { readonly kind: 'spawn-failed'; readonly message: string; readonly command: string }
  | {
      readonly kind: 'exit-code';
      readonly message: string;
      readonly code: number | null;
      readonly signal: string | null;
      /** Last lines of stderr, for display. */
      readonly stderrTail: string;
    }
  | { readonly kind: 'cancelled'; readonly message: string }
  | { readonly kind: 'timeout'; readonly message: string; readonly timeoutMs: number }
  | { readonly kind: 'probe-failed'; readonly message: string }
  | {
      readonly kind: 'missing-capability';
      readonly message: string;
      readonly missing: readonly string[];
    }
  | { readonly kind: 'parse-failed'; readonly message: string }
  | { readonly kind: 'invalid-input'; readonly message: string }
  | { readonly kind: 'io'; readonly message: string; readonly path: string };

export type FfmpegErrorKind = FfmpegError['kind'];

/** Keeps the last `maxLines` non-empty lines of a stderr dump. */
export function stderrTail(stderr: string, maxLines = 15): string {
  const lines = stderr.split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.slice(-maxLines).join('\n');
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
