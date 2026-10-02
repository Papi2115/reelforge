/**
 * `storyboard.json` written by the storyboard stage: the shared schema plus the prompt's rules
 * (contiguous shots from 0, boundaries on word starts, shot lengths, no treatment more than twice
 * in a row, scene paths, transitions).
 */
import { storyboardFileSchema, type StoryboardShot, type WordsFile } from '@reelforge/shared';
import { z } from 'zod';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

/** The storyboard file plus the prompt's optional top-level `missingProps` list. */
export const storyboardOutputSchema = storyboardFileSchema.extend({
  missingProps: z.array(z.string().min(1)).optional(),
});
export type StoryboardOutput = z.infer<typeof storyboardOutputSchema>;

export interface StoryboardRules {
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
  maxTailS: 1,
  minTransitionS: 0.2,
  maxTransitionS: 0.6,
};

const EPSILON = 1e-3;
const fmt = (seconds: number): string => seconds.toFixed(3);

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
    if (length < rules.minShotS || length > rules.maxShotS) {
      issues.push(
        issue(
          'error',
          'shot-length',
          `${shot.id} lasts ${length.toFixed(2)} s (allowed ${String(rules.minShotS)}–${String(rules.maxShotS)} s)`,
          where,
        ),
      );
    } else if (length < rules.typicalMinShotS || length > rules.typicalMaxShotS) {
      issues.push(
        issue(
          'warning',
          'shot-length',
          `${shot.id} lasts ${length.toFixed(2)} s (typical ${String(rules.typicalMinShotS)}–${String(rules.typicalMaxShotS)} s)`,
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
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let run = 0;
  shots.forEach((shot, index) => {
    run = index > 0 && shots[index - 1]?.treatment === shot.treatment ? run + 1 : 1;
    if (run === rules.maxTreatmentRun + 1) {
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

function transitionIssues(
  shots: readonly StoryboardShot[],
  rules: StoryboardRules,
): ValidationIssue[] {
  return shots.flatMap((shot, index) => {
    const transition = shot.transitionIn;
    const where = `shots[${String(index)}].transitionIn`;
    if (transition === undefined || transition.type === 'cut') return [];
    if (index === 0)
      return [issue('error', 'first-transition', 'the first shot has no transition', where)];
    const { duration } = transition;
    return duration < rules.minTransitionS || duration > rules.maxTransitionS
      ? [
          issue(
            'warning',
            'transition-duration',
            `${transition.type} lasts ${String(duration)} s (use ${String(rules.minTransitionS)}–${String(rules.maxTransitionS)} s)`,
            where,
          ),
        ]
      : [];
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
    if (onStart) return;
    const inside = words.words.find((word) => boundary > word.t && boundary < word.tEnd);
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
}

/** Rule checks on an already parsed storyboard. */
export function checkStoryboard(
  storyboard: StoryboardOutput,
  options: StoryboardCheckOptions = {},
): ValidationIssue[] {
  const rules = { ...DEFAULT_STORYBOARD_RULES, ...options.rules };
  const { shots } = storyboard;
  return [
    ...timelineIssues(shots, rules),
    ...treatmentIssues(shots, rules),
    ...identityIssues(shots),
    ...transitionIssues(shots, rules),
    ...(options.words === undefined ? [] : wordIssues(shots, options.words, rules)),
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
