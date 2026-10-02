/**
 * Failure classification for a finished turn. The usage-limit stream shape is UNKNOWN live
 * (ADR-001): we accept any of `rate_limit_event{status:"rejected"}`, `assistant.error:"rate_limit"`,
 * or limit wording in an error text. Pausing/resuming on limits is PLAN.md#5.4, not here.
 */
import type { StreamEvent } from './events.js';

export type FailureKind = 'auth' | 'limit' | 'session-not-found' | 'api' | 'unknown';

/** Verified on 2.1.287: `--resume <unknown id>` -> `result{is_error, errors:[this], num_turns:0}`. */
export const SESSION_NOT_FOUND_PATTERN = /No conversation found with session ID/i;

export interface LimitSignal {
  readonly source: 'rate-limit-event' | 'api-error' | 'text';
  readonly rateLimitType: string | undefined;
  /** Epoch seconds, when the CLI reported one. */
  readonly resetsAt: number | undefined;
  readonly message: string | undefined;
}

/** Wording heuristic, applied only to error texts (never to normal assistant prose). */
export const LIMIT_TEXT_PATTERN =
  /usage limit|rate limit|hit your (?:usage |session |weekly |opus |sonnet )?limit|limit reached|limit will reset/i;

const AUTH_ERRORS = new Set(['authentication_failed', 'oauth_org_not_allowed']);
const AUTH_TEXT_PATTERN = /not logged in|please run \/login|invalid api key/i;

/** Limit signal carried by a single event, if any. */
export function limitSignalOf(event: StreamEvent): LimitSignal | undefined {
  if (event.kind === 'rate-limit' && event.status === 'rejected') {
    return {
      source: 'rate-limit-event',
      rateLimitType: event.rateLimitType,
      resetsAt: event.resetsAt,
      message: undefined,
    };
  }
  if (event.kind === 'api-error' && event.error === 'rate_limit') {
    return {
      source: 'api-error',
      rateLimitType: undefined,
      resetsAt: undefined,
      message: event.text,
    };
  }
  const errorText =
    event.kind === 'api-error' || (event.kind === 'result' && event.isError) ? event.text : '';
  if (LIMIT_TEXT_PATTERN.test(errorText)) {
    return { source: 'text', rateLimitType: undefined, resetsAt: undefined, message: errorText };
  }
  return undefined;
}

/** Merges signals: prefer the one with a reset time, then the most structured source. */
export function mergeLimitSignals(
  current: LimitSignal | undefined,
  next: LimitSignal | undefined,
): LimitSignal | undefined {
  if (current === undefined || next === undefined) return current ?? next;
  return {
    source: current.source,
    rateLimitType: current.rateLimitType ?? next.rateLimitType,
    resetsAt: current.resetsAt ?? next.resetsAt,
    message: current.message ?? next.message,
  };
}

/** Classifies why an `is_error` turn failed, from all events it produced. */
export function classifyFailure(
  events: readonly StreamEvent[],
  limit: LimitSignal | undefined,
): FailureKind {
  const authFailed = events.some(
    (event) =>
      (event.kind === 'api-error' && AUTH_ERRORS.has(event.error)) ||
      ((event.kind === 'api-error' || (event.kind === 'result' && event.isError)) &&
        AUTH_TEXT_PATTERN.test(event.text)),
  );
  if (authFailed) return 'auth';
  if (limit !== undefined) return 'limit';
  const sessionMissing = events.some(
    (event) =>
      event.kind === 'result' &&
      event.errors.some((error) => SESSION_NOT_FOUND_PATTERN.test(error)),
  );
  if (sessionMissing) return 'session-not-found';
  if (events.some((event) => event.kind === 'api-error')) return 'api';
  return 'unknown';
}
