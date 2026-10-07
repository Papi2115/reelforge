/**
 * The local taste profiles (PLAN.md#12.13, #13.13): nothing is learned while the switch is off,
 * decisions are saved atomically to the channel's file (<userData>/taste.json for the default
 * channel) and survive a restart, a broken file is moved aside, "Forget everything" brings the
 * empty profile back (of that profile only), the export is the same JSON, the prompts of a film get
 * its channel's profile, and the file holds only feature values — no project path, shot id or text.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyAppSettingsPatch,
  channelsFileSchema,
  defaultAppSettings,
  tasteProfileFileSchema,
  type AppSettings,
  type TasteSignal,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import type { TasteTarget } from './taste-scope.js';
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

const DEFAULT: TasteTarget = { kind: 'channel' };

function service(): TasteService {
  return new TasteService({
    dir: root,
    channelsFile: path.join(root, 'channels.json'),
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
    taste.learner(path.join(root, 'none')).record([PICK, PICK, PICK]);
    await taste.whenSaved();
    expect(taste.profileText(DEFAULT)).toBeUndefined();
    await expect(readdir(root)).resolves.toEqual([]);
    expect(taste.state(DEFAULT)).toMatchObject({ status: 'ok', learning: 'off', profile: null });
  });

  it('records decisions, persists them and builds the profile; reset forgets everything', async () => {
    const taste = service();
    await taste.record(DEFAULT, [PICK, PICK]);
    expect(taste.profileText(DEFAULT)).toBeUndefined();
    await taste.record(DEFAULT, [PICK]);
    expect(taste.profileText(DEFAULT)).toBe(
      'Prefers orbit camera moves, the retro-ui look. Usually turns down violet backgrounds.',
    );
    const saved = tasteProfileFileSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    expect(saved.signals.pick).toBe(3);
    expect(service().profileText(DEFAULT)).toBe(taste.profileText(DEFAULT));
    expect(taste.state(DEFAULT)).toMatchObject({
      status: 'ok',
      learning: 'auto',
      signals: { pick: 3, keep: 0, discard: 0, lock: 0, rebuild: 0 },
      minSignals: 3,
      file,
      scope: { channelId: 'default', fromProject: false, perWorld: false, world: null },
    });
    expect(JSON.parse(taste.exportJson(DEFAULT))).toEqual(saved);
    // Only feature values: no project path, shot id or script text.
    expect(await readFile(file, 'utf8')).not.toMatch(/scenes\/|[A-Z]:\\|s0\d/);

    await taste.reset(DEFAULT);
    expect(taste.profileText(DEFAULT)).toBeUndefined();
    expect(service().state(DEFAULT)).toMatchObject({ preferences: [], updatedAt: null });
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
    expect(taste.profileOf(file).counters).toEqual([]);
    const names = await readdir(root);
    expect(names.some((name) => name.startsWith('taste.corrupt-'))).toBe(true);
  });

  it('keeps one profile per channel: records, prompts and Forget stay in their channel', async () => {
    await writeFile(
      path.join(root, 'channels.json'),
      JSON.stringify(
        channelsFileSchema.parse({
          version: 1,
          defaultChannelId: 'default',
          channels: [
            { id: 'default', name: 'Default', createdAt: NOW.toISOString() },
            {
              id: 'crime',
              name: 'Crime',
              tasteProfile: 'crime',
              tastePerWorld: true,
              createdAt: NOW.toISOString(),
            },
          ],
        }),
      ),
    );
    const film = async (name: string, fields: Record<string, string>): Promise<string> => {
      const dir = path.join(root, name);
      await mkdir(dir);
      await writeFile(path.join(dir, 'project.json'), JSON.stringify({ version: 1, ...fields }));
      return dir;
    };
    const old = await film('old', { style: 'voxel-pixel-crisp640' });
    const comic = await film('comic', { style: 'comic', channelId: 'crime' });
    const notebook = await film('notebook', { style: 'notebook', channelId: 'crime' });
    const taste = service();
    const comicLearner = taste.learner(comic);
    comicLearner.record([PICK, PICK, PICK]);
    await taste.whenSaved();

    expect((await readdir(root)).filter((name) => name.startsWith('taste'))).toEqual([
      'taste-crime--comic.json',
    ]);
    expect(comicLearner.profile()).toMatch(/orbit camera moves/);
    // Another world of the same channel and the default channel start empty.
    expect(taste.learner(notebook).profile()).toBeUndefined();
    expect(taste.learner(old).profile()).toBeUndefined();

    await taste.record({ kind: 'project', dir: old }, [PICK, PICK, PICK]);
    expect(taste.state({ kind: 'project', dir: comic })).toMatchObject({
      signals: { pick: 3 },
      scope: { channelId: 'crime', fromProject: true, perWorld: true, world: 'comic' },
    });
    expect(taste.state({ kind: 'channel', channelId: 'crime' })).toMatchObject({
      scope: { world: 'comic', worlds: ['comic'] },
    });

    await taste.reset({ kind: 'project', dir: comic });
    expect(comicLearner.profile()).toBeUndefined();
    expect(taste.learner(old).profile()).toMatch(/orbit camera moves/);
    expect(service().state(DEFAULT)).toMatchObject({ signals: { pick: 3 } });
  });
});
