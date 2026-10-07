import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { ElevenLabsClient, speechRequestBody, type VoiceClientEvent } from './client.js';
import { startFakeElevenLabs, type FakeElevenLabs } from './testing/fake-elevenlabs.js';

const KEY = 'sk_canary_5f1e9a0c7b2d4e6f8a1b3c5d7e9f0a2b';

let server: FakeElevenLabs | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

interface Harness {
  readonly fake: FakeElevenLabs;
  readonly client: ElevenLabsClient;
  readonly delays: number[];
  readonly events: VoiceClientEvent[];
}

async function harness(
  options: {
    apiKey?: string;
    delayMs?: number;
    maxConcurrency?: number;
    maxAttempts?: number;
  } = {},
): Promise<Harness> {
  const fake = await startFakeElevenLabs({ apiKey: KEY, delayMs: options.delayMs ?? 0 });
  server = fake;
  const delays: number[] = [];
  const events: VoiceClientEvent[] = [];
  const client = new ElevenLabsClient({
    apiKey: options.apiKey ?? KEY,
    baseUrl: fake.url,
    maxConcurrency: options.maxConcurrency ?? 2,
    retry: { maxAttempts: options.maxAttempts ?? 4, baseDelayMs: 100, maxDelayMs: 1_000 },
    random: () => 0.5,
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve(true);
    },
    onEvent: (event) => events.push(event),
  });
  return { fake, client, delays, events };
}

const speech = { voiceId: 'voice-a', text: 'Hello there.', modelId: 'eleven_multilingual_v2' };

describe('ElevenLabsClient', () => {
  it('reads the subscription with the key header', async () => {
    const { fake, client } = await harness();
    const result = await client.getSubscription();
    expect(result).toEqual({
      ok: true,
      value: {
        tier: 'creator',
        status: 'active',
        characterCount: 1_000,
        characterLimit: 100_000,
        nextResetUnix: 1_790_000_000,
      },
    });
    expect(fake.requests[0]?.apiKey).toBe(KEY);
  });

  it('lists voices across pages', async () => {
    const { fake, client } = await harness();
    const result = await client.listVoices();
    expect(result.ok && result.value.map((voice) => voice.voiceId)).toEqual(['voice-a', 'voice-b']);
    expect(fake.requests.map((request) => request.query['next_page_token'])).toEqual([
      undefined,
      'page-2',
    ]);
    expect(result.ok && result.value[0]?.labels).toEqual({ accent: 'american' });
  });

  it('generates audio with request id and character cost', async () => {
    const { fake, client } = await harness();
    const result = await client.generate({ ...speech, outputFormat: 'pcm_44100', seed: 7 });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.requestId).toBe('req-1');
    expect(result.value.characterCost).toBe(12);
    expect(result.value.alignment).toBeNull();
    expect(result.value.audio.byteLength).toBe(Math.round(0.2 * 44_100) * 2);
    const request = fake.requests[0];
    expect(request?.path).toBe('/v1/text-to-speech/voice-a');
    expect(request?.query).toEqual({ output_format: 'pcm_44100' });
    expect(request?.body).toEqual({
      text: 'Hello there.',
      model_id: 'eleven_multilingual_v2',
      seed: 7,
    });
  });

  it('returns the character alignment from /with-timestamps', async () => {
    const { fake, client } = await harness();
    const result = await client.generate({
      ...speech,
      outputFormat: 'pcm_44100',
      withTimestamps: true,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(fake.requests[0]?.path).toBe('/v1/text-to-speech/voice-a/with-timestamps');
    expect(result.value.alignment?.characters.join('')).toBe('Hello there.');
    expect(result.value.alignment?.starts).toHaveLength(12);
    expect(result.value.audio.byteLength).toBeGreaterThan(0);
  });

  it('sends stitching fields: request ids replace context text', () => {
    expect(
      speechRequestBody({
        ...speech,
        outputFormat: 'pcm_44100',
        previousText: 'Before.',
        nextText: 'After.',
        previousRequestIds: ['req-1', 'req-2'],
        voiceSettings: { stability: 0.4, similarityBoost: 0.8, useSpeakerBoost: false },
      }),
    ).toEqual({
      text: 'Hello there.',
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.8, use_speaker_boost: false },
      previous_request_ids: ['req-1', 'req-2'],
      next_text: 'After.',
    });
  });

  it('refuses more than 3 request ids per side without a request', async () => {
    const { fake, client } = await harness();
    const result = await client.generate({
      ...speech,
      outputFormat: 'pcm_44100',
      previousRequestIds: ['a', 'b', 'c', 'd'],
    });
    expect(!result.ok && result.error.kind).toBe('invalid-input');
    expect(fake.requests).toHaveLength(0);
  });

  it('retries 429 honouring Retry-After, then succeeds', async () => {
    const { fake, client, delays, events } = await harness();
    fake.failNext({ status: 429, retryAfterS: 2 }, 2);
    const result = await client.generate({ ...speech, outputFormat: 'pcm_44100' });
    expect(result.ok).toBe(true);
    expect(fake.requests).toHaveLength(3);
    expect(delays).toEqual([2_000, 2_000]);
    expect(events.map((event) => [event.error.kind, event.attempt])).toEqual([
      ['rate-limit', 1],
      ['rate-limit', 2],
    ]);
  });

  it('backs off exponentially with jitter on 5xx and gives up after max attempts', async () => {
    const { fake, client, delays } = await harness({ maxAttempts: 3 });
    fake.failNext({ status: 503 }, 5);
    const result = await client.generate({ ...speech, outputFormat: 'pcm_44100' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: 'server', status: 503, attempts: 3 });
    expect(fake.requests).toHaveLength(3);
    // base 100 ms doubled per attempt, jitter factor 0.5 + 0.5 * 0.5 = 0.75
    expect(delays).toEqual([75, 150]);
  });

  it.each([
    [401, 'auth'],
    [402, 'payment'],
    [403, 'forbidden'],
    [422, 'validation'],
  ] as const)('never retries %i', async (status, kind) => {
    const { fake, client } = await harness();
    fake.failNext({ status }, 3);
    const result = await client.generate({ ...speech, outputFormat: 'pcm_44100' });
    expect(!result.ok && result.error.kind).toBe(kind);
    expect(!result.ok && result.error.attempts).toBe(1);
    expect(fake.requests).toHaveLength(1);
  });

  it('reports a network failure after retrying', async () => {
    const { client, fake } = await harness({ maxAttempts: 2 });
    await fake.close();
    server = null;
    const result = await client.getSubscription();
    expect(!result.ok && result.error).toMatchObject({ kind: 'network', attempts: 2 });
  });

  it('stops on an aborted signal', async () => {
    const { fake, client } = await harness();
    const controller = new AbortController();
    controller.abort();
    const result = await client.generate(
      { ...speech, outputFormat: 'pcm_44100' },
      controller.signal,
    );
    expect(!result.ok && result.error.kind).toBe('aborted');
    expect(fake.requests).toHaveLength(0);
  });

  it('keeps at most maxConcurrency requests in flight', async () => {
    const { fake, client } = await harness({ delayMs: 40, maxConcurrency: 2 });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, k) =>
        client.generate({ ...speech, text: `Line ${String(k)}.`, outputFormat: 'pcm_44100' }),
      ),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    expect(fake.maxInFlight()).toBe(2);
  });

  it('never leaks the key (canary) into errors, events or the client object', async () => {
    const wrongKey = `${KEY}-wrong`;
    const { fake, client, events } = await harness({ apiKey: wrongKey });
    const rejected = await client.getSubscription();
    expect(!rejected.ok && rejected.error.kind).toBe('auth');
    fake.failNext({ status: 500, body: `boom ${wrongKey} boom` }, 1);
    const retried = await client.generate({ ...speech, outputFormat: 'pcm_44100' });
    expect(fake.requests.map((request) => request.apiKey)).toEqual([wrongKey, wrongKey, wrongKey]);
    const surfaces = [
      JSON.stringify(rejected),
      JSON.stringify(retried),
      JSON.stringify(events),
      JSON.stringify(client),
      inspect(client, { depth: 5, showHidden: true }),
    ].join('\n');
    expect(surfaces).not.toContain(KEY);
    expect(surfaces).toContain('[redacted]');
  });
});
