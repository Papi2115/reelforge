import { describe, expect, it } from 'vitest';
import {
  analysisArgs,
  buildCleanChain,
  gainSteps,
  joinFilters,
  renderArgs,
  silenceStep,
  type CleanChainParams,
} from './presets.js';
import { CleanReportSchema, type CleanReport } from './report.js';

const base: CleanChainParams = {
  preset: 'standard',
  noiseFloorDb: -51,
  arnndn: { unavailable: 'no-model' },
  silence: null,
  channels: 'mono',
};

describe('buildCleanChain', () => {
  it('light / standard: format, high-pass, measured-floor afftdn', () => {
    expect(joinFilters(buildCleanChain({ ...base, preset: 'light' }))).toBe(
      'aresample=48000,aformat=channel_layouts=mono,highpass=f=70,afftdn=nr=10:nf=-51',
    );
    expect(joinFilters(buildCleanChain(base))).toBe(
      'aresample=48000,aformat=channel_layouts=mono,highpass=f=80,afftdn=nr=20:nf=-51',
    );
  });

  it('keeps the source layout when asked', () => {
    expect(joinFilters(buildCleanChain({ ...base, channels: 'source' }))).toBe(
      'aresample=48000,highpass=f=80,afftdn=nr=20:nf=-51',
    );
  });

  it('heavy uses arnndn (escaped path, short label) and never afftdn after it', () => {
    const steps = buildCleanChain({
      ...base,
      preset: 'heavy',
      arnndn: { modelPath: 'C:\\Users\\Papi\\Creatorize Suite\\sh.rnnn' },
    });
    expect(steps.map((entry) => entry.filter)).toEqual([
      'aresample=48000',
      'aformat=channel_layouts=mono',
      'highpass=f=80',
      'arnndn=m=C\\\\:/Users/Papi/Creatorize Suite/sh.rnnn',
    ]);
    expect(steps.at(-1)?.label).toBe('arnndn=m=sh.rnnn');
  });

  it('heavy without a model falls back to a stronger afftdn', () => {
    const steps = buildCleanChain({
      ...base,
      preset: 'heavy',
      arnndn: { unavailable: 'model-missing' },
    });
    expect(steps.at(-1)?.filter).toBe('afftdn=nr=30:nf=-51');
  });

  it('appends silence shortening after denoise', () => {
    const steps = buildCleanChain({ ...base, silence: { maxPauseS: 1.5, thresholdDb: -48 } });
    expect(steps.at(-1)?.filter).toBe(
      'silenceremove=stop_periods=-1:stop_duration=1.450:stop_silence=0:stop_threshold=-48.0dB:detection=rms:window=0.05',
    );
  });
});

describe('silenceStep / gainSteps / args', () => {
  it('clamps tiny pause limits', () => {
    expect(silenceStep({ maxPauseS: 0.01, thresholdDb: -60 }).filter).toContain(
      'stop_duration=0.200',
    );
  });

  it('builds gain + delay-compensated limiter', () => {
    expect(joinFilters(gainSteps(14.567, -2))).toBe(
      'volume=14.57dB,alimiter=limit=0.7943:attack=5:release=60:level=false:latency=1',
    );
    expect(gainSteps(-3, -40)[1]?.filter).toContain('limit=0.0625');
  });

  it('maps only the first audio stream and writes 48 kHz s16 WAV', () => {
    expect(renderArgs('in put.mp4', 'volume=1dB', 'out.wav.partial')).toEqual([
      '-i',
      'in put.mp4',
      '-map',
      '0:a:0',
      '-af',
      'volume=1dB',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-c:a',
      'pcm_s16le',
      '-ar',
      '48000',
      '-f',
      'wav',
      '-y',
      'out.wav.partial',
    ]);
    expect(analysisArgs('a.wav', 'x')).toEqual([
      '-i',
      'a.wav',
      '-map',
      '0:a:0',
      '-af',
      'x',
      '-f',
      'null',
      '-',
    ]);
  });
});

describe('CleanReportSchema', () => {
  const report: CleanReport = {
    version: 1,
    preset: 'heavy',
    targetLufs: -16,
    toleranceLu: 0.5,
    noiseFloorDb: -42,
    gainDb: 10.2,
    limiterCeilingDb: -2,
    renderPasses: 1,
    filters: ['highpass=f=80'],
    skipped: [{ step: 'arnndn', reason: 'no-model' }],
    silence: null,
    input: { durationS: 8, sampleRate: 48000, channels: 2 },
    output: { durationS: 8, sampleRate: 48000, channels: 1 },
    before: { integratedLufs: -28.5, truePeakDbtp: -8.4, lraLu: 5.8 },
    after: { integratedLufs: -16.1, truePeakDbtp: -1.9, lraLu: 8.5 },
    withinTolerance: true,
  };

  it('accepts a valid report and rejects a wrong version', () => {
    expect(CleanReportSchema.safeParse(report).success).toBe(true);
    expect(CleanReportSchema.safeParse({ ...report, version: 2 }).success).toBe(false);
    expect(CleanReportSchema.safeParse({ ...report, preset: 'ultra' }).success).toBe(false);
  });
});
