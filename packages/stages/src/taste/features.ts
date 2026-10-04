/**
 * Taste features (PLAN.md#12.13): what a decision about a shot says about the user's taste, as
 * `feature:value` pairs — from the storyboard entry (look, roll, treatment, tempo = shot length,
 * planned mark density) and from a scan of the scene source (kit environments/effects used,
 * background swatch, accent swatches, camera moves, `ctx.annotate` density). Pure.
 */
import {
  shotLook,
  type StoryboardShot,
  type TasteFeature,
  type TasteFeatureValue,
} from '@reelforge/shared';

/** Shots shorter than this are `fast`, longer than `TEMPO_SLOW_S` are `slow`. */
export const TEMPO_FAST_S = 3.5;
export const TEMPO_SLOW_S = 6.5;
/** More than one mark per this many seconds is `dense`. */
export const DENSE_MARK_EVERY_S = 4;
/** At most this many template / accent values per scene (the most used ones). */
const MAX_TEMPLATES = 6;
const MAX_ACCENTS = 3;

/** Moves of `ctx.camera` that are a creative choice (not `set`/`lookAt`/`object`). */
export const CAMERA_MOVES = [
  'orbit',
  'pushIn',
  'crane',
  'dolly',
  'shake',
  'rackFocus',
  'dollyZoom',
  'parallax',
] as const;

/** Kit definitions that are plumbing, not taste. */
const PLUMBING_KIT_NAMES = new Set(['lights']);
/** Palette roles that are not an accent choice (lights, ground, sky, shadow). */
const NEUTRAL_SWATCH = /light|shadow|ground|sky|black|white/i;

export type Tempo = 'fast' | 'medium' | 'slow';
export type MarkDensity = 'none' | 'light' | 'dense';

export function tempoOf(seconds: number): Tempo {
  if (seconds < TEMPO_FAST_S) return 'fast';
  return seconds > TEMPO_SLOW_S ? 'slow' : 'medium';
}

export function densityOf(marks: number, seconds: number): MarkDensity {
  if (marks === 0) return 'none';
  return marks / Math.max(seconds, 0.1) > 1 / DENSE_MARK_EVERY_S ? 'dense' : 'light';
}

export function featureKey(entry: TasteFeatureValue): string {
  return `${entry.feature}:${entry.value}`;
}

const value = (feature: TasteFeature, text: string): TasteFeatureValue => ({
  feature,
  value: text.slice(0, 64),
});

/** Each pair once, in first-seen order. */
export function uniqueFeatures(entries: readonly TasteFeatureValue[]): TasteFeatureValue[] {
  const seen = new Map<string, TasteFeatureValue>();
  for (const entry of entries) if (!seen.has(featureKey(entry))) seen.set(featureKey(entry), entry);
  return [...seen.values()];
}

/** What the storyboard entry says: look, roll, treatment, tempo and the planned mark density. */
export function shotTasteFeatures(shot: StoryboardShot): TasteFeatureValue[] {
  const seconds = shot.t1 - shot.t0;
  return [
    value('look', shotLook(shot)),
    ...(shot.roll === undefined ? [] : [value('roll', shot.roll)]),
    value('treatment', shot.treatment),
    value('tempo', tempoOf(seconds)),
    ...(shot.annotations === undefined
      ? []
      : [value('density', densityOf(shot.annotations.length, seconds))]),
  ];
}

/** Names by how often they occur (most first, then alphabetical). */
function byUse(names: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || (first[0] < second[0] ? -1 : 1))
    .map(([name]) => name);
}

/** What the scene source says (a regex scan; comments count like code). */
export function sceneTasteFeatures(source: string, seconds: number): TasteFeatureValue[] {
  const templates = byUse(
    [...source.matchAll(/\bkit\.(?:env|fx)\.([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name !== '' && !PLUMBING_KIT_NAMES.has(name)),
  ).slice(0, MAX_TEMPLATES);
  const background =
    /\bbackground\s*=\s*new\s+[\w.]*Color\(\s*(?:ctx\.)?palette\.([A-Za-z][A-Za-z0-9]*)/.exec(
      source,
    )?.[1];
  const accents = byUse(
    [...source.matchAll(/\bpalette\.([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name !== '' && name !== background && !NEUTRAL_SWATCH.test(name)),
  ).slice(0, MAX_ACCENTS);
  const moves = new Set(
    [...source.matchAll(/\bcamera\.([A-Za-z]+)\s*\(/g)].map((match) => match[1] ?? ''),
  );
  const marks = [...source.matchAll(/\bannotate\.[A-Za-z]+\s*\(/g)].length;
  return [
    ...templates.map((name) => value('template', name)),
    ...(background === undefined ? [] : [value('background', background)]),
    ...accents.map((name) => value('accent', name)),
    ...CAMERA_MOVES.filter((move) => moves.has(move)).map((move) => value('camera', move)),
    value('density', densityOf(marks, seconds)),
  ];
}

/**
 * Everything a decision about the shot endorses or turns down: the storyboard entry plus, when
 * the scene source is known, its scan (whose mark density wins over the planned one).
 */
export function shotDecisionFeatures(shot: StoryboardShot, source?: string): TasteFeatureValue[] {
  const fromShot = shotTasteFeatures(shot);
  if (source === undefined) return fromShot;
  const fromScene = sceneTasteFeatures(source, shot.t1 - shot.t0);
  return uniqueFeatures([...fromShot.filter((entry) => entry.feature !== 'density'), ...fromScene]);
}

export function directionFeature(directionId: string): TasteFeatureValue {
  return value('direction', directionId);
}
