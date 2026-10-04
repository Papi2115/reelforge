/** Audio cleaned, Sound cues (Claude + deterministic fallback) and Mix on fake tools. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import {
  CleanReportSchema,
  CuesFileSchema,
  MixQaReportSchema,
  MixReportSchema,
} from '@reelforge/pipeline';
import {
  BEAT_SYNC_REPORT_FILE,
  beatSyncReportSchema,
  storyboardFileSchema,
  wordsFileSchema,
} from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { GridTimes } from './beat-sync/grid.js';
import { gridForFilm } from './beat-sync/stage.js';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS, type StageSettings } from './settings.js';
import { FakeAudioTools } from './testing/fake-audio.js';
import { FakeClaudeHarness, writes, type Step } from './testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const CUE_INPUTS = ['storyboard.json', 'timing/words.json'];
const LOUD_AMBIENCE = goldenFile('cues.json').replace('"gainDb": -27', '"gainDb": -5');

async function setup(
  name: string,
  golden: readonly string[],
  options: { steps?: readonly Step[]; settings?: StageSettings } = {},
) {
  const dir = await projects.create(name, golden);
  const audio = new FakeAudioTools();
  const harness = options.steps === undefined ? undefined : new FakeClaudeHarness(options.steps);
  if (harness !== undefined) harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    audio,
    claude: harness?.runner,
    guard: harness?.guard,
    settings: options.settings ?? DEFAULT_STAGE_SETTINGS,
    sceneSfx: () => Promise.resolve([{ t: 12.6, name: 'pop' }]),
    git: projects.git,
  });
  return { dir, audio, harness, runner };
}

describe('clean stage', { timeout: 30_000 }, () => {
  it('cleans the original with the preset from the settings and stores the LUFS report', async () => {
    const { dir, audio, runner } = await setup('clean', [], {
      settings: { ...DEFAULT_STAGE_SETTINGS, clean: { preset: 'heavy' } },
    });
    writeProject(dir, 'audio/vo.original.flac', 'fLaC');
    const result = await runner.run({ stage: 'clean' });
    expect(result.ok && result.value).toMatchObject({
      message: '-22.5 -> -16.1 LUFS (heavy)',
      metrics: { lufsBefore: -22.5, lufsAfter: -16.1 },
    });
    expect(audio.cleanCalls[0]?.input.endsWith('vo.original.flac')).toBe(true);
    expect(audio.cleanCalls[0]?.preset).toBe('heavy');
    const report = CleanReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/reports/clean.json')),
    );
    expect(report.after.integratedLufs).toBe(-16.1);
  });

  it('cannot run without a voice-over', async () => {
    const { runner } = await setup('clean no vo', []);
    const result = await runner.run({ stage: 'clean' });
    expect(!result.ok && result.error.issues).toEqual([
      'No voice-over imported yet: run Voiceover first.',
    ]);
  });
});

let reference: Promise<Record<string, unknown>> | undefined;

/** The deterministic cues.json of the golden project (as the stage writes it before Claude). */
function defaultDesign(): Promise<Record<string, unknown>> {
  reference ??= (async () => {
    const { dir, runner } = await setup('cues reference', CUE_INPUTS, {
      settings: { ...DEFAULT_STAGE_SETTINGS, economy: true },
    });
    const result = await runner.run({ stage: 'sound-cues' });
    if (!result.ok) throw new Error(result.error.message);
    return JSON.parse(readProject(dir, 'cues.json')) as Record<string, unknown>;
  })();
  return reference;
}

describe('sound cues stage', { timeout: 60_000 }, () => {
  it("keeps Claude's valid cues.json", async () => {
    const { dir, harness, runner } = await setup('cues claude', CUE_INPUTS, {
      steps: [writes({ 'cues.json': goldenFile('cues.json') })],
    });
    const result = await runner.run({ stage: 'sound-cues' });
    expect(result.ok && result.value).toMatchObject({
      message: '4 sfx, 1 ambience, 0 music (claude)',
      warnings: [],
    });
    expect(harness?.specs[0]).toMatchObject({ stage: 'sound-cues', purpose: 'main' });
    expect(readProject(dir, 'cues.json')).toBe(goldenFile('cues.json'));
  });

  it('falls back to the default cues when Claude stays invalid after the repair', async () => {
    const { dir, harness, runner } = await setup('cues invalid', CUE_INPUTS, {
      steps: [writes({ 'cues.json': LOUD_AMBIENCE }), writes({ 'cues.json': LOUD_AMBIENCE })],
    });
    const result = await runner.run({ stage: 'sound-cues' });
    expect(harness?.specs[1]?.prompt).toContain('ambience-too-loud');
    expect(result.ok && result.value.metrics['source']).toBe('default');
    expect(result.ok && result.value.warnings[0]).toMatch(/stayed invalid/);
    const cues = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
    expect(cues.ambience.every((cue) => cue.gainDb <= -20)).toBe(true);
  });

  it('writes deterministic cues without a Claude turn in Economy mode and commits them', async () => {
    const { dir, harness, runner } = await setup('cues economy', CUE_INPUTS, {
      steps: [],
      settings: { ...DEFAULT_STAGE_SETTINGS, economy: true },
    });
    const result = await runner.run({ stage: 'sound-cues' });
    expect(result.ok && result.value.metrics['source']).toBe('default');
    expect(harness?.specs).toEqual([]);
    const cues = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
    // The scene's pop, transition sounds and a soft hit on a number; one generated bed.
    expect(cues.sfx.find((cue) => cue.name === 'pop')?.t).toBe(12.6);
    expect(cues.sfx.some((cue) => cue.name === 'swoosh-in')).toBe(true);
    expect(cues.moods).toEqual(['calm-tech']);
    expect(cues.music).toHaveLength(1);
    expect(existsSync(path.join(dir, ...(cues.music[0]?.file ?? '').split('/')))).toBe(true);
    expect(result.ok && result.value.metrics).toMatchObject({ acts: 1, moods: 'calm-tech' });
    const [latest] = await projects.history(dir);
    expect(latest).toMatchObject({ kind: 'pipeline-step', step: 'sound-cues' });
  });

  it('skips Claude when the default cues are requested', async () => {
    const { harness, runner } = await setup('cues default', CUE_INPUTS, {
      steps: [writes({ 'cues.json': goldenFile('cues.json') })],
    });
    const result = await runner.run({ stage: 'sound-cues', mode: 'default' });
    expect(result.ok && result.value.metrics['source']).toBe('default');
    expect(result.ok && result.value.warnings).toContain('Default cues requested (no Claude turn)');
    expect(harness?.specs).toEqual([]);
  });

  it('skips the music when it is switched off in the settings', async () => {
    const { dir, runner } = await setup('cues no music', CUE_INPUTS, {
      settings: { ...DEFAULT_STAGE_SETTINGS, economy: true, music: { enabled: false } },
    });
    expect((await runner.run({ stage: 'sound-cues' })).ok).toBe(true);
    const cues = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
    expect(cues.music).toEqual([]);
    expect(cues.moods).toBeUndefined();
  });

  it("re-renders the music when Claude's adjustment changes an act's mood", async () => {
    const design = await defaultDesign();
    const adjusted = { ...design, moods: ['lofi-chill'] };
    const { dir, harness, runner } = await setup('cues moods', CUE_INPUTS, {
      steps: [writes({ 'cues.json': JSON.stringify(adjusted) })],
    });
    const result = await runner.run({ stage: 'sound-cues' });
    expect(harness?.specs[0]?.prompt).toContain('1: 0–37.205 s, full, energy');
    expect(result.ok && result.value.metrics).toMatchObject({
      source: 'claude',
      moods: 'lofi-chill',
    });
    const cues = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
    const file = cues.music[0]?.file ?? '';
    expect(file).toMatch(/^audio\/music\/gen-lofi-chill-/);
    expect(existsSync(path.join(dir, ...file.split('/')))).toBe(true);
    expect(cues.sfx).toEqual(CuesFileSchema.parse(design).sfx);
  });

  it('rejects moods that do not match the acts and keeps the default design', async () => {
    const design = await defaultDesign();
    const wrong = JSON.stringify({ ...design, moods: ['lofi-chill', 'retro-wave'] });
    const { dir, harness, runner } = await setup('cues bad moods', CUE_INPUTS, {
      steps: [writes({ 'cues.json': wrong }), writes({ 'cues.json': wrong })],
    });
    const result = await runner.run({ stage: 'sound-cues' });
    expect(harness?.specs[1]?.prompt).toContain('moods-count');
    expect(result.ok && result.value.metrics['source']).toBe('default');
    const cues = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
    expect(cues).toEqual(CuesFileSchema.parse(design));
  });

  it('uses the default cues when Claude is not connected', async () => {
    const { runner } = await setup('cues offline', CUE_INPUTS);
    const result = await runner.run({ stage: 'sound-cues' });
    expect(result.ok && result.value.warnings).toContain('Claude is not connected: default cues');
  });

  it("beat sync on: snaps Claude's whoosh peak onto a beat and counts it in the report", async () => {
    const shots = storyboardFileSchema.parse(JSON.parse(goldenFile('storyboard.json'))).shots;
    const words = wordsFileSchema.parse(JSON.parse(goldenFile('timing/words.json'))).words;
    const cuts = shots.slice(1).map((shot) => shot.t0);
    const grid = gridForFilm({ shots, words, styleId: 'voxel-pixel-crisp640' });
    const times = new GridTimes(grid);
    // A beat with room around it: no cut near, inside a shot, nearest grid time to 80 ms after.
    const beat = grid.beats.find(
      (t) =>
        t > 3 &&
        !cuts.some((cut) => cut > t - 1 && cut < t + 0.5) &&
        times.nearest(t + 0.08, 0.12) === t,
    );
    if (beat === undefined) throw new Error('no free beat in the golden film');
    const late = Math.round((beat - 0.25 + 0.08) * 1000) / 1000;
    const cues = JSON.parse(goldenFile('cues.json')) as { sfx: Record<string, unknown>[] };
    cues.sfx = [
      ...cues.sfx.filter((cue) => Math.abs(Number(cue['t']) - late) > 1),
      { t: late, name: 'whoosh', gainDb: -10, pan: 0 },
    ].sort((a, b) => Number(a['t']) - Number(b['t']));
    const { dir, runner } = await setup('cues beat sync', CUE_INPUTS, {
      steps: [writes({ 'cues.json': JSON.stringify(cues, null, 2) })],
    });
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    writeProject(dir, 'project.json', JSON.stringify({ ...project, beatSync: 'auto' }, null, 2));
    const result = await runner.run({ stage: 'sound-cues' });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const written = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
    const snapped = written.sfx.find(
      (cue) => cue.name === 'whoosh' && Math.abs(cue.t - late) < 0.2,
    );
    expect(snapped?.t).toBe(Math.round((beat - 0.25) * 1000) / 1000);
    const report = beatSyncReportSchema.parse(JSON.parse(readProject(dir, BEAT_SYNC_REPORT_FILE)));
    expect(report.cues?.whooshes).toBeGreaterThanOrEqual(1);
    expect(report.cues?.snapped).toBeGreaterThanOrEqual(report.cues?.whooshes ?? 0);
  });

  it("beat sync off: Claude's cues stay byte for byte (no whoosh snapping)", async () => {
    const { dir, runner } = await setup('cues beat sync off', CUE_INPUTS, {
      steps: [writes({ 'cues.json': goldenFile('cues.json') })],
    });
    expect((await runner.run({ stage: 'sound-cues' })).ok).toBe(true);
    expect(readProject(dir, 'cues.json')).toBe(goldenFile('cues.json'));
    expect(existsSync(path.join(dir, ...BEAT_SYNC_REPORT_FILE.split('/')))).toBe(false);
  });
});

describe('mix stage', { timeout: 30_000 }, () => {
  async function mixProject(name: string) {
    const setupResult = await setup(name, ['cues.json']);
    writeProject(setupResult.dir, 'audio/vo.clean.wav', 'RIFF');
    return setupResult;
  }

  it('renders mix.wav and passes the -14 LUFS ±1 / TP <= -1 check', async () => {
    const { dir, audio, runner } = await mixProject('mix ok');
    const result = await runner.run({ stage: 'mix' });
    expect(result.ok && result.value).toMatchObject({
      message: '-14.2 LUFS, true peak -1.4 dBTP',
      outputs: ['audio/mix.wav'],
    });
    expect(audio.mixCalls[0]?.voPath.endsWith('vo.clean.wav')).toBe(true);
    expect(audio.mixCalls[0]?.stemsDir).toBeUndefined();
    expect((await runner.run({ stage: 'mix', stems: true })).ok).toBe(true);
    expect(audio.mixCalls[1]?.stemsDir).toBe(path.join(dir, 'out', 'stems'));
    expect(
      MixReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/reports/mix.json'))).after
        .integratedLufs,
    ).toBe(-14.2);
  });

  it('writes the mix QA report and warns about shallow ducking and muddy music', async () => {
    const { dir, audio, runner } = await mixProject('mix qa');
    const good = await runner.run({ stage: 'mix' });
    expect(good.ok && good.value.warnings).toEqual([]);
    expect(good.ok && good.value.metrics).toMatchObject({ duckingDb: 9.5, speechMarginDb: 21 });
    const first = MixQaReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/mix-report.json')),
    );
    expect(first.checks.map((check) => [check.id, check.status])).toEqual([
      ['loudness', 'pass'],
      ['true-peak', 'pass'],
      ['clipping', 'pass'],
      ['ducking', 'pass'],
      ['speech-clarity', 'pass'],
      ['music-low-band', 'pass'],
      ['sfx-density', 'pass'],
    ]);
    if (audio.mixQa === undefined) throw new Error('the fake mix has QA measurements');
    audio.mixQa = { ...audio.mixQa, duckingDepthDb: 2.5, musicLowShare: 0.2 };
    const weak = await runner.run({ stage: 'mix' });
    expect(weak.ok && weak.value.warnings).toEqual([
      'Music ducking under speech: 2.5 dB (want ≥ 6 dB)',
      'Music below 120 Hz: 20.0 % (want ≤ 12 %)',
    ]);
    const second = MixQaReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/mix-report.json')),
    );
    expect(second.checks.find((check) => check.id === 'ducking')?.status).toBe('warn');
  });

  it('fails when the master misses the loudness bar', async () => {
    const { dir, audio, runner } = await mixProject('mix loud');
    audio.mixLoudness = { lufs: -16.3, truePeakDbtp: -0.5 };
    const result = await runner.run({ stage: 'mix' });
    expect(!result.ok && result.error).toMatchObject({
      kind: 'quality',
      issues: ['loudness -16.3 LUFS is outside -14 ±1 LU', 'true peak -0.5 dBTP is above -1 dBTP'],
    });
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['mix']?.status).toBe('failed');
  });
});
