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

/** Renders `events` over `totalFrames` frames into a 48 kHz stereo float32 WAV at `filePath`. */
export async function writeBusWav(
  filePath: string,
  events: readonly BusEvent[],
  totalFrames: number,
  signal: AbortSignal | undefined,
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
