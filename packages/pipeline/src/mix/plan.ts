/**
 * Turns validated cues into bus events on a fixed-length timeline (pure; user files must already
 * be decoded). Built-in recipes are synthesized here, cached per (recipe, seed, length). Music cues
 * are grouped by ducking settings: each group becomes one bus with its own sidechain compressor.
 */
import path from 'node:path';
import type { FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';
import { synthesizeAmbience } from './ambience.js';
import { balanceGains, type BusEvent } from './bus.js';
import { clipFrames, makeSeamlessLoop, monoClip, type StereoClip } from './clip.js';
import type { AmbienceCue, CuesFile, DuckingSettings, MusicCue, SfxCue } from './cues.js';
import { MIX_SAMPLE_RATE, dbToGain, hashSeed, secondsToFrames } from './dsp.js';
import { synthesizeSfx } from './sfx.js';

export interface MusicBus {
  /** null = this bus is not ducked. */
  readonly ducking: DuckingSettings | null;
  readonly events: readonly BusEvent[];
}

export interface MixPlan {
  readonly totalFrames: number;
  readonly sfx: readonly BusEvent[];
  readonly ambience: readonly BusEvent[];
  /** At least one bus (an empty, unducked one when there is no music). */
  readonly music: readonly MusicBus[];
  readonly warnings: readonly string[];
}

/** Decoded user files keyed by resolved absolute path. */
export type FileClips = ReadonlyMap<string, StereoClip>;

const AMBIENCE_FILE_CROSSFADE_S = 0.5;
const MUSIC_LOOP_CROSSFADE_S = 1;

export function resolveCueFile(baseDir: string, file: string): string {
  return path.resolve(baseDir, file);
}

/** Every distinct user file referenced by the cues, resolved, in order of first use. */
export function cueFiles(cues: CuesFile, baseDir: string): string[] {
  const files = [
    ...cues.sfx.map((cue) => cue.file),
    ...cues.ambience.map((cue) => cue.file),
    ...cues.music.map((cue) => cue.file),
  ].filter((file): file is string => file !== undefined);
  return [...new Set(files.map((file) => resolveCueFile(baseDir, file)))];
}

const formatS = (frames: number): string => (frames / MIX_SAMPLE_RATE).toFixed(2);

class Planner {
  readonly warnings: string[] = [];
  private readonly cache = new Map<string, StereoClip>();

  constructor(
    private readonly totalFrames: number,
    private readonly baseDir: string,
    private readonly files: FileClips,
    private readonly busGainDb: Readonly<Record<'sfx' | 'ambience' | 'music', number>>,
  ) {}

  private cached(key: string, make: () => StereoClip): StereoClip {
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const made = make();
    this.cache.set(key, made);
    return made;
  }

  file(file: string): Result<StereoClip, FfmpegError> {
    const resolved = resolveCueFile(this.baseDir, file);
    const clip = this.files.get(resolved);
    return clip === undefined
      ? err({ kind: 'invalid-input', message: `audio file was not decoded: ${file}` })
      : ok(clip);
  }

  private startOrWarn(label: string, seconds: number): number | null {
    const start = secondsToFrames(seconds);
    if (start < this.totalFrames) return start;
    this.warnings.push(
      `${label} starts at ${formatS(start)} s, after the end of the mix (${formatS(this.totalFrames)} s); skipped`,
    );
    return null;
  }

  sfx(cue: SfxCue, index: number): Result<BusEvent | null, FfmpegError> {
    const start = this.startOrWarn(`sfx[${String(index)}]`, cue.t);
    if (start === null) return ok(null);
    let clip: StereoClip;
    if (cue.name === undefined) {
      const loaded = this.file(cue.file ?? '');
      if (!loaded.ok) return loaded;
      clip = loaded.value;
    } else {
      const name = cue.name;
      const seed = cue.seed ?? hashSeed(`${name}@${cue.t.toFixed(3)}`);
      clip = this.cached(`sfx|${name}|${String(seed)}|${String(cue.durationS)}`, () =>
        monoClip(synthesizeSfx(name, { seed, durationS: cue.durationS })),
      );
    }
    const pan = balanceGains(cue.pan);
    const gain = dbToGain(cue.gainDb + this.busGainDb.sfx);
    return ok({
      clip,
      startFrame: start,
      frames: Math.min(clipFrames(clip), this.totalFrames - start),
      offsetFrame: 0,
      loop: false,
      gainLeft: gain * pan.left,
      gainRight: gain * pan.right,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    });
  }

  private ranged(
    label: string,
    cue: { from: number; to: number; fadeInS: number; fadeOutS: number; gainDb: number },
    bus: 'ambience' | 'music',
    clip: StereoClip,
    offsetFrame: number,
    loop: boolean,
  ): BusEvent | null {
    const start = this.startOrWarn(label, cue.from);
    if (start === null) return null;
    const frames = Math.min(secondsToFrames(cue.to), this.totalFrames) - start;
    if (frames <= 0) return null;
    const half = Math.floor(frames / 2);
    const gain = dbToGain(cue.gainDb + this.busGainDb[bus]);
    return {
      clip,
      startFrame: start,
      frames,
      offsetFrame,
      loop,
      gainLeft: gain,
      gainRight: gain,
      fadeInFrames: Math.min(secondsToFrames(cue.fadeInS), half),
      fadeOutFrames: Math.min(secondsToFrames(cue.fadeOutS), half),
    };
  }

  ambience(cue: AmbienceCue, index: number): Result<BusEvent | null, FfmpegError> {
    let clip: StereoClip;
    if (cue.name === undefined) {
      const file = cue.file ?? '';
      const loaded = this.file(file);
      if (!loaded.ok) return loaded;
      const source = loaded.value;
      clip = this.cached(`amb-file|${resolveCueFile(this.baseDir, file)}`, () =>
        makeSeamlessLoop(
          source,
          Math.min(secondsToFrames(AMBIENCE_FILE_CROSSFADE_S), clipFrames(source) / 4),
        ),
      );
    } else {
      const name = cue.name;
      const seed = cue.seed ?? hashSeed(`${name}@${cue.from.toFixed(3)}`);
      clip = this.cached(`amb|${name}|${String(seed)}`, () => synthesizeAmbience(name, { seed }));
    }
    return ok(this.ranged(`ambience[${String(index)}]`, cue, 'ambience', clip, 0, true));
  }

  music(cue: MusicCue, index: number): Result<BusEvent | null, FfmpegError> {
    const loaded = this.file(cue.file);
    if (!loaded.ok) return loaded;
    const source = loaded.value;
    const clip = cue.loop
      ? this.cached(`music-loop|${resolveCueFile(this.baseDir, cue.file)}`, () =>
          makeSeamlessLoop(
            source,
            Math.min(secondsToFrames(MUSIC_LOOP_CROSSFADE_S), clipFrames(source) / 4),
          ),
        )
      : source;
    const offset = secondsToFrames(cue.offsetS);
    const label = `music[${String(index)}]`;
    if (!cue.loop && offset >= clipFrames(clip)) {
      this.warnings.push(`${label}: offsetS is past the end of ${cue.file}; skipped`);
      return ok(null);
    }
    return ok(
      this.ranged(
        label,
        cue,
        'music',
        clip,
        cue.loop ? offset % clipFrames(clip) : offset,
        cue.loop,
      ),
    );
  }
}

function duckingKey(ducking: DuckingSettings): string {
  if (!ducking.enabled) return 'off';
  return [ducking.thresholdDb, ducking.ratio, ducking.attackMs, ducking.releaseMs].join('|');
}

function collect<C>(
  cues: readonly C[],
  place: (cue: C, index: number) => Result<BusEvent | null, FfmpegError>,
): Result<BusEvent[], FfmpegError> {
  const events: BusEvent[] = [];
  for (const [index, cue] of cues.entries()) {
    const placed = place(cue, index);
    if (!placed.ok) return placed;
    if (placed.value !== null) events.push(placed.value);
  }
  return ok(events);
}

export function planMix(
  cues: CuesFile,
  totalFrames: number,
  baseDir: string,
  files: FileClips,
): Result<MixPlan, FfmpegError> {
  const planner = new Planner(totalFrames, baseDir, files, {
    sfx: cues.global.sfxGainDb ?? 0,
    ambience: cues.global.ambienceGainDb ?? 0,
    music: cues.global.musicGainDb ?? 0,
  });
  const sfx = collect(cues.sfx, (cue, index) => planner.sfx(cue, index));
  if (!sfx.ok) return sfx;
  const ambience = collect(cues.ambience, (cue, index) => planner.ambience(cue, index));
  if (!ambience.ok) return ambience;
  const groups = new Map<string, { ducking: DuckingSettings | null; events: BusEvent[] }>();
  for (const [index, cue] of cues.music.entries()) {
    const placed = planner.music(cue, index);
    if (!placed.ok) return placed;
    if (placed.value === null) continue;
    const key = duckingKey(cue.ducking);
    const group = groups.get(key) ?? {
      ducking: cue.ducking.enabled ? cue.ducking : null,
      events: [],
    };
    group.events.push(placed.value);
    groups.set(key, group);
  }
  const music = groups.size === 0 ? [{ ducking: null, events: [] }] : [...groups.values()];
  return ok({
    totalFrames,
    sfx: sfx.value,
    ambience: ambience.value,
    music,
    warnings: planner.warnings,
  });
}
