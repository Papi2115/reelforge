import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { channelSecretsFileSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { ChannelSecretStore } from './channel-secrets.js';
import { fakeSafeStorage, type FakeSafeStorage } from './fake-safe-storage.js';

const CANARY = 'sk-CANARY-secret-store-91b2';
let root: string;
let file: string;
let lines: string[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge secrets ż-'));
  file = path.join(root, 'channel-secrets.bin.json');
  lines = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function store(
  storage: FakeSafeStorage = fakeSafeStorage(),
  platform: NodeJS.Platform = 'win32',
): ChannelSecretStore {
  return new ChannelSecretStore({
    file,
    safeStorage: storage,
    platform,
    log: createLogger((line) => lines.push(line)),
    now: () => new Date('2026-10-07T10:00:00.000Z'),
  });
}

describe('ChannelSecretStore', () => {
  it('stores ciphertext only and gives the value back to main', async () => {
    const secrets = store();
    expect(await secrets.has('crime', 'elevenlabs-api-key')).toEqual({ ok: true, value: false });
    expect(await secrets.set('crime', 'elevenlabs-api-key', CANARY)).toEqual({
      ok: true,
      value: true,
    });
    expect(await secrets.has('crime', 'elevenlabs-api-key')).toEqual({ ok: true, value: true });
    expect(await secrets.has('tech', 'elevenlabs-api-key')).toEqual({ ok: true, value: false });
    expect(await secrets.names('crime')).toEqual({ ok: true, value: ['elevenlabs-api-key'] });
    expect(await secrets.get('crime', 'elevenlabs-api-key')).toEqual({ ok: true, value: CANARY });
    const text = await readFile(file, 'utf8');
    expect(text).not.toContain(CANARY);
    const onDisk = channelSecretsFileSchema.parse(JSON.parse(text));
    expect(Object.keys(onDisk.secrets)).toEqual(['crime']);
    expect(onDisk.secrets['crime']?.['elevenlabs-api-key']).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(lines.join('')).not.toContain(CANARY);
  });

  it('deletes one secret and every secret of a channel', async () => {
    const secrets = store();
    await secrets.set('crime', 'elevenlabs-api-key', CANARY);
    await secrets.set('tech', 'elevenlabs-api-key', 'other');
    expect(await secrets.delete('crime', 'elevenlabs-api-key')).toEqual({ ok: true, value: false });
    expect(await secrets.get('crime', 'elevenlabs-api-key')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await secrets.deleteChannel('tech')).toEqual({ ok: true, value: true });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ version: 1, secrets: {} });
  });

  it('refuses to store anything without OS encryption (never plain text)', async () => {
    const storage = fakeSafeStorage(false);
    const result = await store(storage).set('crime', 'elevenlabs-api-key', CANARY);
    expect(result).toMatchObject({ ok: false, error: { kind: 'encryption-unavailable' } });
    expect(storage.encryptCalls).toBe(0);
    expect(existsSync(file)).toBe(false);
  });

  it("treats Linux's basic_text backend as unavailable", async () => {
    const weak = store(fakeSafeStorage(true, 'basic_text'), 'linux');
    expect(weak.encryptionAvailable()).toBe(false);
    expect(await weak.set('crime', 'elevenlabs-api-key', CANARY)).toMatchObject({
      ok: false,
      error: { kind: 'encryption-unavailable' },
    });
    expect(store(fakeSafeStorage(true, 'basic_text'), 'win32').encryptionAvailable()).toBe(true);
    expect(store(fakeSafeStorage(true, 'kwallet6'), 'linux').encryptionAvailable()).toBe(true);
  });

  it('moves a broken file aside on the next write; reads report it', async () => {
    await writeFile(file, '{ not json');
    const secrets = store();
    expect(await secrets.has('crime', 'elevenlabs-api-key')).toMatchObject({
      ok: false,
      error: { kind: 'corrupt' },
    });
    expect(await secrets.set('crime', 'elevenlabs-api-key', CANARY)).toEqual({
      ok: true,
      value: true,
    });
    const names = await readdir(root);
    expect(names.some((name) => name.startsWith('channel-secrets.bin.corrupt-'))).toBe(true);
    expect(await secrets.get('crime', 'elevenlabs-api-key')).toEqual({ ok: true, value: CANARY });
  });

  it('reports ciphertext it cannot decrypt without echoing it', async () => {
    await writeFile(
      file,
      JSON.stringify({ version: 1, secrets: { crime: { 'elevenlabs-api-key': 'AAAA' } } }),
    );
    const result = await store().get('crime', 'elevenlabs-api-key');
    expect(result).toMatchObject({ ok: false, error: { kind: 'corrupt' } });
    expect(!result.ok && result.error.message).not.toContain('AAAA');
  });
});
