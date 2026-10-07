import { describe, expect, it } from 'vitest';
import type { ExportJob, ExportOptions, ExportReport } from '../../shared/export-contract.js';
import {
  autoWorkers,
  cacheLine,
  clockText,
  encoderTestLine,
  formProblem,
  frameTimeText,
  initialForm,
  presetLabel,
  progressLine,
  reportLine,
  shotsLine,
  sizeText,
} from './export-view.js';

const OPTIONS: ExportOptions = {
  projectDir: 'C:/p',
  title: 'Film',
  defaultFileName: 'Film.mp4',
  outputDir: 'C:/p/out',
  customOutputDir: false,
  render: { width: 480, height: 270, style: 'x' },
  presets: [
    {
      id: '1080p30',
      label: '1080p (Full HD)',
      width: 1920,
      height: 1080,
      factor: 4,
      problem: null,
    },
    {
      id: '1440p',
      label: '1440p (QHD)',
      width: 2560,
      height: 1440,
      factor: null,
      problem: 'x5.33',
    },
    { id: '4k', label: '4K (UHD)', width: 3840, height: 2160, factor: 8, problem: null },
  ],
  cores: 12,
  defaults: {
    preset: '1440p',
    encoder: 'nvenc',
    quality: 'high',
    workers: 'auto',
    includeChapters: true,
    includeThumbnail: false,
  },
  chapters: { text: null, problem: 'too short' },
  thumbnailDefaultS: 1.1,
  blockers: [],
  warnings: [],
};

const REPORT: ExportReport = {
  output: 'C:/p/out/Film.mp4',
  durationS: 61,
  sizeBytes: 24_500_000,
  avgFps: 48.25,
  encoder: 'h264_nvenc (final)',
  gpu: null,
  totalShots: 12,
  renderedShots: 1,
  cachedShots: 11,
  wallMs: 95_000,
  resumed: false,
  width: 1920,
  height: 1080,
  extras: [],
  warnings: [],
};

describe('export view', () => {
  it('starts from the last choices; an impossible preset falls back to a usable one', () => {
    expect(initialForm(OPTIONS)).toEqual({
      preset: '1080p30',
      encoder: 'nvenc',
      quality: 'high',
      workers: 6,
      fileName: 'Film.mp4',
      includeChapters: true,
      includeThumbnail: false,
      thumbnailAt: null,
    });
    expect(autoWorkers(1)).toBe(1);
  });

  it('explains why the form cannot be queued', () => {
    const form = initialForm(OPTIONS);
    expect(formProblem(form, OPTIONS)).toBeNull();
    expect(formProblem({ ...form, preset: '1440p' }, OPTIONS)).toBe('x5.33');
    expect(formProblem({ ...form, workers: 13 }, OPTIONS)).toBe('Workers must be 1–12.');
    expect(formProblem({ ...form, fileName: ' ' }, OPTIONS)).toBe('Name the video file.');
    expect(formProblem(form, { ...OPTIONS, blockers: ['No storyboard yet.'] })).toBe(
      'No storyboard yet.',
    );
  });

  it('labels presets with their scale factor', () => {
    const [full, qhd] = OPTIONS.presets;
    expect(full && presetLabel(full)).toBe('1080p (Full HD) · 1920×1080 · ×4');
    expect(qhd && presetLabel(qhd)).toBe('1440p (QHD) · 2560×1440');
  });

  it('formats times, sizes, the report and the cache hits', () => {
    expect(clockText(65)).toBe('1:05');
    expect(clockText(3723)).toBe('1:02:03');
    expect(frameTimeText(12.34)).toBe('0:12.3');
    expect(sizeText(24_500_000)).toBe('23.4 MB');
    expect(reportLine(REPORT)).toBe(
      '1:01 · 1920×1080 · 23.4 MB · 48.3 fps · h264_nvenc (final) · in 1:35',
    );
    expect(cacheLine(REPORT)).toBe('Re-rendered 1 of 12 shots (11 from the cache)');
  });

  it('describes a running job and the encoder test', () => {
    const full: ExportJob = {
      id: 'export-1',
      request: {
        preset: '1080p30',
        encoder: 'auto',
        quality: 'standard',
        workers: 2,
        fileName: 'Film.mp4',
        includeChapters: true,
        includeThumbnail: true,
        thumbnailAt: null,
      },
      output: 'C:/p/out/Film.mp4',
      createdAt: 0,
      startedAt: 0,
      finishedAt: null,
      report: null,
      error: null,
      status: 'running',
      progress: {
        percent: 40,
        label: 'Rendering s02 (50/100 frames)',
        etaS: 75,
        fps: 24.5,
        totalShots: 3,
        shots: [
          { id: 's01', frames: 30, done: 30, state: 'cached' },
          { id: 's02', frames: 100, done: 50, state: 'rendering' },
        ],
        warning: null,
      },
    };
    expect(progressLine(full)).toBe('Rendering s02 (50/100 frames) · 1:15 left · 24.5 fps');
    expect(shotsLine(full)).toBe('1/3 shots (1 cached)');
    expect(
      encoderTestLine({
        status: 'ok',
        encoder: 'libx264',
        hardware: false,
        probes: [
          { encoder: 'h264_nvenc', ok: false, detail: 'Cannot load nvcuda.dll' },
          { encoder: 'libx264', ok: true, detail: 'ok' },
        ],
      }),
    ).toBe('libx264 works (CPU) (h264_nvenc: Cannot load nvcuda.dll)');
  });
});
