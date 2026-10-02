import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { err, ok } from '@reelforge/claude-bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeWav } from '../../shared/wav-encode.js';
import { MAX_RECORDING_BYTES } from '../../shared/voiceover-contract.js';
import { readStageReports } from './stage-reports.js';
import { TempProjects } from './testing/fixtures.js';
import {
  checkImport,
  RECORDINGS_DIR,
  saveRecording,
  validateRecordingWav,
} from './voiceover-input.js';

const projects = new TempProjects();
afterEach(() => {
  projects.dispose();
});

/** A canonical PCM WAV: `frames` frames of silence. */
function wav(frames: number, options: { rate?: number; bits?: number; channels?: number } = {}) {
  const rate = options.rate ?? 48_000;
  const bits = options.bits ?? 16;
  const channels = options.channels ?? 1;
  const dataSize = frames * channels * (bits / 8);
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * (bits / 8), true);
  view.setUint16(32, channels * (bits / 8), true);
  view.setUint16(34, bits, true);
  text(36, 'data');
  view.setUint32(40, dataSize, true);
  return bytes;
}

describe('recording validation', () => {
  it('accepts 48 kHz 16-bit PCM and reports its length', () => {
    expect(validateRecordingWav(wav(96_000))).toEqual(
      ok({ sampleRate: 48_000, channels: 1, bitsPerSample: 16, durationS: 2 }),
    );
    expect(validateRecordingWav(wav(48_000, { channels: 2 })).ok).toBe(true);
  });

  it('refuses other formats, broken headers, empty and oversized takes', () => {
    expect(validateRecordingWav(wav(10, { rate: 44_100 }))).toEqual(
      err('the recording must be 48000 Hz'),
    );
    expect(validateRecordingWav(wav(10, { bits: 8 }))).toEqual(
      err('the recording must be 16-bit PCM'),
    );
    expect(validateRecordingWav(wav(0))).toEqual(err('the recording has no audio'));
    const notWav = wav(10);
    notWav.set([0x4f, 0x67, 0x67, 0x53]); // "OggS"
    expect(validateRecordingWav(notWav)).toEqual(err('the recording is not a WAV file'));
    const truncated = wav(100).subarray(0, 60);
    expect(validateRecordingWav(truncated)).toEqual(err('the WAV data is truncated'));
    expect(validateRecordingWav(new Uint8Array(MAX_RECORDING_BYTES + 1)).ok).toBe(false);
  });

  it('accepts what the renderer encodes (wav-encode.ts)', () => {
    const samples = new Float32Array(24_000).map((_, i) => Math.sin(i / 10) * 0.5);
    expect(validateRecordingWav(encodeWav(samples, 48_000))).toEqual(
      ok({ sampleRate: 48_000, channels: 1, bitsPerSample: 16, durationS: 0.5 }),
    );
  });

  it('saves a take atomically under .reelforge/recordings, keeping only the latest', async () => {
    const dir = projects.create();
    const first = await saveRecording(dir, wav(480), new Date('2026-10-02T10:00:00.000Z'));
    const second = await saveRecording(dir, wav(960), new Date('2026-10-02T10:01:00.000Z'));
    const folder = path.join(dir, ...RECORDINGS_DIR.split('/'));
    expect(readdirSync(folder)).toEqual([path.basename(second)]);
    expect(first).not.toBe(second);
    expect(readFileSync(second).byteLength).toBe(44 + 960 * 2);
  });
});

describe('voice-over import check', () => {
  const probe = (durationS: number | null, sampleRate: number | null) => () =>
    Promise.resolve(ok({ durationS, sampleRate, channels: 1 }));

  it('checks the extension and probes for an audio stream with a length', async () => {
    expect(await checkImport('C:/takes/vo.MP3', probe(12.5, 44_100))).toEqual(ok(12.5));
    expect((await checkImport('C:/takes/vo.aiff', probe(1, 1))).ok).toBe(false);
    expect(await checkImport('take.wav', probe(3, null))).toEqual(
      err('"take.wav" has no audio stream'),
    );
    expect(await checkImport('take.flac', probe(0, 48_000))).toEqual(
      err('"take.flac" has no length (empty or broken file)'),
    );
    expect(await checkImport('take.m4a', () => Promise.resolve(err('Invalid data found')))).toEqual(
      err('cannot read "take.m4a": Invalid data found'),
    );
  });
});

describe('stage reports', () => {
  it('reads valid reports and returns null for missing or invalid ones', async () => {
    const dir = projects.create({
      '.reelforge/reports/voiceover.json': JSON.stringify({
        version: 1,
        durationS: 30,
        scriptWords: 75,
        expectedDurationS: 30,
        wordsPerMinute: 150,
        verdict: 'ok',
        messages: [],
        alignment: null,
      }),
      '.reelforge/scenes-report.json': '{"version": 99}',
    });
    const reports = await readStageReports(dir);
    expect(reports.voReport?.verdict).toBe('ok');
    expect(reports.scenes).toBeNull();
    expect(reports.sync).toBeNull();
    expect((await readStageReports(undefined)).projectDir).toBeNull();
  });
});
