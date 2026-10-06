/**
 * Variety of a world film (real run Sketchbook 1: no pop-up, no strip, a boring film), checked on
 * the storyboard of a world project only: every `worldMoment` is one of the world's catalog and
 * sits in a look that hosts it (and opens with its transition when it needs one); the film has
 * its breakthrough quota (worlds/variety.ts) with at least two kinds once it needs two; no two
 * breakthroughs in adjacent shots; one moment kind at most once per 90 s; never three shots in a
 * row with the same moment (or plain) in the same roll; at least three distinct page transitions;
 * with continuity links on, at least one link in films of 45 s+ (the world's signature cut, real
 * run Sketchbook 2 planned none). The look run (at most two in a row) is the rhythm check with the world's limit (storyboard.ts).
 * Every finding is an error, so the storyboard's repair turn fixes it.
 */
import { continuityKindOf, shotLook, type StoryboardShot } from '@reelforge/shared';
import {
  breakthroughQuota,
  continuityQuota,
  WORLD_VARIETY_RULES,
  type WorldQuotaOverride,
  type WorldVarietyRules,
} from '../worlds/variety.js';
import type { WorldMomentOption, WorldTransitionOption } from '../worlds/types.js';
import { issue, type ValidationIssue } from './issues.js';

export interface WorldVarietyOptions {
  /** The world's moment catalog (`WorldPromptText.moments`). */
  readonly moments: readonly WorldMomentOption[];
  /** The world's page-native transitions (for the distinct-transitions rule). */
  readonly transitions?: readonly WorldTransitionOption[];
  /** The project has continuity links on (`continuityLinks`): the film's link quota applies. */
  readonly continuityLinks?: boolean;
  /** Test drivers only: a higher breakthrough floor (StageSettings.worldQuotaOverride). */
  readonly override?: WorldQuotaOverride | undefined;
  readonly rules?: Partial<WorldVarietyRules>;
}

const PLAIN = 'plain';
const where = (index: number, field = 'worldMoment'): string => `shots[${String(index)}].${field}`;
const momentOf = (shot: StoryboardShot): string => shot.worldMoment ?? PLAIN;

function catalogIssues(
  shots: readonly StoryboardShot[],
  catalog: ReadonlyMap<string, WorldMomentOption>,
): ValidationIssue[] {
  return shots.flatMap((shot, index): ValidationIssue[] => {
    const id = shot.worldMoment;
    if (id === undefined || id === PLAIN) return [];
    const option = catalog.get(id);
    if (option === undefined) {
      return [
        issue(
          'error',
          'moment-unknown',
          `${shot.id}: "${id}" is not a moment of this world; use one of ${[...catalog.keys()].join(', ')} or leave the field out (plain)`,
          where(index),
        ),
      ];
    }
    const issues: ValidationIssue[] = [];
    if (option.looks.length > 0 && !option.looks.includes(shotLook(shot))) {
      issues.push(
        issue(
          'error',
          'moment-look',
          `${shot.id}: ${id} is drawn in look ${option.looks.join(' or ')}, not ${shotLook(shot)}; move the moment or change the shot's look and roll`,
          where(index, 'look'),
        ),
      );
    }
    const style = shot.transitionIn?.type === 'cut' ? undefined : shot.transitionIn?.style;
    if (option.transition !== undefined && style !== option.transition) {
      issues.push(
        issue(
          'error',
          'moment-transition',
          `${shot.id}: ${id} opens with the ${option.transition} transition (transitionIn style "${option.transition}")`,
          where(index, 'transitionIn'),
        ),
      );
    }
    return issues;
  });
}

function quotaIssues(
  shots: readonly StoryboardShot[],
  breakthroughs: ReadonlySet<string>,
  durationS: number,
  options: WorldVarietyOptions,
  rules: WorldVarietyRules,
): ValidationIssue[] {
  const quota = breakthroughQuota(durationS, options.override, rules);
  const planned = shots.filter((shot) => breakthroughs.has(momentOf(shot)));
  const kinds = new Set(planned.map(momentOf));
  const names = [...breakthroughs].join(', ');
  const film = `${durationS.toFixed(0)} s`;
  const issues: ValidationIssue[] = [];
  if (planned.length < quota.min) {
    issues.push(
      issue(
        'error',
        'moment-quota',
        `${String(planned.length)} breakthrough moments (${names}) in ${film}; this film needs at least ${String(quota.min)} (about one per ${String(rules.breakthroughTargetEveryS)} s): plan them where the narration calls for them (a reveal or twist → popup, a sequence of dates → strip)`,
        'shots',
      ),
    );
  } else if (planned.length > quota.max) {
    issues.push(
      issue(
        'error',
        'moment-quota',
        `${String(planned.length)} breakthrough moments in ${film}; at most ${String(quota.max)}: keep them for the strongest beats`,
        'shots',
      ),
    );
  }
  const available = Math.min(quota.kinds, breakthroughs.size);
  if (planned.length >= quota.min && kinds.size < available) {
    issues.push(
      issue(
        'error',
        'moment-variety',
        `the breakthroughs use ${String(kinds.size)} kind(s) (${[...kinds].join(', ')}); use at least ${String(available)} different ones (${names})`,
        'shots',
      ),
    );
  }
  return issues;
}

function spacingIssues(
  shots: readonly StoryboardShot[],
  breakthroughs: ReadonlySet<string>,
  rules: WorldVarietyRules,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let lastBreakthrough: number | undefined;
  const lastOfKind = new Map<string, StoryboardShot>();
  shots.forEach((shot, index) => {
    const moment = momentOf(shot);
    if (moment === PLAIN) return;
    if (breakthroughs.has(moment)) {
      const previous = lastBreakthrough === undefined ? undefined : shots[lastBreakthrough];
      if (
        lastBreakthrough !== undefined &&
        previous !== undefined &&
        index - lastBreakthrough < rules.breakthroughGapShots
      ) {
        issues.push(
          issue(
            'error',
            'moment-spacing',
            `${previous.id} and ${shot.id} are both breakthroughs; never put two in adjacent shots`,
            where(index),
          ),
        );
      }
      lastBreakthrough = index;
    }
    const earlier = lastOfKind.get(moment);
    if (earlier !== undefined && shot.t0 - earlier.t0 < rules.momentRepeatS) {
      issues.push(
        issue(
          'error',
          'moment-repeat',
          `${moment} in ${earlier.id} and again in ${shot.id} ${(shot.t0 - earlier.t0).toFixed(0)} s later; the same moment at most once per ${String(rules.momentRepeatS)} s`,
          where(index),
        ),
      );
    }
    lastOfKind.set(moment, shot);
  });
  return issues;
}

function runIssues(shots: readonly StoryboardShot[], rules: WorldVarietyRules): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const key = (shot: StoryboardShot): string => `${momentOf(shot)} / roll ${shot.roll ?? '-'}`;
  let run = 0;
  shots.forEach((shot, index) => {
    const previous = shots[index - 1];
    run = previous !== undefined && key(previous) === key(shot) ? run + 1 : 1;
    if (run === rules.maxMomentRun + 1) {
      issues.push(
        issue(
          'error',
          'moment-run',
          `${String(run)} shots in a row are ${key(shot)} (up to ${shot.id}); change the moment or the roll`,
          where(index),
        ),
      );
    }
  });
  return issues;
}

function transitionVarietyIssues(
  shots: readonly StoryboardShot[],
  durationS: number,
  options: WorldVarietyOptions,
  rules: WorldVarietyRules,
): ValidationIssue[] {
  if (durationS < rules.distinctTransitionsFromS) return [];
  const offered = options.transitions?.map((option) => option.id);
  const named = new Set(
    shots.flatMap((shot) => {
      const transition = shot.transitionIn;
      if (transition === undefined || transition.type === 'cut') return [];
      if (continuityKindOf(transition) !== undefined || transition.style === undefined) return [];
      return offered === undefined || offered.includes(transition.style) ? [transition.style] : [];
    }),
  );
  const needed = Math.min(rules.minDistinctTransitions, offered?.length ?? Infinity);
  if (named.size >= needed) return [];
  return [
    issue(
      'error',
      'transition-variety',
      `${String(named.size)} distinct page transition(s) (${[...named].join(', ') || 'none named'}); name the \`style\` of the non-cut transitions and use at least ${String(needed)} different ones`,
      'shots',
    ),
  ];
}

function continuityQuotaIssues(
  shots: readonly StoryboardShot[],
  durationS: number,
  rules: WorldVarietyRules,
): ValidationIssue[] {
  const min = continuityQuota(durationS, rules);
  const planned = shots.filter((shot, index) => index > 0 && shot.continuity !== undefined);
  if (planned.length >= min) return [];
  return [
    issue(
      'error',
      'continuity-quota',
      `${String(planned.length)} continuity link(s) in ${durationS.toFixed(0)} s; this world film needs at least ${String(min)} (the world's signature cut): add "continuity" to the second shot of a pair the narration carries across — zoom-through into a drawn object, shared-object (the same drawing stays while the page changes) or carry-environment (the same page, one drawing changes) — and name the object in both intents`,
      'shots',
    ),
  ];
}

/** The variety checks of a world's storyboard (see the module comment). */
export function checkWorldVariety(
  shots: readonly StoryboardShot[],
  options: WorldVarietyOptions,
): ValidationIssue[] {
  const rules = { ...WORLD_VARIETY_RULES, ...options.rules };
  const catalog = new Map(options.moments.map((option) => [option.id, option]));
  const breakthroughs = new Set(
    options.moments.filter((option) => option.breakthrough).map((option) => option.id),
  );
  const durationS = shots.at(-1)?.t1 ?? 0;
  return [
    ...catalogIssues(shots, catalog),
    ...(breakthroughs.size === 0
      ? []
      : quotaIssues(shots, breakthroughs, durationS, options, rules)),
    ...spacingIssues(shots, breakthroughs, rules),
    ...runIssues(shots, rules),
    ...transitionVarietyIssues(shots, durationS, options, rules),
    ...(options.continuityLinks === true ? continuityQuotaIssues(shots, durationS, rules) : []),
  ];
}
