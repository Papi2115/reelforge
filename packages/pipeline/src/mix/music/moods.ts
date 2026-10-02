/**
 * Mood presets of the generative music engine. A preset picks tempo/key ranges, a library of
 * diatonic progressions, which instruments play (and from which energy level they enter), their
 * 16-step rhythm patterns, swing and the room. Everything here is data; score.ts interprets it.
 */
import type { ChordColor, ChordSpec, ScaleMode } from './theory.js';

export const MUSIC_MOODS = [
  'calm-tech',
  'lofi-chill',
  'tense-investigation',
  'bright-explainer',
  'retro-wave',
] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export const SECTION_KINDS = ['intro', 'main', 'break', 'outro'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** One 16-step bar: probability and velocity per step. */
export interface Step {
  readonly chance: number;
  readonly velocity: number;
}
export type Pattern = readonly Step[];

const STEP_CODES: Readonly<Record<string, Step>> = {
  X: { chance: 1, velocity: 1 },
  x: { chance: 1, velocity: 0.75 },
  o: { chance: 0.6, velocity: 0.6 },
  '-': { chance: 0.3, velocity: 0.4 },
  '.': { chance: 0, velocity: 0 },
};

const REST: Step = { chance: 0, velocity: 0 };

/** `X` accent, `x` hit, `o` likely, `-` ghost (rare, soft), `.` rest; 16 characters. */
export function pattern(code: string): Pattern {
  if (code.length !== 16) throw new Error(`pattern must have 16 steps: ${code}`);
  return Array.from({ length: 16 }, (_, index) => STEP_CODES[code.charAt(index)] ?? REST);
}

const chords = (...specs: readonly (readonly [number, ChordColor])[]): ChordSpec[] =>
  specs.map(([degree, color]) => ({ degree, color }));

export type DrumVoice = 'kick' | 'snare' | 'clap' | 'hat' | 'openHat' | 'shaker' | 'rim';
export type DrumKit = 'soft' | 'lofi' | 'electro' | 'retro';

export interface PadPart {
  readonly level: number;
  /** Low-pass cutoff at energy 0 and 1 (Hz). */
  readonly cutoff: readonly [number, number];
  readonly detuneCents: number;
  readonly attackS: number;
  readonly releaseS: number;
  readonly voices: number;
  readonly register: readonly [number, number];
}

export interface PitchedPart {
  readonly level: number;
  readonly minEnergy: number;
  readonly register: readonly [number, number];
}

export interface KeysPart extends PitchedPart {
  readonly rhythm: Pattern;
  /** Wow/flutter depth in cents (lo-fi tape feel). */
  readonly wowCents: number;
}

export interface ArpPart extends PitchedPart {
  readonly sound: 'pluck' | 'synth';
  /** 8 = eighth notes, 16 = sixteenths. */
  readonly rate: 8 | 16;
  /** Note lengths as a share of the step (staccato < 1). */
  readonly gate: number;
  /** Probability that a step plays at full energy. */
  readonly density: number;
  /** 0 = soft/dark, 1 = bright. */
  readonly brightness: number;
}

export interface BassPart extends PitchedPart {
  readonly style: 'sub' | 'warm' | 'pulse';
  readonly rhythm: Pattern;
  /** Alternate octaves on off-steps (synthwave bass). */
  readonly octaveJump: boolean;
}

export interface DrumPart {
  readonly level: number;
  readonly minEnergy: number;
  readonly kit: DrumKit;
  readonly patterns: Partial<Readonly<Record<DrumVoice, Pattern>>>;
  /** Gated-reverb snare (80s). */
  readonly gatedSnare: boolean;
}

export interface MoodPreset {
  readonly bpm: readonly [number, number];
  readonly modes: readonly ScaleMode[];
  readonly tonics: readonly number[];
  readonly progressions: readonly (readonly ChordSpec[])[];
  readonly barsPerChord: 1 | 2;
  /** Delay of odd sixteenths as a share of a sixteenth (0 = straight). */
  readonly swing: number;
  readonly sectionEnergy: Readonly<Record<SectionKind | 'mainB', number>>;
  readonly pad: PadPart | null;
  readonly keys: KeysPart | null;
  readonly arp: ArpPart | null;
  readonly bass: BassPart | null;
  readonly drums: DrumPart | null;
  /** Quiet tape-like hiss level (linear, 0 = none). */
  readonly hiss: number;
  readonly reverb: { readonly decayS: number; readonly wet: number };
}

const STANDARD_ENERGY = { intro: 0.35, main: 0.7, break: 0.45, mainB: 0.9, outro: 0.3 };

export const MOOD_PRESETS: Readonly<Record<MusicMood, MoodPreset>> = {
  'calm-tech': {
    bpm: [84, 96],
    modes: ['lydian', 'major'],
    tonics: [2, 4, 5, 7, 9],
    progressions: [
      chords([0, 'add9'], [4, 'sus4'], [5, 'seventh'], [3, 'add9']),
      chords([5, 'seventh'], [3, 'add9'], [0, 'add9'], [4, 'sus2']),
      chords([0, 'add9'], [2, 'seventh'], [3, 'add9'], [3, 'sus2']),
      chords([3, 'add9'], [4, 'triad'], [2, 'seventh'], [5, 'seventh']),
    ],
    barsPerChord: 2,
    swing: 0,
    sectionEnergy: STANDARD_ENERGY,
    pad: {
      level: 0.5,
      cutoff: [1100, 3200],
      detuneCents: 9,
      attackS: 1.4,
      releaseS: 1.8,
      voices: 4,
      register: [55, 76],
    },
    keys: null,
    arp: {
      level: 0.45,
      minEnergy: 0.4,
      register: [62, 86],
      sound: 'pluck',
      rate: 8,
      gate: 1,
      density: 0.85,
      brightness: 0.6,
    },
    bass: {
      level: 0.3,
      minEnergy: 0.3,
      register: [40, 55],
      style: 'sub',
      rhythm: pattern('x.......x.....-.'),
      octaveJump: false,
    },
    drums: {
      level: 0.5,
      minEnergy: 0.55,
      kit: 'soft',
      patterns: {
        kick: pattern('x.......x.-.....'),
        rim: pattern('....o.......x...'),
        hat: pattern('-.x.-.x.-.x.-.x.'),
        shaker: pattern('..-...-...-...-.'),
      },
      gatedSnare: false,
    },
    hiss: 0,
    reverb: { decayS: 2.2, wet: 0.3 },
  },
  'lofi-chill': {
    bpm: [70, 84],
    modes: ['major', 'dorian'],
    tonics: [0, 2, 3, 5, 7, 10],
    progressions: [
      chords([1, 'seventh'], [4, 'seventh'], [0, 'seventh'], [5, 'seventh']),
      chords([0, 'seventh'], [5, 'seventh'], [1, 'seventh'], [4, 'ninth']),
      chords([3, 'seventh'], [2, 'seventh'], [1, 'seventh'], [0, 'ninth']),
      chords([0, 'ninth'], [3, 'seventh'], [0, 'seventh'], [3, 'ninth']),
    ],
    barsPerChord: 1,
    swing: 0.32,
    sectionEnergy: STANDARD_ENERGY,
    pad: {
      level: 0.18,
      cutoff: [600, 1200],
      detuneCents: 6,
      attackS: 1.2,
      releaseS: 1.5,
      voices: 3,
      register: [52, 72],
    },
    keys: {
      level: 0.7,
      minEnergy: 0.2,
      register: [53, 74],
      rhythm: pattern('x.....o...-.....'),
      wowCents: 6,
    },
    arp: null,
    bass: {
      level: 0.3,
      minEnergy: 0.3,
      register: [40, 55],
      style: 'warm',
      rhythm: pattern('x.....o...x..-..'),
      octaveJump: false,
    },
    drums: {
      level: 0.6,
      minEnergy: 0.45,
      kit: 'lofi',
      patterns: {
        kick: pattern('x......o..x.....'),
        snare: pattern('....x.......x...'),
        hat: pattern('x.o.x.o.x.o.x.o.'),
      },
      gatedSnare: false,
    },
    hiss: 0.0035,
    reverb: { decayS: 1.6, wet: 0.22 },
  },
  'tense-investigation': {
    bpm: [70, 84],
    modes: ['phrygian', 'minor'],
    tonics: [1, 2, 4, 9],
    progressions: [
      chords([0, 'sus2'], [1, 'triad'], [0, 'sus2'], [6, 'sus4']),
      chords([0, 'sus2'], [5, 'add9'], [3, 'sus2'], [4, 'sus4']),
      chords([0, 'sus4'], [0, 'sus2'], [5, 'triad'], [1, 'sus2']),
    ],
    barsPerChord: 2,
    swing: 0,
    sectionEnergy: { intro: 0.25, main: 0.5, break: 0.35, mainB: 0.8, outro: 0.3 },
    pad: {
      level: 0.55,
      cutoff: [500, 1800],
      detuneCents: 12,
      attackS: 2,
      releaseS: 2.5,
      voices: 3,
      register: [55, 74],
    },
    keys: null,
    arp: {
      level: 0.35,
      minEnergy: 0.45,
      register: [67, 88],
      sound: 'pluck',
      rate: 8,
      gate: 1,
      density: 0.22,
      brightness: 0.45,
    },
    bass: {
      level: 0.26,
      minEnergy: 0.3,
      register: [40, 55],
      style: 'pulse',
      rhythm: pattern('x.......-...o...'),
      octaveJump: false,
    },
    drums: {
      level: 0.5,
      minEnergy: 0.4,
      kit: 'soft',
      patterns: {
        kick: pattern('x..o............'),
        shaker: pattern('....-.......-...'),
        rim: pattern('............-...'),
      },
      gatedSnare: false,
    },
    hiss: 0,
    reverb: { decayS: 2.6, wet: 0.32 },
  },
  'bright-explainer': {
    bpm: [100, 116],
    modes: ['major'],
    tonics: [0, 2, 5, 7, 9],
    progressions: [
      chords([0, 'triad'], [4, 'triad'], [5, 'triad'], [3, 'add9']),
      chords([0, 'add9'], [3, 'triad'], [5, 'seventh'], [4, 'triad']),
      chords([3, 'add9'], [0, 'triad'], [4, 'sus4'], [5, 'triad']),
    ],
    barsPerChord: 1,
    swing: 0.08,
    sectionEnergy: STANDARD_ENERGY,
    pad: {
      level: 0.22,
      cutoff: [1800, 4000],
      detuneCents: 7,
      attackS: 0.6,
      releaseS: 1,
      voices: 3,
      register: [60, 79],
    },
    keys: null,
    arp: {
      level: 0.5,
      minEnergy: 0.3,
      register: [64, 88],
      sound: 'pluck',
      rate: 8,
      gate: 0.45,
      density: 0.9,
      brightness: 0.8,
    },
    bass: {
      level: 0.24,
      minEnergy: 0.35,
      register: [40, 55],
      style: 'warm',
      rhythm: pattern('x.o.x.o.x.o.x.o.'),
      octaveJump: false,
    },
    drums: {
      level: 0.55,
      minEnergy: 0.45,
      kit: 'electro',
      patterns: {
        kick: pattern('x.....-.x.......'),
        clap: pattern('....x.......x...'),
        hat: pattern('-.x.-.x.-.x.-.x.'),
      },
      gatedSnare: false,
    },
    hiss: 0,
    reverb: { decayS: 1.4, wet: 0.2 },
  },
  'retro-wave': {
    bpm: [84, 100],
    modes: ['minor', 'dorian'],
    tonics: [2, 4, 6, 9],
    progressions: [
      chords([0, 'triad'], [5, 'triad'], [2, 'triad'], [6, 'triad']),
      chords([0, 'triad'], [6, 'triad'], [5, 'triad'], [6, 'sus4']),
      chords([5, 'add9'], [6, 'triad'], [0, 'triad'], [0, 'sus2']),
      chords([0, 'triad'], [3, 'triad'], [5, 'add9'], [6, 'triad']),
    ],
    barsPerChord: 1,
    swing: 0,
    sectionEnergy: STANDARD_ENERGY,
    pad: {
      level: 0.42,
      cutoff: [1400, 3600],
      detuneCents: 14,
      attackS: 0.9,
      releaseS: 1.4,
      voices: 4,
      register: [55, 76],
    },
    keys: null,
    arp: {
      level: 0.33,
      minEnergy: 0.5,
      register: [60, 84],
      sound: 'synth',
      rate: 16,
      gate: 0.6,
      density: 1,
      brightness: 0.5,
    },
    bass: {
      level: 0.28,
      minEnergy: 0.3,
      register: [40, 55],
      style: 'pulse',
      rhythm: pattern('x.x.x.x.x.x.x.x.'),
      octaveJump: true,
    },
    drums: {
      level: 0.55,
      minEnergy: 0.5,
      kit: 'retro',
      patterns: {
        kick: pattern('x...x...x...x...'),
        snare: pattern('....x.......x...'),
        hat: pattern('..x...x...x...x.'),
        openHat: pattern('..............-.'),
      },
      gatedSnare: true,
    },
    hiss: 0,
    reverb: { decayS: 2.2, wet: 0.28 },
  },
};
