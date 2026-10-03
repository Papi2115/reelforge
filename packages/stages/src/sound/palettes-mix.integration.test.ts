/**
 * Integration with the REAL ffmpeg (skipped without it): the example film with its shots spread
 * over all four looks (sound palettes, PLAN.md#12.24) mixes byte-identically twice, at -14 LUFS
 * ±1 and a true peak <= -1 dBTP.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CuesFileSchema, FfmpegManager, mixAudio } from '@reelforge/pipeline';
import { afterAll, describe, expect, it } from 'vitest';
import { generateDefaultCues } from '../stages/default-cues.js';
import { EXAMPLE_DIR } from '../testing/example-film.js';
import { ALL_LOOKS, EXAMPLE_SOUND_INPUT } from '../testing/sound-films.js';

const created = await FfmpegManager.create();
const ffmpeg = created.ok ? created.value : null;
const title =
  ffmpeg === null
    ? 'sound palettes mix (SKIPPED: ffmpeg not found)'
    : 'sound palettes mix with real ffmpeg';

const LOOK_BY_SHOT: Readonly<Record<string, string>> = {
  s02: 'retro-ui',
  s03: 'diorama',
  s04: 'blueprint',
  s05: 'diorama',
  s06: 'retro-ui',
};

describe.skipIf(ffmpeg === null)(title, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'reelforge palettes mix '));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('mixes a four-look film deterministically within the loudness targets', async () => {
    const manager = ffmpeg as FfmpegManager;
    const shots = EXAMPLE_SOUND_INPUT.shots.map((shot) => {
      const look = LOOK_BY_SHOT[shot.id];
      return look === undefined ? shot : { ...shot, look };
    });
    const cues = CuesFileSchema.parse(
      generateDefaultCues({
        ...EXAMPLE_SOUND_INPUT,
        shots,
        palettes: { lookMode: 'mixed', looks: ALL_LOOKS },
      }),
    );
    expect(cues.sfx.some((cue) => cue.name === 'window-open' || cue.name === 'crt-zap')).toBe(true);
    const hashes: string[] = [];
    for (const name of ['a', 'b']) {
      const outputPath = path.join(dir, `mix ${name}.wav`);
      const report = await mixAudio(cues, {
        ffmpeg: manager,
        voPath: path.join(EXAMPLE_DIR, 'audio', 'vo.original.wav'),
        outputPath,
        baseDir: dir,
      });
      expect(report.ok, report.ok ? '' : report.error.message).toBe(true);
      if (!report.ok) return;
      expect(report.value.withinTolerance).toBe(true);
      expect(report.value.truePeakOk).toBe(true);
      hashes.push(createHash('sha256').update(readFileSync(outputPath)).digest('hex'));
    }
    expect(hashes[1]).toBe(hashes[0]);
  }, 240_000);
});
