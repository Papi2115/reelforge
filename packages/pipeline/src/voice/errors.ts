/**
 * Expected failures of ElevenLabs voice generation (PLAN.md#13.14), discriminated by `kind`.
 * Messages never contain the API key: everything built from a response, an exception or a
 * request goes through `redactSecret` first.
 */

export type VoiceErrorKind =
  /** 401: invalid or missing key. Not retried. */
  | 'auth'
  /** 402: out of credits / payment required. Not retried. */
  | 'payment'
  /** 403: key lacks a permission, IP not allowlisted, feature not on the plan. Not retried. */
  | 'forbidden'
  /** 400/422: the request is invalid. Not retried. */
  | 'validation'
  /** 429: plan concurrency or "system busy". Retried with backoff. */
  | 'rate-limit'
  /** 5xx. Retried with backoff. */
  | 'server'
  /** Another HTTP status. Not retried. */
  | 'http'
  /** Connection failed / reset. Retried with backoff. */
  | 'network'
  /** The per-request timeout fired. Retried with backoff. */
  | 'timeout'
  /** The caller's signal aborted. */
  | 'aborted'
  /** A 2xx response whose body does not have the documented shape. */
  | 'invalid-response'
  | 'invalid-input'
  | 'stale-manifest'
  | 'alignment'
  | 'decode'
  | 'io';

export interface VoiceError {
  readonly kind: VoiceErrorKind;
  readonly message: string;
  /** HTTP status when the error came from a response. */
  readonly status?: number;
  /** Retry-After of a 429/503 in milliseconds. */
  readonly retryAfterMs?: number;
  /** Attempts made before giving up (HTTP errors). */
  readonly attempts?: number;
}

export const REDACTED = '[redacted]';

/** Replaces every occurrence of `secret` in `text` (no-op for an empty secret). */
export function redactSecret(text: string, secret: string): string {
  return secret.length === 0 ? text : text.split(secret).join(REDACTED);
}

export function voiceError(kind: VoiceErrorKind, message: string): VoiceError {
  return { kind, message };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `fetch failed` alone says nothing: add the cause (e.g. `connect ECONNREFUSED`). */
export function describeWithCause(error: unknown): string {
  const cause =
    error instanceof Error && error.cause !== undefined ? describeError(error.cause) : '';
  const message = describeError(error);
  return cause === '' || cause === message ? message : `${message} (${cause})`;
}

/** Error kind of a non-2xx HTTP status. */
export function statusKind(status: number): VoiceErrorKind {
  if (status === 401) return 'auth';
  if (status === 402) return 'payment';
  if (status === 403) return 'forbidden';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  return 'http';
}

/** 429, 5xx, connection failures and timeouts are retried; 401/402/403/422 never. */
export function isRetryable(error: VoiceError): boolean {
  return (
    error.kind === 'rate-limit' ||
    error.kind === 'server' ||
    error.kind === 'network' ||
    error.kind === 'timeout'
  );
}

const MAX_RETRY_AFTER_MS = 60_000;

/** `Retry-After` (delta seconds or an HTTP date) in ms, capped at 60 s; undefined when absent. */
export function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const secondsValue = Number(value);
  if (Number.isFinite(secondsValue)) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, secondsValue * 1000));
  }
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - nowMs));
}

const MAX_DETAIL_CHARS = 300;

function detailText(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item: unknown) =>
        typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : null,
      )
      .filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join('; ') : null;
  }
  if (typeof detail === 'object' && detail !== null) {
    const message = 'message' in detail ? detail.message : undefined;
    const status = 'status' in detail ? detail.status : undefined;
    if (typeof message === 'string') {
      return typeof status === 'string' ? `${status}: ${message}` : message;
    }
  }
  return null;
}

/** Short human text of an error body (`{detail: {status, message}}`, `{detail: [{msg}]}`, text). */
export function errorBodySummary(body: string): string {
  let text: string | null = null;
  try {
    const json: unknown = JSON.parse(body);
    if (typeof json === 'object' && json !== null && 'detail' in json) {
      text = detailText(json.detail);
    }
  } catch {
    // Not JSON: the raw text below is the summary.
    text = null;
  }
  const summary = (text ?? body).replace(/\s+/g, ' ').trim();
  return summary.length > MAX_DETAIL_CHARS ? `${summary.slice(0, MAX_DETAIL_CHARS)}…` : summary;
}

const KIND_TEXT: Readonly<Record<VoiceErrorKind, string>> = {
  auth: 'the ElevenLabs key was rejected (401)',
  payment: 'the ElevenLabs account is out of credits (402)',
  forbidden: 'the ElevenLabs key lacks a permission for this request (403)',
  validation: 'ElevenLabs rejected the request as invalid',
  'rate-limit': 'ElevenLabs is busy or the plan concurrency is reached (429)',
  server: 'ElevenLabs had a server error',
  http: 'ElevenLabs answered with an unexpected status',
  network: 'cannot reach ElevenLabs',
  timeout: 'ElevenLabs did not answer in time',
  aborted: 'cancelled',
  'invalid-response': 'ElevenLabs answered with an unexpected body',
  'invalid-input': 'invalid input',
  'stale-manifest': 'the takes no longer match the script',
  alignment: 'the timing data does not match the text',
  decode: 'cannot decode the audio',
  io: 'file error',
};

/** One-line headline of a kind (UI copy; the message carries the detail). */
export function voiceErrorHeadline(kind: VoiceErrorKind): string {
  return KIND_TEXT[kind];
}
