/**
 * Taste signals from the user's decisions (PLAN.md#12.13): a variant picked over the others, the
 * current scene kept over its variants, all variants discarded, a shot locked (approved as is) or
 * sent back to be rebuilt. Reads the storyboard entry and the scene sources the decision was
 * about; the owner of the profile (the app) records the signal.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  storyboardFileSchema,
  type ShotVariantSet,
  type StoryboardShot,
  type TasteDecision,
  type TasteFeatureValue,
  type TasteSignal,
} from '@reelforge/shared';
import { readProjectText, requireProjectJson } from '../files.js';
import { readLockedShots } from '../locks.js';
import { FILES } from '../paths.js';
import { SCENE_STUB_MARKER } from '../stages/scene-stub.js';
import type { StageError } from '../types.js';
import {
  directionFeature,
  featureKey,
  sceneTasteFeatures,
  shotDecisionFeatures,
  uniqueFeatures,
} from './features.js';

/** A rebuild or "discard all" is weaker evidence than a pick or a lock. */
export const WEAK_SIGNAL_WEIGHT = 0.5;

/**
 * Where the learned taste goes (the app's profile in its data folder). `profile` is the condensed
 * text for the prompts, undefined while learning is off or the evidence is too thin.
 */
export interface TasteLearner {
  profile(): string | undefined;
  /** Records decisions; never throws (the owner logs its own failures). */
  record(signals: readonly TasteSignal[]): void;
}

async function sourceOf(projectDir: string, file: string): Promise<string | undefined> {
  const read = await readProjectText(projectDir, file);
  if (!read.ok || read.value === undefined) return undefined;
  return read.value.startsWith(SCENE_STUB_MARKER) ? undefined : read.value;
}

function without(
  entries: readonly TasteFeatureValue[],
  endorsed: readonly TasteFeatureValue[],
): TasteFeatureValue[] {
  const keys = new Set(endorsed.map(featureKey));
  return entries.filter((entry) => !keys.has(featureKey(entry)));
}

/**
 * The signal of a decision about `set` (call before the variant files are removed). Dropped
 * variants (QA failures) are no opinion of the user's and are left out.
 */
export async function variantDecisionSignal(
  projectDir: string,
  set: ShotVariantSet,
  shot: StoryboardShot,
  decision: TasteDecision,
  chosen?: number,
): Promise<TasteSignal> {
  const ready = set.variants.filter((variant) => variant.status === 'ready');
  const seconds = shot.t1 - shot.t0;
  const offered = await Promise.all(
    ready.map(async (variant) => {
      const source =
        variant.file === undefined ? undefined : await sourceOf(projectDir, variant.file);
      return {
        index: variant.index,
        source,
        direction: directionFeature(variant.direction.id),
        // The storyboard entry is the same for every variant: only the scene tells them apart.
        features: uniqueFeatures([
          directionFeature(variant.direction.id),
          ...(source === undefined ? [] : sceneTasteFeatures(source, seconds)),
        ]),
      };
    }),
  );
  if (decision === 'discard') {
    return {
      kind: 'discard',
      positive: [],
      negative: uniqueFeatures(offered.map((entry) => entry.direction)),
      weight: WEAK_SIGNAL_WEIGHT,
    };
  }
  const picked = offered.find((entry) => entry.index === chosen);
  const positive =
    decision === 'pick' && picked !== undefined
      ? uniqueFeatures([...shotDecisionFeatures(shot, picked.source), picked.direction])
      : shotDecisionFeatures(shot, await sourceOf(projectDir, shot.scene));
  const rejected = offered.filter((entry) => entry !== picked).flatMap((entry) => entry.features);
  return {
    kind: decision === 'pick' ? 'pick' : 'keep',
    positive,
    negative: without(uniqueFeatures(rejected), positive),
  };
}

/** Lock (positive) or rebuild (negative, weak) signals of shots with a built scene. */
export async function shotTasteSignals(
  projectDir: string,
  shotIds: readonly string[],
  kind: 'lock' | 'rebuild',
): Promise<Result<TasteSignal[], StageError>> {
  const storyboard = await requireProjectJson(projectDir, FILES.storyboard, storyboardFileSchema);
  if (!storyboard.ok) return storyboard;
  const locked = await readLockedShots(projectDir);
  if (!locked.ok) return err(locked.error);
  const wanted = new Set(shotIds);
  const signals: TasteSignal[] = [];
  for (const shot of storyboard.value.shots) {
    // A locked shot is never rebuilt, so the request says nothing about it.
    if (!wanted.has(shot.id) || (kind === 'rebuild' && locked.value.has(shot.id))) continue;
    const source = await sourceOf(projectDir, shot.scene);
    if (source === undefined) continue;
    const features = shotDecisionFeatures(shot, source);
    signals.push(
      kind === 'lock'
        ? { kind, positive: features, negative: [] }
        : { kind, positive: [], negative: features, weight: WEAK_SIGNAL_WEIGHT },
    );
  }
  return ok(signals);
}
