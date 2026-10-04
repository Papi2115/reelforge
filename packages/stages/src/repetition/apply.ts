/**
 * Applying a repetition item's changes (PLAN.md#12.23, pure, on the raw JSON so fields the
 * schemas do not know survive): SFX swaps rewrite `cues.json` sfx entries (recipe + the gain of
 * the new category), transition swaps rewrite `storyboard.json` transitions (type / style /
 * duration from the transition kit). An entry that no longer shows the repeated value (edited
 * meanwhile), or belongs to a locked shot, is left alone.
 */
import { SFX_RECIPES, type SfxRecipe } from '@reelforge/pipeline';
import { getTransitionStyle, type RepetitionChange, type StoryboardShot } from '@reelforge/shared';
import { cueKey } from './analyse.js';
import { swappedGainDb } from './proposals.js';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isSfxRecipe = (name: string): name is SfxRecipe =>
  (SFX_RECIPES as readonly string[]).includes(name);

export interface Applied {
  readonly json: unknown;
  /** Changes that were made. */
  readonly applied: number;
}

function shotAt(shots: readonly StoryboardShot[], t: number): StoryboardShot | undefined {
  return shots.find((shot) => t >= shot.t0 && t < shot.t1) ?? shots.at(-1);
}

/** Swaps the recipes of the targeted sfx cues in raw cues.json. */
export function applySfxChanges(
  raw: unknown,
  changes: readonly RepetitionChange[],
  shots: readonly StoryboardShot[],
  locked: ReadonlySet<string>,
): Applied {
  if (!isObject(raw) || !Array.isArray(raw['sfx'])) return { json: raw, applied: 0 };
  const byTarget = new Map(changes.map((change) => [change.target, change]));
  let applied = 0;
  const sfx = raw['sfx'].map((entry: unknown) => {
    if (!isObject(entry) || typeof entry['t'] !== 'number') return entry;
    const name = typeof entry['name'] === 'string' ? entry['name'] : undefined;
    const id = typeof entry['id'] === 'string' ? entry['id'] : undefined;
    const change = byTarget.get(cueKey({ id, t: entry['t'], name }));
    if (change === undefined || change.from !== name) return entry;
    if (!isSfxRecipe(change.from) || !isSfxRecipe(change.to)) return entry;
    const shot = shotAt(shots, entry['t']);
    if (shot !== undefined && locked.has(shot.id)) return entry;
    applied += 1;
    const gainDb = typeof entry['gainDb'] === 'number' ? entry['gainDb'] : 0;
    return { ...entry, name: change.to, gainDb: swappedGainDb(gainDb, change.from, change.to) };
  });
  return { json: { ...raw, sfx }, applied };
}

const PLAIN_TYPES = new Set(['crossfade', 'wipe', 'glitch']);

/** The transition a change asks for, keeping the duration when the new style allows it. */
function transitionFor(current: JsonObject, to: string): JsonObject | undefined {
  const duration = typeof current['duration'] === 'number' ? current['duration'] : undefined;
  if (PLAIN_TYPES.has(to)) {
    return duration === undefined ? undefined : { type: to, duration };
  }
  const style = getTransitionStyle(to);
  if (style === undefined) return undefined;
  const keeps =
    duration !== undefined && duration >= style.duration.min && duration <= style.duration.max;
  return { type: style.type, duration: keeps ? duration : style.duration.default, style: style.id };
}

/** Re-styles the targeted transitions in raw storyboard.json. */
export function applyTransitionChanges(
  raw: unknown,
  changes: readonly RepetitionChange[],
  locked: ReadonlySet<string>,
): Applied {
  if (!isObject(raw) || !Array.isArray(raw['shots'])) return { json: raw, applied: 0 };
  const byTarget = new Map(changes.map((change) => [change.target, change]));
  let applied = 0;
  const shots = raw['shots'].map((entry: unknown) => {
    if (!isObject(entry) || typeof entry['id'] !== 'string') return entry;
    const change = byTarget.get(entry['id']);
    const current = entry['transitionIn'];
    if (change === undefined || locked.has(entry['id']) || !isObject(current)) return entry;
    const shown = typeof current['style'] === 'string' ? current['style'] : current['type'];
    if (shown !== change.from) return entry;
    const next = transitionFor(current, change.to);
    if (next === undefined) return entry;
    applied += 1;
    return { ...entry, transitionIn: next };
  });
  return { json: { ...raw, shots }, applied };
}
