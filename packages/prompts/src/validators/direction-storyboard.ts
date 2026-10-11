/**
 * A Grim Ink storyboard against its direction plan (PLAN.md#14.16): the first shot is the title
 * frame (`ink-poster`, 1.5–3 s, `direction.titleFrame`); every other shot carries its `direction`
 * refs with 2–5 framings (close / ECU with a `why`), never the same framing sequence as the shot
 * before; close + ECU at least a quarter of the framings; the climax beat's shot has the ECU;
 * every person's payoff beat plays the gag, and a person in 3+ shots plays it in at least 3.
 * Runs inside `checkStoryboard` when the stage passes the plan (Grim Ink films only).
 */
import {
  framingSequence,
  type DirectionFile,
  type FramingStep,
  type StoryboardShot,
} from '@reelforge/shared';
import { closeShareIssues, DIRECTION_RULES, whyIssues } from './direction-rules.js';
import { issue, type ValidationIssue } from './issues.js';

const err = (code: string, message: string, path?: string): ValidationIssue =>
  issue('error', code, message, path);

const TITLE_LOOK = 'ink-poster';

function titleFrameIssues(
  shots: readonly StoryboardShot[],
  plan: DirectionFile,
): ValidationIssue[] {
  const first = shots[0];
  if (first === undefined) return [];
  const { titleFrame } = plan;
  const fix = `the first shot must be the title frame: look \`${TITLE_LOOK}\`, ${String(DIRECTION_RULES.titleMinS)}–${String(DIRECTION_RULES.titleMaxS)} s, "direction": { "titleFrame": true, "framings": [{ "framing": "wide", "subject": "the title over ${titleFrame.cast.join(', ')}" }] }, the title "${titleFrame.title}" lettered in`;
  const issues: ValidationIssue[] = [];
  if (first.direction?.titleFrame !== true) {
    issues.push(err('direction-title-frame', `missing title frame: ${fix}`, 'shots[0].direction'));
  }
  if (first.look !== TITLE_LOOK) {
    issues.push(
      err(
        'direction-title-frame',
        `the title frame's look is ${first.look ?? 'none'}: ${fix}`,
        'shots[0].look',
      ),
    );
  }
  const length = first.t1 - first.t0;
  if (length < DIRECTION_RULES.titleMinS - 1e-6 || length > DIRECTION_RULES.titleMaxS + 1e-6) {
    issues.push(
      err(
        'direction-title-frame',
        `the title frame lasts ${length.toFixed(2)} s: ${fix}`,
        'shots[0].t1',
      ),
    );
  }
  const framings = first.direction?.framings.length ?? 0;
  if (framings > DIRECTION_RULES.titleMaxFramings) {
    issues.push(
      err(
        'direction-framings',
        `the title frame has ${String(framings)} framings: at most ${String(DIRECTION_RULES.titleMaxFramings)} (a slow push-in or pull-back on the poster)`,
        'shots[0].direction.framings',
      ),
    );
  }
  const unnamed = titleFrame.cast.filter((id) => !mentions(first.intent, id));
  if (unnamed.length > 0) {
    issues.push(
      issue(
        'warning',
        'direction-title-frame',
        `the title frame's intent does not name ${unnamed.join(', ')} (its cast tag)`,
        'shots[0].intent',
      ),
    );
  }
  shots.slice(1).forEach((shot, index) => {
    if (shot.direction?.titleFrame === true) {
      issues.push(
        err(
          'direction-title-frame',
          `only the first shot is the title frame (${shot.id} is marked too)`,
          `shots[${String(index + 1)}].direction.titleFrame`,
        ),
      );
    }
  });
  return issues;
}

/** The id as a whole word in the text (a cast tag, a gag hint). */
function mentions(text: string, id: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_-])${id.replace(/[-]/g, '\\-')}([^A-Za-z0-9_-]|$)`).test(text);
}

function shotIssues(shots: readonly StoryboardShot[], plan: DirectionFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const beats = new Set(plan.beats.map((beat) => beat.id));
  const cast = new Set(plan.cast.map((person) => person.id));
  let previous: { readonly id: string; readonly sequence: string } | undefined;
  shots.forEach((shot, index) => {
    if (index === 0) return;
    const path = `shots[${String(index)}].direction`;
    const direction = shot.direction;
    if (direction === undefined) {
      issues.push(
        err(
          'direction-shot',
          `${shot.id} has no "direction": give it the plan's beat ids, the people whose gag plays and 2–5 framings from those beats' progressions`,
          path,
        ),
      );
      previous = undefined;
      return;
    }
    const count = direction.framings.length;
    if (count < DIRECTION_RULES.minFramings || count > DIRECTION_RULES.maxFramings) {
      issues.push(
        err(
          'direction-framings',
          `${shot.id} has ${String(count)} framings: give it ${String(DIRECTION_RULES.minFramings)}–${String(DIRECTION_RULES.maxFramings)} cut on its beats`,
          `${path}.framings`,
        ),
      );
    }
    issues.push(...whyIssues(direction.framings, `${path}.framings`));
    const sequence = framingSequence(direction.framings);
    if (previous?.sequence === sequence) {
      issues.push(
        err(
          'direction-repeat',
          `${previous.id} and ${shot.id} repeat the framing sequence ${sequence}: vary the sizes or their order`,
          `${path}.framings`,
        ),
      );
    }
    previous = { id: shot.id, sequence };
    const unknownBeats = (direction.beats ?? []).filter((ref) => !beats.has(ref));
    const unknownCast = (direction.gags ?? []).filter((ref) => !cast.has(ref));
    if (unknownBeats.length > 0 || unknownCast.length > 0) {
      const names = [
        ...unknownBeats.map((ref) => `beat ${ref}`),
        ...unknownCast.map((ref) => `person ${ref}`),
      ];
      issues.push(
        err(
          'direction-unknown-ref',
          `${shot.id} names what direction.json does not have: ${names.join(', ')}`,
          path,
        ),
      );
    }
  });
  const progressions: FramingStep[][] = shots
    .slice(1)
    .map((shot) => shot.direction?.framings ?? []);
  issues.push(...closeShareIssues(progressions, 'shots'));
  return issues;
}

function covering(shots: readonly StoryboardShot[], beatId: string): StoryboardShot[] {
  return shots.filter((shot) => shot.direction?.beats?.includes(beatId) === true);
}

function climaxIssues(shots: readonly StoryboardShot[], plan: DirectionFile): ValidationIssue[] {
  const { beatRef, ecuSubject } = plan.climax;
  const carriers = covering(shots, beatRef);
  if (carriers.length === 0) {
    return [
      err(
        'direction-climax',
        `no shot covers the climax beat ${beatRef}: list it in the "direction.beats" of the shot where it is spoken, with the ECU of ${ecuSubject}`,
      ),
    ];
  }
  const framed = carriers.some((shot) =>
    shot.direction?.framings.some((step) => step.framing === 'ecu'),
  );
  return framed
    ? []
    : [
        err(
          'direction-climax',
          `the climax shot ${carriers.map((shot) => shot.id).join('/')} has no ecu framing: add the extreme close-up of ${ecuSubject}`,
        ),
      ];
}

function gagShotIssues(shots: readonly StoryboardShot[], plan: DirectionFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const story = shots.slice(1);
  for (const person of plan.cast) {
    const payoff = person.signatureGag.arc.payoff;
    const payoffShots = covering(story, payoff);
    if (!payoffShots.some((shot) => shot.direction?.gags?.includes(person.id) === true)) {
      issues.push(
        err(
          'direction-payoff',
          `${person.id}'s gag pays off on beat ${payoff}, but no shot covering it lists "${person.id}" in "direction.gags": play the payoff there`,
        ),
      );
    }
    const appears = story.filter((shot) => mentions(shot.intent, person.id)).length;
    const plays = story.filter((shot) => shot.direction?.gags?.includes(person.id) === true).length;
    if (appears >= DIRECTION_RULES.minGagShots && plays < DIRECTION_RULES.minGagShots) {
      issues.push(
        err(
          'direction-gag-shots',
          `${person.id} is in ${String(appears)} shots but plays the signature gag (${person.signatureGag.kind}) in ${String(plays)}: at least ${String(DIRECTION_RULES.minGagShots)} (setup, escalation, payoff) in "direction.gags"`,
        ),
      );
    }
  }
  return issues;
}

function coverageIssues(shots: readonly StoryboardShot[], plan: DirectionFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const beat of plan.beats) {
    const carriers = covering(shots, beat.id);
    if (carriers.length === 0) {
      issues.push(
        issue(
          'warning',
          'direction-uncovered',
          `no shot lists the planned beat ${beat.id} in "direction.beats"`,
        ),
      );
      continue;
    }
    const overlaps = carriers.some((shot) => shot.t0 < beat.span.t1 && beat.span.t0 < shot.t1);
    if (!overlaps) {
      issues.push(
        issue(
          'warning',
          'direction-beat-time',
          `beat ${beat.id} (${beat.span.t0.toFixed(1)}–${beat.span.t1.toFixed(1)} s) is listed by ${carriers.map((shot) => shot.id).join('/')}, which does not cover its time`,
        ),
      );
    }
  }
  return issues;
}

/** The storyboard's shots (end card removed) against the film's direction plan. */
export function checkDirectedStoryboard(
  shots: readonly StoryboardShot[],
  plan: DirectionFile,
): ValidationIssue[] {
  return [
    ...titleFrameIssues(shots, plan),
    ...shotIssues(shots, plan),
    ...climaxIssues(shots, plan),
    ...gagShotIssues(shots, plan),
    ...coverageIssues(shots, plan),
  ];
}
