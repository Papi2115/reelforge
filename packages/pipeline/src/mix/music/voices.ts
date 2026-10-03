/**
 * Instrument voices of the music engine. Each renders one note into a stereo bus:
 * - pad: detuned saw stack (filtered on the bus, see render.ts), slow attack/release;
 * - keys: 2-operator FM electric piano (decaying index, tine partial, tremolo, tape wow);
 * - pluck: Karplus-Strong string (soft noise burst, damped loop, fractional tuning);
 * - synth: saw + square through a resonant low-pass with a per-note filter envelope;
 * - bass: sine with gentle saturation (audible harmonics on small speakers) and a low-pass.
 */
import type { StereoClip } from '../clip.js';
import { MIX_SAMPLE_RATE, whiteNoise, type Rng } from '../dsp.js';
import { OnePole, Osc, Svf, gateEnvelope, midiToHz, panGains, saturate } from '../synth.js';
import type { NoteEvent } from './score.js';

const SR = MIX_SAMPLE_RATE;

function span(bus: StereoClip, note: NoteEvent, tailS: number): { start: number; end: number } {
  const start = Math.max(0, Math.round(note.time * SR));
  const end = Math.min(bus.left.length, Math.round((note.time + note.length + tailS) * SR));
  return { start, end };
}

function write(bus: StereoClip, at: number, left: number, right: number): void {
  bus.left[at] = (bus.left[at] ?? 0) + left;
  bus.right[at] = (bus.right[at] ?? 0) + right;
}

/** Release-aware envelope: attack, hold for the gate, raised-cosine release after it. */
function sustainEnvelope(t: number, attackS: number, gateS: number, releaseS: number): number {
  return gateEnvelope(t, attackS, releaseS, gateS + releaseS);
}

export interface PadVoiceOptions {
  readonly detuneCents: number;
  readonly attackS: number;
  readonly releaseS: number;
}

/** Five detuned saws, spread across the stereo field around the note's pan. */
export function renderPadNote(
  bus: StereoClip,
  note: NoteEvent,
  options: PadVoiceOptions,
  rng: Rng,
): void {
  const { start, end } = span(bus, note, options.releaseS);
  const hz = midiToHz(note.midi);
  const detunes = [-1, -0.45, 0, 0.45, 1].map((d) => 2 ** ((d * options.detuneCents) / 1200));
  const oscillators = detunes.map(() => new Osc(rng()));
  const frequencies = detunes.map((detune) => hz * detune);
  const pans = detunes.map((_, index) =>
    panGains(Math.max(-1, Math.min(1, note.pan + (index - 2) * 0.12))),
  );
  const level = 0.12 * note.velocity;
  let envelope = 0;
  for (let at = start; at < end; at++) {
    const t = (at - start) / SR;
    // Slow envelope: refreshing it every 8 samples is inaudible and saves most of the cost.
    if ((at - start) % 8 === 0) {
      envelope = level * sustainEnvelope(t, options.attackS, note.length, options.releaseS);
    }
    let left = 0;
    let right = 0;
    for (let index = 0; index < oscillators.length; index++) {
      const value = oscillators[index]?.saw(frequencies[index] ?? hz) ?? 0;
      left += value * (pans[index]?.left ?? 1);
      right += value * (pans[index]?.right ?? 1);
    }
    write(bus, at, left * envelope, right * envelope);
  }
}

export interface KeysVoiceOptions {
  readonly wowCents: number;
}

/** FM electric piano: carrier 1:1 with a decaying index, plus a short 14:1 "tine" partial. */
export function renderKeysNote(
  bus: StereoClip,
  note: NoteEvent,
  options: KeysVoiceOptions,
  rng: Rng,
): void {
  const { start, end } = span(bus, note, 0.35);
  const hz = midiToHz(note.midi);
  const carrier = new Osc();
  const modulator = new Osc();
  const tine = new Osc();
  const tremoloPhase = rng() * 2 * Math.PI;
  const brightness = 1.2 + 1.4 * note.velocity;
  const level = 0.16 * note.velocity;
  // Envelopes run as per-sample multipliers; wow and tremolo are refreshed every 16 samples.
  const indexFall = Math.exp(-1 / (SR * 0.35));
  const tineFall = Math.exp(-1 / (SR * 0.03));
  const bodyFall = Math.exp(-1 / (SR * 2.2));
  let indexDepth = brightness;
  let tineDepth = 0.5 * note.velocity;
  let body = 1;
  let wow = 1;
  let tremolo = 0;
  for (let at = start; at < end; at++) {
    const t = (at - start) / SR;
    if ((at - start) % 16 === 0) {
      wow = 2 ** ((options.wowCents * Math.sin(2 * Math.PI * 0.6 * (at / SR))) / 1200);
      tremolo = 0.22 * Math.sin(2 * Math.PI * 4.2 * t + tremoloPhase);
    }
    const tineMod = tineDepth * tine.sine(hz * 14 * wow);
    const value = carrier.pm(hz * wow, (0.25 + indexDepth) * modulator.sine(hz * wow) + tineMod);
    const sample =
      saturate(value * body * sustainEnvelope(t, 0.003, note.length, 0.3), 1.3) * level;
    write(bus, at, sample * (1 + tremolo), sample * (1 - tremolo));
    indexDepth *= indexFall;
    tineDepth *= tineFall;
    body *= bodyFall;
  }
}

export interface PluckVoiceOptions {
  /** 0 = soft/dark, 1 = bright. */
  readonly brightness: number;
}

/** Karplus-Strong plucked string with a low-passed excitation and an allpass for fine tuning. */
export function renderPluckNote(
  bus: StereoClip,
  note: NoteEvent,
  options: PluckVoiceOptions,
  rng: Rng,
): void {
  const ringS = Math.min(1.8, 0.5 + note.length * 2);
  const { start, end } = span(bus, { ...note, length: 0 }, ringS);
  const hz = midiToHz(note.midi);
  // The two-point average adds half a sample of delay; the allpass covers the fraction.
  const period = SR / hz - 0.5;
  const length = Math.max(2, Math.floor(period));
  const fraction = period - length;
  const allpass = (1 - fraction) / (1 + fraction);
  const line = new Float64Array(length);
  const excite = new OnePole(1500 + 6000 * options.brightness * note.velocity);
  for (let index = 0; index < length; index++) line[index] = excite.low(whiteNoise(rng));
  const feedback = Math.exp(-1 / (hz * (0.6 + 1.4 * options.brightness)));
  const pan = panGains(note.pan);
  const level = 0.5 * note.velocity;
  let allpassIn = 0;
  let allpassOut = 0;
  let cursor = 0;
  for (let at = start; at < end; at++) {
    const current = line[cursor] ?? 0;
    const next = line[(cursor + 1) % length] ?? 0;
    const averaged = 0.5 * (current + next) * feedback;
    const tuned = allpass * averaged + allpassIn - allpass * allpassOut;
    allpassIn = averaged;
    allpassOut = tuned;
    line[cursor] = tuned;
    cursor = (cursor + 1) % length;
    const t = (at - start) / SR;
    const fade = Math.min(1, (ringS - t) / 0.05);
    const value = current * level * fade;
    write(bus, at, value * pan.left, value * pan.right);
  }
}

/** Analog-ish synth note: saw + soft square through a resonant low-pass with an envelope. */
export function renderSynthNote(
  bus: StereoClip,
  note: NoteEvent,
  options: PluckVoiceOptions,
  rng: Rng,
): void {
  const { start, end } = span(bus, note, 0.12);
  const hz = midiToHz(note.midi);
  const saw = new Osc(rng());
  const square = new Osc(rng());
  const filter = new Svf();
  const pan = panGains(note.pan);
  const peak = 900 + 3500 * options.brightness * note.velocity;
  const level = 0.18 * note.velocity;
  for (let at = start; at < end; at++) {
    const t = (at - start) / SR;
    if ((at - start) % 2 === 0) filter.set(350 + peak * Math.exp(-t / 0.09), 1.4);
    const raw = saw.saw(hz) + 0.4 * square.square(hz * 0.5, 0.5);
    const value = filter.process(raw) * level * sustainEnvelope(t, 0.003, note.length, 0.1);
    write(bus, at, value * pan.left, value * pan.right);
  }
}

export type BassStyle = 'sub' | 'warm' | 'pulse';

/** Bass: sine body, saturated for upper harmonics (style sets the drive), then low-passed. */
export function renderBassNote(bus: StereoClip, note: NoteEvent, style: BassStyle): void {
  const { start, end } = span(bus, note, 0.08);
  const hz = midiToHz(note.midi);
  const body = new Osc();
  const octave = new Osc();
  const tone = new OnePole(style === 'sub' ? 420 : style === 'warm' ? 700 : 900);
  const drive = style === 'sub' ? 1.2 : style === 'warm' ? 1.8 : 2.4;
  const level = 0.35 * note.velocity;
  for (let at = start; at < end; at++) {
    const t = (at - start) / SR;
    const raw = body.sine(hz) + (style === 'sub' ? 0 : 0.2 * octave.triangle(hz * 2));
    const value =
      tone.low(saturate(raw * 0.9, drive)) * level * sustainEnvelope(t, 0.006, note.length, 0.06);
    write(bus, at, value, value);
  }
}
