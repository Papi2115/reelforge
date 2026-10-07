import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { loadChannels, updateChannel } from '@reelforge/project';
import {
  DEFAULT_CHANNEL_ID,
  VOICEOVER_RECORD_VERSION,
  voiceTakesFileSchema,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startFakeElevenLabs,
  type FakeElevenLabs,
} from '../../../../../packages/pipeline/src/voice/testing/fake-elevenlabs.js';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import type { VoiceProgress } from '../../shared/voice-contract.js';
import { ChannelSecretStore } from '../channels/channel-secrets.js';
import { fakeSafeStorage } from '../channels/fake-safe-storage.js';
import { createLogger } from '../logger.js';
import { GENERATED_FILE } from './vo-swap.js';
import { VoiceService } from './voice-service.js';

vi.setConfig({ testTimeout: 30_000 });

const KEY = 'sk_CANARY_voice_service_5e8d1c';
const SCRIPT = [
  'Doom runs on almost anything.',
  'But this one is special. It is a calculator.',
  'If it has a screen, it runs Doom.',
].join('\n\n');
const STAMP = '2026-10-07T10:00:00.000Z';

let root: string;
let dir: string;
let channelsFile: string;
let secrets: ChannelSecretStore;
let fake: FakeElevenLabs;
let lines: string[];
let pushes: VoiceProgress[];
let imports: string[];
let commits: { message: string; paths: readonly string[] }[];
let onPush: ((progress: VoiceProgress) => void) | undefined;

const projectFile = (...parts: string[]): string => path.join(dir, ...parts);

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

/** What the Voiceover step does with the file (enough for the service: file + record). */
async function fakeImport(file: string): Promise<StageCommandResult> {
  imports.push(file);
  const bytes = await readFile(file);
  await writeFile(projectFile('audio', 'vo.original.wav'), bytes);
  await writeJson(projectFile('.reelforge', 'voiceover.json'), {
    version: VOICEOVER_RECORD_VERSION,
    file: 'audio/vo.original.wav',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourceName: path.basename(file),
    importedAt: STAMP,
    durationS: null,
    previous: null,
  });
  return { status: 'queued', message: null };
}

async function configureChannel(withVoice = true, key: string | null = KEY): Promise<void> {
  await loadChannels(channelsFile);
  if (withVoice) {
    const updated = await updateChannel(channelsFile, DEFAULT_CHANNEL_ID, {
      voice: { provider: 'elevenlabs', voiceId: 'voice-a', settings: { similarity: 0.8 } },
    });
    expect(updated.ok).toBe(true);
  }
  if (key !== null) await secrets.set(DEFAULT_CHANNEL_ID, 'elevenlabs-api-key', key);
}

function service(baseUrl = fake.url): VoiceService {
  return new VoiceService({
    channelsFile,
    secrets,
    store: new PipelineStateStore(),
    baseUrl,
    retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
    ffmpeg: () => Promise.resolve(null),
    importVoiceover: (_dir, file) => fakeImport(file),
    voiceoverBusy: () => false,
    commit: (_dir, message, paths) => {
      commits.push({ message, paths });
      return Promise.resolve();
    },
    push: (progress) => {
      pushes.push(progress);
      onPush?.(progress);
    },
    log: createLogger((line) => lines.push(line)),
  });
}

async function manifest() {
  const text = await readFile(projectFile('audio', 'takes', 'takes.json'), 'utf8');
  return voiceTakesFileSchema.parse(JSON.parse(text));
}

const ttsCount = (): number => fake.requests.filter((request) => request.method === 'POST').length;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge voice ł-'));
  dir = path.join(root, 'My film');
  channelsFile = path.join(root, 'user data', 'channels.json');
  secrets = new ChannelSecretStore({
    file: path.join(root, 'user data', 'channel-secrets.bin.json'),
    safeStorage: fakeSafeStorage(),
    platform: 'win32',
    log: createLogger(() => undefined),
  });
  fake = await startFakeElevenLabs({ apiKey: KEY, tier: 'pro', secondsPerChar: 0.01 });
  lines = [];
  pushes = [];
  imports = [];
  commits = [];
  onPush = undefined;
  await writeJson(projectFile('project.json'), {
    version: 1,
    title: 'My film',
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 1,
  });
  await writeFile(projectFile('script.txt'), SCRIPT);
  await writeJson(projectFile('storyboard.json'), {
    version: 1,
    shots: [
      {
        id: 's01',
        t0: 0,
        t1: 0.5,
        treatment: 'title-card',
        intent: 'Open.',
        scene: 'scenes/s01.js',
      },
      {
        id: 's02',
        t0: 0.5,
        t1: 2,
        treatment: 'title-card',
        intent: 'Calc.',
        scene: 'scenes/s02.js',
      },
      { id: 's03', t0: 2, t1: 9, treatment: 'title-card', intent: 'End.', scene: 'scenes/s03.js' },
    ],
  });
  const approved = await new PipelineStateStore().update(dir, (state) => ({
    ...state,
    stages: { script: { status: 'done', updatedAt: STAMP, approvedAt: STAMP } },
  }));
  expect(approved.ok).toBe(true);
});

afterEach(async () => {
  await fake.close();
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('VoiceService', () => {
  it('says what the channel is missing, without network', async () => {
    await configureChannel(false, null);
    const state = await service().state(dir);
    expect(state.setup).toEqual({
      status: 'missing',
      channelId: DEFAULT_CHANNEL_ID,
      channelName: 'Default',
      missing: ['voice', 'key'],
    });
    await configureChannel(true, KEY);
    expect((await service().state(dir)).setup).toMatchObject({
      status: 'ready',
      voiceId: 'voice-a',
      model: 'eleven_multilingual_v2',
    });
    expect(fake.requests).toHaveLength(0);
    expect(await service().generate(dir)).toMatchObject({ status: 'ok' });
  });

  it('estimates against the quota, and offline with a quota-unknown note', async () => {
    await configureChannel();
    const estimate = await service().estimate(dir);
    const characters = SCRIPT.split('\n\n').join('').length;
    expect(estimate).toMatchObject({
      status: 'ok',
      characters,
      pendingCharacters: characters,
      paragraphs: 3,
      reusedParagraphs: 0,
      remaining: 99_000,
      quotaNote: null,
      warning: null,
    });
    expect(fake.requests.map((request) => request.path)).toEqual(['/v1/user/subscription']);

    const offline = await service('http://127.0.0.1:9').estimate(dir);
    expect(offline).toMatchObject({ status: 'ok', remaining: null, share: null });
    expect(offline.status === 'ok' ? offline.quotaNote : '').toMatch(
      /^Quota unknown: Cannot reach/,
    );
  });

  it('generates, hands the file to the Voiceover step and reuses paragraphs next time', async () => {
    await configureChannel();
    await mkdir(projectFile('audio'), { recursive: true });
    await writeFile(projectFile('audio', 'vo.original.wav'), 'old take');
    const result = await service().generate(dir);
    expect(result).toEqual({
      status: 'ok',
      generatedParagraphs: 3,
      reusedParagraphs: 0,
      characters: SCRIPT.split('\n\n').join('').length,
      message: `Generated 3 paragraphs (${String(SCRIPT.split('\n\n').join('').length)} characters).`,
    });
    expect(imports).toEqual([projectFile(...GENERATED_FILE.split('/'))]);
    expect(commits).toEqual([
      { message: 'Voiceover generated (ElevenLabs)', paths: ['timing/words.elevenlabs.json'] },
    ]);
    expect(existsSync(projectFile('timing', 'words.elevenlabs.json'))).toBe(true);
    expect((await manifest()).takes).toHaveLength(3);
    const body = fake.requests.find((request) => request.method === 'POST')?.body;
    expect(body).toMatchObject({ voice_settings: { similarity_boost: 0.8 } });
    expect(pushes.at(-1)).toMatchObject({ finished: true, done: 3, total: 3 });
    expect(pushes.some((progress) => progress.phase === 'importing')).toBe(true);
    expect(pushes.map((progress) => progress.done)).toEqual(
      [...pushes.map((progress) => progress.done)].sort((a, b) => a - b),
    );

    const state = await service().state(dir);
    expect(state).toMatchObject({ generated: true, scriptChanged: false });
    expect(state.sentences.map((sentence) => sentence.id)).toEqual([
      'p00-s00',
      'p01-s00',
      'p01-s01',
      'p02-s00',
    ]);
    expect(state.sentences[1]).toMatchObject({ takes: 1, redoCharacters: 44 });
    expect(state.sentences[1]?.start).toBeGreaterThan(0.29);

    const again = await service().generate(dir);
    expect(again).toMatchObject({ status: 'ok', generatedParagraphs: 0, reusedParagraphs: 3 });
    expect(ttsCount()).toBe(3);
  });

  it('keeps the current recording in place when generation fails', async () => {
    await configureChannel();
    await mkdir(projectFile('audio'), { recursive: true });
    await writeFile(projectFile('audio', 'vo.original.wav'), 'old take');
    // The subscription passes, then the first paragraph is refused for lack of credits.
    const voice = service();
    let armed = false;
    onPush = (progress) => {
      if (armed || progress.total === 0) return;
      armed = true;
      fake.failNext({ status: 402 }, 1);
    };
    expect(await voice.generate(dir)).toMatchObject({ status: 'error', kind: 'quota' });
    expect(await readFile(projectFile('audio', 'vo.original.wav'), 'utf8')).toBe('old take');
    expect(imports).toEqual([]);
  });

  it('cancels between paragraphs; Generate again sends only what is missing', async () => {
    await configureChannel();
    const voice = service();
    onPush = (progress) => {
      if (progress.done === 1) voice.cancel();
    };
    const cancelled = await voice.generate(dir);
    expect(cancelled).toMatchObject({ status: 'cancelled' });
    expect((await manifest()).takes).toHaveLength(1);
    expect(existsSync(projectFile('audio', 'vo.original.wav'))).toBe(false);
    expect(imports).toEqual([]);
    onPush = undefined;
    const resumed = await voice.generate(dir);
    expect(resumed).toMatchObject({ status: 'ok', generatedParagraphs: 2, reusedParagraphs: 1 });
    expect(ttsCount()).toBe(3);
  });

  it('redoes one sentence and names the shots it changes', async () => {
    await configureChannel();
    await service().generate(dir);
    expect(await service().retake(dir, 'p01-s01')).toEqual({
      status: 'ok',
      sentenceIds: ['p01-s00', 'p01-s01'],
      changedShotIds: ['s02'],
      shiftedShotIds: [],
      shiftS: 0,
      characters: 44,
    });
    expect(ttsCount()).toBe(4);
    expect(imports).toHaveLength(2);
    expect(commits.at(-1)?.message).toBe('Voiceover: sentence p01-s01 redone (ElevenLabs)');
    expect((await service().state(dir)).sentences[2]).toMatchObject({ takes: 2 });

    await writeFile(projectFile('script.txt'), `${SCRIPT}\n\nOne more line.`);
    expect(await service().retake(dir, 'p01-s01')).toMatchObject({
      status: 'error',
      kind: 'script-changed',
    });
    expect(await service().state(dir)).toMatchObject({ scriptChanged: true, sentences: [] });
  });

  it('refuses before spending: no key, no voice, script not approved, busy', async () => {
    await configureChannel(true, null);
    expect(await service().generate(dir)).toMatchObject({ kind: 'no-key' });
    await configureChannel(false, KEY);
    await updateChannel(channelsFile, DEFAULT_CHANNEL_ID, { voice: null });
    expect(await service().estimate(dir)).toMatchObject({ kind: 'no-voice' });
    await configureChannel();
    await new PipelineStateStore().update(dir, (state) => ({ ...state, stages: {} }));
    expect(await service().generate(dir)).toMatchObject({ kind: 'not-approved' });
    expect(await service().generate(undefined)).toMatchObject({ kind: 'no-project' });
    expect(fake.requests).toHaveLength(0);
  });

  it('maps rate limits (with a retry note), a rejected key and the network to plain words', async () => {
    await configureChannel();
    fake.failNext({ status: 429, retryAfterS: 0 }, 2);
    expect(await service().generate(dir)).toMatchObject({ kind: 'rate-limited' });
    expect(pushes.some((progress) => /rate limited\), retrying/.test(progress.note ?? ''))).toBe(
      true,
    );
    expect(await service('http://127.0.0.1:9').generate(dir)).toMatchObject({ kind: 'network' });
    await secrets.set(DEFAULT_CHANNEL_ID, 'elevenlabs-api-key', 'sk_wrong');
    expect(await service().generate(dir)).toMatchObject({ kind: 'key-rejected' });
  });

  it('tests a channel key', async () => {
    await configureChannel();
    expect(await service().testKey(DEFAULT_CHANNEL_ID)).toEqual({
      status: 'ok',
      tier: 'pro',
      remaining: 99_000,
      limit: 100_000,
      resetsOn: '2026-09-21',
    });
    expect(await service().testKey('other')).toMatchObject({ kind: 'no-key' });
    await secrets.set(DEFAULT_CHANNEL_ID, 'elevenlabs-api-key', 'sk_wrong');
    expect(await service().testKey(DEFAULT_CHANNEL_ID)).toMatchObject({ kind: 'key-rejected' });
  });

  it('never lets the key out: results, pushes, logs, commits and project files', async () => {
    await configureChannel();
    const results: unknown[] = [];
    // Every request answers 401/402/500 with the received key echoed in the body.
    for (const status of [401, 402, 500]) {
      fake.failNext({ status }, 4);
      results.push(await service().generate(dir));
      results.push(await service().testKey(DEFAULT_CHANNEL_ID));
      results.push(await service().estimate(dir));
    }
    results.push(await service().generate(dir), await service().state(dir));
    const seen = JSON.stringify([results, pushes, commits, imports]) + lines.join('\n');
    expect(seen).not.toContain(KEY);
    const files = await readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of files.filter((file) => file.isFile())) {
      const bytes = await readFile(path.join(entry.parentPath, entry.name));
      expect(bytes.includes(KEY), entry.name).toBe(false);
    }
  });
});
