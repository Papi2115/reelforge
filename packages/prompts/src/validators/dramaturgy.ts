/**
 * Dramaturgy checks of the storyboard turn (PLAN.md#12.25–12.26, ADR-020).
 * Pattern interrupts (`shot.interrupt`, switch on): not in the first 5 s (error), at least 15 s
 * apart (error), a kind the look pair allows (error), `enter-screen` realised by a `crt-zoom`
 * transition (error), a look-switch with a non-cut transition (warning), the planned density per
 * minute (warning; with a tension curve the target follows it: 1/min calm … 2/min at the peak),
 * and locked shots keep the marker they had (error).
 * Open loops (`loops.json`, switch on): schema problems and the ⚠ analysis (never closed, closed
 * without a foreshadow, closed before the opening) are warnings: the film still builds.
 */
import {
  analyzeLoops,
  DEFAULT_INTERRUPT_RULES,
  ENTER_SCREEN_STYLE,
  interruptKindProblem,
  interruptRange,
  loopsFileSchema,
  meanTension,
  shotLook,
  targetInterruptRate,
  type Interrupt,
  type InterruptRules,
  type LoopsFile,
  type StoryboardShot,
  type TensionPoint,
  type WordsFile,
} from '@reelforge/shared';
import { issue, parseJsonText, report, schemaIssues, type ValidationIssue } from './issues.js';
import type { ValidationReport } from './issues.js';

export interface InterruptCheckOptions {
  readonly rules?: Partial<InterruptRules>;
  /** Tension curve points: the planned density follows it. */
  readonly tension?: readonly TensionPoint[];
  /** Locked shot id -> the interrupt it had before this turn (undefined = none). */
  readonly locked?: ReadonlyMap<string, Interrupt | undefined>;
  /** The world cuts hard between shots (`cutsOnly`, Grim Ink): no look-change transition asked. */
  readonly cutsOnly?: boolean;
}

const TENSION_STEP_S = 10;

/** Planned-count range of the film: the general 1–2 per minute, narrowed by the curve. */
export function interruptTarget(
  durationS: number,
  tension: readonly TensionPoint[] | undefined,
  rules: InterruptRules = DEFAULT_INTERRUPT_RULES,
): { readonly min: number; readonly max: number } {
  const range = interruptRange(durationS, rules);
  if (tension === undefined || tension.length < 2) return range;
  let expected = 0;
  for (let t = 0; t < durationS; t += TENSION_STEP_S) {
    const end = Math.min(durationS, t + TENSION_STEP_S);
    expected += (targetInterruptRate(meanTension(tension, t, end), rules) * (end - t)) / 60;
  }
  return {
    min: Math.max(range.min, Math.floor(expected * 0.7)),
    max: Math.min(range.max, Math.max(1, Math.ceil(expected * 1.3))),
  };
}

const same = (left: Interrupt | undefined, right: Interrupt | undefined): boolean =>
  left?.kind === right?.kind && left?.note === right?.note;

function shotIssues(
  shot: StoryboardShot,
  previous: StoryboardShot | undefined,
  where: string,
  cutsOnly: boolean,
): ValidationIssue[] {
  const interrupt = shot.interrupt;
  if (interrupt === undefined) return [];
  const issues: ValidationIssue[] = [];
  const problem = interruptKindProblem(interrupt.kind, {
    from: previous === undefined ? undefined : shotLook(previous),
    to: shotLook(shot),
  });
  if (problem !== undefined) {
    issues.push(issue('error', 'interrupt-kind', `${shot.id}: ${problem}`, where));
  }
  const transition = shot.transitionIn;
  const style = transition?.type === 'cut' ? undefined : transition?.style;
  if (interrupt.kind === 'enter-screen' && problem === undefined && style !== ENTER_SCREEN_STYLE) {
    issues.push(
      issue(
        'error',
        'interrupt-transition',
        `${shot.id}: enter-screen needs \`transitionIn\` { "type": "glitch", "duration": 0.7, "style": "${ENTER_SCREEN_STYLE}" }`,
        where,
      ),
    );
  }
  const plainCut = transition === undefined || transition.type === 'cut';
  if (interrupt.kind === 'look-switch' && plainCut && !cutsOnly) {
    issues.push(
      issue(
        'warning',
        'interrupt-transition',
        `${shot.id}: a look-switch reads better with a look-change transition than a plain cut`,
        where,
      ),
    );
  }
  return issues;
}

/** Rule checks of the planned interrupts (see the module comment). */
export function checkInterrupts(
  shots: readonly StoryboardShot[],
  options: InterruptCheckOptions = {},
): ValidationIssue[] {
  const rules = { ...DEFAULT_INTERRUPT_RULES, ...options.rules };
  const issues: ValidationIssue[] = [];
  let last: StoryboardShot | undefined;
  shots.forEach((shot, index) => {
    const where = `shots[${String(index)}].interrupt`;
    if (options.locked?.has(shot.id) === true) {
      if (!same(options.locked.get(shot.id), shot.interrupt)) {
        issues.push(
          issue(
            'error',
            'interrupt-locked',
            `${shot.id} is locked: keep its interrupt marker as it was`,
            where,
          ),
        );
      }
    }
    if (shot.interrupt === undefined) return;
    if (shot.t0 < rules.firstAllowedS) {
      issues.push(
        issue(
          'error',
          'interrupt-too-early',
          `${shot.id}: no interrupt in the first ${String(rules.firstAllowedS)} s (the hook lands first)`,
          where,
        ),
      );
    }
    if (last !== undefined && shot.t0 - last.t0 < rules.minSpacingS) {
      issues.push(
        issue(
          'error',
          'interrupt-spacing',
          `${shot.id}: interrupts must be at least ${String(rules.minSpacingS)} s apart (${last.id} is ${(shot.t0 - last.t0).toFixed(1)} s before)`,
          where,
        ),
      );
    }
    issues.push(...shotIssues(shot, shots[index - 1], where, options.cutsOnly === true));
    last = shot;
  });
  const durationS = shots.at(-1)?.t1 ?? 0;
  const count = shots.filter((shot) => shot.interrupt !== undefined).length;
  const range = interruptTarget(durationS, options.tension, rules);
  if (count < range.min || count > range.max) {
    issues.push(
      issue(
        'warning',
        'interrupt-density',
        `${String(count)} interrupts planned; this film should have ${String(range.min)}–${String(range.max)} (${String(rules.minPerMinute)}–${String(rules.maxPerMinute)} per minute)`,
      ),
    );
  }
  return issues;
}

export interface LoopsCheckOptions {
  readonly shots?: readonly Pick<StoryboardShot, 'id' | 't0' | 't1'>[];
  readonly words?: WordsFile;
}

/** `loops.json` text -> schema problems and ⚠ analysis, all warnings (code `loop-*`). */
export function validateLoops(
  text: string,
  options: LoopsCheckOptions = {},
): ValidationReport<LoopsFile> {
  const json = parseJsonText(text);
  if (!json.parsed) {
    return report<LoopsFile>(
      undefined,
      json.issues.map((entry) => ({ ...entry, severity: 'warning' as const })),
    );
  }
  const parsed = loopsFileSchema.safeParse(json.value);
  if (!parsed.success) {
    return report<LoopsFile>(
      undefined,
      schemaIssues(parsed.error).map((entry) => ({
        ...entry,
        severity: 'warning' as const,
        message: `loops.json: ${entry.message}`,
      })),
    );
  }
  const warnings = analyzeLoops(parsed.data, {
    ...(options.shots === undefined ? {} : { shots: options.shots }),
    ...(options.words === undefined ? {} : { words: options.words.words }),
  });
  return report(parsed.data, [
    ...json.issues,
    ...warnings.map((warning) => issue('warning', warning.code, warning.message)),
  ]);
}
