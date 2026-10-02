/** Every expected whisper.cpp failure, discriminated by `kind`. Library code returns these. */
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
    }
  | {
      readonly kind: 'checksum-mismatch';
      readonly message: string;
      readonly url: string;
      readonly expected: string;
      readonly actual: string;
    }
  | { readonly kind: 'extract-failed'; readonly message: string; readonly path: string }
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
  | { readonly kind: 'io'; readonly message: string; readonly path: string };

export type WhisperErrorKind = WhisperError['kind'];
