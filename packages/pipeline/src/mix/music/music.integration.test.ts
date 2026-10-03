/**
 * Integration (real ffmpeg; skipped when missing): a cues.json that uses the new SFX names and a
 * generated music bed renders a byte-identical mix at -14 LUFS, with the bed ducked under the VO.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FfmpegManager } from '../../ffmpeg/manager.js';
import { CuesFileSchema, type CuesFile } from '../cues.js';
import { STEM_FILE_NAMES } from '../master.js';
import { mixAudio } from '../mix.js';
import { VO_SPANS, writeMixFixtures, type MixFixtures } from '../test-fixtures.js';
import { writeMusicFile } from './music.js';

const created = await FfmpegManager.create();
const manager = created.ok ? created.value : null;

const sha256 = async (file: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

describe.skipIf(manager === null)('generated music + new SFX in mixAudio', () => {
  const ffmpeg = manager as FfmpegManager;
  let dir = '';
  let fixtures: MixFixtures;
  let cues: CuesFile;

  async function rmsDb(file: string, start: number, end: number): Promise<number> {
    const run = await ffmpeg.run([
      '-i',
      file,
      '-af',
      `atrim=start=${String(start)}:end=${String(end)},astats=measure_perchannel=none`,
      '-f',
      'null',
      '-',
    ]);
    if (!run.ok) throw new Error(run.error.message);
    const match = /RMS level dB:\s*(-?[\d.]+)/.exec(run.value.stderr.split('Overall').at(-1) ?? '');
    return Number(match?.[1] ?? Number.NaN);
  }

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge gen music ż '));
    fixtures = await writeMixFixtures(dir);
    // A steady bed (one main section) so the ducking measurement is not mixed up with the arc.
    const music = await writeMusicFile(dir, {
      mood: 'calm-tech',
      seed: 3,
      durationS: 60,
      bpm: 90,
      structure: [{ kind: 'main', bars: 23, energy: 0.7 }],
    });
    if (!music.ok) throw new Error(music.error.message);
    cues = CuesFileSchema.parse({
      version: 1,
      sfx: [
        { t: 0.8, name: 'swoosh-in', gainDb: -8 },
        { t: 4, name: 'bubble', gainDb: -6 },
        { t: 10, name: 'whoosh-impact', gainDb: -8 },
        { t: 22, name: 'coin', gainDb: -8 },
        { t: 34, name: 'notification', gainDb: -8 },
        { t: 46, name: 'sparkle', gainDb: -10 },
        { t: 58, name: 'success', gainDb: -8 },
      ],
      music: [{ from: 0, to: 60, file: music.value.file, ducking: { enabled: true } }],
    });
  }, 120_000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('renders a deterministic -14 LUFS mix with the bed ducked under speech', async () => {
    const render = (name: string) =>
      mixAudio(cues, {
        ffmpeg,
        voPath: fixtures.voPath,
        outputPath: path.join(dir, 'audio', `${name}.wav`),
        stemsDir: path.join(dir, 'audio', `stems ${name}`),
        baseDir: dir,
      });
    const first = await render('a');
    const second = await render('b');
    expect(first.ok, first.ok ? '' : first.error.message).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok) return;
    expect(await sha256(path.join(dir, 'audio', 'a.wav'))).toBe(
      await sha256(path.join(dir, 'audio', 'b.wav')),
    );
    expect(Math.abs(first.value.after.integratedLufs - -14)).toBeLessThanOrEqual(1);
    expect(first.value.after.truePeakDbtp).toBeLessThanOrEqual(-1);
    expect(first.value.warnings).toEqual([]);
    const music = path.join(dir, 'audio', 'stems a', STEM_FILE_NAMES.music);
    const under = await Promise.all(
      VO_SPANS.map(([start, end]) => rmsDb(music, start + 2, end - 1)),
    );
    const gaps = await Promise.all(
      VO_SPANS.slice(0, -1).map(([, end], index) =>
        rmsDb(music, end + 0.8, (VO_SPANS[index + 1]?.[0] ?? 0) - 0.1),
      ),
    );
    const mean = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(gaps) - mean(under)).toBeGreaterThanOrEqual(6);
  }, 180_000);
});
