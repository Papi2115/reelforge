/**
 * Test support: AudioTools without ffmpeg/whisper. Transcriptions replay spike 03 fixtures
 * (whisper turbo-q5 chunk output of the SAPI `en-doom` sample), optionally shifted in time.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  CLEAN_REPORT_VERSION,
  MIX_REPORT_VERSION,
  WORDS_RAW_VERSION,
  type CleanReport,
  type MixReport,
  type RawWord,
  type WhisperModelId,
  type WordsRaw,
} from '@reelforge/pipeline';
import type {
  AudioTools,
  CleanRequest,
  MixRequest,
  ToolError,
  TranscribeRequest,
} from '../audio-tools.js';
import { SPIKE_AUDIO_DIR } from './project.js';

interface SpikeRaw {
  readonly audioS: number;
  readonly words: readonly RawWord[];
}

/** `spikes/03-audio/samples/<id>.txt` (the script the sample voice read). */
export function spikeScript(id: 'en-doom'): string {
  return readFileSync(path.join(SPIKE_AUDIO_DIR, 'samples', `${id}.txt`), 'utf8');
}

/** words.raw.json built from a spike fixture; `shiftS` moves every word (a "new recording"). */
export function spikeRaw(id: 'en-doom', model: WhisperModelId, shiftS = 0): WordsRaw {
  const file = path.join(SPIKE_AUDIO_DIR, 'fixtures', `${id}.turbo-q5.words.raw.json`);
  const fixture = JSON.parse(readFileSync(file, 'utf8')) as SpikeRaw;
  const shift = (value: number): number => Math.round((value + shiftS) * 1000) / 1000;
  return {
    version: WORDS_RAW_VERSION,
    engine: 'whisper.cpp',
    model,
    lang: 'en',
    decodedLang: 'en',
    mode: 'chunk',
    backend: 'cpu',
    usedGpu: false,
    fallbacks: [],
    dtwLeadS: 0.21,
    audioS: shift(fixture.audioS),
    wallMs: 1,
    chunks: [{ start: 0, end: shift(fixture.audioS) }],
    words: fixture.words.map((word) => ({
      ...word,
      t: shift(word.t),
      tEnd: shift(word.tEnd),
    })),
  };
}

/** The first `share` of the words only (a poor transcription with low script coverage). */
export function truncatedRaw(raw: WordsRaw, share: number): WordsRaw {
  return { ...raw, words: raw.words.slice(0, Math.floor(raw.words.length * share)) };
}

export function cleanReport(): CleanReport {
  const loudness = (lufs: number): CleanReport['before'] => ({
    integratedLufs: lufs,
    truePeakDbtp: -2,
    lraLu: 5,
  });
  return {
    version: CLEAN_REPORT_VERSION,
    preset: 'standard',
    targetLufs: -16,
    toleranceLu: 0.5,
    noiseFloorDb: -60,
    gainDb: 4,
    limiterCeilingDb: -2,
    renderPasses: 1,
    filters: ['highpass=f=80'],
    skipped: [],
    silence: null,
    input: { durationS: 43.2, sampleRate: 48_000, channels: 1 },
    output: { durationS: 43.2, sampleRate: 48_000, channels: 1 },
    before: loudness(-22.5),
    after: loudness(-16.1),
    withinTolerance: true,
  };
}

export function mixReport(lufs: number, truePeakDbtp: number): MixReport {
  const loudness = { integratedLufs: lufs, truePeakDbtp, lraLu: 6 };
  return {
    version: MIX_REPORT_VERSION,
    durationS: 37,
    sampleRate: 48_000,
    channels: 2,
    targetLufs: -14,
    truePeakMaxDbtp: -1,
    toleranceLu: 0.5,
    vo: loudness,
    before: loudness,
    after: loudness,
    gainDb: 0,
    limiterCeilingDb: -1.5,
    renderPasses: 1,
    withinTolerance: true,
    truePeakOk: truePeakDbtp <= -1,
    cues: { sfx: 4, ambience: 1, music: 0, duckedMusicBuses: 0 },
    stems: [],
    warnings: [],
  };
}

async function touch(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

export class FakeAudioTools implements AudioTools {
  durationResult: number | null = 37;
  /** Transcriptions returned in order (the last one repeats). */
  transcriptions: (WordsRaw | ToolError)[] = [];
  installedModels = new Set<WhisperModelId>(['large-v3-turbo-q5_0']);
  mixLoudness = { lufs: -14.2, truePeakDbtp: -1.4 };
  readonly transcribeCalls: TranscribeRequest[] = [];
  readonly cleanCalls: CleanRequest[] = [];
  readonly mixCalls: MixRequest[] = [];

  durationS(): Promise<Result<number | null, ToolError>> {
    return Promise.resolve(ok(this.durationResult));
  }

  async clean(request: CleanRequest): Promise<Result<CleanReport, ToolError>> {
    this.cleanCalls.push(request);
    await touch(request.output, 'RIFF clean');
    return ok({ ...cleanReport(), preset: request.preset });
  }

  transcribe(request: TranscribeRequest): Promise<Result<WordsRaw, ToolError>> {
    this.transcribeCalls.push(request);
    const index = Math.min(this.transcribeCalls.length - 1, this.transcriptions.length - 1);
    const next = this.transcriptions[index];
    if (next === undefined) return Promise.resolve(err({ kind: 'not-installed', message: 'none' }));
    if ('version' in next) return Promise.resolve(ok({ ...next, model: request.model }));
    return Promise.resolve(err(next));
  }

  hasWhisperModel(model: WhisperModelId): boolean {
    return this.installedModels.has(model);
  }

  async mix(_cues: unknown, request: MixRequest): Promise<Result<MixReport, ToolError>> {
    this.mixCalls.push(request);
    await touch(request.outputPath, 'RIFF mix');
    return ok(mixReport(this.mixLoudness.lufs, this.mixLoudness.truePeakDbtp));
  }
}
