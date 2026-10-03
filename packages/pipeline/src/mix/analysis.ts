/**
 * Offline audio measurements used to level the synthesized SFX / music and by their objective QA
 * tests: windowed RMS, integrated loudness (ITU-R BS.1770-4 K-weighting + gating, 48 kHz),
 * FFT-based spectra (centroid, band energy), stereo correlation and onset periodicity.
 */
import type { StereoClip } from './clip.js';
import { MIX_SAMPLE_RATE } from './dsp.js';

/** Highest RMS over sliding windows of `windowFrames` (hop = window / 4). */
export function maxWindowRms(samples: Float32Array | Float64Array, windowFrames: number): number {
  const window = Math.max(1, Math.min(windowFrames, samples.length));
  const hop = Math.max(1, Math.floor(window / 4));
  let best = 0;
  for (let start = 0; start + window <= samples.length; start += hop) {
    let sum = 0;
    for (let index = start; index < start + window; index++) {
      const value = samples[index] ?? 0;
      sum += value * value;
    }
    best = Math.max(best, Math.sqrt(sum / window));
  }
  return best;
}

/** In-place biquad with fixed coefficients (direct form I, float64). */
function biquadInPlace(samples: Float64Array, b: readonly number[], a: readonly number[]): void {
  const [b0 = 0, b1 = 0, b2 = 0] = b;
  const [, a1 = 0, a2 = 0] = a;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < samples.length; index++) {
    const input = samples[index] ?? 0;
    const output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = output;
    samples[index] = output;
  }
}

/** K-weighted copy of one channel (BS.1770 pre-filter + RLB high-pass, 48 kHz coefficients). */
export function kWeighted(samples: Float32Array): Float64Array {
  const out = Float64Array.from(samples);
  biquadInPlace(
    out,
    [1.53512485958697, -2.69169618940638, 1.19839281085285],
    [1, -1.69065929318241, 0.73248077421585],
  );
  biquadInPlace(out, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  return out;
}

function kWeightedSquares(samples: Float32Array): Float64Array {
  const out = kWeighted(samples);
  for (let index = 0; index < out.length; index++) out[index] = (out[index] ?? 0) ** 2;
  return out;
}

const blockLoudness = (power: number): number => -0.691 + 10 * Math.log10(Math.max(power, 1e-20));

/** Integrated loudness (LUFS) of a 48 kHz stereo clip; -70 for silence or too-short input. */
export function integratedLufs(clip: StereoClip): number {
  const left = kWeightedSquares(clip.left);
  const right = clip.right === clip.left ? left : kWeightedSquares(clip.right);
  const block = Math.round(0.4 * MIX_SAMPLE_RATE);
  const hop = Math.round(0.1 * MIX_SAMPLE_RATE);
  // Prefix sums make every 400 ms block O(1).
  const prefix = new Float64Array(left.length + 1);
  for (let index = 0; index < left.length; index++) {
    prefix[index + 1] = (prefix[index] ?? 0) + (left[index] ?? 0) + (right[index] ?? 0);
  }
  const powers: number[] = [];
  for (let start = 0; start + block <= left.length; start += hop) {
    powers.push(((prefix[start + block] ?? 0) - (prefix[start] ?? 0)) / block);
  }
  const absolute = powers.filter((power) => blockLoudness(power) > -70);
  if (absolute.length === 0) return -70;
  const mean = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const relativeGate = blockLoudness(mean(absolute)) - 10;
  const gated = absolute.filter((power) => blockLoudness(power) > relativeGate);
  return blockLoudness(mean(gated.length > 0 ? gated : absolute));
}

const twiddles = new Map<number, { readonly cos: Float64Array; readonly sin: Float64Array }>();

function twiddlesFor(size: number): { readonly cos: Float64Array; readonly sin: Float64Array } {
  const cached = twiddles.get(size);
  if (cached !== undefined) return cached;
  const made = {
    cos: Float64Array.from({ length: size / 2 }, (_, k) => Math.cos((-2 * Math.PI * k) / size)),
    sin: Float64Array.from({ length: size / 2 }, (_, k) => Math.sin((-2 * Math.PI * k) / size)),
  };
  twiddles.set(size, made);
  return made;
}

/** In-place iterative radix-2 FFT (length must be a power of two). */
export function fft(real: Float64Array, imag: Float64Array): void {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index++) {
    let bit = size >> 1;
    for (; (reversed & bit) !== 0; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed] ?? 0, real[index] ?? 0];
      [imag[index], imag[reversed]] = [imag[reversed] ?? 0, imag[index] ?? 0];
    }
  }
  const table = twiddlesFor(size);
  for (let length = 2; length <= size; length <<= 1) {
    const stride = size / length;
    for (let start = 0; start < size; start += length) {
      for (let k = 0; k < length / 2; k++) {
        const cos = table.cos[k * stride] ?? 1;
        const sin = table.sin[k * stride] ?? 0;
        const even = start + k;
        const odd = even + length / 2;
        const oddReal = (real[odd] ?? 0) * cos - (imag[odd] ?? 0) * sin;
        const oddImag = (real[odd] ?? 0) * sin + (imag[odd] ?? 0) * cos;
        real[odd] = (real[even] ?? 0) - oddReal;
        imag[odd] = (imag[even] ?? 0) - oddImag;
        real[even] = (real[even] ?? 0) + oddReal;
        imag[even] = (imag[even] ?? 0) + oddImag;
      }
    }
  }
}

export interface PowerSpectrum {
  /** Mean power per bin, bins 0..size/2. */
  readonly power: Float64Array;
  readonly binHz: number;
}

/** Welch power spectrum (Hann windows of `size`, 50% overlap) of a mono signal. */
export function powerSpectrum(samples: Float32Array, size = 4096): PowerSpectrum {
  const power = new Float64Array(size / 2 + 1);
  const window = Float64Array.from(
    { length: size },
    (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / size),
  );
  let count = 0;
  for (let start = 0; start === 0 || start + size <= samples.length; start += size / 2) {
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let index = 0; index < size; index++) {
      real[index] = (samples[start + index] ?? 0) * (window[index] ?? 0);
    }
    fft(real, imag);
    for (let bin = 0; bin < power.length; bin++) {
      power[bin] = (power[bin] ?? 0) + (real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2;
    }
    count++;
  }
  for (let bin = 0; bin < power.length; bin++) power[bin] = (power[bin] ?? 0) / count;
  return { power, binHz: MIX_SAMPLE_RATE / size };
}

/** Power-weighted mean frequency (Hz). */
export function spectralCentroid(spectrum: PowerSpectrum): number {
  let weighted = 0;
  let total = 0;
  spectrum.power.forEach((value, bin) => {
    weighted += value * bin * spectrum.binHz;
    total += value;
  });
  return total === 0 ? 0 : weighted / total;
}

/** Share of the total power in [fromHz, toHz). */
export function bandShare(spectrum: PowerSpectrum, fromHz: number, toHz: number): number {
  let band = 0;
  let total = 0;
  spectrum.power.forEach((value, bin) => {
    const hz = bin * spectrum.binHz;
    total += value;
    if (hz >= fromHz && hz < toHz) band += value;
  });
  return total === 0 ? 0 : band / total;
}

/** Pearson correlation of the two channels (1 = mono, 0 = unrelated, -1 = out of phase). */
export function stereoCorrelation(clip: StereoClip): number {
  let lr = 0;
  let ll = 0;
  let rr = 0;
  for (let index = 0; index < clip.left.length; index++) {
    const l = clip.left[index] ?? 0;
    const r = clip.right[index] ?? 0;
    lr += l * r;
    ll += l * l;
    rr += r * r;
  }
  return ll === 0 || rr === 0 ? 1 : lr / Math.sqrt(ll * rr);
}

export function mixToMono(clip: StereoClip): Float32Array {
  return Float32Array.from(clip.left, (value, index) => 0.5 * (value + (clip.right[index] ?? 0)));
}

/** Positive energy flux per `hopFrames` hop (onset strength), mean-removed. */
export function onsetEnvelope(samples: Float32Array, hopFrames: number): Float64Array {
  const count = Math.floor(samples.length / hopFrames);
  const energy = new Float64Array(count);
  for (let hop = 0; hop < count; hop++) {
    let sum = 0;
    for (let index = hop * hopFrames; index < (hop + 1) * hopFrames; index++) {
      sum += (samples[index] ?? 0) ** 2;
    }
    energy[hop] = Math.log10(1e-9 + sum / hopFrames);
  }
  const flux = Float64Array.from(energy, (value, hop) =>
    hop === 0 ? 0 : Math.max(0, value - (energy[hop - 1] ?? 0)),
  );
  const mean = flux.reduce((sum, value) => sum + value, 0) / Math.max(1, flux.length);
  return flux.map((value) => value - mean);
}

/** Normalized autocorrelation of `signal` at `lag`. */
export function autocorrelation(signal: Float64Array, lag: number): number {
  let sum = 0;
  let norm = 0;
  for (let index = 0; index < signal.length; index++) {
    const value = signal[index] ?? 0;
    norm += value * value;
    if (index + lag < signal.length) sum += value * (signal[index + lag] ?? 0);
  }
  return norm === 0 ? 0 : sum / norm;
}
