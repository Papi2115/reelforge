/**
 * The sound director (pure, deterministic): applies the rule table to the candidate gestures,
 * keeps the important ones within the density budget (about one gesture per 3 s, at most
 * three per 4 s, nothing in the first 0.3 s of a shot except transitions, cues of different gestures
 * >= 150 ms apart) and picks recipe variants by a seed derived from shot id + event index, never
 * repeating the previous cue's variant unless a series is designed that way. Each cue is voiced by
 * its shot's sound palette (`palettes/`); without palettes every shot is `voxel` (the rule table).
 */
import { SFX_VARIANTS, hashSeed, type SfxRecipe } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import {
  CUE_RULES,
  DENSITY,
  HEAVY_VARIANTS,
  LIST_PITCH_ORDER,
  ruleGainDb,
  type CueEventKind,
} from './cue-rules.js';
import type { EventCue, Gesture } from './cue-events.js';
import {
  NO_HISTORY,
  VOXEL_PALETTE,
  lookChangeSlot,
  paletteSlots,
  pickRecipe,
  sceneRecipe,
  type PaletteSlot,
  type ShotPalettes,
  type SoundPalette,
} from './palettes/index.js';

export interface DirectedCue {
  /** Start time (s, rounded to ms). */
  readonly t: number;
  readonly name: SfxRecipe;
  readonly gainDb: number;
  readonly pan: number;
  /** Seed whose `% variants` is the chosen variant. */
  readonly seed: number;
  readonly variant: string;
  readonly durationS: number | undefined;
  readonly kind: CueEventKind;
  readonly shotId: string;
}

interface ResolvedCue {
  readonly start: number;
  readonly recipe: SfxRecipe;
  /** Allowed variant indices of the recipe. */
  readonly allowed: readonly number[];
  readonly forced: number | undefined;
  readonly gainDb: number;
  readonly pan: number;
  readonly durationS: number | undefined;
  readonly kind: CueEventKind;
  readonly salt: string;
}

interface Candidate {
  readonly gesture: Gesture;
  readonly priority: number;
  readonly start: number;
  readonly cues: readonly ResolvedCue[];
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Variant indices of `names`; none named = every variant that is not bass-heavy. */
function variantIndices(recipe: SfxRecipe, names: readonly string[]): number[] {
  const all = SFX_VARIANTS[recipe];
  const picked = names.map((name) => all.indexOf(name)).filter((index) => index >= 0);
  if (picked.length > 0) return picked;
  const heavy = HEAVY_VARIANTS[recipe] ?? [];
  const light = all.flatMap((name, index) => (heavy.includes(name) ? [] : [index]));
  return light.length > 0 ? light : all.map((_, index) => index);
}

/** Palette of each shot and the look-change slot of shots entered from another look. */
interface SoundContext {
  readonly palette: (shotId: string) => SoundPalette;
  readonly lookChange: (shotId: string) => PaletteSlot | undefined;
}

function soundContext(shots: readonly StoryboardShot[], palettes: ShotPalettes): SoundContext {
  const paletteOf = (shotId: string): SoundPalette => palettes.get(shotId) ?? VOXEL_PALETTE;
  const changes = new Map<string, PaletteSlot>();
  shots.forEach((shot, index) => {
    const previous = shots[index - 1];
    if (previous === undefined) return;
    const slot = lookChangeSlot(paletteOf(previous.id), paletteOf(shot.id), shot);
    if (slot !== undefined) changes.set(shot.id, slot);
  });
  return { palette: paletteOf, lookChange: (shotId) => changes.get(shotId) };
}

/** A designed variant (list pitch) in the palette's recipe: the voxel pop order maps onto it. */
function forcedVariant(
  palette: SoundPalette,
  cue: EventCue,
  recipe: SfxRecipe,
): number | undefined {
  if (cue.variant === undefined) return undefined;
  let name = cue.variant;
  const order = palette.listPitch;
  if (cue.kind === 'list-item' && palette.sfx['list-item'] !== undefined && order !== undefined) {
    const step = (LIST_PITCH_ORDER as readonly string[]).indexOf(cue.variant);
    const top = LIST_PITCH_ORDER.length - 1;
    name = order[Math.round((Math.max(0, step) * (order.length - 1)) / top)] ?? name;
  }
  const index = SFX_VARIANTS[recipe].indexOf(name);
  return index < 0 ? undefined : index;
}

function resolveCue(
  gesture: Gesture,
  cue: EventCue,
  position: number,
  sound: SoundContext,
): ResolvedCue | null {
  const rule = CUE_RULES[cue.kind];
  const palette = sound.palette(gesture.shotId);
  const salt = `${gesture.shotId}|${String(gesture.index)}|${String(position)}`;
  let recipe: SfxRecipe;
  let names: readonly string[] = [];
  let leadS = rule.leadS;
  let choiceTrimDb = 0;
  if (cue.kind === 'scene') {
    if (cue.recipe === undefined) return null;
    recipe = sceneRecipe(palette, cue.recipe);
  } else {
    const lookChange = rule.transition === true ? sound.lookChange(gesture.shotId) : undefined;
    const slots = lookChange === undefined ? paletteSlots(palette, cue.kind) : [lookChange];
    const slot = slots[cue.choice ?? 0] ?? slots[0] ?? [];
    const choice = pickRecipe({ candidates: slot, salt, history: NO_HISTORY });
    if (choice === undefined) return null;
    recipe = choice.recipe;
    names = choice.variants;
    leadS = choice.leadS ?? leadS;
    choiceTrimDb = choice.trimDb ?? 0;
  }
  return {
    start: round3(Math.max(0, cue.t - leadS)),
    recipe,
    allowed: variantIndices(recipe, names),
    forced: forcedVariant(palette, cue, recipe),
    gainDb: round1(ruleGainDb(rule, recipe) + choiceTrimDb + (cue.trimDb ?? 0)),
    pan: round2(Math.max(-1, Math.min(1, cue.pan ?? 0))),
    durationS: cue.durationS ?? rule.durationS,
    kind: cue.kind,
    salt: `${salt}|${recipe}`,
  };
}

function shotAt(shots: readonly StoryboardShot[], t: number): StoryboardShot | undefined {
  return shots.find((shot) => t >= shot.t0 && t < shot.t1);
}

/**
 * Where a cue may start: inside the timeline and not in a shot's first 0.3 s unless it is a
 * transition; a cue slightly inside the head moves to its end (null = dropped).
 */
function placeCue(
  cue: ResolvedCue,
  shots: readonly StoryboardShot[],
  durationS: number,
): ResolvedCue | null {
  if (cue.start > durationS) return null;
  if (CUE_RULES[cue.kind].transition === true) return cue;
  const shot = shotAt(shots, cue.start);
  if (shot === undefined) return cue;
  const headEnd = round3(shot.t0 + DENSITY.shotHeadS);
  if (cue.start >= headEnd) return cue;
  return headEnd - cue.start <= DENSITY.headNudgeS + 1e-9 ? { ...cue, start: headEnd } : null;
}

function candidates(
  gestures: readonly Gesture[],
  shots: readonly StoryboardShot[],
  durationS: number,
  sound: SoundContext,
): Candidate[] {
  return gestures.flatMap((gesture): Candidate[] => {
    const cues = gesture.cues
      .map((cue, position) => {
        const resolved = resolveCue(gesture, cue, position, sound);
        return resolved === null ? null : placeCue(resolved, shots, durationS);
      })
      .filter((cue): cue is ResolvedCue => cue !== null);
    if (cues.length === 0) return [];
    const start = Math.min(...cues.map((cue) => cue.start));
    const priority = gesture.priority ?? CUE_RULES[gesture.kind].priority;
    return [{ gesture, priority, start, cues }];
  });
}

function fitsWindow(starts: readonly number[]): boolean {
  const sorted = [...starts].sort((a, b) => a - b);
  return sorted.every(
    (from, index) =>
      sorted.slice(index).filter((t) => t < from + DENSITY.windowS).length <= DENSITY.maxPerWindow,
  );
}

function fits(kept: readonly Candidate[], candidate: Candidate): boolean {
  const spaced = kept.every(
    (other) => Math.abs(other.start - candidate.start) >= DENSITY.minGestureGapS,
  );
  const clear = kept.every((other) =>
    other.cues.every((a) =>
      candidate.cues.every((b) => Math.abs(a.start - b.start) >= DENSITY.minCueGapS),
    ),
  );
  return spaced && clear && fitsWindow([...kept.map((other) => other.start), candidate.start]);
}

const distanceTo = (kept: readonly Candidate[], start: number): number =>
  Math.min(Number.POSITIVE_INFINITY, ...kept.map((other) => Math.abs(other.start - start)));

/**
 * Priority level by level; within a level the gesture farthest from those already kept goes next
 * (so the budget spreads over the film instead of filling its start), each kept only if it fits.
 */
function selectGestures(all: readonly Candidate[], durationS: number): Candidate[] {
  const budget = Math.floor(durationS / DENSITY.secondsPerGesture) + 1;
  const levels = [...new Set(all.map((candidate) => candidate.priority))].sort((a, b) => a - b);
  const kept: Candidate[] = [];
  for (const level of levels) {
    let pending = all
      .filter((candidate) => candidate.priority === level)
      .sort((a, b) => a.start - b.start || a.gesture.shotId.localeCompare(b.gesture.shotId));
    while (pending.length > 0 && kept.length < budget) {
      pending = pending.filter((candidate) => fits(kept, candidate));
      let best: Candidate | undefined;
      let bestDistance = -1;
      for (const candidate of pending) {
        const distance = distanceTo(kept, candidate.start);
        if (distance > bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
      if (best === undefined) break;
      kept.push(best);
      pending = pending.filter((candidate) => candidate !== best);
    }
  }
  return kept;
}

/** Seed for `variant` of `recipe`: `seed % variants === variant`, derived from `salt`. */
export function variantSeed(recipe: SfxRecipe, variant: number, salt: string): number {
  const count = SFX_VARIANTS[recipe].length;
  const base = hashSeed(salt) & 0x7fff_ffff;
  return Math.floor(base / count) * count + variant;
}

/**
 * Applies the rule table and density control to `gestures` (see the module comment); `palettes`
 * voices each shot (missing shots = `voxel`).
 */
export function directCues(
  gestures: readonly Gesture[],
  shots: readonly StoryboardShot[],
  durationS: number,
  palettes: ShotPalettes = new Map(),
): DirectedCue[] {
  const sound = soundContext(shots, palettes);
  const kept = selectGestures(candidates(gestures, shots, durationS, sound), durationS);
  const timeline = kept
    .flatMap((candidate) => candidate.cues.map((cue) => ({ cue, gesture: candidate.gesture })))
    .sort((a, b) => a.cue.start - b.cue.start || a.cue.salt.localeCompare(b.cue.salt));
  const out: DirectedCue[] = [];
  for (const { cue, gesture } of timeline) {
    let variant = cue.forced ?? cue.allowed[hashSeed(cue.salt) % cue.allowed.length] ?? 0;
    const previous = out.at(-1);
    const repeats =
      previous !== undefined &&
      previous.name === cue.recipe &&
      SFX_VARIANTS[cue.recipe][variant] === previous.variant;
    if (cue.forced === undefined && repeats && cue.allowed.length > 1) {
      const position = cue.allowed.indexOf(variant);
      variant = cue.allowed[(position + 1) % cue.allowed.length] ?? variant;
    }
    out.push({
      t: cue.start,
      name: cue.recipe,
      gainDb: cue.gainDb,
      pan: cue.pan,
      seed: variantSeed(cue.recipe, variant, cue.salt),
      variant: SFX_VARIANTS[cue.recipe][variant] ?? '',
      durationS: cue.durationS,
      kind: cue.kind,
      shotId: gesture.shotId,
    });
  }
  return out;
}
