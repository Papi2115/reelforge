/** Voiceover import/replace (+ invalidation) and Words timed (retries, anchors after a new VO). */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { AnchorIndex, WordsFileSchema } from '@reelforge/pipeline';
import { voReportSchema, voiceoverRecordSchema, wordsReportSchema } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { canRun } from './gating.js';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeAudioTools, spikeRaw, spikeScript, truncatedRaw } from './testing/fake-audio.js';
import { TestProjects, readProject, writeProject } from './testing/project.js';

const projects = new TestProjects();
afterAll(() => {
  projects.dispose();
});

function recording(name: string, content: string): string {
  const file = path.join(projects.root, name);
  writeFileSync(file, content);
  return file;
}

async function setup(name: string, golden: readonly string[] = ['script.txt']) {
  const dir = await projects.create(name, golden);
  const audio = new FakeAudioTools();
  const runner = new StageRunner({ projectDir: dir, audio, git: projects.git });
  return { dir, audio, runner };
}

const SCENE = `export const meta = { id: 's01_hook', title: 'Hook', treatment: 'title-card' };
export function build(ctx) { return { hit: ctx.anchor('four floppy disks') }; }
export function update(t, s, ctx) { ctx.text.title('DOOM', { id: 'title', at: s.hit.t }); }
`;

describe('voiceover stage', { timeout: 30_000 }, () => {
  it('imports a recording with its hash and a discrepancy report', async () => {
    const { dir, runner } = await setup('vo import');
    const result = await runner.run({
      stage: 'voiceover',
      source: recording('take 1.WAV', 'RIFF one'),
    });
    expect(result.ok && result.value).toMatchObject({
      message: 'imported take 1.WAV (0:37)',
      outputs: ['audio/vo.original.wav'],
      metrics: { durationS: 37, scriptWords: 84, verdict: 'ok' },
      invalidated: [],
    });
    expect(readProject(dir, 'audio/vo.original.wav')).toBe('RIFF one');
    const record = voiceoverRecordSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/voiceover.json')),
    );
    expect(record).toMatchObject({
      file: 'audio/vo.original.wav',
      sourceName: 'take 1.WAV',
      previous: null,
    });
    expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);

    const again = await runner.run({
      stage: 'voiceover',
      source: recording('take 1.WAV', 'RIFF one'),
    });
    expect(again.ok && again.value).toMatchObject({ changed: false, invalidated: [] });
  });

  it('flags a recording far too short for the script', async () => {
    const { audio, runner } = await setup('vo short');
    audio.durationResult = 10;
    const result = await runner.run({ stage: 'voiceover', source: recording('short.mp3', 'ID3') });
    expect(result.ok && result.value.metrics['verdict']).toBe('too-short');
    expect(result.ok && result.value.warnings[0]).toMatch(/short for the script/);
  });

  it('rejects unsupported formats', async () => {
    const { runner } = await setup('vo aiff');
    const result = await runner.run({ stage: 'voiceover', source: recording('take.aiff', 'FORM') });
    expect(!result.ok && result.error.kind).toBe('invalid-input');
  });

  it('replacing the recording archives it and marks downstream stages stale, scenes untouched', async () => {
    const { dir, runner } = await setup('vo replace', [
      'script.txt',
      'timing/words.json',
      'storyboard.json',
    ]);
    expect(
      (await runner.run({ stage: 'voiceover', source: recording('a.wav', 'RIFF a') })).ok,
    ).toBe(true);
    writeProject(dir, 'scenes/s01_hook.js', SCENE);
    const store = new PipelineStateStore();
    await store.setStage(dir, 'words', 'done');
    await store.setStage(dir, 'clean', 'done');

    const result = await runner.run({ stage: 'voiceover', source: recording('b.m4a', 'M4A b') });
    expect(result.ok && result.value.invalidated).toEqual([
      'clean',
      'words',
      'storyboard',
      'scenes',
    ]);
    expect(existsSync(path.join(dir, 'audio', 'vo.original.wav'))).toBe(false);
    expect(readProject(dir, 'audio/vo.original.m4a')).toBe('M4A b');
    expect(readProject(dir, 'audio/vo.original.prev.wav')).toBe('RIFF a');
    expect(readProject(dir, 'scenes/s01_hook.js')).toBe(SCENE);
    const state = await store.read(dir);
    expect(state.ok && state.value.stages['words']).toMatchObject({
      status: 'done',
      stale: true,
      staleReason: 'voiceover changed',
    });
    const readiness = canRun('storyboard', await runner.snapshot());
    expect(readiness.reasons).toEqual([
      'Words timed is out of date (voiceover changed): run it again first.',
    ]);
  });
});

describe('words stage', { timeout: 30_000 }, () => {
  async function wordsProject(name: string) {
    const setupResult = await setup(name, []);
    writeProject(setupResult.dir, 'script.txt', spikeScript('en-doom'));
    const imported = await setupResult.runner.run({
      stage: 'voiceover',
      source: recording(`${name}.wav`, `RIFF ${name}`),
    });
    expect(imported.ok).toBe(true);
    return setupResult;
  }

  it('transcribes the original recording, aligns to the script and commits timing/', async () => {
    const { dir, audio, runner } = await wordsProject('words ok');
    audio.transcriptions = [spikeRaw('en-doom', 'large-v3-turbo-q5_0')];
    const result = await runner.run({ stage: 'words' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metrics['coverage']).toBeGreaterThanOrEqual(0.9);
    expect(result.value.metrics['attempts']).toBe(1);
    expect(audio.transcribeCalls[0]).toMatchObject({
      input: path.join(dir, 'audio', 'vo.original.wav'),
      lang: 'en',
      model: 'large-v3-turbo-q5_0',
      decoding: undefined,
    });
    const words = WordsFileSchema.parse(JSON.parse(readProject(dir, 'timing/words.json')));
    expect(words.words.length).toBeGreaterThan(50);
    const vo = voReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/reports/voiceover.json')),
    );
    expect(vo.alignment?.coverage).toBe(result.value.metrics['coverage']);
    const [latest] = await projects.history(dir);
    expect(latest).toMatchObject({ kind: 'pipeline-step', step: 'words' });
    expect(latest?.files.map((file) => file.path).sort()).toEqual([
      'timing/words.json',
      'timing/words.raw.json',
    ]);
  });

  it('retries a poor transcription with -bs 5 -tp 0.2 and keeps the better one', async () => {
    const { dir, audio, runner } = await wordsProject('words retry');
    const full = spikeRaw('en-doom', 'large-v3-turbo-q5_0');
    audio.transcriptions = [truncatedRaw(full, 0.5), full];
    const result = await runner.run({ stage: 'words' });
    expect(result.ok && result.value.metrics['attempts']).toBe(2);
    expect(audio.transcribeCalls[1]?.decoding).toEqual({ beamSize: 5, temperature: 0.2 });
    const report = wordsReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/reports/words.json')),
    );
    expect(report.chosen).toBe(1);
    expect(report.attempts[0]?.coverage).toBeLessThan(0.85);
  });

  it('runs with the model of the request ("Retry with a bigger model")', async () => {
    const { audio, runner } = await wordsProject('words bigger');
    audio.installedModels.add('medium');
    audio.transcriptions = [spikeRaw('en-doom', 'medium')];
    const result = await runner.run({ stage: 'words', model: 'medium' });
    expect(result.ok && result.value.metrics['model']).toBe('medium');
    expect(audio.transcribeCalls[0]?.model).toBe('medium');
  });

  it('falls back to another installed model and reports mismatches when all attempts stay poor', async () => {
    const { dir, audio, runner } = await wordsProject('words poor');
    audio.installedModels.add('small');
    audio.transcriptions = [truncatedRaw(spikeRaw('en-doom', 'large-v3-turbo-q5_0'), 0.6)];
    const result = await runner.run({ stage: 'words' });
    expect(audio.transcribeCalls.map((call) => call.model)).toEqual([
      'large-v3-turbo-q5_0',
      'large-v3-turbo-q5_0',
      'small',
    ]);
    expect(result.ok && result.value.warnings[0]).toMatch(/of the script was found/);
    const report = wordsReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/reports/words.json')),
    );
    expect(report.mismatches.length).toBeGreaterThan(0);
  });

  it('after a VO replacement re-timed words move the anchors; scene files stay untouched', async () => {
    const { dir, audio, runner } = await wordsProject('words new vo');
    audio.transcriptions = [spikeRaw('en-doom', 'large-v3-turbo-q5_0')];
    expect((await runner.run({ stage: 'words' })).ok).toBe(true);
    writeProject(dir, 'scenes/s01_hook.js', SCENE);
    const anchor = (): number => {
      const words = WordsFileSchema.parse(JSON.parse(readProject(dir, 'timing/words.json')));
      const hit = new AnchorIndex(words.words, { lang: 'en' }).resolve('four floppy disks');
      if (!hit.ok) throw new Error(hit.error.message);
      return hit.value.t;
    };
    const before = anchor();

    const replaced = await runner.run({
      stage: 'voiceover',
      source: recording('retake.wav', 'RIFF 2'),
    });
    expect(replaced.ok && replaced.value.invalidated).toContain('words');
    audio.transcriptions = [spikeRaw('en-doom', 'large-v3-turbo-q5_0', 0.5)];
    expect((await runner.run({ stage: 'words' })).ok).toBe(true);

    expect(anchor()).toBeCloseTo(before + 0.5, 2);
    expect(readFileSync(path.join(dir, 'scenes', 's01_hook.js'), 'utf8')).toBe(SCENE);
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['words']?.stale).toBeUndefined();
    expect(state.ok && state.value.stages['scenes']?.stale).toBe(true);
  });

  it('needs ffmpeg/whisper', async () => {
    const dir = await projects.create('words no tools', ['script.txt']);
    writeProject(dir, 'audio/vo.original.wav', 'RIFF');
    const runner = new StageRunner({
      projectDir: dir,
      git: projects.git,
      settings: DEFAULT_STAGE_SETTINGS,
    });
    const result = await runner.run({ stage: 'words' });
    expect(!result.ok && result.error.kind).toBe('missing-tool');
  });
});
