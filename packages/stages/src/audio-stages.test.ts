/** Audio cleaned, Sound cues (Claude + deterministic fallback) and Mix on fake tools. */
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { CleanReportSchema, CuesFileSchema, MixReportSchema } from '@reelforge/pipeline';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
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
    expect(cues.sfx.map((cue) => cue.name)).toEqual(['pop', 'whoosh']);
    const [latest] = await projects.history(dir);
    expect(latest).toMatchObject({ kind: 'pipeline-step', step: 'sound-cues' });
  });

  it('uses the default cues when Claude is not connected', async () => {
    const { runner } = await setup('cues offline', CUE_INPUTS);
    const result = await runner.run({ stage: 'sound-cues' });
    expect(result.ok && result.value.warnings).toContain('Claude is not connected: default cues');
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
    expect(
      MixReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/reports/mix.json'))).after
        .integratedLufs,
    ).toBe(-14.2);
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
