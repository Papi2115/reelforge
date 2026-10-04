/**
 * The local taste profile (PLAN.md#12.13): nothing is learned while the switch is off, decisions
 * are saved atomically to <userData>/taste.json and survive a restart, a broken file is moved
 * aside, "Forget everything" brings the empty profile (no profile text) back, the export is the
 * same JSON, and the file holds only feature values — no project path, shot id or text.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyAppSettingsPatch,
  defaultAppSettings,
  tasteProfileFileSchema,
  type AppSettings,
  type TasteSignal,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { TasteService } from './taste-service.js';

let root: string;
let file: string;
let settings: AppSettings;

const NOW = new Date('2026-10-04T10:00:00.000Z');
const PICK: TasteSignal = {
  kind: 'pick',
  positive: [
    { feature: 'camera', value: 'orbit' },
    { feature: 'look', value: 'retro-ui' },
  ],
  negative: [{ feature: 'background', value: 'violet' }],
};

function service(): TasteService {
  return new TasteService({
    file,
    settings: () => settings,
    log: createLogger(() => undefined),
    now: () => NOW,
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'rf taste ż '));
  file = path.join(root, 'taste.json');
  settings = defaultAppSettings();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('TasteService', () => {
  it('learns nothing while off and gives no profile', async () => {
    settings = applyAppSettingsPatch(settings, { taste: { learning: 'off' } });
    const taste = service();
    taste.learner().record([PICK, PICK, PICK]);
    await taste.whenSaved();
    expect(taste.profileText()).toBeUndefined();
    await expect(readdir(root)).resolves.toEqual([]);
    expect(taste.state()).toMatchObject({ status: 'ok', learning: 'off', profile: null });
  });

  it('records decisions, persists them and builds the profile; reset forgets everything', async () => {
    const taste = service();
    await taste.record([PICK, PICK]);
    expect(taste.profileText()).toBeUndefined();
    await taste.record([PICK]);
    expect(taste.profileText()).toBe(
      'Prefers orbit camera moves, the retro-ui look. Usually turns down violet backgrounds.',
    );
    const saved = tasteProfileFileSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    expect(saved.signals.pick).toBe(3);
    expect(service().profileText()).toBe(taste.profileText());
    expect(taste.state()).toMatchObject({
      status: 'ok',
      learning: 'auto',
      signals: { pick: 3, keep: 0, discard: 0, lock: 0, rebuild: 0 },
      minSignals: 3,
      file,
    });
    expect(JSON.parse(taste.exportJson())).toEqual(saved);
    // Only feature values: no project path, shot id or script text.
    expect(await readFile(file, 'utf8')).not.toMatch(/scenes\/|[A-Z]:\\|s0\d/);

    await taste.reset();
    expect(taste.profileText()).toBeUndefined();
    expect(service().state()).toMatchObject({ preferences: [], updatedAt: null });
  });

  it('never touches the network: no fetch, http, sockets in the taste code', async () => {
    const dirs = [
      import.meta.dirname,
      path.resolve(
        import.meta.dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        'packages',
        'stages',
        'src',
        'taste',
      ),
    ];
    for (const folder of dirs) {
      for (const name of (await readdir(folder)).filter((entry) => entry.endsWith('.ts'))) {
        if (name.endsWith('.test.ts')) continue;
        const source = await readFile(path.join(folder, name), 'utf8');
        expect(source, name).not.toMatch(
          /\bfetch\(|node:https?|node:net|XMLHttpRequest|WebSocket|ANTHROPIC_|apiKey/,
        );
      }
    }
  });

  it('moves a broken file aside and starts empty', async () => {
    await writeFile(file, '{ "version": 1, "counters": "nope" }');
    const taste = service();
    expect(taste.profile.counters).toEqual([]);
    const names = await readdir(root);
    expect(names.some((name) => name.startsWith('taste.corrupt-'))).toBe(true);
  });
});
