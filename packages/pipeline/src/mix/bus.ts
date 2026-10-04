/**
 * Offline bus rendering: places clips on a 48 kHz stereo timeline (gain, balance, fades, looping)
 * and streams the sum to a float32 WAV in fixed-size blocks, so long timelines never need the
 * whole bus in memory. Accumulation is float64 and in event order: fully deterministic.
 */
import { open, rm } from 'node:fs/promises';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';
import { clipFrames, type StereoClip } from './clip.js';
import { MIX_SAMPLE_RATE, fadeCurve } from './dsp.js';
import { encodeSamples, wavHeader } from './wav.js';

export interface BusEvent {
  readonly clip: StereoClip;
  /** First timeline frame of the event. */
  readonly startFrame: number;
  /** Length on the timeline (frames). */
  readonly frames: number;
  /** Clip frame played at `startFrame`. */
  readonly offsetFrame: number;
  /** Wrap around the clip (it should be a seamless loop) instead of stopping at its end. */
  readonly loop: boolean;
  readonly gainLeft: number;
  readonly gainRight: number;
  readonly fadeInFrames: number;
  readonly fadeOutFrames: number;
}

/**
 * A silence of the bus (reveal moment "silence hit", PLAN.md#12.27): over [startFrame, endFrame)
 * the bus fades to SILENCE_FLOOR in SILENCE_FADE_FRAMES (raised cosine), holds, and is back at
 * full level at `endFrame`, where the hit lands.
 */
export interface BusSilence {
  readonly startFrame: number;
  readonly endFrame: number;
}

/** Level inside a silence (−40 dB: near silence, still a room). */
export const SILENCE_FLOOR = 0.01;
/** Fade into the silence (30 ms). */
export const SILENCE_FADE_FRAMES = Math.round(MIX_SAMPLE_RATE * 0.03);

/** Gain of the silences at timeline frame `frame` (1 outside them). */
export function silenceGain(silences: readonly BusSilence[], frame: number): number {
  for (const silence of silences) {
    if (frame < silence.startFrame || frame >= silence.endFrame) continue;
    const length = silence.endFrame - silence.startFrame;
    const fade = Math.min(SILENCE_FADE_FRAMES, Math.floor(length / 2));
    const position = frame - silence.startFrame;
    if (fade <= 0 || position >= fade) return SILENCE_FLOOR;
    return 1 - (1 - SILENCE_FLOOR) * fadeCurve((position + 0.5) / fade);
  }
  return 1;
}

/** Multiplies the block by the silences' gain (no-op without silences). */
export function applySilences(
  silences: readonly BusSilence[],
  blockStart: number,
  left: Float64Array,
  right: Float64Array,
): void {
  if (silences.length === 0) return;
  for (let at = 0; at < left.length; at++) {
    const gain = silenceGain(silences, blockStart + at);
    if (gain === 1) continue;
    left[at] = (left[at] ?? 0) * gain;
    right[at] = (right[at] ?? 0) * gain;
  }
}

/** Block size for streaming (10 s). */
export const BUS_BLOCK_FRAMES = MIX_SAMPLE_RATE * 10;

/** Balance law: centre = unity on both sides; panning attenuates the far side (cosine). */
export function balanceGains(pan: number): { readonly left: number; readonly right: number } {
  const clamped = Math.max(-1, Math.min(1, pan));
  return {
    left: clamped > 0 ? Math.cos((clamped * Math.PI) / 2) : 1,
    right: clamped < 0 ? Math.cos((-clamped * Math.PI) / 2) : 1,
  };
}

function envelopeAt(event: BusEvent, position: number): number {
  let gain = 1;
  if (position < event.fadeInFrames) gain *= fadeCurve((position + 0.5) / event.fadeInFrames);
  const remaining = event.frames - position;
  if (remaining <= event.fadeOutFrames) gain *= fadeCurve((remaining - 0.5) / event.fadeOutFrames);
  return gain;
}

/** Adds every event overlapping [blockStart, blockStart + left.length) into the accumulators. */
export function mixBlock(
  events: readonly BusEvent[],
  blockStart: number,
  left: Float64Array,
  right: Float64Array,
): void {
  const blockEnd = blockStart + left.length;
  for (const event of events) {
    const length = clipFrames(event.clip);
    const from = Math.max(blockStart, event.startFrame);
    const to = Math.min(blockEnd, event.startFrame + event.frames);
    if (from >= to || length === 0) continue;
    for (let frame = from; frame < to; frame++) {
      const position = frame - event.startFrame;
      let source = event.offsetFrame + position;
      if (event.loop) source %= length;
      else if (source >= length) break;
      const gain = envelopeAt(event, position);
      const at = frame - blockStart;
      left[at] = (left[at] ?? 0) + (event.clip.left[source] ?? 0) * gain * event.gainLeft;
      right[at] = (right[at] ?? 0) + (event.clip.right[source] ?? 0) * gain * event.gainRight;
    }
  }
}

function cancelled(): FfmpegError {
  return { kind: 'cancelled', message: 'mix cancelled' };
}

/** Reads `aborted` through a call so TypeScript does not narrow it across awaits. */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * Renders `events` over `totalFrames` frames into a 48 kHz stereo float32 WAV at `filePath`;
 * `silences` (reveal moments) duck the whole bus, none = the same bytes as before.
 */
export async function writeBusWav(
  filePath: string,
  events: readonly BusEvent[],
  totalFrames: number,
  signal: AbortSignal | undefined,
  silences: readonly BusSilence[] = [],
): Promise<Result<void, FfmpegError>> {
  if (isAborted(signal)) return err(cancelled());
  let failure: FfmpegError | null = null;
  try {
    const handle = await open(filePath, 'w');
    try {
      await handle.write(wavHeader(totalFrames, 2, MIX_SAMPLE_RATE, 'float32'));
      for (let blockStart = 0; blockStart < totalFrames; blockStart += BUS_BLOCK_FRAMES) {
        if (isAborted(signal)) {
          failure = cancelled();
          break;
        }
        const frames = Math.min(BUS_BLOCK_FRAMES, totalFrames - blockStart);
        const left = new Float64Array(frames);
        const right = new Float64Array(frames);
        mixBlock(events, blockStart, left, right);
        applySilences(silences, blockStart, left, right);
        const channels = [Float32Array.from(left), Float32Array.from(right)];
        await handle.write(encodeSamples(channels, 0, frames, 'float32'));
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    failure = {
      kind: 'io',
      message: `cannot write bus ${filePath}: ${describeError(error)}`,
      path: filePath,
    };
  }
  if (failure === null) return ok(undefined);
  await rm(filePath, { force: true });
  return err(failure);
}
