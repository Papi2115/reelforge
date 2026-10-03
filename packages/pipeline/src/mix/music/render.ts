/**
 * Renders a score to a finished stereo bed: per-part buses (the pad bus is low-passed with a slow,
 * energy-following cutoff), a shared reverb send, an optional gated-reverb snare, then the bed
 * master: 80 Hz high-pass (24 dB/oct) + low shelf, a broad -3 dB dip around 1 kHz that leaves room for the voice, a soft
 * high shelf, mono-safe widening (bass kept centred), loudness to -23 LUFS and a soft limiter.
 * Loopable beds fold the release/reverb tail back onto the start (seamless end -> start).
 */
import { integratedLufs } from '../analysis.js';
import type { StereoClip } from '../clip.js';
import { Biquad, MIX_SAMPLE_RATE, PinkNoise, dbToGain, mulberry32, type Rng } from '../dsp.js';
import { applyReverb } from '../reverb.js';
import { OnePole, Svf, createStereo, expLerp } from '../synth.js';
import { drumSample } from './drums.js';
import type { DrumVoice, MoodPreset } from './moods.js';
import { isDrumVoice, type NoteEvent, type Score } from './score.js';
import {
  renderBassNote,
  renderKeysNote,
  renderPadNote,
  renderPluckNote,
  renderSynthNote,
} from './voices.js';

const SR = MIX_SAMPLE_RATE;
/** Integrated loudness of every generated bed (the mixer's ducking + master do the rest). */
export const MUSIC_TARGET_LUFS = -23;
/** Sample-peak ceiling of the bed's soft limiter (dBFS). */
export const MUSIC_PEAK_DB = -1;
/** Rendered after the last bar for releases and reverb (folded back when loopable). */
const TAIL_S = 4;
const DRUM_VARIANTS = 3;
/** The bed's high-pass corner (Hz). */
export const BED_HIGHPASS_HZ = 80;

interface Buses {
  readonly pad: StereoClip;
  readonly keys: StereoClip;
  readonly arp: StereoClip;
  readonly bass: StereoClip;
  readonly drums: StereoClip;
  readonly snare: StereoClip;
}

/** Energy at `t` seconds: bar energies interpolated between bar centres (smooth transitions). */
export function energyAt(score: Score, t: number): number {
  const position = t / score.barS - 0.5;
  const index = Math.max(0, Math.min(score.bars.length - 1, Math.floor(position)));
  const next = Math.min(score.bars.length - 1, index + 1);
  const mix = Math.min(1, Math.max(0, position - index));
  const here = score.bars[index]?.energy ?? 0;
  return here + ((score.bars[next]?.energy ?? here) - here) * mix;
}

function placeDrums(buses: Buses, notes: readonly NoteEvent[], preset: MoodPreset, rng: Rng): void {
  const kit = preset.drums?.kit ?? 'soft';
  const samples = new Map<DrumVoice, Float32Array[]>();
  for (const note of notes) {
    const voice = note.voice;
    if (!isDrumVoice(voice)) continue;
    let variants = samples.get(voice);
    if (variants === undefined) {
      variants = Array.from({ length: DRUM_VARIANTS }, () => drumSample(kit, voice, rng));
      samples.set(voice, variants);
    }
    const sample = variants[Math.floor(rng() * DRUM_VARIANTS)] ?? new Float32Array(0);
    const target =
      voice === 'snare' && preset.drums?.gatedSnare === true ? buses.snare : buses.drums;
    const start = Math.round(note.time * SR);
    const left = Math.cos(((note.pan + 1) * Math.PI) / 4) * Math.SQRT2 * note.velocity;
    const right = Math.sin(((note.pan + 1) * Math.PI) / 4) * Math.SQRT2 * note.velocity;
    for (let offset = 0; offset < sample.length && start + offset < target.left.length; offset++) {
      const value = sample[offset] ?? 0;
      target.left[start + offset] = (target.left[start + offset] ?? 0) + value * left;
      target.right[start + offset] = (target.right[start + offset] ?? 0) + value * right;
    }
  }
}

function renderNotes(score: Score, preset: MoodPreset, frames: number, rng: Rng): Buses {
  const buses: Buses = {
    pad: createStereo(frames),
    keys: createStereo(frames),
    arp: createStereo(frames),
    bass: createStereo(frames),
    drums: createStereo(frames),
    snare: createStereo(frames),
  };
  for (const note of score.notes) {
    if (note.voice === 'pad' && preset.pad !== null)
      renderPadNote(buses.pad, note, preset.pad, rng);
    else if (note.voice === 'keys' && preset.keys !== null) {
      renderKeysNote(buses.keys, note, preset.keys, rng);
    } else if (note.voice === 'arp' && preset.arp !== null) {
      if (preset.arp.sound === 'pluck') renderPluckNote(buses.arp, note, preset.arp, rng);
      else renderSynthNote(buses.arp, note, preset.arp, rng);
    } else if (note.voice === 'bass' && preset.bass !== null) {
      renderBassNote(buses.bass, note, preset.bass.style);
    }
  }
  placeDrums(buses, score.notes, preset, rng);
  return buses;
}

/** Low-passes the pad bus with a cutoff that follows the energy and drifts slowly. */
function filterPad(pad: StereoClip, score: Score, preset: MoodPreset, rng: Rng): void {
  if (preset.pad === null) return;
  const [low, high] = preset.pad.cutoff;
  const phase = rng() * 2 * Math.PI;
  for (const channel of [pad.left, pad.right]) {
    const filter = new Svf();
    const soften = new OnePole(9000);
    for (let index = 0; index < channel.length; index++) {
      if (index % 8 === 0) {
        const t = index / SR;
        const drift = 1 + 0.18 * Math.sin(2 * Math.PI * 0.045 * t + phase);
        filter.set(expLerp(low, high, energyAt(score, t)) * drift, 0.8);
      }
      channel[index] = soften.low(filter.process(channel[index] ?? 0));
    }
  }
}

/** 80s gated reverb: the snare's room is cut ~0.22 s after each hit. */
function gateSnare(snare: StereoClip, notes: readonly NoteEvent[]): StereoClip {
  const room = applyReverb(snare, { decayS: 1.4, wet: 0.5, dry: 0, damping: 0.3, width: 1 });
  const gate = new Float32Array(snare.left.length);
  for (const note of notes) {
    if (note.voice !== 'snare') continue;
    const start = Math.round(note.time * SR);
    for (let offset = 0; offset < 0.26 * SR; offset++) {
      const t = offset / SR;
      const value = t < 0.22 ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (t - 0.22)) / 0.04);
      const at = start + offset;
      if (at < gate.length) gate[at] = Math.max(gate[at] ?? 0, value);
    }
  }
  for (let index = 0; index < gate.length; index++) {
    const open = gate[index] ?? 0;
    room.left[index] = (snare.left[index] ?? 0) + (room.left[index] ?? 0) * open;
    room.right[index] = (snare.right[index] ?? 0) + (room.right[index] ?? 0) * open;
  }
  return room;
}

function mixBuses(buses: Buses, score: Score, preset: MoodPreset, rng: Rng): StereoClip {
  const frames = buses.pad.left.length;
  filterPad(buses.pad, score, preset, rng);
  const snare =
    preset.drums?.gatedSnare === true ? gateSnare(buses.snare, score.notes) : buses.snare;
  const parts: readonly (readonly [StereoClip, number, number])[] = [
    [buses.pad, preset.pad?.level ?? 0, 0.55],
    [buses.keys, preset.keys?.level ?? 0, 0.35],
    [buses.arp, preset.arp?.level ?? 0, 0.45],
    [buses.bass, preset.bass?.level ?? 0, 0],
    [buses.drums, preset.drums?.level ?? 0, 0.1],
    [snare, preset.drums?.level ?? 0, 0.1],
  ];
  const dry = createStereo(frames);
  const send = createStereo(frames);
  for (const [bus, level, sendLevel] of parts) {
    for (let index = 0; index < frames; index++) {
      const left = (bus.left[index] ?? 0) * level;
      const right = (bus.right[index] ?? 0) * level;
      dry.left[index] = (dry.left[index] ?? 0) + left;
      dry.right[index] = (dry.right[index] ?? 0) + right;
      send.left[index] = (send.left[index] ?? 0) + left * sendLevel;
      send.right[index] = (send.right[index] ?? 0) + right * sendLevel;
    }
  }
  const room = applyReverb(send, {
    decayS: preset.reverb.decayS,
    wet: preset.reverb.wet,
    dry: 0,
    damping: 0.55,
    preDelayMs: 20,
    lowCutHz: 250,
    width: 0.8,
  });
  if (preset.hiss > 0) {
    for (const channel of [room.left, room.right]) {
      const pink = new PinkNoise(rng);
      const dull = new OnePole(5000);
      for (let index = 0; index < frames; index++) {
        channel[index] = (channel[index] ?? 0) + dull.low(pink.next()) * preset.hiss * 4;
      }
    }
  }
  for (let index = 0; index < frames; index++) {
    dry.left[index] = (dry.left[index] ?? 0) + (room.left[index] ?? 0);
    dry.right[index] = (dry.right[index] ?? 0) + (room.right[index] ?? 0);
  }
  return dry;
}

/** Bed EQ + mono-safe widening: low cut, voice-room dip, soft top, wider sides above 150 Hz. */
function masterBed(clip: StereoClip): void {
  const chains = [0, 1].map(() => [
    // 24 dB/oct at 80 Hz plus a gentle low shelf: no sub build-up under the voice-over.
    new Biquad().highpass(BED_HIGHPASS_HZ),
    new Biquad().highpass(BED_HIGHPASS_HZ),
    new Biquad().shelf('low', 150, -3),
    new Biquad().peaking(1000, 0.45, -3),
    new Biquad().shelf('high', 9000, -2),
  ]);
  const sideLowCut = new Biquad().highpass(150);
  for (let index = 0; index < clip.left.length; index++) {
    let left = clip.left[index] ?? 0;
    let right = clip.right[index] ?? 0;
    for (const filter of chains[0] ?? []) left = filter.process(left);
    for (const filter of chains[1] ?? []) right = filter.process(right);
    const mid = 0.5 * (left + right);
    const side = 0.5 * (left - right);
    const wideSide = sideLowCut.process(side) * 1.1;
    clip.left[index] = mid + wideSide;
    clip.right[index] = mid - wideSide;
  }
}

/** Gain to the target loudness, then a soft knee limiter under the peak ceiling. */
function levelBed(clip: StereoClip): number {
  const gain = dbToGain(MUSIC_TARGET_LUFS - integratedLufs(clip));
  const ceiling = dbToGain(MUSIC_PEAK_DB);
  const knee = ceiling * 0.75;
  for (const channel of [clip.left, clip.right]) {
    for (let index = 0; index < channel.length; index++) {
      const value = (channel[index] ?? 0) * gain;
      const magnitude = Math.abs(value);
      channel[index] =
        magnitude <= knee
          ? value
          : Math.sign(value) *
            (knee + (ceiling - knee) * Math.tanh((magnitude - knee) / (ceiling - knee)));
    }
  }
  return integratedLufs(clip);
}

/** Folds everything after `frames` back onto the start (loop) or fades the end (one-shot). */
function finishLength(clip: StereoClip, frames: number, loopable: boolean): StereoClip {
  const out = { left: clip.left.slice(0, frames), right: clip.right.slice(0, frames) };
  if (loopable) {
    for (let index = frames; index < clip.left.length; index++) {
      const at = (index - frames) % frames;
      out.left[at] = (out.left[at] ?? 0) + (clip.left[index] ?? 0);
      out.right[at] = (out.right[at] ?? 0) + (clip.right[index] ?? 0);
    }
    return out;
  }
  const fade = Math.min(frames, Math.round(0.8 * SR));
  for (let index = 0; index < fade; index++) {
    const at = frames - 1 - index;
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * index) / fade);
    out.left[at] = (out.left[at] ?? 0) * gain;
    out.right[at] = (out.right[at] ?? 0) * gain;
  }
  return out;
}

export interface RenderedBed {
  readonly clip: StereoClip;
  readonly lufs: number;
}

export function renderBed(
  score: Score,
  preset: MoodPreset,
  seed: number,
  loopable: boolean,
): RenderedBed {
  const frames = Math.round(score.durationS * SR);
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const buses = renderNotes(score, preset, frames + Math.round(TAIL_S * SR), rng);
  const mixed = mixBuses(buses, score, preset, rng);
  masterBed(mixed);
  const clip = finishLength(mixed, frames, loopable);
  const lufs = levelBed(clip);
  return { clip, lufs };
}
