/**
 * `storyboard.json` written by the storyboard stage: the shared schema plus the prompt's rules
 * (contiguous shots from 0, boundaries on word starts, shot lengths, no treatment more than twice
 * in a row, scene paths, transitions and their transition-kit styles) and the annotation plans' phrase and variety rules; in
 * `mixed` look mode also the look/roll rhythm (rhythm.ts, ADR-009); with a tension curve the cut
 * tempo per segment (`tension-tempo`, tension.ts, PLAN.md#12.22); with the project's characters
 * the mascot and role checks (characters.ts, PLAN.md#12.20); with a shots-per-minute range
 * (ADR-027) shot lengths, the pattern window and the tempo targets follow the range, plus the
 * range and sentence-boundary checks (shot-range.ts); the wow-transition budget and order rules
 * (wow.ts, ADR-028) apply wherever a wow style is named; continuity links (continuity.ts,
 * PLAN.md#13.2) are checked with their transitions written from the links.
 */
import {
  applyContinuityTransitions,
  DEFAULT_LOOK_ID,
  shotRangeRules,
  STANDARD_TEMPO,
  storyboardFileSchema,
  type LookMode,
  type ShotsPerMinute,
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { z } from 'zod';
import { checkAnnotationPlans, type AnnotationRules } from './annotations.js';
import { checkAssetNeeds, checkShotAssets, type AssetNeedRules } from './asset-needs.js';
import { checkCharacters, type CharacterCheckOptions } from './characters.js';
import { checkContinuity } from './continuity.js';
import { checkInterrupts, type InterruptCheckOptions } from './dramaturgy.js';
import { offensiveJsonIssues } from './offensive.js';
import {
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';
import { checkLookRhythm, DEFAULT_LOOK_RHYTHM_RULES, type LookRhythmRules } from './rhythm.js';
import { checkShotRange } from './shot-range.js';
import {
  identityIssues,
  timelineIssues,
  transitionIssues,
  treatmentIssues,
  wordIssues,
} from './storyboard-shots.js';
import { checkTensionTempo } from './tension.js';
import { checkWowTransitions } from './wow.js';
import { checkWorldVariety, type WorldVarietyOptions } from './world-variety.js';
import { WORLD_VARIETY_RULES } from '../worlds/variety.js';
import type { WorldTransitionOption } from '../worlds/types.js';

/** The storyboard file plus the prompt's optional top-level `missingProps` list. */
export const storyboardOutputSchema = storyboardFileSchema.extend({
  missingProps: z.array(z.string().min(1)).optional(),
});
export type StoryboardOutput = z.infer<typeof storyboardOutputSchema>;

/** The look rhythm fields (rhythm.ts) apply only in `mixed` look mode. */
export interface StoryboardRules extends LookRhythmRules {
  /** Hard shot length limits (error), seconds. Default 1 / 10. */
  readonly minShotS: number;
  readonly maxShotS: number;
  /** Typical range (warning outside). Default 3 / 8. */
  readonly typicalMinShotS: number;
  readonly typicalMaxShotS: number;
  /** Same treatment allowed this many times in a row. Default 2. */
  readonly maxTreatmentRun: number;
  /** Shot boundary vs. a word start, seconds. Default 0.05. */
  readonly boundaryToleranceS: number;
  /**
   * A boundary in the silence before a word start, at most this much earlier, is on that word
   * too (beat sync moves cuts into the pause, PLAN.md#12.21). Default 0 (off).
   */
  readonly pauseLeadS: number;
  /** Last t1 may exceed the last word's end by up to this. Default 1. */
  readonly maxTailS: number;
  /** Non-cut transition duration range (warning outside). Default 0.2 / 0.6. */
  readonly minTransitionS: number;
  readonly maxTransitionS: number;
}

export const DEFAULT_STORYBOARD_RULES: StoryboardRules = {
  minShotS: 1,
  maxShotS: 10,
  typicalMinShotS: 3,
  typicalMaxShotS: 8,
  maxTreatmentRun: 2,
  boundaryToleranceS: 0.05,
  pauseLeadS: 0,
  maxTailS: 1,
  minTransitionS: 0.2,
  maxTransitionS: 0.6,
  ...DEFAULT_LOOK_RHYTHM_RULES,
};

/** Shortest mascot reactor shot (a reaction micro-beat), seconds. */
export { REACTOR_MIN_SHOT_S } from './storyboard-shots.js';

export interface StoryboardCheckOptions {
  /** `timing/words.json`; enables the boundary and end checks. */
  readonly words?: WordsFile;
  readonly rules?: Partial<StoryboardRules>;
  readonly annotationRules?: Partial<AnnotationRules>;
  /** `mixed` adds the look/roll rhythm checks (ADR-009); absent = `voxel-only` (pre-2.0 checks). */
  readonly lookMode?: LookMode;
  /** Available look ids in `mixed` mode (default: voxel only). */
  readonly looks?: readonly string[];
  /** Asset need rules (PLAN.md#12.10); absent = research off. */
  readonly assetNeeds?: Partial<AssetNeedRules>;
  /** Asset ids in assets.json (PLAN.md#12.12): `shot.assets` must name one; absent = unchecked. */
  readonly assetIds?: readonly string[];
  /** Tension curve (PLAN.md#12.22): adds the `tension-tempo` check; absent = map off. */
  readonly tension?: Pick<TensionFile, 'points' | 'segments'>;
  /** Pattern interrupts (PLAN.md#12.25): adds the `interrupt-*` checks; absent = switch off. */
  readonly interrupts?: InterruptCheckOptions;
  /** Characters and mascot (PLAN.md#12.20): the `mascot-*` and role checks; absent = none. */
  readonly characters?: CharacterCheckOptions;
  /**
   * Shots per minute (ADR-027): shot lengths, the pattern window and the tempo targets follow the
   * range, plus `shots-per-minute` and `cut-mid-sentence` (shot-range.ts). Absent = the checks
   * exactly as before.
   */
  readonly shotsPerMinute?: ShotsPerMinute;
  /**
   * A world's page-native transitions (PLAN.md#13.6): the only styles its storyboard may name.
   * Absent = the transition kit's styles (every built-in style).
   */
  readonly worldTransitions?: readonly WorldTransitionOption[];
  /**
   * A world's moment catalog and quota (world-variety.ts, real run Sketchbook 1): the variety
   * checks and the world's look run limit. Absent = neither (every other project).
   */
  readonly worldVariety?: WorldVarietyOptions;
  /**
   * The genre preset's wow-transition multiplier (ADR-035, `wowPacing`). Absent = 1 (the wow
   * checks exactly as before presets).
   */
  readonly wowScale?: number;
}

/** Storyboard rules of a range (`StoryboardCheckOptions.rules` still win over them). */
export function shotRangeStoryboardRules(range: ShotsPerMinute): Partial<StoryboardRules> {
  const derived = shotRangeRules(range);
  return {
    minShotS: derived.minShotS,
    maxShotS: derived.maxShotS,
    typicalMinShotS: derived.typicalMinShotS,
    typicalMaxShotS: derived.typicalMaxShotS,
    maxPatternS: derived.maxPatternS,
  };
}

/** Rule checks on an already parsed storyboard. */
export function checkStoryboard(
  storyboard: StoryboardOutput,
  options: StoryboardCheckOptions = {},
): ValidationIssue[] {
  const range = options.shotsPerMinute;
  const ranged = range !== undefined;
  const rules = {
    ...DEFAULT_STORYBOARD_RULES,
    ...(range === undefined ? {} : shotRangeStoryboardRules(range)),
    ...(options.worldVariety === undefined
      ? {}
      : { maxLookRun: options.worldVariety.rules?.maxLookRun ?? WORLD_VARIETY_RULES.maxLookRun }),
    ...options.rules,
  };
  const { shots } = applyContinuityTransitions(storyboard.shots);
  return [
    ...timelineIssues(shots, rules),
    ...treatmentIssues(shots, rules, ranged),
    ...identityIssues(shots),
    ...transitionIssues(shots, rules, options.worldTransitions),
    ...checkWowTransitions(shots, options.wowScale),
    ...checkContinuity(shots),
    ...(options.words === undefined ? [] : wordIssues(shots, options.words, rules)),
    ...checkAnnotationPlans(shots, options.words, options.annotationRules),
    ...checkAssetNeeds(shots, options.assetNeeds),
    ...checkShotAssets(shots, options.assetIds),
    ...(options.lookMode === 'mixed'
      ? checkLookRhythm(shots, {
          looks: options.looks ?? [DEFAULT_LOOK_ID],
          rules,
          ...(ranged ? { continuesExempt: true } : {}),
          ...(options.worldTransitions === undefined
            ? {}
            : { pageNativeStyles: options.worldTransitions.map((option) => option.id) }),
        })
      : []),
    ...(options.tension === undefined
      ? []
      : checkTensionTempo(
          shots,
          options.tension,
          {},
          range === undefined ? STANDARD_TEMPO : shotRangeRules(range).tempo,
        )),
    ...(range === undefined
      ? []
      : checkShotRange(shots, options.words, {
          range,
          longSentenceS: shotRangeRules(range).longSentenceS,
          boundaryToleranceS: rules.boundaryToleranceS,
        })),
    ...(options.interrupts === undefined ? [] : checkInterrupts(shots, options.interrupts)),
    ...(options.worldVariety === undefined ? [] : checkWorldVariety(shots, options.worldVariety)),
    ...(options.characters === undefined
      ? []
      : checkCharacters(storyboard, options.words, options.characters)),
    ...offensiveJsonIssues(storyboard),
  ];
}

/** `storyboard.json` text -> schema + rule checks. */
export function validateStoryboard(
  text: string,
  options: StoryboardCheckOptions = {},
): ValidationReport<StoryboardOutput> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<StoryboardOutput>(undefined, json.issues);
  const parsed = storyboardOutputSchema.safeParse(json.value);
  if (!parsed.success)
    return report<StoryboardOutput>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  return report(parsed.data, [...json.issues, ...checkStoryboard(parsed.data, options)]);
}
