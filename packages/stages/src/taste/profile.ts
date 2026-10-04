/**
 * The taste profile (PLAN.md#12.13, ADR-022): signals update decaying counters per feature value;
 * preferences are the values with enough evidence and a clear lean; `tasteProfileText` condenses
 * them into ≤ 120 words for the storyboard and scene-build prompts. Pure and deterministic: the
 * same file and the same `now` give the same text.
 */
import {
  MAX_TASTE_COUNTERS,
  TASTE_PROFILE_VERSION,
  type TasteCounter,
  type TasteFeature,
  type TasteProfileFile,
  type TasteSignal,
} from '@reelforge/shared';
import { directionById } from '../variants/directions.js';
import { featureKey } from './features.js';

/** Evidence halves every 60 days: old decisions fade, the profile follows changing taste. */
export const TASTE_HALF_LIFE_DAYS = 60;
/** A value needs this much (decayed) evidence before it can become a preference. */
export const MIN_PREFERENCE_EVIDENCE = 2;
/** …and a lean of at least this much (−1 dislike … +1 like). */
export const MIN_PREFERENCE_STRENGTH = 0.34;
/** No profile at all before this many decisions were recorded. */
export const MIN_PROFILE_SIGNALS = 3;
export const MAX_PROFILE_WORDS = 120;
/** Likes / dislikes named in the text, strongest first. */
const MAX_PROFILE_ITEMS = 5;
/** Counters below this evidence are forgotten. */
const FORGET_BELOW = 0.01;
const DAY_MS = 86_400_000;

export interface TastePreference {
  readonly feature: TasteFeature;
  readonly value: string;
  /** How the profile names it ("orbit camera moves"). */
  readonly label: string;
  /** −1 (always turned down) … +1 (always chosen). */
  readonly strength: number;
  /** Decayed evidence behind it. */
  readonly evidence: number;
}

const round = (value: number): number => Math.round(value * 10_000) / 10_000;

function decayFactor(updatedAt: string | null, now: Date): number {
  if (updatedAt === null) return 1;
  const days = Math.max(0, now.getTime() - Date.parse(updatedAt)) / DAY_MS;
  return 0.5 ** (days / TASTE_HALF_LIFE_DAYS);
}

/** The counters decayed to `now`. */
export function decayedTasteProfile(file: TasteProfileFile, now: Date): TasteProfileFile {
  const factor = decayFactor(file.updatedAt, now);
  const counters = file.counters
    .map((counter) => ({
      ...counter,
      positive: round(counter.positive * factor),
      negative: round(counter.negative * factor),
    }))
    .filter((counter) => counter.positive + counter.negative >= FORGET_BELOW);
  return { ...file, counters, updatedAt: file.updatedAt === null ? null : now.toISOString() };
}

function sortCounters(counters: Iterable<TasteCounter>): TasteCounter[] {
  return [...counters].sort((first, second) =>
    featureKey(first) < featureKey(second) ? -1 : featureKey(first) > featureKey(second) ? 1 : 0,
  );
}

/** Adds decisions (after decaying the old evidence to `now`). */
export function applyTasteSignals(
  file: TasteProfileFile,
  signals: readonly TasteSignal[],
  now: Date,
): TasteProfileFile {
  const decayed = decayedTasteProfile(file, now);
  const counters = new Map(decayed.counters.map((counter) => [featureKey(counter), counter]));
  const counts = { ...decayed.signals };
  const add = (signal: TasteSignal, side: 'positive' | 'negative'): void => {
    const weight = signal.weight ?? 1;
    const endorsed = new Set(signal.positive.map(featureKey));
    for (const entry of signal[side]) {
      // A value on both sides of one decision says nothing about it.
      if (side === 'negative' && endorsed.has(featureKey(entry))) continue;
      const current = counters.get(featureKey(entry)) ?? { ...entry, positive: 0, negative: 0 };
      counters.set(featureKey(entry), { ...current, [side]: round(current[side] + weight) });
    }
  };
  for (const signal of signals) {
    add(signal, 'positive');
    add(signal, 'negative');
    counts[signal.kind] += 1;
  }
  const kept = [...counters.values()]
    .sort((first, second) => second.positive + second.negative - (first.positive + first.negative))
    .slice(0, MAX_TASTE_COUNTERS);
  return {
    version: TASTE_PROFILE_VERSION,
    updatedAt: now.toISOString(),
    counters: sortCounters(kept),
    signals: counts,
  };
}

const TEMPO_LABELS: Readonly<Record<string, string>> = {
  fast: 'fast cuts (short shots)',
  medium: 'medium-length shots',
  slow: 'slower cuts (longer shots)',
};
const DENSITY_LABELS: Readonly<Record<string, string>> = {
  none: 'shots without on-screen marks',
  light: 'a few on-screen marks',
  dense: 'dense on-screen marks',
};

/** How the profile names a feature value. */
export function tasteLabel(feature: TasteFeature, value: string): string {
  switch (feature) {
    case 'look':
      return `the ${value} look`;
    case 'roll':
      return `${value}-roll shots`;
    case 'treatment':
      return `${value} shots`;
    case 'template':
      return `kit ${value}`;
    case 'background':
      return `${value} backgrounds`;
    case 'accent':
      return `${value} accents`;
    case 'tempo':
      return TEMPO_LABELS[value] ?? `${value} tempo`;
    case 'density':
      return DENSITY_LABELS[value] ?? `${value} mark density`;
    case 'camera':
      return `${value} camera moves`;
    case 'direction':
      return `"${(directionById(value)?.label ?? value).toLowerCase()}" compositions`;
  }
}

/** Decisions recorded so far (all kinds). */
export function tasteSignalCount(file: TasteProfileFile): number {
  return Object.values(file.signals).reduce((sum, count) => sum + count, 0);
}

/** Values with enough evidence and a clear lean, strongest first. */
export function tastePreferences(file: TasteProfileFile, now: Date): TastePreference[] {
  return decayedTasteProfile(file, now)
    .counters.map((counter) => {
      const evidence = counter.positive + counter.negative;
      return {
        feature: counter.feature,
        value: counter.value,
        label: tasteLabel(counter.feature, counter.value),
        strength: round((counter.positive - counter.negative) / (evidence + 1)),
        evidence: round(evidence),
      };
    })
    .filter(
      (entry) =>
        entry.evidence >= MIN_PREFERENCE_EVIDENCE &&
        Math.abs(entry.strength) >= MIN_PREFERENCE_STRENGTH,
    )
    .sort(
      (first, second) =>
        Math.abs(second.strength) - Math.abs(first.strength) ||
        second.evidence - first.evidence ||
        (featureKey(first) < featureKey(second) ? -1 : 1),
    );
}

function limitWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  if (words.length <= max) return text;
  return `${words.slice(0, max).join(' ').replace(/[,;]$/, '')}.`;
}

/**
 * The condensed profile (≤ 120 words), or undefined while there is too little evidence (then the
 * prompts stay byte for byte as without taste learning).
 */
export function tasteProfileText(file: TasteProfileFile, now: Date): string | undefined {
  if (tasteSignalCount(file) < MIN_PROFILE_SIGNALS) return undefined;
  const preferences = tastePreferences(file, now);
  const likes = preferences.filter((entry) => entry.strength > 0).slice(0, MAX_PROFILE_ITEMS);
  const dislikes = preferences.filter((entry) => entry.strength < 0).slice(0, MAX_PROFILE_ITEMS);
  if (likes.length === 0 && dislikes.length === 0) return undefined;
  const sentences = [
    likes.length === 0 ? '' : `Prefers ${likes.map((entry) => entry.label).join(', ')}.`,
    dislikes.length === 0
      ? ''
      : `Usually turns down ${dislikes.map((entry) => entry.label).join(', ')}.`,
  ].filter((sentence) => sentence !== '');
  return limitWords(sentences.join(' '), MAX_PROFILE_WORDS);
}
