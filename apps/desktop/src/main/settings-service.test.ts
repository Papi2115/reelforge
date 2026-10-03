import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appSettingsSchema, defaultAppSettings } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import { settingsBackupFile, SettingsService } from './settings-service.js';

let dir: string;
let file: string;
let lines: string[];

const log = (): ReturnType<typeof createLogger> => createLogger((line) => lines.push(line));
const fixedNow = (): Date => new Date('2026-10-02T06:31:00.000Z');

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge settings ż-'));
  file = path.join(dir, 'settings.json');
  lines = [];
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function readSaved(): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

describe('SettingsService', () => {
  it('starts from defaults without writing when the file is missing', () => {
    const service = SettingsService.load({ file, log: log() });
    expect(service.get()).toEqual(defaultAppSettings());
    expect(existsSync(file)).toBe(false);
  });

  it('persists updates atomically and reloads them', async () => {
    const service = SettingsService.load({ file, log: log() });
    const result = await service.update({ language: 'pl', economy: true });
    expect(result.status).toBe('ok');
    expect(service.get().language).toBe('pl');
    expect(appSettingsSchema.parse(await readSaved())).toMatchObject({
      language: 'pl',
      economy: true,
    });
    // No temp files are left behind.
    expect(await readdir(dir)).toEqual(['settings.json']);
    const reloaded = SettingsService.load({ file, log: log() });
    expect(reloaded.get().language).toBe('pl');
    expect(reloaded.get().economy).toBe(true);
  });

  it('serializes concurrent updates', async () => {
    const service = SettingsService.load({ file, log: log() });
    await Promise.all([
      service.update({ models: { critic: 'sonnet' } }),
      service.update({ performance: { exportWorkers: 3 } }),
      service.update({ chat: { boostModel: 'sonnet' } }),
    ]);
    const saved = appSettingsSchema.parse(await readSaved());
    expect(saved.models.critic).toBe('sonnet');
    expect(saved.performance.exportWorkers).toBe(3);
    expect(saved.chat.boostModel).toBe('sonnet');
  });

  it('sets tool paths from main only and validates them', async () => {
    const service = SettingsService.load({ file, log: log() });
    const ffmpeg = path.join(dir, 'ff mpeg', 'ffmpeg.exe');
    expect((await service.setToolPath('ffmpegPath', ffmpeg)).status).toBe('ok');
    expect(service.get().tools.ffmpegPath).toBe(ffmpeg);
    expect((await service.setToolPath('ffmpegPath', '')).status).toBe('error');
    expect(service.get().tools.ffmpegPath).toBe(ffmpeg);
    expect((await service.setToolPath('ffmpegPath', null)).status).toBe('ok');
    expect(service.get().tools.ffmpegPath).toBeNull();
  });

  it('moves a corrupt file aside and uses the defaults', async () => {
    await writeFile(file, '{ "version": 1, "language": ', 'utf8');
    const service = SettingsService.load({ file, log: log(), now: fixedNow });
    expect(service.get()).toEqual(defaultAppSettings());
    const backup = settingsBackupFile(file, 'corrupt', fixedNow());
    expect(path.basename(backup)).toBe('settings.corrupt-2026-10-02T06-31-00-000Z.json');
    expect(await readFile(backup, 'utf8')).toBe('{ "version": 1, "language": ');
    expect(existsSync(file)).toBe(false);
    expect(lines.join('')).toContain('settings corrupt');
  });

  it('survives a zero-byte file (power loss) and loads again without a loop (PLAN.md#10.2)', async () => {
    await writeFile(file, '', 'utf8');
    const first = SettingsService.load({ file, log: log(), now: fixedNow });
    expect(first.get()).toEqual(defaultAppSettings());
    expect(await readFile(settingsBackupFile(file, 'corrupt', fixedNow()), 'utf8')).toBe('');
    // The next start finds no file (defaults again), not the same broken one.
    expect(existsSync(file)).toBe(false);
    const second = SettingsService.load({ file, log: log(), now: fixedNow });
    expect(second.get()).toEqual(defaultAppSettings());
    expect((await second.update({ economy: true })).status).toBe('ok');
    expect(SettingsService.load({ file, log: log() }).get().economy).toBe(true);
  });

  it('keeps a schema-invalid or newer file as a backup', async () => {
    await writeFile(file, JSON.stringify({ version: 1, economy: 'yes' }), 'utf8');
    const invalid = SettingsService.load({ file, log: log(), now: fixedNow });
    expect(invalid.get().economy).toBe(false);
    expect(existsSync(settingsBackupFile(file, 'corrupt', fixedNow()))).toBe(true);

    await writeFile(file, JSON.stringify({ version: 99 }), 'utf8');
    SettingsService.load({ file, log: log(), now: fixedNow });
    expect(existsSync(settingsBackupFile(file, 'newer-version', fixedNow()))).toBe(true);
  });

  it('says while a write is pending, so quitting can wait for it', async () => {
    const service = SettingsService.load({ file, log: log() });
    expect(service.saving).toBe(false);
    const write = service.update({ economy: true });
    expect(service.saving).toBe(true);
    await write;
    expect(service.saving).toBe(false);
    expect(await readSaved()).toMatchObject({ economy: true });
  });

  it('rewrites a migrated file in the current version', async () => {
    await writeFile(file, JSON.stringify({ language: 'pl' }), 'utf8');
    const service = SettingsService.load({ file, log: log() });
    expect(service.get().language).toBe('pl');
    await service.whenSaved();
    expect(await readSaved()).toMatchObject({ version: 1, language: 'pl' });
  });

  it('reports invalid patches without changing anything', async () => {
    const service = SettingsService.load({ file, log: log() });
    const result = await service.update({ performance: { exportWorkers: 0 } });
    expect(result.status).toBe('error');
    expect(service.get().performance.exportWorkers).toBe('auto');
    expect(existsSync(file)).toBe(false);
  });
});
