/**
 * Generative background music (public API): `generateMusic` renders a deterministic stereo bed
 * for a mood (score -> voices -> bed master at -23 LUFS, loopable by default); `writeMusicFile`
 * caches it as `audio/music/gen-<mood>-<seed>-<hash>.wav` (the hash covers every option and the
 * engine version, so a changed request never reuses a stale file); `planActMusic` /
 * `generateActMusic` give one ducked bed per act for `cues.json`. See docs/music.md.
 */
import { createHash } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { StereoClip } from '../clip.js';
import type { CuesFileInput } from '../cues.js';
import { MIX_SAMPLE_RATE, hashSeed } from '../dsp.js';
import { describeError, type FfmpegError } from '../../ffmpeg/errors.js';
import { err, ok, type Result } from '../../result.js';
import { writeWavAtomic } from '../wav.js';
import { MOOD_PRESETS, MUSIC_MOODS, type MusicMood } from './moods.js';
import { renderBed } from './render.js';
import { generateScore, type Score, type ScoreOptions } from './score.js';

/** Bump when the sound of generated music changes (invalidates cached files). */
export const MUSIC_ENGINE_VERSION = 1;
export const MUSIC_FOLDER = 'audio/music';
export const MIN_MUSIC_DURATION_S = 4;
export const MAX_MUSIC_DURATION_S = 20 * 60;

export interface GenerateMusicOptions extends ScoreOptions {
  /** Fold the tail onto the start so the file loops seamlessly (default true). */
  readonly loopable?: boolean | undefined;
}

export interface GeneratedMusic {
  readonly clip: StereoClip;
  readonly score: Score;
  /** Measured integrated loudness (LUFS). */
  readonly lufs: number;
}

function clampDuration(durationS: number): number {
  return Math.min(MAX_MUSIC_DURATION_S, Math.max(MIN_MUSIC_DURATION_S, durationS));
}

export function generateMusic(options: GenerateMusicOptions): GeneratedMusic {
  const score = generateScore({ ...options, durationS: clampDuration(options.durationS) });
  const bed = renderBed(score, MOOD_PRESETS[options.mood], options.seed, options.loopable ?? true);
  return { clip: bed.clip, score, lufs: bed.lufs };
}

/** Stable content hash of a request (option order and float noise do not matter). */
export function musicCacheKey(options: GenerateMusicOptions): string {
  const canonical = JSON.stringify({
    version: MUSIC_ENGINE_VERSION,
    mood: options.mood,
    seed: options.seed >>> 0,
    durationMs: Math.round(clampDuration(options.durationS) * 1000),
    bpm: options.bpm ?? null,
    key: options.key ?? null,
    structure: options.structure ?? null,
    energy: options.energy ?? null,
    loopable: options.loopable ?? true,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 10);
}

/** Project-relative path of the cached file for a request. */
export function musicFilePath(options: GenerateMusicOptions): string {
  const seed = String(options.seed >>> 0);
  return `${MUSIC_FOLDER}/gen-${options.mood}-${seed}-${musicCacheKey(options)}.wav`;
}

export interface MusicFile {
  /** Project-relative, forward slashes (as used in cues.json). */
  readonly file: string;
  /** True when an existing file was reused. */
  readonly cached: boolean;
}

/** Renders (or reuses) the bed for `options` under `<projectDir>/audio/music/`. */
export async function writeMusicFile(
  projectDir: string,
  options: GenerateMusicOptions,
): Promise<Result<MusicFile, FfmpegError>> {
  const file = musicFilePath(options);
  const target = path.join(projectDir, ...file.split('/'));
  const exists = await stat(target).then(
    (stats) => stats.isFile(),
    () => false,
  );
  if (exists) return ok({ file, cached: true });
  try {
    await mkdir(path.dirname(target), { recursive: true });
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot create ${MUSIC_FOLDER}: ${describeError(error)}`,
      path: target,
    });
  }
  const { clip } = generateMusic(options);
  const written = await writeWavAtomic(target, [clip.left, clip.right], MIX_SAMPLE_RATE, 'pcm16');
  return written.ok ? ok({ file, cached: false }) : written;
}

export interface ActSpan {
  /** Act start / end on the voice-over timeline (seconds). */
  readonly from: number;
  readonly to: number;
  readonly mood?: MusicMood | undefined;
  /** 0..1 intensity of the act (maps to the bed's energy). */
  readonly energy?: number | undefined;
}

export interface ActMusicOptions {
  readonly seed: number;
  /** Mood per act (cycled) or one mood for all; an act's own `mood` wins. */
  readonly moods?: MusicMood | readonly MusicMood[] | undefined;
  /** Cue gain (dB) of every bed (default 0: the bed is already at -23 LUFS). */
  readonly gainDb?: number | undefined;
}

export type MusicCueInput = NonNullable<CuesFileInput['music']>[number];

export interface ActMusicPlan {
  readonly options: GenerateMusicOptions;
  readonly cue: MusicCueInput;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** One bed per act (pure): generation options and the ducked music cue that plays it. */
export function planActMusic(acts: readonly ActSpan[], options: ActMusicOptions): ActMusicPlan[] {
  const moods: readonly MusicMood[] =
    options.moods === undefined
      ? ['calm-tech']
      : typeof options.moods === 'string'
        ? [options.moods]
        : options.moods;
  return acts
    .filter((act) => act.to - act.from >= MIN_MUSIC_DURATION_S / 2)
    .map((act, index) => {
      const mood = act.mood ?? moods[index % Math.max(1, moods.length)] ?? 'calm-tech';
      const generate: GenerateMusicOptions = {
        mood,
        seed: hashSeed(`${String(options.seed >>> 0)}|act${String(index)}|${mood}`),
        durationS: clampDuration(act.to - act.from),
        energy: act.energy,
        loopable: true,
      };
      return {
        options: generate,
        cue: {
          id: `music-${String(index + 1).padStart(2, '0')}`,
          from: round3(act.from),
          to: round3(act.to),
          file: musicFilePath(generate),
          gainDb: options.gainDb ?? 0,
          // The bed is rendered to the act's exact length; looping is only for user-extended cues.
          loop: false,
          fadeInS: 1,
          fadeOutS: 2,
          ducking: { enabled: true },
        },
      };
    });
}

/** Renders (cached) every act's bed and returns the music cues for `cues.json`. */
export async function generateActMusic(
  projectDir: string,
  acts: readonly ActSpan[],
  options: ActMusicOptions,
): Promise<Result<MusicCueInput[], FfmpegError>> {
  const cues: MusicCueInput[] = [];
  for (const plan of planActMusic(acts, options)) {
    const written = await writeMusicFile(projectDir, plan.options);
    if (!written.ok) return written;
    cues.push(plan.cue);
  }
  return ok(cues);
}

export { MUSIC_MOODS, type MusicMood };
