/**
 * Deterministic annotation trim of the storyboard stage: when the only errors left are the
 * annotation count rules (`ANNOTATION_COUNT_CODES`: too many marks in a minute, the same form too
 * often in a row), the weakest marks of each offending window are dropped instead of failing the
 * stage. Locked shots are never touched; a lone `claim` mark of a shot is never dropped; what can
 * not be fixed that way stays as a warning.
 */
import {
  ANNOTATION_COUNT_CODES,
  ANNOTATION_DENSITY_WINDOW_S,
  DEFAULT_ANNOTATION_RULES,
  timedAnnotationPlans,
  type AnnotationRules,
  type StoryboardOutput,
  type TimedPlan,
  type ValidationIssue,
} from '@reelforge/prompts';
import type { AnnotationPlan, AnnotationReason, WordsFile } from '@reelforge/shared';

/** What a mark is planned for: numbers, names and claims are kept longest. */
const REASON_WEIGHT: Readonly<Record<AnnotationReason, number>> = {
  number: 3,
  name: 3,
  claim: 3,
  definition: 2,
  comparison: 2,
  list: 2,
  place: 1,
  emphasis: 0,
};

/** Forms that only decorate (no label or value of their own). */
const DECORATIVE_KINDS: ReadonlySet<string> = new Set([
  'highlight',
  'underline',
  'spotlight',
  'ring',
  'stamp',
]);

function strength(plan: AnnotationPlan): number {
  return REASON_WEIGHT[plan.reason] * 2 + (DECORATIVE_KINDS.has(plan.kind) ? 0 : 1);
}

const isCountError = (entry: ValidationIssue): boolean =>
  entry.severity === 'error' && ANNOTATION_COUNT_CODES.includes(entry.code);

/** True when there are errors and every one of them is an annotation count rule. */
export function onlyAnnotationCountErrors(issues: readonly ValidationIssue[]): boolean {
  const errors = issues.filter((entry) => entry.severity === 'error');
  return errors.length > 0 && errors.every(isCountError);
}

/** Annotation count errors as warnings (left after a trim: locked or lone claim marks). */
export function softenAnnotationCounts(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.map((entry) =>
    isCountError(entry) ? { ...entry, severity: 'warning' as const } : entry,
  );
}

interface Trim {
  readonly alive: readonly TimedPlan[];
  readonly locked: ReadonlySet<string>;
}

function removable(trim: Trim, entry: TimedPlan): boolean {
  if (trim.locked.has(entry.shotId)) return false;
  if (entry.plan.reason !== 'claim') return true;
  return trim.alive.filter((other) => other.shotIndex === entry.shotIndex).length > 1;
}

/** Smallest time to a neighbour among the kept marks: the most crowded mark goes first. */
function crowding(alive: readonly TimedPlan[], entry: TimedPlan): number {
  const at = alive.indexOf(entry);
  const gaps = [alive[at - 1], alive[at + 1]]
    .filter((other): other is TimedPlan => other !== undefined)
    .map((other) => Math.abs(other.t - entry.t));
  return Math.min(Infinity, ...gaps);
}

/** The mark of `group` to drop: weakest, then most crowded, then the later one in shot order. */
function weakest(trim: Trim, group: readonly TimedPlan[]): TimedPlan | undefined {
  const candidates = group.filter((entry) => removable(trim, entry));
  return candidates.sort(
    (first, second) =>
      strength(first.plan) - strength(second.plan) ||
      crowding(trim.alive, first) - crowding(trim.alive, second) ||
      second.shotIndex - first.shotIndex ||
      second.index - first.index,
  )[0];
}

function densityTarget(trim: Trim, rules: AnnotationRules): TimedPlan | undefined {
  for (const entry of trim.alive) {
    const end = entry.t + ANNOTATION_DENSITY_WINDOW_S;
    const window = trim.alive.filter((other) => other.t >= entry.t && other.t < end);
    const pick = window.length > rules.maxPerMinute ? weakest(trim, window) : undefined;
    if (pick !== undefined) return pick;
  }
  return undefined;
}

function runTarget(trim: Trim, rules: AnnotationRules): TimedPlan | undefined {
  for (const [index, entry] of trim.alive.entries()) {
    const run = trim.alive.slice(Math.max(0, index - rules.maxKindRun), index + 1);
    const first = run[0];
    const repeats =
      run.length === rules.maxKindRun + 1 &&
      first !== undefined &&
      run.every((other) => other.plan.kind === entry.plan.kind) &&
      entry.t - first.t <= rules.runWindowS;
    const pick = repeats ? weakest(trim, run) : undefined;
    if (pick !== undefined) return pick;
  }
  return undefined;
}

export interface TrimmedAnnotations {
  readonly storyboard: StoryboardOutput;
  /** Ids of the shots that lost a mark, one entry per dropped mark, in shot order. */
  readonly removed: readonly string[];
}

/** Drops the weakest unlocked marks until the density and run rules hold (or nothing can go). */
export function trimAnnotations(
  storyboard: StoryboardOutput,
  words: WordsFile | undefined,
  locked: ReadonlySet<string>,
  rules: AnnotationRules = DEFAULT_ANNOTATION_RULES,
): TrimmedAnnotations {
  let alive = timedAnnotationPlans(storyboard.shots, words);
  const dropped: TimedPlan[] = [];
  for (;;) {
    const trim = { alive, locked };
    const target = densityTarget(trim, rules) ?? runTarget(trim, rules);
    if (target === undefined) break;
    dropped.push(target);
    alive = alive.filter((entry) => entry !== target);
  }
  if (dropped.length === 0) return { storyboard, removed: [] };
  const gone = new Set(dropped.map((entry) => `${String(entry.shotIndex)}:${String(entry.index)}`));
  const shots = storyboard.shots.map((shot, shotIndex) =>
    shot.annotations === undefined || !dropped.some((entry) => entry.shotIndex === shotIndex)
      ? shot
      : {
          ...shot,
          annotations: shot.annotations.filter(
            (_plan, index) => !gone.has(`${String(shotIndex)}:${String(index)}`),
          ),
        },
  );
  const removed = [...dropped]
    .sort((first, second) => first.shotIndex - second.shotIndex || first.index - second.index)
    .map((entry) => entry.shotId);
  return { storyboard: { ...storyboard, shots }, removed };
}

/** "Trimmed 2 annotations to fit the density rules (s05, s09)". */
export function trimWarning(removed: readonly string[]): string {
  const noun = removed.length === 1 ? 'annotation' : 'annotations';
  const shots = [...new Set(removed)].join(', ');
  return `Trimmed ${String(removed.length)} ${noun} to fit the density rules (${shots})`;
}
