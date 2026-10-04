/**
 * Look and roll rhythm of a storyboard in `mixed` look mode (ADR-009, PLAN.md phase 12): known
 * looks; a roll-A shot at least every N shots (an untagged voxel shot counts as A); and, once two
 * or more looks are available, every shot tagged, no look more than N shots in a row (A-roll voxel
 * may run one longer), a new pattern (roll + look + treatment) at least every 6–8 s, and a C-roll
 * at act changes (warning). Projects in `voxel-only` mode never reach these checks.
 */
import { DEFAULT_LOOK_ID, shotLook, type Roll, type StoryboardShot } from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

export interface LookRhythmRules {
  /** Same look allowed this many shots in a row. Default 3. */
  readonly maxLookRun: number;
  /** ...or this many when every shot of the run is an A-roll in the voxel look. Default 4. */
  readonly maxAnchorLookRun: number;
  /** At least one A-roll shot in every this many shots in a row. Default 6. */
  readonly rollAEvery: number;
  /** Shots in a row with one roll + look + treatment may last at most this long, s. Default 8. */
  readonly maxPatternS: number;
}

export const DEFAULT_LOOK_RHYTHM_RULES: LookRhythmRules = {
  maxLookRun: 3,
  maxAnchorLookRun: 4,
  rollAEvery: 6,
  maxPatternS: 8,
};

export interface LookRhythmOptions {
  /** Ids of the available looks (voxel first). */
  readonly looks: readonly string[];
  readonly rules: LookRhythmRules;
}

const where = (index: number, field: string): string => `shots[${String(index)}].${field}`;

/** The shot's roll; an untagged shot in the voxel look counts as the A-roll it always was. */
function effectiveRoll(shot: StoryboardShot): Roll | undefined {
  return shot.roll ?? (shotLook(shot) === DEFAULT_LOOK_ID ? 'A' : undefined);
}

function lookIssues(shots: readonly StoryboardShot[], looks: readonly string[]): ValidationIssue[] {
  return shots.flatMap((shot, index) =>
    looks.includes(shotLook(shot))
      ? []
      : [
          issue(
            'error',
            'unknown-look',
            `${shot.id} uses look "${shotLook(shot)}"; available looks: ${looks.join(', ')}`,
            where(index, 'look'),
          ),
        ],
  );
}

function rollAGapIssues(shots: readonly StoryboardShot[], every: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let gap = 0;
  shots.forEach((shot, index) => {
    gap = effectiveRoll(shot) === 'A' ? 0 : gap + 1;
    if (gap === every) {
      issues.push(
        issue(
          'error',
          'roll-a-gap',
          `${String(every)} shots in a row without an A-roll shot (up to ${shot.id}); bring the main story back at least every ${String(every)} shots`,
          where(index, 'roll'),
        ),
      );
    }
  });
  return issues;
}

function missingRollIssues(shots: readonly StoryboardShot[]): ValidationIssue[] {
  return shots.flatMap((shot, index) =>
    shot.roll === undefined
      ? [issue('error', 'missing-roll', `${shot.id} has no roll (A, B or C)`, where(index, 'roll'))]
      : [],
  );
}

function lookRunIssues(
  shots: readonly StoryboardShot[],
  rules: LookRhythmRules,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let start = 0;
  let reported = false;
  shots.forEach((shot, index) => {
    if (index > 0 && shotLook(shot) !== shotLook(shots[index - 1] ?? shot)) {
      start = index;
      reported = false;
    }
    const run = shots.slice(start, index + 1);
    const anchor = shotLook(shot) === DEFAULT_LOOK_ID && run.every((member) => member.roll === 'A');
    const limit = anchor ? rules.maxAnchorLookRun : rules.maxLookRun;
    if (!reported && run.length > limit) {
      reported = true;
      issues.push(
        issue(
          'error',
          'look-run',
          `look ${shotLook(shot)} used more than ${String(limit)} shots in a row (up to ${shot.id}); switch look or roll`,
          where(index, 'look'),
        ),
      );
    }
  });
  return issues;
}

function patternKey(shot: StoryboardShot): string {
  return `${effectiveRoll(shot) ?? '-'}|${shotLook(shot)}|${shot.treatment}`;
}

function patternIssues(shots: readonly StoryboardShot[], maxS: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let start = 0;
  let reported = false;
  shots.forEach((shot, index) => {
    if (index > 0 && patternKey(shot) !== patternKey(shots[index - 1] ?? shot)) {
      start = index;
      reported = false;
    }
    const first = shots[start] ?? shot;
    const length = shot.t1 - first.t0;
    if (!reported && index > start && length > maxS) {
      reported = true;
      issues.push(
        issue(
          'error',
          'pattern-run',
          `${first.id}…${shot.id} keep one pattern (${patternKey(shot).replaceAll('|', ' / ')}) for ${length.toFixed(2)} s; change what the viewer sees at least every ${String(maxS)} s (another look or treatment that really changes the picture, not a new label on the same one). If these shots continue one visual (one chart, counter or place), keep its look: merge them into one shot or put a different shot between them`,
          where(index, 'treatment'),
        ),
      );
    }
  });
  return issues;
}

function actChangeIssues(shots: readonly StoryboardShot[]): ValidationIssue[] {
  return shots.flatMap((shot, index) =>
    shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut' && shot.roll !== 'C'
      ? [
          issue(
            'warning',
            'act-change-roll',
            `${shot.id} opens an act (${shot.transitionIn.type}) but is not a C-roll`,
            where(index, 'roll'),
          ),
        ]
      : [],
  );
}

/** The `mixed` look-mode checks; the multi-look ones only once a second look is available. */
export function checkLookRhythm(
  shots: readonly StoryboardShot[],
  options: LookRhythmOptions,
): ValidationIssue[] {
  const { looks, rules } = options;
  const multiLook = looks.length >= 2;
  return [
    ...lookIssues(shots, looks),
    ...(multiLook ? missingRollIssues(shots) : []),
    ...rollAGapIssues(shots, rules.rollAEvery),
    ...(multiLook ? lookRunIssues(shots, rules) : []),
    ...(multiLook ? patternIssues(shots, rules.maxPatternS) : []),
    ...(multiLook ? actChangeIssues(shots) : []),
  ];
}
