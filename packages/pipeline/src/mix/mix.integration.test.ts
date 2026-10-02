/**
 * Integration: a 60 s mix (synthesized VO stand-in, every SFX recipe, user sample, synth + user
 * ambience, looped music ducked by the VO) with the real ffmpeg. Skipped when ffmpeg is missing.
 * AC (PLAN 4.6 / 8.3): byte-identical re-render, -14 LUFS ±1, true peak <= -1 dBTP, music at least
 * 6 dB lower under the voice than in the gaps.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FfmpegManager } from '../ffmpeg/manager.js';
import { CuesFileSchema, type CuesFile } from './cues.js';
import { STEM_FILE_NAMES } from './master.js';
import { mixAudio, type MixProgress } from './mix.js';
import { mixPreview } from './preview.js';
import { SFX_RECIPES } from './sfx.js';
import {
  FIXTURE_DURATION_S,
  VO_SPANS,
  writeMixFixtures,
  type MixFixtures,
} from './test-fixtures.js';

const created = await FfmpegManager.create();
const manager = created.ok ? created.value : null;
const suiteTitle =
  manager === null
    ? 'mixAudio integration (SKIPPED: ffmpeg not found; set REELFORGE_FFMPEG or add it to PATH)'
    : 'mixAudio integration';

const sha256 = async (file: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

describe.skipIf(manager === null)(suiteTitle, () => {
  const ffmpeg = manager as FfmpegManager;
  let projectDir = '';
  let fixtures: MixFixtures;
  let cues: CuesFile;

  /** Overall RMS level (dBFS) of [start, end) seconds. */
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
    if (match?.[1] === undefined) throw new Error('astats: RMS level not found');
    return Number(match[1]);
  }

  beforeAll(async () => {
    projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge mix żółć '));
    fixtures = await writeMixFixtures(projectDir);
    cues = CuesFileSchema.parse({
      version: 1,
      sfx: [
        ...SFX_RECIPES.map((name, index) => ({ t: 0.5 + index * 7, name, gainDb: -6 })),
        { t: 50, file: fixtures.boomFile, pan: -0.5 },
      ],
      ambience: [
        { from: 0, to: 40, name: 'room-tone' },
        { from: 20, to: 35, name: 'wind', gainDb: -3 },
        { from: 40, to: 60, file: fixtures.loopFile, gainDb: -6 },
      ],
      music: [{ from: 0, to: 60, file: fixtures.musicFile, loop: true, gainDb: -2 }],
    });
  }, 60_000);

  afterAll(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('renders a deterministic 60 s mix at -14 LUFS with ducked music and stems', async () => {
    const stages = new Set<MixProgress['stage']>();
    const render = (name: string) =>
      mixAudio(cues, {
        ffmpeg,
        voPath: fixtures.voPath,
        outputPath: path.join(projectDir, 'audio', `${name}.wav`),
        stemsDir: path.join(projectDir, 'audio', `stems ${name}`),
        baseDir: projectDir,
        onProgress: (progress) => stages.add(progress.stage),
      });
    const first = await render('mix a');
    expect(first.ok, first.ok ? '' : first.error.message).toBe(true);
    const second = await render('mix b');
    expect(second.ok, second.ok ? '' : second.error.message).toBe(true);
    if (!first.ok || !second.ok) return;

    const report = first.value;
    expect(second.value).toEqual(report);
    const mixA = path.join(projectDir, 'audio', 'mix a.wav');
    expect(await sha256(mixA)).toBe(await sha256(path.join(projectDir, 'audio', 'mix b.wav')));
    for (const stem of Object.values(STEM_FILE_NAMES)) {
      expect(await sha256(path.join(projectDir, 'audio', 'stems mix a', stem))).toBe(
        await sha256(path.join(projectDir, 'audio', 'stems mix b', stem)),
      );
    }

    expect(Math.abs(report.after.integratedLufs - -14)).toBeLessThanOrEqual(1);
    expect(report.after.truePeakDbtp).toBeLessThanOrEqual(-1);
    expect(report).toMatchObject({
      durationS: FIXTURE_DURATION_S,
      withinTolerance: true,
      truePeakOk: true,
      stems: ['vo', 'sfx', 'ambience', 'music'],
      warnings: [],
      cues: { sfx: SFX_RECIPES.length + 1, ambience: 3, music: 1, duckedMusicBuses: 1 },
    });
    expect([...stages]).toEqual(
      expect.arrayContaining([
        'analyze',
        'decode',
        'synthesize',
        'premix',
        'master',
        'verify',
        'stems',
      ]),
    );
    // 48 kHz 16-bit stereo, exactly 60 s.
    expect((await readFile(mixA)).length).toBe(44 + FIXTURE_DURATION_S * 48_000 * 4);

    // Ducking: music under speech vs. in the gaps (skipping attack/release edges).
    const music = path.join(projectDir, 'audio', 'stems mix a', STEM_FILE_NAMES.music);
    const mean = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const underVoice = await Promise.all(
      VO_SPANS.map(([start, end]) => rmsDb(music, start + 2, end - 1)),
    );
    const gaps = VO_SPANS.slice(0, -1).map(([, end], index) => [
      end + 0.8,
      (VO_SPANS[index + 1]?.[0] ?? 0) - 0.1,
    ]);
    const inGaps = await Promise.all(
      gaps.map(([start, end]) => rmsDb(music, start ?? 0, end ?? 0)),
    );
    expect(mean(inGaps) - mean(underVoice)).toBeGreaterThanOrEqual(6);

    // Temporary files are gone.
    const leftovers = (await readdir(path.join(projectDir, 'audio'))).filter(
      (name) => name.startsWith('.reelforge-mix-') || name.endsWith('.partial'),
    );
    expect(leftovers).toEqual([]);
  }, 120_000);

  it('renders a 15 s preview window that sounds like that part of the full mix', async () => {
    const full = path.join(projectDir, 'audio', 'mix a.wav');
    const report = await mixAudio(cues, {
      ffmpeg,
      voPath: fixtures.voPath,
      outputPath: full,
      baseDir: projectDir,
    });
    if (!report.ok) throw new Error(report.error.message);
    const output = path.join(projectDir, 'preview', 'window.wav');
    const preview = await mixPreview(cues, {
      ffmpeg,
      voPath: fixtures.voPath,
      outputPath: output,
      baseDir: projectDir,
      workDir: path.join(projectDir, 'preview'),
      startS: 20,
      durationS: 15,
      gainDb: report.value.gainDb,
    });
    expect(preview.ok, preview.ok ? '' : preview.error.message).toBe(true);
    expect((await readFile(output)).length).toBe(44 + 15 * 48_000 * 4);
    const windowDb = await rmsDb(output, 2, 13);
    const fullDb = await rmsDb(full, 22, 33);
    expect(Math.abs(windowDb - fullDb)).toBeLessThan(1.5);
    expect((await readdir(path.join(projectDir, 'preview'))).sort()).toEqual(['window.wav']);
  }, 120_000);

  it('returns cancelled and writes nothing when aborted', async () => {
    const output = path.join(projectDir, 'cancel.wav');
    const result = await mixAudio(cues, {
      ffmpeg,
      voPath: fixtures.voPath,
      outputPath: output,
      baseDir: projectDir,
      signal: AbortSignal.abort(),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
    expect(existsSync(output)).toBe(false);
  });

  it('reports a missing cue file and output == voice-over as typed errors', async () => {
    const missing = await mixAudio(
      CuesFileSchema.parse({ version: 1, sfx: [{ t: 1, file: 'audio/sfx/nope.wav' }] }),
      {
        ffmpeg,
        voPath: fixtures.voPath,
        outputPath: path.join(projectDir, 'm.wav'),
        baseDir: projectDir,
      },
    );
    expect(missing).toMatchObject({ ok: false, error: { kind: 'io' } });
    const same = await mixAudio(cues, {
      ffmpeg,
      voPath: fixtures.voPath,
      outputPath: fixtures.voPath,
      baseDir: projectDir,
    });
    expect(same).toMatchObject({ ok: false, error: { kind: 'invalid-input' } });
  }, 60_000);
});
