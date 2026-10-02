/**
 * In-app recording -> 48 kHz 16-bit PCM WAV (PLAN.md#7.2). The take is decoded at 48 kHz by the
 * Web Audio API, mixed down to mono (a voice-over), clipped to [-1, 1] and written as a canonical
 * 44-byte-header WAV, which main validates again before saving. Pure.
 */

/** Averages the channels of a decoded take into one. */
export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0];
  if (first === undefined) return new Float32Array(0);
  if (channels.length === 1) return first;
  const mono = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < mono.length; i += 1) mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0);
  }
  for (let i = 0; i < mono.length; i += 1) mono[i] = (mono[i] ?? 0) / channels.length;
  return mono;
}

function writeText(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Mono float samples -> WAV bytes (16-bit little-endian PCM). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  writeText(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(view, 8, 'WAVE');
  writeText(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  return bytes;
}

/** Peak and RMS of a block of samples (level meter), as 0..1. */
export function levelOf(samples: Float32Array): { readonly peak: number; readonly rms: number } {
  let peak = 0;
  let sum = 0;
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }
  return {
    peak: Math.min(1, peak),
    rms: samples.length === 0 ? 0 : Math.sqrt(sum / samples.length),
  };
}

/** Level 0..1 -> meter fill 0..1 on a -60..0 dBFS scale. */
export function meterFill(level: number): number {
  if (level <= 0) return 0;
  const db = 20 * Math.log10(level);
  return Math.max(0, Math.min(1, (db + 60) / 60));
}
