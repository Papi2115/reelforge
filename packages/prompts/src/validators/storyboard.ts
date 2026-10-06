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
  describePairs,
  getTransitionStyle,
  isContinuityStyle,
  shotLook,
  shotRangeRules,
  STANDARD_TEMPO,
  storyboardFileSchema,
  TRANSITION_STYLE_IDS,
  transitionSuits,
  type LookMode,
  type ShotsPerMinute,
  type StoryboardShot,
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { z } from 'zod';
import { checkAnnotationPlans, type AnnotationRules } from './annotations.js';
import { checkAssetNeeds, checkShotAssets, type AssetNeedRules } from './asset-needs.js';
import { checkCharacters, type CharacterCheckOptions } from './characters.js';
import { checkContinuity } from './continuity.js';
import { checkInterrupts, type InterruptCheckOptions } from './dramaturgy.js';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';
import { checkLookRhythm, DEFAULT_LOOK_RHYTHM_RULES, type LookRhythmRules } from './rhythm.js';
import { checkShotRange } from './shot-range.js';
import { checkTensionTempo } from './tension.js';
import { checkWowTransitions } from './wow.js';

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

const EPSILON = 1e-3;
const fmt = (seconds: number): string => seconds.toFixed(3);
/** Shortest mascot reactor shot (a reaction micro-beat), seconds. */
export const REACTOR_MIN_SHOT_S = 1.2;

function timelineIssues(
  shots: readonly StoryboardShot[],
  rules: StoryboardRules,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const first = shots[0];
  if (first !== undefined && Math.abs(first.t0) > EPSILON) {
    issues.push(
      issue(
        'error',
        'not-from-zero',
        `first shot starts at ${fmt(first.t0)}, not 0`,
        'shots[0].t0',
      ),
    );
  }
  shots.forEach((shot, index) => {
    const previous = shots[index - 1];
    if (previous !== undefined && Math.abs(shot.t0 - previous.t1) > EPSILON) {
      issues.push(
        issue(
          'error',
          'not-contiguous',
          `${shot.id} starts at ${fmt(shot.t0)} but ${previous.id} ends at ${fmt(previous.t1)}`,
          `shots[${String(index)}].t0`,
        ),
      );
    }
    const length = shot.t1 - shot.t0;
    const where = `shots[${String(index)}]`;
    // A mascot reaction may be a micro-beat as short as REACTOR_MIN_SHOT_S (2.3.7).
    const reactor = shot.mascot?.role === 'reactor';
    const minShotS = reactor ? Math.min(rules.minShotS, REACTOR_MIN_SHOT_S) : rules.minShotS;
    const typicalMinS = reactor
      ? Math.min(rules.typicalMinShotS, REACTOR_MIN_SHOT_S)
      : rules.typicalMinShotS;
    if (length < minShotS || length > rules.maxShotS) {
      issues.push(
        issue(
          'error',
          'shot-length',
          `${shot.id} lasts ${length.toFixed(2)} s (allowed ${String(minShotS)}–${String(rules.maxShotS)} s)`,
          where,
        ),
      );
    } else if (length < typicalMinS || length > rules.typicalMaxShotS) {
      issues.push(
        issue(
          'warning',
          'shot-length',
          `${shot.id} lasts ${length.toFixed(2)} s (typical ${String(typicalMinS)}–${String(rules.typicalMaxShotS)} s)`,
          where,
        ),
      );
    }
  });
  return issues;
}

function treatmentIssues(
  shots: readonly StoryboardShot[],
  rules: StoryboardRules,
  continuesExempt: boolean,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let run = 0;
  shots.forEach((shot, index) => {
    const same = index > 0 && shots[index - 1]?.treatment === shot.treatment;
    // With a range (ADR-027) a `continues` shot is the same picture going on, not a repeat.
    const exempt = continuesExempt && shot.continues === true;
    run = same ? run + (exempt ? 0 : 1) : 1;
    if (!exempt && run === rules.maxTreatmentRun + 1) {
      issues.push(
        issue(
          'error',
          'treatment-run',
          `${shot.treatment} used more than ${String(rules.maxTreatmentRun)} times in a row (up to ${shot.id})`,
          `shots[${String(index)}].treatment`,
        ),
      );
    }
  });
  return issues;
}

function identityIssues(shots: readonly StoryboardShot[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const scenes = new Set<string>();
  shots.forEach((shot, index) => {
    const where = `shots[${String(index)}]`;
    if (ids.has(shot.id))
      issues.push(issue('error', 'duplicate-id', `shot id ${shot.id} repeats`, `${where}.id`));
    if (scenes.has(shot.scene))
      issues.push(
        issue('error', 'duplicate-scene', `scene ${shot.scene} repeats`, `${where}.scene`),
      );
    ids.add(shot.id);
    scenes.add(shot.scene);
    if (!/^scenes\/[^/\\]+\.js$/.test(shot.scene)) {
      issues.push(
        issue(
          'error',
          'scene-path',
          `scene must be scenes/<name>.js, got ${shot.scene}`,
          `${where}.scene`,
        ),
      );
    } else if (shot.scene !== `scenes/${shot.id}.js`) {
      issues.push(
        issue(
          'warning',
          'scene-path',
          `scene ${shot.scene} does not match id ${shot.id}`,
          `${where}.scene`,
        ),
      );
    }
  });
  return issues;
}

function durationIssue(
  label: string,
  duration: number,
  min: number,
  max: number,
  where: string,
): ValidationIssue[] {
  return duration < min || duration > max
    ? [
        issue(
          'warning',
          'transition-duration',
          `${label} lasts ${String(duration)} s (use ${String(min)}–${String(max)} s)`,
          where,
        ),
      ]
    : [];
}

/** Checks of a transition-kit `style` (PLAN.md#12.15): known id, its duration, its look pair. */
function styleIssues(
  shot: StoryboardShot,
  previous: StoryboardShot,
  style: string,
  duration: number,
  where: string,
): ValidationIssue[] {
  const known = getTransitionStyle(style);
  if (known === undefined) {
    return [
      issue(
        'error',
        'transition-style',
        `unknown transition style "${style}"; use one of ${TRANSITION_STYLE_IDS.join(', ')}`,
        `${where}.style`,
      ),
    ];
  }
  const from = shotLook(previous);
  const to = shotLook(shot);
  const issues = durationIssue(style, duration, known.duration.min, known.duration.max, where);
  if (known.lookChange && from === to) {
    issues.push(
      issue(
        'error',
        'transition-special',
        `${style} is a look-change transition but ${previous.id} and ${shot.id} are both ${to}; use it only where the look changes`,
        `${where}.style`,
      ),
    );
  } else if (!transitionSuits(known, from, to, { from: previous.roll, to: shot.roll })) {
    issues.push(
      issue(
        'warning',
        'transition-pair',
        `${style} does not suit ${from} -> ${to} (it suits ${describePairs(known)})`,
        `${where}.style`,
      ),
    );
  }
  return issues;
}

function transitionIssues(
  shots: readonly StoryboardShot[],
  rules: StoryboardRules,
): ValidationIssue[] {
  return shots.flatMap((shot, index) => {
    const transition = shot.transitionIn;
    const where = `shots[${String(index)}].transitionIn`;
    if (transition === undefined || transition.type === 'cut') return [];
    const previous = shots[index - 1];
    if (previous === undefined)
      return [issue('error', 'first-transition', 'the first shot has no transition', where)];
    const { duration, style } = transition;
    // A continuity link's transition comes from the link (continuity.ts checks it).
    if (isContinuityStyle(style)) return [];
    if (style !== undefined) return styleIssues(shot, previous, style, duration, where);
    return durationIssue(
      transition.type,
      duration,
      rules.minTransitionS,
      rules.maxTransitionS,
      where,
    );
  });
}

function wordIssues(
  shots: readonly StoryboardShot[],
  words: WordsFile,
  rules: StoryboardRules,
): ValidationIssue[] {
  const lastWord = words.words.at(-1);
  if (lastWord === undefined) return [];
  const issues: ValidationIssue[] = [];
  shots.slice(0, -1).forEach((shot, index) => {
    const boundary = shot.t1;
    const onStart = words.words.some(
      (word) => Math.abs(word.t - boundary) <= rules.boundaryToleranceS,
    );
    const inside = words.words.find((word) => boundary > word.t && boundary < word.tEnd);
    const inPause =
      inside === undefined &&
      words.words.some((word) => word.t >= boundary && word.t - boundary <= rules.pauseLeadS);
    if (onStart || inPause) return;
    const detail = inside === undefined ? 'not on a word start' : `mid-word ("${inside.text}")`;
    issues.push(
      issue(
        'error',
        'boundary-not-on-word',
        `${shot.id} ends at ${fmt(boundary)}: ${detail}`,
        `shots[${String(index)}].t1`,
      ),
    );
  });
  const last = shots.at(-1);
  if (last !== undefined) {
    const tail = last.t1 - lastWord.tEnd;
    if (tail < -rules.boundaryToleranceS || tail > rules.maxTailS) {
      issues.push(
        issue(
          'error',
          'end-mismatch',
          `last shot ends at ${fmt(last.t1)}, last word ends at ${fmt(lastWord.tEnd)} (allowed tail 0–${String(rules.maxTailS)} s)`,
          `shots[${String(shots.length - 1)}].t1`,
        ),
      );
    }
  }
  return issues;
}

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
    ...options.rules,
  };
  const { shots } = applyContinuityTransitions(storyboard.shots);
  return [
    ...timelineIssues(shots, rules),
    ...treatmentIssues(shots, rules, ranged),
    ...identityIssues(shots),
    ...transitionIssues(shots, rules),
    ...checkWowTransitions(shots),
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
    ...(options.characters === undefined
      ? []
      : checkCharacters(storyboard, options.words, options.characters)),
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
