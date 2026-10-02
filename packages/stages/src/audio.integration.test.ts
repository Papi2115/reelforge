/**
 * Voiceover -> Audio cleaned -> Words timed with the REAL ffmpeg + whisper.cpp on the spike 03
 * `en-doom` recording (~100 s). Opt-in (REELFORGE_REAL_WHISPER=1, keeps default runs fast) and
 * skipped unless everything is available locally (never downloads):
 * whisper build REELFORGE_WHISPER or spikes/03-audio/.cache/bin/cuda, models
 * REELFORGE_WHISPER_MODELS or spikes/03-audio/.cache/models, audio from the spike's `prepare` step.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  AnchorIndex,
  FfmpegManager,
  WHISPER_ENV_VAR,
  WhisperManager,
  WordsFileSchema,
} from '@reelforge/pipeline';
import { afterAll, describe, expect, it } from 'vitest';
import { createPipelineAudioTools } from './audio-tools.js';
import { StageRunner } from './runner.js';
import { spikeScript } from './testing/fake-audio.js';
import { SPIKE_AUDIO_DIR, TestProjects, readProject, writeProject } from './testing/project.js';

const CACHE = path.join(SPIKE_AUDIO_DIR, '.cache');
const whisperPath = process.env[WHISPER_ENV_VAR] ?? path.join(CACHE, 'bin', 'cuda');
const modelsDir = process.env['REELFORGE_WHISPER_MODELS'] ?? path.join(CACHE, 'models');
const recording = path.join(CACHE, 'out', 'en-doom', 'vo.original.wav');

const whisper = new WhisperManager({ configuredPath: whisperPath, modelsDir });
const optedIn = process.env['REELFORGE_REAL_WHISPER'] === '1';
const ready =
  optedIn &&
  (await FfmpegManager.create()).ok &&
  whisper.locate().ok &&
  whisper.hasModel('large-v3-turbo-q5_0') &&
  existsSync(whisper.vadModelPath()) &&
  existsSync(recording);

const title = ready
  ? 'stages with real ffmpeg + whisper.cpp'
  : 'stages with real ffmpeg + whisper.cpp (SKIPPED: set REELFORGE_REAL_WHISPER=1; needs the spike 03 cache or REELFORGE_WHISPER + REELFORGE_WHISPER_MODELS)';

describe.skipIf(!ready)(title, () => {
  const projects = new TestProjects();
  afterAll(() => {
    projects.dispose();
  });

  it('imports, cleans and times the voice-over; anchors land', { timeout: 300_000 }, async () => {
    const dir = await projects.create('real audio');
    writeProject(dir, 'script.txt', spikeScript('en-doom'));
    const runner = new StageRunner({
      projectDir: dir,
      audio: createPipelineAudioTools({ whisper: { configuredPath: whisperPath, modelsDir } }),
      git: projects.git,
    });
    const imported = await runner.run({ stage: 'voiceover', source: recording });
    expect(imported.ok && imported.value.metrics['verdict']).toBe('ok');
    const cleaned = await runner.run({ stage: 'clean' });
    expect(cleaned.ok && cleaned.value.warnings).toEqual([]);
    const timed = await runner.run({ stage: 'words' });
    expect(timed.ok).toBe(true);
    if (!timed.ok) return;
    expect(timed.value.metrics['coverage']).toBeGreaterThanOrEqual(0.92);
    expect(timed.value.metrics['attempts']).toBe(1);
    const words = WordsFileSchema.parse(JSON.parse(readProject(dir, 'timing/words.json')));
    const hit = new AnchorIndex(words.words, { lang: 'en' }).resolve('four floppy disks');
    expect(hit.ok).toBe(true);
  });
});
