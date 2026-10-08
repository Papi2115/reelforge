/**
 * Test-only local stand-in for the ElevenLabs API (node:http on 127.0.0.1, random port): the
 * subscription, voice list and TTS endpoints with deterministic audio (a cosine tone as raw
 * 16-bit pcm, or caller-provided bytes for compressed formats), uniform character alignment,
 * `request-id` / `character-cost` headers, scripted failures (429 + Retry-After, 401, 402, 5xx)
 * and an artificial delay to observe concurrency. Error bodies echo the received key so tests
 * can prove the client redacts it. Never used outside tests; no real network.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeFailure {
  readonly status: number;
  readonly retryAfterS?: number;
  readonly body?: string;
}

export interface FakeRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly apiKey: string | null;
  readonly body: unknown;
}

export interface FakeElevenLabsOptions {
  readonly apiKey: string;
  readonly tier?: string;
  readonly characterCount?: number;
  readonly characterLimit?: number;
  /** Seconds of audio per character of text (default 0.01). */
  readonly secondsPerChar?: number;
  /** `character-cost` = characters x this (default 1); null = header omitted. */
  readonly costMultiplier?: number | null;
  /** Delay before every answer (ms). */
  readonly delayMs?: number;
  /** Body for non-pcm formats (default: the pcm tone wrapped in nothing, i.e. raw pcm). */
  readonly compressedAudio?: Uint8Array;
  readonly voices?: readonly { readonly voice_id: string; readonly name: string }[];
}

export interface FakeElevenLabs {
  readonly url: string;
  readonly requests: FakeRequest[];
  /** Highest number of requests in flight at once (during `delayMs`). */
  readonly maxInFlight: () => number;
  /** The next `times` requests (any endpoint) fail with `failure`. */
  failNext(failure: FakeFailure, times?: number): void;
  close(): Promise<void>;
}

export const FAKE_SAMPLE_RATE = 44_100;

/** Deterministic cosine tone (starts at full amplitude: a hard edge without fades). */
export function toneSamples(durationS: number, frequency = 220, amplitude = 0.5): Int16Array {
  const frames = Math.max(1, Math.round(durationS * FAKE_SAMPLE_RATE));
  const samples = new Int16Array(frames);
  for (let k = 0; k < frames; k++) {
    samples[k] = Math.round(
      amplitude * 32767 * Math.cos((2 * Math.PI * frequency * k) / FAKE_SAMPLE_RATE),
    );
  }
  return samples;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', reject);
  });
}

function textOf(body: unknown): string {
  return typeof body === 'object' &&
    body !== null &&
    'text' in body &&
    typeof body.text === 'string'
    ? body.text
    : '';
}

function uniformAlignment(text: string, durationS: number): Record<string, unknown> {
  const characters = Array.from(text);
  const step = durationS / Math.max(1, characters.length);
  return {
    characters,
    character_start_times_seconds: characters.map((_, k) => Math.round(k * step * 1e4) / 1e4),
    character_end_times_seconds: characters.map((_, k) => Math.round((k + 1) * step * 1e4) / 1e4),
  };
}

export async function startFakeElevenLabs(options: FakeElevenLabsOptions): Promise<FakeElevenLabs> {
  const requests: FakeRequest[] = [];
  const failures: FakeFailure[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let ttsCount = 0;

  const send = (
    response: ServerResponse,
    status: number,
    body: string | Uint8Array,
    headers: Record<string, string> = {},
  ): void => {
    response.writeHead(status, headers);
    response.end(body);
  };

  const tts = (
    response: ServerResponse,
    voicePath: string,
    query: Record<string, string>,
    body: unknown,
  ): void => {
    const text = textOf(body);
    const durationS = Math.max(0.2, Array.from(text).length * (options.secondsPerChar ?? 0.01));
    const format = query['output_format'] ?? 'mp3_44100_128';
    const pcm = toneSamples(durationS);
    const audio = format.startsWith('pcm_')
      ? new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
      : (options.compressedAudio ?? new Uint8Array(pcm.buffer));
    ttsCount += 1;
    const headers: Record<string, string> = { 'request-id': `req-${String(ttsCount)}` };
    const multiplier = options.costMultiplier === undefined ? 1 : options.costMultiplier;
    if (multiplier !== null)
      headers['character-cost'] = String(Math.round(Array.from(text).length * multiplier));
    if (voicePath.endsWith('/with-timestamps')) {
      const alignment = uniformAlignment(text, durationS);
      const json = JSON.stringify({
        audio_base64: Buffer.from(audio).toString('base64'),
        alignment,
        normalized_alignment: alignment,
      });
      send(response, 200, json, { ...headers, 'content-type': 'application/json' });
      return;
    }
    send(response, 200, audio, { ...headers, 'content-type': 'application/octet-stream' });
  };

  const route = (response: ServerResponse, request: FakeRequest): void => {
    const failure = failures.shift();
    if (failure !== undefined) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (failure.retryAfterS !== undefined) headers['retry-after'] = String(failure.retryAfterS);
      const body =
        failure.body ??
        JSON.stringify({
          detail: { status: 'scripted_failure', message: `failed for key ${request.apiKey ?? ''}` },
        });
      send(response, failure.status, body, headers);
      return;
    }
    if (request.apiKey !== options.apiKey) {
      const message = `Invalid API key: ${request.apiKey ?? '(none)'}`;
      send(response, 401, JSON.stringify({ detail: { status: 'invalid_api_key', message } }), {
        'content-type': 'application/json',
      });
      return;
    }
    if (request.method === 'GET' && request.path === '/v1/user/subscription') {
      send(
        response,
        200,
        JSON.stringify({
          tier: options.tier ?? 'creator',
          status: 'active',
          character_count: options.characterCount ?? 1_000,
          character_limit: options.characterLimit ?? 100_000,
          next_character_count_reset_unix: 1_790_000_000,
          voice_limit: 30,
        }),
        { 'content-type': 'application/json' },
      );
      return;
    }
    if (request.method === 'GET' && request.path === '/v2/voices') {
      const voices = options.voices ?? [
        { voice_id: 'voice-a', name: 'Narrator A' },
        { voice_id: 'voice-b', name: 'Narrator B' },
      ];
      const second = request.query['next_page_token'] === 'page-2';
      const page = second ? voices.slice(1) : voices.slice(0, 1);
      send(
        response,
        200,
        JSON.stringify({
          voices: page.map((voice) => ({
            ...voice,
            category: 'cloned',
            labels: { accent: 'american' },
          })),
          has_more: !second && voices.length > 1,
          next_page_token: second ? null : 'page-2',
        }),
        { 'content-type': 'application/json' },
      );
      return;
    }
    if (request.method === 'POST' && request.path.startsWith('/v1/text-to-speech/')) {
      tts(response, request.path, request.query, request.body);
      return;
    }
    send(response, 404, JSON.stringify({ detail: 'not found' }), {
      'content-type': 'application/json',
    });
  };

  const server = createServer((incoming, response) => {
    void (async () => {
      const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
      const raw = await readBody(incoming);
      let body: unknown;
      try {
        body = raw === '' ? null : JSON.parse(raw);
      } catch {
        // Not JSON: recorded as the raw string.
        body = raw;
      }
      const key = incoming.headers['xi-api-key'];
      const request: FakeRequest = {
        method: incoming.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        apiKey: typeof key === 'string' ? key : null,
        body,
      };
      requests.push(request);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if ((options.delayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      inFlight -= 1;
      route(response, request);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    maxInFlight: () => maxInFlight,
    failNext(failure, times = 1) {
      for (let k = 0; k < times; k++) failures.push(failure);
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
      }),
  };
}
