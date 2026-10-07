/**
 * The note writer of a score (score.ts drives it bar by bar): pad and keys voicings that lead
 * smoothly, arpeggios, a moving bass line and drums with fills, all humanized from the score's RNG.
 */
import type { Rng } from '../dsp.js';
import type { DrumVoice, MoodPreset, Pattern } from './moods.js';
import type { BarInfo, NoteEvent } from './score.js';
import { chordPitchClasses, voiceLead, type MusicKey } from './theory.js';

export const DRUM_ORDER: readonly DrumVoice[] = [
  'kick',
  'snare',
  'clap',
  'hat',
  'openHat',
  'shaker',
  'rim',
];
const HUMANIZE_S = 0.006;

export type BassStep = 'root' | 'fifth' | 'octave';

interface PartState {
  previous: number[] | null;
}

export class ScoreBuilder {
  readonly notes: NoteEvent[] = [];
  private readonly stepS: number;
  private readonly states: Record<'pad' | 'keys', PartState> = {
    pad: { previous: null },
    keys: { previous: null },
  };

  constructor(
    private readonly preset: MoodPreset,
    private readonly key: MusicKey,
    private readonly barS: number,
    private readonly rng: Rng,
  ) {
    this.stepS = barS / 16;
  }

  /** Step start time with swing on odd sixteenths and a little human timing. */
  private stepTime(bar: number, step: number, humanize = HUMANIZE_S): number {
    const swing = step % 2 === 1 ? this.preset.swing * this.stepS : 0;
    const jitter = (this.rng() * 2 - 1) * humanize;
    return Math.max(0, bar * this.barS + step * this.stepS + swing + jitter);
  }

  private add(note: NoteEvent): void {
    const human = 1 + (this.rng() * 2 - 1) * 0.08;
    this.notes.push({ ...note, velocity: Math.min(1, Math.max(0.05, note.velocity * human)) });
  }

  private voicing(
    part: 'pad' | 'keys',
    bar: BarInfo,
    register: readonly [number, number],
    count: number,
  ): number[] {
    const state = this.states[part];
    const notes = voiceLead(bar.pitchClasses, state.previous, register[0], register[1], count);
    state.previous = notes;
    return notes;
  }

  pad(bar: BarInfo, chordBars: number): void {
    const pad = this.preset.pad;
    if (pad === null) return;
    const notes = this.voicing('pad', bar, pad.register, pad.voices);
    notes.forEach((midi, index) => {
      this.add({
        voice: 'pad',
        time: bar.index * this.barS,
        length: chordBars * this.barS,
        midi,
        velocity: 0.8,
        pan: 0.7 * (-0.5 + index / Math.max(1, notes.length - 1)),
      });
    });
  }

  private hits(
    rhythm: Pattern,
    energy: number,
    minEnergy: number,
  ): { step: number; velocity: number }[] {
    if (energy < minEnergy) return [];
    const density = Math.min(1, 0.45 + energy);
    return rhythm.flatMap((step, index) =>
      step.chance > 0 && this.rng() < step.chance * (step.chance >= 1 ? 1 : density)
        ? [{ step: index, velocity: step.velocity * (0.7 + 0.3 * energy) }]
        : [],
    );
  }

  keys(bar: BarInfo): void {
    const keys = this.preset.keys;
    if (keys === null) return;
    const notes = this.voicing('keys', bar, keys.register, 4);
    const hits = this.hits(keys.rhythm, bar.energy, keys.minEnergy);
    hits.forEach((hit, index) => {
      const next = hits[index + 1]?.step ?? 16;
      for (const midi of notes) {
        this.add({
          voice: 'keys',
          time: this.stepTime(bar.index, hit.step),
          length: (next - hit.step) * this.stepS * 0.95,
          midi,
          velocity: hit.velocity * 0.8,
          pan: 0,
        });
      }
    });
  }

  arp(bar: BarInfo, shape: readonly number[]): void {
    const arp = this.preset.arp;
    if (arp === null || bar.energy < arp.minEnergy) return;
    const [low, high] = arp.register;
    const pool: number[] = [];
    for (let midi = low; midi <= high; midi++) {
      if (bar.pitchClasses.includes(midi % 12)) pool.push(midi);
    }
    if (pool.length === 0) return;
    const stride = arp.rate === 8 ? 2 : 1;
    const density = arp.density * Math.min(1, 0.4 + bar.energy);
    for (let step = 0, count = 0; step < 16; step += stride, count++) {
      const accent = step % 4 === 0;
      if (!accent && this.rng() > density) continue;
      const index = shape[count % shape.length] ?? 0;
      const midi = pool[Math.min(pool.length - 1, index)] ?? low;
      this.add({
        voice: 'arp',
        time: this.stepTime(bar.index, step),
        length: stride * this.stepS * arp.gate,
        midi,
        velocity: (accent ? 0.9 : 0.65) * (0.75 + 0.25 * bar.energy),
        pan: count % 2 === 0 ? -0.3 : 0.3,
      });
    }
  }

  /**
   * Short, moving bass: root on the chord's first downbeat (fifth on its second bar), then the
   * section's line (fifth / octave / root), so even sparse patterns never repeat one note.
   */
  bass(bar: BarInfo, line: readonly BassStep[], chordBar: number): void {
    const bass = this.preset.bass;
    if (bass === null) return;
    const [low] = bass.register;
    const root = low + ((((bar.rootPitchClass - low) % 12) + 12) % 12);
    const fifthPitchClass = chordPitchClasses(this.key, { ...bar.chord, color: 'triad' })[2] ?? 0;
    const pitches: Readonly<Record<BassStep, number>> = {
      root,
      fifth: root + ((fifthPitchClass - bar.rootPitchClass + 12) % 12),
      octave: root + 12,
    };
    const legato = bass.style === 'pulse' ? 0.45 : bass.style === 'warm' ? 0.6 : 0.7;
    const hits = this.hits(bass.rhythm, bar.energy, bass.minEnergy);
    hits.forEach((hit, index) => {
      const next = hits[index + 1]?.step ?? 16;
      const step: BassStep =
        index === 0
          ? chordBar % 2 === 0
            ? 'root'
            : 'fifth'
          : bass.octaveJump
            ? index % 2 === 1
              ? 'octave'
              : 'root'
            : (line[index % line.length] ?? 'fifth');
      this.add({
        voice: 'bass',
        time: this.stepTime(bar.index, hit.step, 0.003),
        // Never longer than a beat: the bass stays rhythmic, never a drone.
        length: Math.max(0.06, Math.min(4 * this.stepS, (next - hit.step) * this.stepS * legato)),
        midi: pitches[step],
        velocity: hit.velocity,
        pan: 0,
      });
    });
  }

  drums(bar: BarInfo, fill: boolean): void {
    const drums = this.preset.drums;
    if (drums === null || bar.energy < drums.minEnergy) return;
    for (const voice of DRUM_ORDER) {
      const rhythm = drums.patterns[voice];
      if (rhythm === undefined) continue;
      for (const hit of this.hits(rhythm, bar.energy, drums.minEnergy)) {
        this.add({
          voice,
          time: this.stepTime(bar.index, hit.step, voice === 'kick' ? 0.002 : 0.005),
          length: this.stepS,
          midi: 0,
          velocity: hit.velocity,
          pan: voice === 'hat' || voice === 'openHat' ? 0.25 : voice === 'shaker' ? -0.3 : 0,
        });
      }
    }
    if (fill) {
      const fillVoice: DrumVoice = drums.patterns.snare !== undefined ? 'snare' : 'rim';
      for (const step of [12, 14, 15]) {
        this.add({
          voice: fillVoice,
          time: this.stepTime(bar.index, step),
          length: this.stepS,
          midi: 0,
          velocity: 0.35 + step * 0.02,
          pan: 0.1,
        });
      }
    }
  }
}
