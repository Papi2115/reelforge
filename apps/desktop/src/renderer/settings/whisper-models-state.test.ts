import { describe, expect, it } from 'vitest';
import type { WhisperModelsState, WhisperProgress } from '../../shared/settings-contract.js';
import {
  EMPTY_WHISPER_VIEW,
  formatBytes,
  reduceWhisperModels,
  whisperRows,
  type WhisperModelsEvent,
  type WhisperModelsView,
} from './whisper-models-state.js';

const list: WhisperModelsState = {
  modelsDir: 'C:\\Users\\x\\AppData\\Local\\ReelForge\\whisper\\models',
  models: [
    { id: 'large-v3-turbo-q5_0', approxBytes: 574_000_000, installed: false },
    { id: 'small', approxBytes: 488_000_000, installed: true },
    { id: 'medium', approxBytes: 1_530_000_000, installed: false },
    { id: 'base', approxBytes: 148_000_000, installed: false },
  ],
  vadInstalled: false,
  downloading: null,
};

const progress = (patch: Partial<WhisperProgress>): WhisperProgress => ({
  model: 'base',
  phase: 'downloading',
  asset: 'base',
  receivedBytes: 0,
  totalBytes: 1000,
  ...patch,
});

/** A fake downloader: the events main pushes for one model download. */
function run(events: readonly WhisperModelsEvent[]): WhisperModelsView {
  return events.reduce(reduceWhisperModels, EMPTY_WHISPER_VIEW);
}

const row = (view: WhisperModelsView, id: string): ReturnType<typeof whisperRows>[number] => {
  const found = whisperRows(view).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
};

describe('whisper model manager state', () => {
  it('lists models with sizes and actions', () => {
    const view = run([{ type: 'loaded', list }]);
    expect(whisperRows(view).map((r) => [r.id, r.sizeLabel, r.statusLabel])).toEqual([
      ['large-v3-turbo-q5_0', '574 MB', 'Not downloaded'],
      ['small', '488 MB', 'Installed'],
      ['medium', '1.5 GB', 'Not downloaded'],
      ['base', '148 MB', 'Not downloaded'],
    ]);
    expect(row(view, 'small')).toMatchObject({ canDownload: false, canDelete: true });
    expect(row(view, 'base')).toMatchObject({ canDownload: true, canDelete: false });
  });

  it('shows progress (VAD first), blocks other downloads, ends installed', () => {
    const loaded = { type: 'loaded', list: { ...list, downloading: 'base' } } as const;
    const vad = run([
      loaded,
      { type: 'progress', progress: progress({ asset: 'silero-vad', receivedBytes: 500 }) },
    ]);
    expect(row(vad, 'base')).toMatchObject({
      status: 'downloading',
      statusLabel: 'Downloading 50 % (VAD model)',
      canCancel: true,
    });
    const half = run([loaded, { type: 'progress', progress: progress({ receivedBytes: 420 }) }]);
    expect(row(half, 'base')).toMatchObject({ percent: 42, statusLabel: 'Downloading 42 %' });
    expect(row(half, 'medium').canDownload).toBe(false);

    const unknownSize = run([
      loaded,
      { type: 'progress', progress: progress({ totalBytes: null }) },
    ]);
    expect(row(unknownSize, 'base')).toMatchObject({ percent: null, statusLabel: 'Downloading…' });

    const done = reduceWhisperModels(half, {
      type: 'progress',
      progress: progress({ phase: 'done', receivedBytes: 1000 }),
    });
    expect(row(done, 'base')).toMatchObject({ status: 'installed', canDelete: true });
    expect(done.list?.vadInstalled).toBe(true);
    expect(row(done, 'medium').canDownload).toBe(true);
  });

  it('keeps failures and cancellations visible', () => {
    const loaded = { type: 'loaded', list: { ...list, downloading: 'base' } } as const;
    const failed = run([
      loaded,
      {
        type: 'progress',
        progress: progress({ phase: 'failed', message: 'base: sha256 mismatch' }),
      },
    ]);
    expect(row(failed, 'base')).toMatchObject({ status: 'failed', canDownload: true });
    expect(failed.error).toBe('base: sha256 mismatch');
    const cancelled = run([
      loaded,
      { type: 'progress', progress: progress({ phase: 'cancelled' }) },
    ]);
    expect(row(cancelled, 'base').statusLabel).toBe('Cancelled');
    expect(run([{ type: 'error', message: 'busy' }]).error).toBe('busy');
  });

  it('formats sizes', () => {
    expect(formatBytes(148_000_000)).toBe('148 MB');
    expect(formatBytes(1_530_000_000)).toBe('1.5 GB');
    expect(formatBytes(900)).toBe('1 kB');
  });
});
