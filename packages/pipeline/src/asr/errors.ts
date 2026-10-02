/** Every expected whisper.cpp failure, discriminated by `kind`. Library code returns these. */

/**
 * System error code behind a download / extraction / file failure when there is one (`ENOSPC`,
 * `EPERM`, `ENOTFOUND`, …, or `CLI_MISSING` when whisper-cli vanished after extraction), so the
 * app can turn it into an actionable message (disk full, offline, blocked by antivirus).
 */
export type FailureCode = string | undefined;

export interface WhisperAttemptFailure {
  readonly backend: string;
  readonly gpu: boolean;
  readonly message: string;
}

export type WhisperError =
  | {
      readonly kind: 'not-installed';
      readonly message: string;
      /** Candidate paths that were checked, in order. */
      readonly searched: readonly string[];
    }
  | { readonly kind: 'model-missing'; readonly message: string; readonly path: string }
  | {
      readonly kind: 'download-failed';
      readonly message: string;
      readonly url: string;
      readonly status: number | null;
      readonly code?: FailureCode;
    }
  | {
      readonly kind: 'checksum-mismatch';
      readonly message: string;
      readonly url: string;
      readonly expected: string;
      readonly actual: string;
    }
  | {
      readonly kind: 'extract-failed';
      readonly message: string;
      readonly path: string;
      readonly code?: FailureCode;
    }
  | {
      readonly kind: 'process-failed';
      readonly message: string;
      /** Every backend tried (GPU first, then CPU fallbacks), in order. */
      readonly attempts: readonly WhisperAttemptFailure[];
    }
  | { readonly kind: 'ffmpeg-failed'; readonly message: string }
  | { readonly kind: 'no-speech'; readonly message: string }
  | { readonly kind: 'parse-failed'; readonly message: string; readonly path: string }
  | { readonly kind: 'cancelled'; readonly message: string }
  | {
      readonly kind: 'io';
      readonly message: string;
      readonly path: string;
      readonly code?: FailureCode;
    };

/** `code` of a Node system error, also when wrapped as `cause` (undici's "fetch failed"). */
export function systemErrorCode(error: unknown): string | undefined {
  for (let current = error, depth = 0; depth < 4; depth++) {
    if (typeof current !== 'object' || current === null) return undefined;
    const code: unknown = (current as { code?: unknown }).code;
    if (typeof code === 'string' && code !== '') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export type WhisperErrorKind = WhisperError['kind'];
