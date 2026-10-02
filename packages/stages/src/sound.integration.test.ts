/**
 * Sound design end to end with the REAL ffmpeg on the bundled example film (doom-on-a-calculator,
 * 30.5 s, synthesized voice): default cues (director SFX + a generated bed) -> mix, twice. The
 * mix is byte-identical, meets −14 LUFS ±1 / TP ≤ −1 dBTP, and the QA report shows the music
 * ducked ≥ 6 dB under the voice with ≤ 12 % of its energy below 120 Hz. Skipped without ffmpeg.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CuesFileSchema, FfmpegManager, MixQaReportSchema } from '@reelforge/pipeline';
import { afterAll, describe, expect, it } from 'vitest';
import { createPipelineAudioTools } from './audio-tools.js';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { EXAMPLE_DIR, EXAMPLE_SCENE_SFX } from './testing/example-film.js';
import { TestProjects, readProject } from './testing/project.js';

const ready = (await FfmpegManager.create()).ok;
const title = ready
  ? 'sound design with real ffmpeg'
  : 'sound design with real ffmpeg (SKIPPED: ffmpeg not found)';

describe.skipIf(!ready)(title, () => {
  const projects = new TestProjects();
  afterAll(() => {
    projects.dispose();
  });

  it(
    'mixes the example film deterministically and passes the mix QA',
    { timeout: 240_000 },
    async () => {
      const dir = await projects.create('sound real');
      for (const file of ['storyboard.json', 'timing/words.json']) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        copyFileSync(path.join(EXAMPLE_DIR, file), path.join(dir, file));
      }
      copyFileSync(
        path.join(EXAMPLE_DIR, 'audio', 'vo.original.wav'),
        path.join(dir, 'audio', 'vo.clean.wav'),
      );
      const runner = new StageRunner({
        projectDir: dir,
        audio: createPipelineAudioTools(),
        settings: { ...DEFAULT_STAGE_SETTINGS, economy: true },
        sceneSfx: () => Promise.resolve(EXAMPLE_SCENE_SFX),
        git: projects.git,
      });
      const designed = await runner.run({ stage: 'sound-cues' });
      expect(designed.ok, JSON.stringify(designed)).toBe(true);
      const cues = CuesFileSchema.parse(JSON.parse(readProject(dir, 'cues.json')));
      expect(cues.music).toHaveLength(1);
      expect(cues.sfx.length).toBeGreaterThan(8);

      const hashes: string[] = [];
      for (let run = 0; run < 2; run++) {
        const mixed = await runner.run({ stage: 'mix' });
        expect(mixed.ok, JSON.stringify(mixed)).toBe(true);
        hashes.push(
          createHash('sha256')
            .update(readFileSync(path.join(dir, 'audio', 'mix.wav')))
            .digest('hex'),
        );
      }
      expect(hashes[1]).toBe(hashes[0]);
      const qa = MixQaReportSchema.parse(
        JSON.parse(readProject(dir, '.reelforge/mix-report.json')),
      );
      const status = Object.fromEntries(qa.checks.map((check) => [check.id, check.status]));
      expect(status).toMatchObject({
        loudness: 'pass',
        'true-peak': 'pass',
        clipping: 'pass',
        ducking: 'pass',
        'music-low-band': 'pass',
        'sfx-density': 'pass',
      });
    },
  );
});
