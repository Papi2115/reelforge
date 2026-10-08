/**
 * ElevenLabs HTTPS client (PLAN.md#13.14, CLAUDE.md §3.4 exception): plain `fetch`, no SDK. Only
 * the app's main process uses it, with the user's channel key. Every request carries
 * `xi-api-key`; the key lives in a private field and never reaches an error, an event or a log
 * (`redactSecret` on everything built from responses or exceptions). 429/5xx/network/timeouts are
 * retried with exponential backoff + jitter (Retry-After honoured); 401/402/403/422 never.
 * A shared limiter caps in-flight requests at the plan's concurrency (default 2).
 */
import type { z } from 'zod';
import type { FetchLike } from '../asr/download.js';
import { err, ok, type Result } from '../result.js';
import {
  describeError,
  describeWithCause,
  errorBodySummary,
  isRetryable,
  parseRetryAfter,
  redactSecret,
  statusKind,
  voiceError,
  type VoiceError,
} from './errors.js';
import { ConcurrencyLimiter, DEFAULT_CONCURRENCY } from './limiter.js';
import { MAX_STITCH_IDS } from './models.js';
import {
  headerNumber,
  speechRequestBody,
  stringLabels,
  subscriptionResponseSchema,
  timestampsResponseSchema,
  toAlignment,
  voicesPageSchema,
  type GenerateSpeechRequest,
  type GeneratedSpeech,
} from './wire.js';

export { speechRequestBody, type GenerateSpeechRequest, type GeneratedSpeech } from './wire.js';

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';

export interface RetryPolicy {
  /** Total attempts including the first (default 5). */
  readonly maxAttempts: number;
  /** First backoff delay (default 500 ms), doubled per attempt. */
  readonly baseDelayMs: number;
  /** Backoff cap (default 8 s); a longer Retry-After still wins. */
  readonly maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 8_000 };

export type VoiceClientEvent = {
  readonly kind: 'retry';
  readonly operation: string;
  readonly attempt: number;
  readonly delayMs: number;
  readonly error: VoiceError;
};

export interface ElevenLabsClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetch?: FetchLike;
  /** In-flight request cap (default 2 = the Free plan; see `concurrencyForTier`). */
  readonly maxConcurrency?: number;
  readonly retry?: Partial<RetryPolicy>;
  /** Per-attempt timeout (default 120 s). */
  readonly timeoutMs?: number;
  /** Jitter source in [0, 1) (tests inject a constant). */
  readonly random?: () => number;
  /** Waits `ms` unless aborted; resolves false when aborted (tests inject a recorder). */
  readonly sleep?: (ms: number, signal: AbortSignal | undefined) => Promise<boolean>;
  /** Retry notifications (already redacted) for the caller's log. */
  readonly onEvent?: (event: VoiceClientEvent) => void;
}

export interface ElevenLabsSubscription {
  readonly tier: string;
  readonly status: string | null;
  readonly characterCount: number;
  readonly characterLimit: number;
  readonly nextResetUnix: number | null;
}

export interface ElevenLabsVoice {
  readonly voiceId: string;
  readonly name: string;
  readonly category: string | null;
  readonly labels: Readonly<Record<string, string>>;
  readonly previewUrl: string | null;
}

const MAX_VOICE_PAGES = 20;

function defaultSleep(ms: number, signal: AbortSignal | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve(false);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class ElevenLabsClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #retry: RetryPolicy;
  readonly #timeoutMs: number;
  readonly #random: () => number;
  readonly #sleep: (ms: number, signal: AbortSignal | undefined) => Promise<boolean>;
  readonly #onEvent: ((event: VoiceClientEvent) => void) | undefined;
  readonly limiter: ConcurrencyLimiter;

  constructor(options: ElevenLabsClientOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? ELEVENLABS_BASE_URL).replace(/\/+$/, '');
    this.#fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.#retry = { ...DEFAULT_RETRY, ...options.retry };
    this.#timeoutMs = options.timeoutMs ?? 120_000;
    this.#random = options.random ?? Math.random;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#onEvent = options.onEvent;
    this.limiter = new ConcurrencyLimiter(options.maxConcurrency ?? DEFAULT_CONCURRENCY);
  }

  /** `GET /v1/user/subscription`: validates the key and reads the quota. */
  async getSubscription(signal?: AbortSignal): Promise<Result<ElevenLabsSubscription, VoiceError>> {
    const response = await this.#request(
      'subscription',
      '/v1/user/subscription',
      { method: 'GET' },
      signal,
      (res) => res.text(),
    );
    if (!response.ok) return response;
    const parsed = this.#parseJson(response.value.body, subscriptionResponseSchema);
    if (!parsed.ok) return parsed;
    const wire = parsed.value;
    return ok({
      tier: wire.tier,
      status: wire.status ?? null,
      characterCount: wire.character_count,
      characterLimit: wire.character_limit,
      nextResetUnix: wire.next_character_count_reset_unix ?? null,
    });
  }

  /** `GET /v2/voices` (all pages, up to 20 x 100 voices). */
  async listVoices(
    query: { readonly search?: string; readonly voiceType?: string } = {},
    signal?: AbortSignal,
  ): Promise<Result<ElevenLabsVoice[], VoiceError>> {
    const voices: ElevenLabsVoice[] = [];
    let token: string | null = null;
    for (let page = 0; page < MAX_VOICE_PAGES; page++) {
      const params = new URLSearchParams({ page_size: '100' });
      if (query.search !== undefined) params.set('search', query.search);
      if (query.voiceType !== undefined) params.set('voice_type', query.voiceType);
      if (token !== null) params.set('next_page_token', token);
      const response = await this.#request(
        'voices',
        `/v2/voices?${params.toString()}`,
        { method: 'GET' },
        signal,
        (res) => res.text(),
      );
      if (!response.ok) return response;
      const parsed = this.#parseJson(response.value.body, voicesPageSchema);
      if (!parsed.ok) return parsed;
      for (const voice of parsed.value.voices) {
        voices.push({
          voiceId: voice.voice_id,
          name: voice.name,
          category: voice.category ?? null,
          labels: stringLabels(voice.labels),
          previewUrl: voice.preview_url ?? null,
        });
      }
      token = parsed.value.has_more === true ? (parsed.value.next_page_token ?? null) : null;
      if (token === null) break;
    }
    return ok(voices);
  }

  /** `POST /v1/text-to-speech/{voice_id}[/with-timestamps]`. */
  async generate(
    request: GenerateSpeechRequest,
    signal?: AbortSignal,
  ): Promise<Result<GeneratedSpeech, VoiceError>> {
    const invalid = this.#checkRequest(request);
    if (invalid !== null) return err(invalid);
    const voicePath = `/v1/text-to-speech/${encodeURIComponent(request.voiceId)}`;
    const withTimestamps = request.withTimestamps === true;
    const route = `${voicePath}${withTimestamps ? '/with-timestamps' : ''}?${new URLSearchParams({ output_format: request.outputFormat }).toString()}`;
    const init: RequestInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(speechRequestBody(request)),
    };
    if (!withTimestamps) {
      const response = await this.#request(
        'generate',
        route,
        init,
        signal,
        async (res) => new Uint8Array(await res.arrayBuffer()),
      );
      if (!response.ok) return response;
      return ok({
        audio: response.value.body,
        ...response.value.meta,
        alignment: null,
        normalizedAlignment: null,
      });
    }
    const response = await this.#request('generate', route, init, signal, (res) => res.text());
    if (!response.ok) return response;
    const parsed = this.#parseJson(response.value.body, timestampsResponseSchema);
    if (!parsed.ok) return parsed;
    return ok({
      audio: new Uint8Array(Buffer.from(parsed.value.audio_base64, 'base64')),
      ...response.value.meta,
      alignment: toAlignment(parsed.value.alignment),
      normalizedAlignment: toAlignment(parsed.value.normalized_alignment),
    });
  }

  #checkRequest(request: GenerateSpeechRequest): VoiceError | null {
    if (request.voiceId.trim() === '') return voiceError('invalid-input', 'no voice id');
    if (request.text.trim() === '') return voiceError('invalid-input', 'no text to speak');
    const tooMany = [request.previousRequestIds, request.nextRequestIds].some(
      (ids) => ids !== undefined && ids.length > MAX_STITCH_IDS,
    );
    return tooMany
      ? voiceError('invalid-input', `at most ${String(MAX_STITCH_IDS)} request ids per side`)
      : null;
  }

  #parseJson<S extends z.ZodType>(body: string, schema: S): Result<z.output<S>, VoiceError> {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch (error) {
      return err(voiceError('invalid-response', this.#redact(`not JSON: ${describeError(error)}`)));
    }
    const parsed = schema.safeParse(json);
    if (parsed.success) return ok(parsed.data);
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`);
    return err(voiceError('invalid-response', this.#redact(issues.join('; '))));
  }

  #redact(text: string): string {
    return redactSecret(text, this.#apiKey);
  }

  async #request<T>(
    operation: string,
    route: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    read: (response: Response) => Promise<T>,
  ): Promise<
    Result<
      { body: T; meta: { requestId: string | null; characterCost: number | null } },
      VoiceError
    >
  > {
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted === true) return err(voiceError('aborted', 'cancelled'));
      const result = await this.limiter.run(() => this.#attempt(route, init, signal, read));
      if (result.ok) return result;
      const error: VoiceError = { ...result.error, attempts: attempt };
      if (!isRetryable(error) || attempt >= this.#retry.maxAttempts) return err(error);
      const backoff = Math.min(
        this.#retry.maxDelayMs,
        this.#retry.baseDelayMs * 2 ** (attempt - 1),
      );
      const delayMs = Math.round(
        Math.max(backoff * (0.5 + 0.5 * this.#random()), error.retryAfterMs ?? 0),
      );
      this.#onEvent?.({ kind: 'retry', operation, attempt, delayMs, error });
      if (!(await this.#sleep(delayMs, signal))) return err(voiceError('aborted', 'cancelled'));
    }
  }

  async #attempt<T>(
    route: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    read: (response: Response) => Promise<T>,
  ): Promise<
    Result<
      { body: T; meta: { requestId: string | null; characterCost: number | null } },
      VoiceError
    >
  > {
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    const headers = new Headers(init.headers);
    headers.set('xi-api-key', this.#apiKey);
    headers.set('accept', '*/*');
    try {
      const response = await this.#fetch(`${this.#baseUrl}${route}`, {
        ...init,
        headers,
        signal: combined,
      });
      if (!response.ok) {
        const text = await response.text().catch((error: unknown) => describeError(error));
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), Date.now());
        const summary = errorBodySummary(text);
        return err({
          kind: statusKind(response.status),
          message: this.#redact(
            `HTTP ${String(response.status)}${summary === '' ? '' : `: ${summary}`}`,
          ),
          status: response.status,
          ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
        });
      }
      const body = await read(response);
      return ok({
        body,
        meta: {
          requestId: response.headers.get('request-id'),
          characterCost: headerNumber(response.headers.get('character-cost')),
        },
      });
    } catch (error) {
      if (signal?.aborted === true) return err(voiceError('aborted', 'cancelled'));
      if (timeout.aborted) {
        return err(voiceError('timeout', `no answer within ${String(this.#timeoutMs)} ms`));
      }
      return err(voiceError('network', this.#redact(describeWithCause(error))));
    }
  }
}
