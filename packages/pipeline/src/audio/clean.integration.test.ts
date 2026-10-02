/**
 * Integration: cleanAudio on 3 generated VO-like fixtures (+ a long-pause one) with the real
 * ffmpeg. Skipped when ffmpeg is missing. AC: integrated loudness within ±1 LU of -16 LUFS.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FfmpegManager } from '../ffmpeg/manager.js';
import { cleanAudio, type CleanProgress } from './clean.js';
import type { CleanPreset } from './presets.js';
import { generateFixture, type FixtureKind } from './test-fixtures.js';

const TARGET_LUFS = -16;
const AC_TOLERANCE_LU = 1;

const created = await FfmpegManager.create();
const manager = created.ok ? created.value : null;
const suiteTitle =
  manager === null
    ? 'cleanAudio integration (SKIPPED: ffmpeg not found; set REELFORGE_FFMPEG or add it to PATH)'
    : 'cleanAudio integration';

/** rnnoise model downloaded by spike 03 (gitignored); the heavy+model test runs only if present. */
const SPIKE_RNNOISE_MODEL = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../spikes/03-audio/.cache/models/sh.rnnn',
);

describe.skipIf(manager === null)(suiteTitle, () => {
  const ffmpeg = manager as FfmpegManager;
  let workDir = '';
  const fixture = (kind: FixtureKind): string => path.join(workDir, `${kind}.wav`);

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
    workDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge clean żółć '));
    const kinds: FixtureKind[] = ['quiet-clean', 'uneven-hum', 'noisy-stereo', 'long-pause'];
    for (const kind of kinds) {
      const generated = await generateFixture(ffmpeg, kind, fixture(kind));
      if (!generated.ok) throw new Error(`fixture ${kind}: ${generated.error.message}`);
    }
  }, 60_000);

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  const cases: readonly (readonly [FixtureKind, CleanPreset])[] = [
    ['quiet-clean', 'light'],
    ['uneven-hum', 'standard'],
    ['noisy-stereo', 'heavy'],
  ];

  it.each(cases)(
    '%s with preset %s hits -16 LUFS ±1',
    async (kind, preset) => {
      const output = path.join(workDir, `${kind}.${preset}.clean.wav`);
      const stages = new Set<CleanProgress['stage']>();
      const result = await cleanAudio(fixture(kind), output, preset, {
        ffmpeg,
        onProgress: (progress) => stages.add(progress.stage),
      });
      expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
      if (!result.ok) return;
      const report = result.value;
      expect(Math.abs(report.after.integratedLufs - TARGET_LUFS)).toBeLessThanOrEqual(
        AC_TOLERANCE_LU,
      );
      expect(report.withinTolerance).toBe(true);
      expect(report.after.truePeakDbtp).toBeLessThanOrEqual(-1.5);
      expect(report.before.integratedLufs).not.toBeCloseTo(report.after.integratedLufs, 0);
      // Denoise works: speech-to-gap ratio (speech 0.5-3.5 s, gap 3.5-4.5 s) improves.
      const ratio = async (file: string): Promise<number> =>
        (await rmsDb(file, 1, 3)) - (await rmsDb(file, 3.7, 4.3));
      expect((await ratio(output)) - (await ratio(fixture(kind)))).toBeGreaterThan(3);
      expect(report.output).toMatchObject({ sampleRate: 48000, channels: 1 });
      expect(report.output.durationS).toBeCloseTo(report.input.durationS, 1);
      expect(report.noiseFloorDb).toBeGreaterThanOrEqual(-80);
      expect(report.noiseFloorDb).toBeLessThanOrEqual(-20);
      expect([...stages]).toEqual(expect.arrayContaining(['analyze', 'render', 'verify']));
      expect(existsSync(`${output}.partial`)).toBe(false);
      expect((await stat(output)).size).toBeGreaterThan(48000 * 2 * 7);
      if (preset === 'heavy') {
        expect(report.skipped).toEqual([{ step: 'arnndn', reason: 'no-model' }]);
        expect(report.filters).toContain('afftdn=nr=30:nf=' + String(report.noiseFloorDb));
      } else {
        expect(report.skipped).toEqual([]);
      }
    },
    60_000,
  );

  it('reports a configured but missing rnnoise model and still cleans', async () => {
    const result = await cleanAudio(
      fixture('noisy-stereo'),
      path.join(workDir, 'h2.wav'),
      'heavy',
      {
        ffmpeg,
        arnndnModelPath: path.join(workDir, 'missing.rnnn'),
      },
    );
    expect(result.ok && result.value.skipped).toEqual([
      { step: 'arnndn', reason: 'model-missing' },
    ]);
  }, 60_000);

  it.skipIf(!existsSync(SPIKE_RNNOISE_MODEL))(
    'heavy applies arnndn from a path with spaces and Polish letters',
    async () => {
      const modelPath = path.join(workDir, 'model dir ąę sh.rnnn');
      await copyFile(SPIKE_RNNOISE_MODEL, modelPath);
      const result = await cleanAudio(
        fixture('noisy-stereo'),
        path.join(workDir, 'h3.wav'),
        'heavy',
        {
          ffmpeg,
          arnndnModelPath: modelPath,
        },
      );
      expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
      if (!result.ok) return;
      expect(result.value.skipped).toEqual([]);
      expect(result.value.filters).toContain('arnndn=m=model dir ąę sh.rnnn');
      expect(Math.abs(result.value.after.integratedLufs - TARGET_LUFS)).toBeLessThanOrEqual(
        AC_TOLERANCE_LU,
      );
    },
    60_000,
  );

  it('shortens long pauses down to the limit and reports the removed time', async () => {
    const result = await cleanAudio(
      fixture('long-pause'),
      path.join(workDir, 'lp.wav'),
      'standard',
      {
        ffmpeg,
        shortenSilence: { maxPauseS: 1 },
      },
    );
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
    if (!result.ok) return;
    // 4 s gap -> ~1 s: about 3 s removed; lead/tail silences (0.5 s) stay.
    expect(result.value.silence?.removedS).toBeGreaterThan(2.5);
    expect(result.value.silence?.removedS).toBeLessThan(3.3);
    expect(Math.abs(result.value.after.integratedLufs - TARGET_LUFS)).toBeLessThanOrEqual(
      AC_TOLERANCE_LU,
    );
  }, 60_000);

  it('keeps stereo when channels = source', async () => {
    const result = await cleanAudio(
      fixture('noisy-stereo'),
      path.join(workDir, 'st.wav'),
      'standard',
      {
        ffmpeg,
        channels: 'source',
      },
    );
    expect(result.ok && result.value.output.channels).toBe(2);
  }, 60_000);

  it('returns cancelled and leaves no output when aborted', async () => {
    const output = path.join(workDir, 'cancel.wav');
    const result = await cleanAudio(fixture('uneven-hum'), output, 'standard', {
      ffmpeg,
      signal: AbortSignal.abort(),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
    expect(existsSync(output)).toBe(false);
  });

  it('rejects silent input, a missing input and output == input', async () => {
    const silent = path.join(workDir, 'silent.wav');
    const made = await ffmpeg.run([
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=48000:cl=mono',
      '-t',
      '3',
      '-y',
      silent,
    ]);
    expect(made.ok).toBe(true);
    const silentResult = await cleanAudio(silent, path.join(workDir, 's.wav'), 'standard', {
      ffmpeg,
    });
    expect(silentResult).toMatchObject({ ok: false, error: { kind: 'invalid-input' } });
    const missing = await cleanAudio(
      path.join(workDir, 'nope.wav'),
      path.join(workDir, 'n.wav'),
      'light',
      {
        ffmpeg,
      },
    );
    expect(missing).toMatchObject({ ok: false, error: { kind: 'io' } });
    const same = await cleanAudio(silent, silent, 'light', { ffmpeg });
    expect(same).toMatchObject({ ok: false, error: { kind: 'invalid-input' } });
  }, 30_000);
});
