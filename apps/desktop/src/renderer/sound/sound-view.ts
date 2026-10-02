/**
 * View model of the Sound panel (PLAN.md#8.2): level rows and their ranges, dB / loudness
 * formatting with the −14 LUFS ±1 / ≤ −1 dBTP checks, the cue summary and mix QA marks, the library grouped per kind, and the
 * drag payload of a library sound (validated on drop). Pure.
 */
import {
  librarySoundSchema,
  MIX_GAIN_KEYS,
  type CueSummary,
  type Ducking,
  type LibrarySound,
  type MixGainKey,
  type MixGains,
  type MixQaCheckView,
  type MixResult,
  type SoundKind,
  type SoundMixPatch,
} from '../../shared/sound-contract.js';
import { soundLabel } from '../../shared/sound-library.js';

export const GAIN_RANGE = { min: -24, max: 12, step: 0.5 } as const;

export const GAIN_ROWS: readonly { readonly key: MixGainKey; readonly label: string }[] = [
  { key: 'voGainDb', label: 'Voice-over' },
  { key: 'sfxGainDb', label: 'Sound effects' },
  { key: 'ambienceGainDb', label: 'Ambience' },
  { key: 'musicGainDb', label: 'Music' },
];

export const KIND_LABELS: Readonly<Record<SoundKind, string>> = {
  sfx: 'SFX',
  ambience: 'Ambience',
  music: 'Music',
};

const MINUS = '−';

/** `+3.0 dB`, `0.0 dB`, `−6.5 dB` (typographic minus). */
export function formatDb(value: number, unit = 'dB'): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? MINUS : '';
  return `${sign}${Math.abs(rounded).toFixed(1)} ${unit}`;
}

function plain(value: number): string {
  return `${value < 0 ? MINUS : ''}${String(Math.abs(value))}`;
}

export interface LoudnessReadout {
  readonly lufs: string;
  readonly lufsOk: boolean;
  readonly lufsTarget: string;
  readonly peak: string;
  readonly peakOk: boolean;
  readonly peakTarget: string;
}

export function loudnessReadout(result: MixResult): LoudnessReadout {
  return {
    lufs: formatDb(result.integratedLufs, 'LUFS').replace(/^\+/, ''),
    lufsOk: Math.abs(result.integratedLufs - result.targetLufs) <= result.toleranceLu,
    lufsTarget: `target ${plain(result.targetLufs)} ±${String(result.toleranceLu)}`,
    peak: formatDb(result.truePeakDbtp, 'dBTP').replace(/^\+/, ''),
    peakOk: result.truePeakDbtp <= result.truePeakMaxDbtp,
    peakTarget: `≤ ${plain(result.truePeakMaxDbtp)}`,
  };
}

const plural = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

/** `14 SFX · 1 ambience bed · 1 music bed (bright-explainer)`. */
export function cueSummaryText(summary: CueSummary): string {
  const moods = summary.moods.length > 0 ? ` (${summary.moods.join(', ')})` : '';
  return [
    `${String(summary.sfx)} SFX`,
    plural(summary.ambience, 'ambience bed', 'ambience beds'),
    `${plural(summary.music, 'music bed', 'music beds')}${moods}`,
  ].join(' · ');
}

/** The most used built-in sounds, e.g. `tick ×9, pop ×3, glitch ×2`. */
export function topSoundsText(summary: CueSummary, limit = 6): string {
  const shown = summary.sounds
    .slice(0, limit)
    .map((sound) => `${sound.name} ×${String(sound.count)}`);
  const more = summary.sounds.length - shown.length;
  return more > 0 ? `${shown.join(', ')} +${String(more)} more` : shown.join(', ');
}

export const QA_MARKS: Readonly<
  Record<MixQaCheckView['status'], { readonly mark: string; readonly className: string }>
> = {
  pass: { mark: '✓', className: 'qa-ok' },
  warn: { mark: '⚠', className: 'qa-warning' },
  fail: { mark: '✗', className: 'qa-failed' },
  skip: { mark: '–', className: 'muted' },
};

/** The library per kind, in main's order (built-ins first). */
export function libraryByKind(
  library: readonly LibrarySound[],
): Readonly<Record<SoundKind, readonly LibrarySound[]>> {
  const groups: Record<SoundKind, LibrarySound[]> = { sfx: [], ambience: [], music: [] };
  for (const sound of library) groups[sound.kind].push(sound);
  return groups;
}

export function soundKey(sound: LibrarySound): string {
  return sound.source === 'builtin' ? `builtin:${sound.kind}:${sound.name}` : `file:${sound.file}`;
}

export function soundTitle(sound: LibrarySound): string {
  return sound.source === 'builtin' ? `${soundLabel(sound)} (built-in)` : soundLabel(sound);
}

/** dataTransfer type of a dragged library sound. */
export const SOUND_DRAG_TYPE = 'application/x-reelforge-sound';

export function encodeSoundDrag(sound: LibrarySound): string {
  return JSON.stringify(sound);
}

/** The dropped sound, or null for anything that is not a valid library sound. */
export function decodeSoundDrag(text: string): LibrarySound | null {
  try {
    const parsed = librarySoundSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // not JSON: not ours
  }
}

/** The patch of one level slider. */
export function gainPatch(key: MixGainKey, value: number): SoundMixPatch {
  const gains: Partial<MixGains> = {};
  gains[key] = value;
  return { gains };
}

export type DuckingNumberField = 'thresholdDb' | 'ratio' | 'attackMs' | 'releaseMs';

/** The ducking with one Advanced field changed (and ducking switched on). */
export function withDuckingField(
  ducking: Ducking,
  field: DuckingNumberField,
  value: number,
): Ducking {
  const next: Ducking = { ...ducking, enabled: true };
  next[field] = value;
  return next;
}

/** `gains` with the slider values of a patch applied. */
export function mergeGains(gains: MixGains, patch: SoundMixPatch['gains']): MixGains {
  const next: MixGains = { ...gains };
  for (const key of MIX_GAIN_KEYS) {
    const value = patch?.[key];
    if (value !== undefined) next[key] = value;
  }
  return next;
}
