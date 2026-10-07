/**
 * Score generation: turns (mood preset, seed, length, structure, energy) into timed note events.
 * Sections (intro / main / break / outro) carry an energy level that decides which parts play and
 * how dense they are; each section gets its own progression variant and arpeggio pattern, so a
 * piece develops instead of looping one bar. Pure and deterministic per seed.
 */
import { hashSeed, mulberry32, type Rng } from '../dsp.js';
import {
  MOOD_PRESETS,
  type DrumVoice,
  type MoodPreset,
  type MusicMood,
  type SectionKind,
} from './moods.js';
import { DRUM_ORDER, ScoreBuilder, type BassStep } from './score-builder.js';
import {
  chordPitchClasses,
  chordRootPitchClass,
  degreeToMidi,
  type ChordSpec,
  type MusicKey,
} from './theory.js';

export type PitchedVoice = 'pad' | 'keys' | 'arp' | 'bass';
export type Voice = PitchedVoice | DrumVoice;

export interface NoteEvent {
  readonly voice: Voice;
  /** Start (seconds). */
  readonly time: number;
  /** Gate length (seconds). */
  readonly length: number;
  /** MIDI note (0 for drums). */
  readonly midi: number;
  readonly velocity: number;
  readonly pan: number;
}

export interface SectionSpec {
  readonly kind: SectionKind;
  readonly bars: number;
  /** 0..1; defaults to the mood's level for the section. */
  readonly energy?: number;
}

export interface BarInfo {
  readonly index: number;
  readonly section: SectionKind;
  readonly energy: number;
  readonly chord: ChordSpec;
  readonly rootPitchClass: number;
  readonly pitchClasses: readonly number[];
}

export interface Score {
  readonly mood: MusicMood;
  readonly bpm: number;
  readonly key: MusicKey;
  readonly barS: number;
  readonly durationS: number;
  readonly bars: readonly BarInfo[];
  readonly notes: readonly NoteEvent[];
}

export interface ScoreOptions {
  readonly seed: number;
  readonly mood: MusicMood;
  readonly durationS: number;
  /** Fixed tempo; by default it is picked from the mood range and nudged to fit whole bars. */
  readonly bpm?: number | undefined;
  readonly key?: MusicKey | undefined;
  readonly structure?: readonly SectionSpec[] | undefined;
  /** Overall intensity 0..1 (default 0.6): scales every section's energy. */
  readonly energy?: number | undefined;
}

const BEATS_PER_BAR = 4;

export function isDrumVoice(voice: Voice): voice is DrumVoice {
  return (DRUM_ORDER as readonly Voice[]).includes(voice);
}

const pick = <T>(rng: Rng, items: readonly T[]): T => {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
};

/** Default arrangement for `bars`: intro, main, (break, main), outro. */
export function defaultStructure(bars: number): SectionSpec[] {
  if (bars < 8) return [{ kind: 'main', bars }];
  const edge = bars >= 24 ? 4 : 2;
  const middle = bars - 2 * edge;
  if (middle < 12) {
    return [
      { kind: 'intro', bars: edge },
      { kind: 'main', bars: middle },
      { kind: 'outro', bars: edge },
    ];
  }
  const breakBars = middle >= 24 ? 4 : 2;
  const first = Math.floor((middle - breakBars) / 2 / 2) * 2;
  return [
    { kind: 'intro', bars: edge },
    { kind: 'main', bars: first },
    { kind: 'break', bars: breakBars },
    { kind: 'main', bars: middle - breakBars - first },
    { kind: 'outro', bars: edge },
  ];
}

function tempoAndBars(
  preset: MoodPreset,
  options: ScoreOptions,
  rng: Rng,
): { bpm: number; bars: number } {
  const [low, high] = preset.bpm;
  const base = options.bpm ?? low + rng() * (high - low);
  const barS = (60 / base) * BEATS_PER_BAR;
  if (options.bpm !== undefined) {
    return { bpm: base, bars: Math.max(1, Math.ceil(options.durationS / barS - 1e-6)) };
  }
  const bars = Math.max(2, Math.round(options.durationS / barS));
  return { bpm: (bars * BEATS_PER_BAR * 60) / options.durationS, bars };
}

/** A progression variant: maybe rotated, maybe one chord swapped for its relative (a third down). */
function variantOf(progression: readonly ChordSpec[], rng: Rng): ChordSpec[] {
  const rotated =
    rng() < 0.3 ? [...progression.slice(2), ...progression.slice(0, 2)] : [...progression];
  if (rng() < 0.5) {
    const at = 1 + Math.floor(rng() * (rotated.length - 1));
    const chord = rotated[at];
    if (chord !== undefined) rotated[at] = { ...chord, degree: (chord.degree + 5) % 7 };
  }
  return rotated;
}

/** Bass lines per section (hit index -> chord step); hit 0 of a bar is always the root. */
const BASS_LINES: readonly (readonly BassStep[])[] = [
  ['root', 'fifth', 'octave', 'fifth'],
  ['root', 'octave', 'fifth', 'root'],
  ['root', 'fifth', 'root', 'octave'],
  ['root', 'root', 'fifth', 'octave'],
];

/** Arpeggio shapes as indices into the chord-tone pool of the arp register. */
const ARP_SHAPES: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 3, 2, 1],
  [0, 2, 1, 3, 2, 4, 3, 5],
  [4, 2, 3, 1, 2, 0, 1, 2],
  [0, 2, 4, 2, 5, 4, 2, 1],
  [1, 3, 2, 4, 3, 5, 4, 2],
];

export function generateScore(options: ScoreOptions): Score {
  const preset = MOOD_PRESETS[options.mood];
  const rng = mulberry32((options.seed ^ hashSeed(options.mood)) >>> 0);
  const key = options.key ?? { tonic: pick(rng, preset.tonics), mode: pick(rng, preset.modes) };
  const { bpm, bars: barCount } = tempoAndBars(preset, options, rng);
  const barS = (60 / bpm) * BEATS_PER_BAR;
  const structure = options.structure ?? defaultStructure(barCount);
  const intensity = Math.min(1, Math.max(0, options.energy ?? 0.6));
  const base = pick(rng, preset.progressions);
  const builder = new ScoreBuilder(preset, key, barS, rng);
  const bars: BarInfo[] = [];
  let mains = 0;
  structure.forEach((section, sectionIndex) => {
    const kind = section.kind === 'main' && mains++ > 0 ? 'mainB' : section.kind;
    // An explicit section energy is used as given; mood defaults scale with the overall energy.
    const energy =
      section.energy ??
      Math.min(1, Math.max(0, preset.sectionEnergy[kind] * (0.6 + 0.8 * intensity) - 0.12));
    const progression = kind === 'mainB' || kind === 'break' ? variantOf(base, rng) : [...base];
    const shape = pick(rng, ARP_SHAPES);
    const bassLine = pick(rng, BASS_LINES);
    const nextKind = structure[sectionIndex + 1]?.kind;
    for (let barInSection = 0; barInSection < section.bars; barInSection++) {
      const chordIndex = Math.floor(barInSection / preset.barsPerChord) % progression.length;
      const chord =
        kind === 'intro' || kind === 'outro'
          ? (base[0] ?? progression[0])
          : progression[chordIndex];
      if (chord === undefined) continue;
      const bar: BarInfo = {
        index: bars.length,
        section: section.kind,
        energy,
        chord,
        rootPitchClass: chordRootPitchClass(key, chord),
        pitchClasses: chordPitchClasses(key, chord),
      };
      bars.push(bar);
      const chordStart = barInSection % preset.barsPerChord === 0;
      if (chordStart) {
        builder.pad(bar, Math.min(preset.barsPerChord, section.bars - barInSection));
      }
      builder.keys(bar);
      builder.arp(bar, shape);
      builder.bass(bar, bassLine, barInSection % preset.barsPerChord);
      const lastBar = barInSection === section.bars - 1;
      builder.drums(bar, lastBar && nextKind === 'main' && energy >= 0.45);
    }
  });
  const notes = [...builder.notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  return { mood: options.mood, bpm, key, barS, durationS: bars.length * barS, bars, notes };
}

/** Pitch classes allowed in the score's key (for checks). */
export function scoreScale(score: Score): number[] {
  return Array.from({ length: 7 }, (_, degree) => degreeToMidi(score.key, degree, 0) % 12);
}
