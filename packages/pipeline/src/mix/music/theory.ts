/**
 * Music theory for the generative score: modes, keys, diatonic chords (stacked scale thirds, sus
 * and add9 variants stay in the key by construction) and smooth voice leading (each new chord is
 * voiced as close as possible to the previous one, so pads move by small steps).
 */

export const SCALE_MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const;
export type ScaleMode = keyof typeof SCALE_MODES;

export const PITCH_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface MusicKey {
  /** Pitch class of the tonic (0 = C). */
  readonly tonic: number;
  readonly mode: ScaleMode;
}

export function keyName(key: MusicKey): string {
  return `${PITCH_NAMES[key.tonic] ?? '?'} ${key.mode}`;
}

/** Pitch classes of the key's scale. */
export function scalePitchClasses(key: MusicKey): number[] {
  return SCALE_MODES[key.mode].map((step) => (key.tonic + step) % 12);
}

/** MIDI note of scale `degree` (0-based, may exceed 6 or be negative) above tonic octave. */
export function degreeToMidi(key: MusicKey, degree: number, octave: number): number {
  const steps = SCALE_MODES[key.mode];
  const wrapped = ((degree % 7) + 7) % 7;
  const octaves = Math.floor(degree / 7);
  return 12 * (octave + 1 + octaves) + key.tonic + (steps[wrapped] ?? 0);
}

export type ChordColor = 'triad' | 'seventh' | 'add9' | 'sus2' | 'sus4' | 'ninth';

export interface ChordSpec {
  /** Scale degree of the root (0 = tonic). */
  readonly degree: number;
  readonly color: ChordColor;
}

/** Scale-degree offsets (from the root degree) that make up a chord colour. */
const COLOR_DEGREES: Readonly<Record<ChordColor, readonly number[]>> = {
  triad: [0, 2, 4],
  seventh: [0, 2, 4, 6],
  add9: [0, 2, 4, 8],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  ninth: [0, 2, 4, 6, 8],
};

/** Chord tones as pitch classes (root first); always inside the key. */
export function chordPitchClasses(key: MusicKey, chord: ChordSpec): number[] {
  return COLOR_DEGREES[chord.color].map(
    (offset) => degreeToMidi(key, chord.degree + offset, 0) % 12,
  );
}

export function chordRootPitchClass(key: MusicKey, chord: ChordSpec): number {
  return degreeToMidi(key, chord.degree, 0) % 12;
}

/** Every MIDI note in [low, high] whose pitch class is one of `pitchClasses`. */
function candidates(pitchClasses: readonly number[], low: number, high: number): number[] {
  const notes: number[] = [];
  for (let midi = low; midi <= high; midi++) {
    if (pitchClasses.includes(midi % 12)) notes.push(midi);
  }
  return notes;
}

/**
 * Voices `pitchClasses` as `count` notes inside [low, high], each pitch class used at least once
 * when possible, minimizing total movement from `previous` (or centred in the range).
 */
export function voiceLead(
  pitchClasses: readonly number[],
  previous: readonly number[] | null,
  low: number,
  high: number,
  count: number,
): number[] {
  const pool = candidates(pitchClasses, low, high);
  const centre = (low + high) / 2;
  const targets =
    previous !== null && previous.length > 0
      ? [...previous].sort((a, b) => a - b)
      : Array.from({ length: count }, (_, index) => low + ((index + 0.5) * (high - low)) / count);
  const chosen: number[] = [];
  const used = new Set<number>();
  for (let index = 0; index < count; index++) {
    const target = targets[Math.min(index, targets.length - 1)] ?? centre;
    const missing = pitchClasses.filter((pc) => !chosen.some((note) => note % 12 === pc));
    const allowed = pool.filter(
      (note) => !used.has(note) && (missing.length === 0 || missing.includes(note % 12)),
    );
    const options = allowed.length > 0 ? allowed : pool.filter((note) => !used.has(note));
    let best = options[0] ?? Math.round(centre);
    for (const note of options) {
      if (Math.abs(note - target) < Math.abs(best - target)) best = note;
    }
    chosen.push(best);
    used.add(best);
  }
  return chosen.sort((a, b) => a - b);
}
