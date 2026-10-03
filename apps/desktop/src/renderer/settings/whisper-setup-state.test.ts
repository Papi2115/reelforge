import { describe, expect, it } from 'vitest';
import type { WhisperProgress, WhisperState } from '../../shared/whisper-contract.js';
import {
  EMPTY_WHISPER_SETUP,
  engineCardView,
  formatBytes,
  formatDuration,
  modelRows,
  needsConfirm,
  progressView,
  reduceWhisperSetup,
} from './whisper-setup-state.js';

const STATE: WhisperState = {
  engine: {
    installs: [],
    problem: 'whisper.cpp is not installed',
    configured: false,
    installBackends: ['blas'],
    installBytes: 21_360_234,
    existing: [],
    root: 'C:\\w',
  },
  models: [
    { id: 'large-v3-turbo-q5_0', bytes: 574_041_195, installed: false },
    { id: 'base', bytes: 147_951_465, installed: true },
  ],
  vadInstalled: false,
  vadBytes: 885_098,
  modelsDir: 'C:\\w\\models',
  recommended: 'large-v3-turbo-q5_0',
  readiness: {
    ready: false,
    model: 'large-v3-turbo-q5_0',
    missing: ['engine', 'vad', 'model'],
    bytes: 596_286_527,
  },
  job: null,
};

const running = (over: Partial<WhisperProgress> = {}): WhisperProgress => ({
  job: { kind: 'setup' },
  phase: 'running',
  label: 'Downloading the large-v3-turbo-q5_0 model',
  step: 3,
  steps: 3,
  receivedBytes: 120_000_000,
  totalBytes: 596_286_527,
  bytesPerSecond: 5_200_000,
  etaS: 92,
  message: null,
  detail: null,
  ...over,
});

describe('whisper setup view', () => {
  it('formats sizes, durations and asks above 200 MB', () => {
    expect(formatBytes(574_041_195)).toBe('574 MB');
    expect(formatBytes(1_533_763_059)).toBe('1.5 GB');
    expect(formatBytes(885_098)).toBe('885 kB');
    expect(formatDuration(92)).toBe('1:32');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(needsConfirm(574_041_195)).toBe(true);
    expect(needsConfirm(21_360_234)).toBe(false);
  });

  it('shows bytes, speed, time left and the step', () => {
    expect(progressView(running())).toEqual({
      running: true,
      percent: 20,
      label: 'Downloading the large-v3-turbo-q5_0 model · step 3 of 3',
      detail: '120 MB of 596 MB · 5 MB/s · 1:32 left',
    });
    expect(progressView(running({ phase: 'done' })).percent).toBe(100);
  });

  it('engine card: not installed -> Install with size; installed -> backends and version', () => {
    const missing = reduceWhisperSetup(EMPTY_WHISPER_SETUP, { type: 'loaded', state: STATE });
    expect(engineCardView(missing)).toMatchObject({
      installed: false,
      headline: 'Not installed',
      installLabel: 'Install (21 MB)',
      busy: false,
    });
    const installed = reduceWhisperSetup(missing, {
      type: 'loaded',
      state: {
        ...STATE,
        engine: {
          ...STATE.engine,
          problem: null,
          installBytes: 0,
          installs: [
            {
              path: 'C:\\w\\bin\\cuda\\Release\\whisper-cli.exe',
              backend: 'cuda',
              source: 'app-data',
              version: '1.9.4',
              cuda: 'unavailable',
              cudaReason: 'no CUDA-capable device is detected',
            },
            {
              path: 'C:\\w\\bin\\blas\\Release\\whisper-cli.exe',
              backend: 'blas',
              source: 'app-data',
              version: '1.9.4',
              cuda: 'absent',
              cudaReason: null,
            },
          ],
        },
      },
    });
    const card = engineCardView(installed);
    expect(card?.headline).toBe(
      'Installed: CUDA (NVIDIA GPU) + CPU (OpenBLAS) · whisper.cpp 1.9.4',
    );
    expect(card?.installLabel).toBeNull();
    expect(card?.gpuWarning).toContain('no CUDA-capable device is detected');
  });

  it('a running setup job marks the engine busy and the chosen model as downloading', () => {
    let view = reduceWhisperSetup(EMPTY_WHISPER_SETUP, { type: 'loaded', state: STATE });
    view = reduceWhisperSetup(view, { type: 'progress', progress: running() });
    expect(engineCardView(view)).toMatchObject({ busy: true, blocked: true });
    const [turbo, base] = modelRows(view);
    expect(turbo).toMatchObject({
      status: 'downloading',
      statusLabel: 'Downloading 20 %',
      canCancel: true,
      recommended: true,
      bytes: 574_041_195 + 885_098,
    });
    expect(base).toMatchObject({ status: 'installed', canDownload: false, canDelete: true });
    // A reload while the job runs keeps showing its progress.
    view = reduceWhisperSetup(view, { type: 'loaded', state: { ...STATE, job: running() } });
    expect(view.progress?.phase).toBe('running');
  });

  it('keeps a failure until the next job and clears refusals when one starts', () => {
    let view = reduceWhisperSetup(EMPTY_WHISPER_SETUP, { type: 'error', message: 'busy' });
    view = reduceWhisperSetup(view, {
      type: 'progress',
      progress: running({ phase: 'failed', message: 'Could not reach the download server.' }),
    });
    expect(view.error).toBe('busy');
    expect(view.progress?.message).toBe('Could not reach the download server.');
    view = reduceWhisperSetup(view, { type: 'progress', progress: running() });
    expect(view.error).toBeUndefined();
  });
});
