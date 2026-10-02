import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AMBIENCE_RECIPES, CuesFileSchema, MIX_REPORT_VERSION } from '@reelforge/pipeline';
import type { StageRequest } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_AMBIENCE_NAMES } from '../../shared/sound-contract.js';
import { DUCKING_PRESET_VALUES, libraryCue } from '../../shared/sound-library.js';
import { createLogger } from '../logger.js';
import { freeName } from './sound-files.js';
import { applyMixPatch, describeMixPatch, SoundService } from './sound-service.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);

let root: string;
let dir: string;
let commits: string[];
let queued: StageRequest[][];
let picked: string[] | undefined;
let service: SoundService;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge sound ż-'));
  dir = path.join(root, 'Mój film');
  await cp(FIXTURE, dir, { recursive: true });
  commits = [];
  queued = [];
  picked = undefined;
  service = new SoundService({
    currentProject: () => dir,
    pickFiles: () => Promise.resolve(picked),
    enqueue: (requests) => {
      queued.push([...requests]);
      return Promise.resolve({ status: 'queued', message: null });
    },
    exclusive: (task) => task(),
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    log: createLogger(() => undefined),
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function cues(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(dir, 'cues.json'), 'utf8')) as Record<string, unknown>;
}

describe('SoundService', () => {
  it('lists built-ins first, then imported files; imports copy with free names', async () => {
    expect([...BUILTIN_AMBIENCE_NAMES]).toEqual([...AMBIENCE_RECIPES]);
    const source = path.join(root, 'boom.wav');
    await writeFile(source, 'RIFF');
    await writeFile(path.join(root, 'notes.txt'), 'x');
    picked = [source, source, path.join(root, 'notes.txt')];
    const imported = await service.importFiles('sfx');
    expect(imported).toEqual({
      status: 'ok',
      message: 'Not audio, skipped: notes.txt',
      files: ['audio/sfx/boom.wav', 'audio/sfx/boom (2).wav'],
    });
    const state = await service.state();
    expect(state.library.slice(0, 2)).toEqual([
      { source: 'builtin', kind: 'sfx', name: 'whoosh' },
      { source: 'builtin', kind: 'sfx', name: 'click' },
    ]);
    expect(state.library.filter((sound) => sound.source === 'file')).toEqual([
      { source: 'file', kind: 'sfx', file: 'audio/sfx/boom (2).wav' },
      { source: 'file', kind: 'sfx', file: 'audio/sfx/boom.wav' },
    ]);
    picked = undefined;
    expect((await service.importFiles('music')).status).toBe('cancelled');
    expect(await freeName(path.join(dir, 'audio', 'sfx'), 'a<b?.WAV')).toBe('a b.wav');
  });

  it('renders a cached preview WAV for built-in recipes', async () => {
    const sfx = await service.preview({ source: 'builtin', kind: 'sfx', name: 'pop' });
    expect(sfx).toEqual({ status: 'ok', file: '.reelforge/cache/sound-preview/sfx-pop.wav' });
    const ambience = await service.preview({ source: 'builtin', kind: 'ambience', name: 'wind' });
    expect(ambience.status).toBe('ok');
    const wav = await readFile(
      path.join(dir, '.reelforge', 'cache', 'sound-preview', 'ambience-wind.wav'),
    );
    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    // 4 s of 48 kHz 16-bit stereo.
    expect(wav.length).toBe(44 + 4 * 48_000 * 4);
    const file = { source: 'file', kind: 'music', file: 'audio/music/bed.wav' } as const;
    expect(await service.preview(file)).toEqual({ status: 'ok', file: 'audio/music/bed.wav' });
  });

  it('writes bus gains into cues.json `global` (validated, committed), keeping other keys', async () => {
    const result = await service.setMix({ gains: { sfxGainDb: -6.04, musicGainDb: 3 } });
    expect(result).toEqual({
      status: 'ok',
      message: 'Sound: SFX bus -6 dB, music bus 3 dB',
      committed: true,
    });
    const written = await cues();
    expect(written['global']).toEqual({ sfxGainDb: -6, musicGainDb: 3 });
    expect(written['sfx']).toEqual([{ t: 3.7, name: 'hit' }]);
    expect(CuesFileSchema.parse(written).global.sfxGainDb).toBe(-6);
    expect(commits).toEqual(['Sound: SFX bus -6 dB, music bus 3 dB']);
    const state = await service.state();
    expect(state.gains).toEqual({ voGainDb: 0, sfxGainDb: -6, ambienceGainDb: 0, musicGainDb: 3 });
  });

  it('applies ducking to every music cue; refuses it without music', async () => {
    const strong = DUCKING_PRESET_VALUES.strong;
    expect(await service.setMix({ ducking: strong })).toMatchObject({ status: 'rejected' });
    const music = libraryCue({ source: 'file', kind: 'music', file: 'audio/music/bed.wav' }, 0, {
      duration: 7.5,
      shots: [],
      ducking: DUCKING_PRESET_VALUES.medium,
    });
    const current = await cues();
    await writeFile(
      path.join(dir, 'cues.json'),
      JSON.stringify({ ...current, music: [music.cue, music.cue] }),
    );
    const result = await service.setMix({ ducking: strong });
    expect(result).toMatchObject({ status: 'ok', message: 'Sound: music ducking strong' });
    const written = CuesFileSchema.parse(await cues());
    expect(written.music.map((cue) => cue.ducking)).toEqual([strong, strong]);
    expect((await service.state()).ducking).toEqual(strong);
  });

  it('rejects patches that break the schema and leaves the file alone', async () => {
    const before = await cues();
    expect(applyMixPatch([1], { gains: { voGainDb: 1 } })).toBe('cues.json is not a JSON object');
    await writeFile(
      path.join(dir, 'cues.json'),
      JSON.stringify({ ...before, global: { gain: 1 } }),
    );
    expect(await service.setMix({ gains: { voGainDb: 2 } })).toMatchObject({ status: 'rejected' });
    expect(commits).toEqual([]);
    expect(describeMixPatch({ gains: { voGainDb: -1.26 } })).toBe('Sound: voice-over -1.3 dB');
  });

  it('runs the stages behind the buttons', async () => {
    await service.run('generate-cues');
    await service.run('default-cues');
    await service.run('mix');
    await service.run('mix-stems');
    expect(queued).toEqual([
      [{ stage: 'sound-cues' }],
      [{ stage: 'sound-cues', mode: 'default' }],
      [{ stage: 'mix' }],
      [{ stage: 'mix', stems: true }],
    ]);
  });

  it('reports the mix result, staleness and stems', async () => {
    expect((await service.state()).mix).toEqual({ exists: false, stale: false, result: null });
    await mkdir(path.join(dir, 'audio'), { recursive: true });
    await writeFile(path.join(dir, 'audio', 'mix.wav'), 'RIFF');
    await mkdir(path.join(dir, '.reelforge', 'reports'), { recursive: true });
    const loudness = { integratedLufs: -14.2, truePeakDbtp: -1.4, lraLu: 3 };
    await writeFile(
      path.join(dir, '.reelforge', 'reports', 'mix.json'),
      JSON.stringify({
        version: MIX_REPORT_VERSION,
        durationS: 7.5,
        sampleRate: 48_000,
        channels: 2,
        targetLufs: -14,
        truePeakMaxDbtp: -1,
        toleranceLu: 0.5,
        vo: loudness,
        before: loudness,
        after: loudness,
        gainDb: 1.5,
        limiterCeilingDb: -2,
        renderPasses: 1,
        withinTolerance: true,
        truePeakOk: true,
        cues: { sfx: 1, ambience: 0, music: 0, duckedMusicBuses: 0 },
        stems: ['vo'],
        warnings: [],
      }),
    );
    await mkdir(path.join(dir, 'out', 'stems'), { recursive: true });
    await writeFile(path.join(dir, 'out', 'stems', 'vo.wav'), 'RIFF');
    const state = await service.state();
    expect(state.mix).toMatchObject({
      exists: true,
      stale: false,
      result: { integratedLufs: -14.2, truePeakDbtp: -1.4, toleranceLu: 1 },
    });
    expect(state.stems).toEqual(['out/stems/vo.wav']);
    // Editing cues after the render makes it stale.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.setMix({ gains: { voGainDb: 1 } });
    expect((await service.state()).mix.stale).toBe(true);
    expect(await readdir(path.join(dir, 'audio'))).toContain('mix.wav');
  });
});
