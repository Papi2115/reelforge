/**
 * Tension map (PLAN.md#12.22, ADR-017): `tension.json` as the tension turn writes it (schema,
 * the curve covers the narration, has contrast and a sensible number of points), and the
 * `tension-tempo` check of a storyboard against the curve: a hard error only for gross
 * violations (a high-tension segment whose shots are much longer than its target, a calm one
 * whose shots are much shorter), otherwise warnings.
 */
import {
  CALM_BELOW,
  cutTempoReport,
  HIGH_TENSION,
  STANDARD_TEMPO,
  tensionFileSchema,
  type ShotTempo,
  type StoryboardShot,
  type TensionFile,
} from '@reelforge/shared';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export interface TensionRules {
  /** First point at most this far from 0 / last point at most this far from the end (s). */
  readonly edgeToleranceS: number;
  /** Fewer points = warning. */
  readonly minPoints: number;
  /** Max - min below this = warning (a flat curve steers nothing). */
  readonly minRange: number;
}

export const DEFAULT_TENSION_RULES: TensionRules = {
  edgeToleranceS: 2,
  minPoints: 4,
  minRange: 0.2,
};

export interface TensionCheckOptions {
  /** Length of the narration (s): the curve must cover it. */
  readonly durationS: number;
  readonly rules?: Partial<TensionRules>;
}

/** Rule checks of an already parsed curve. */
export function checkTension(file: TensionFile, options: TensionCheckOptions): ValidationIssue[] {
  const rules = { ...DEFAULT_TENSION_RULES, ...options.rules };
  const issues: ValidationIssue[] = [];
  const first = file.points[0];
  const last = file.points.at(-1);
  if (first !== undefined && first.t > rules.edgeToleranceS) {
    issues.push(
      issue(
        'error',
        'tension-coverage',
        `the first point is at ${String(first.t)} s, not 0`,
        'points[0].t',
      ),
    );
  }
  if (last !== undefined && last.t < options.durationS - rules.edgeToleranceS) {
    issues.push(
      issue(
        'error',
        'tension-coverage',
        `the last point is at ${String(last.t)} s but the narration lasts ${options.durationS.toFixed(1)} s`,
        `points[${String(file.points.length - 1)}].t`,
      ),
    );
  }
  if (file.points.length < rules.minPoints) {
    issues.push(
      issue(
        'warning',
        'tension-points',
        `only ${String(file.points.length)} points: mark where the story changes`,
      ),
    );
  }
  const values = file.points.map((point) => point.v);
  if (Math.max(...values) - Math.min(...values) < rules.minRange) {
    issues.push(
      issue(
        'warning',
        'tension-flat',
        'the curve is almost flat: give the film a peak and calm stretches',
      ),
    );
  }
  (file.segments ?? []).forEach((segment, index) => {
    if (segment.from > options.durationS + rules.edgeToleranceS) {
      issues.push(
        issue(
          'warning',
          'tension-segment',
          `segment ${segment.kind} starts after the narration ends`,
          `segments[${String(index)}]`,
        ),
      );
    }
  });
  return issues;
}

/** `tension.json` text -> schema + rule checks. */
export function validateTension(
  text: string,
  options: TensionCheckOptions,
): ValidationReport<TensionFile> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<TensionFile>(undefined, json.issues);
  const parsed = tensionFileSchema.safeParse(json.value);
  if (!parsed.success) {
    return report<TensionFile>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  }
  return report(parsed.data, [...json.issues, ...checkTension(parsed.data, options)]);
}

export interface TensionTempoRules {
  /** High-tension segment: mean shot length above target x this = error. */
  readonly highMaxRatio: number;
  /** Calm segment: mean shot length below target x this = error. */
  readonly calmMinRatio: number;
  /** Outside [1 / warnRatio, warnRatio] of the target = warning. */
  readonly warnRatio: number;
  /** Segments with fewer shots (or shorter than minSegmentS) only ever warn. */
  readonly minShots: number;
  readonly minSegmentS: number;
}

export const DEFAULT_TENSION_TEMPO_RULES: TensionTempoRules = {
  highMaxRatio: 1.6,
  calmMinRatio: 0.6,
  warnRatio: 1.35,
  minShots: 2,
  minSegmentS: 10,
};

const fmt = (seconds: number): string => seconds.toFixed(1);

/** `tension-tempo`: the storyboard's cut tempo per segment of the curve (cutTempoReport). */
export function checkTensionTempo(
  shots: readonly StoryboardShot[],
  tension: Pick<TensionFile, 'points' | 'segments'>,
  rules: Partial<TensionTempoRules> = {},
  tempo: ShotTempo = STANDARD_TEMPO,
): ValidationIssue[] {
  const limits = { ...DEFAULT_TENSION_TEMPO_RULES, ...rules };
  const report = cutTempoReport(shots, tension, undefined, tempo);
  return report.segments.flatMap((segment): ValidationIssue[] => {
    if (segment.shotIds.length === 0) return [];
    const where = `${fmt(segment.from)}–${fmt(segment.to)} s (${segment.kind}, tension ${segment.mean.toFixed(2)})`;
    const measured = `shots last ${fmt(segment.meanShotS)} s on average, target ~${fmt(segment.targetS)} s`;
    const decisive =
      segment.shotIds.length >= limits.minShots && segment.to - segment.from >= limits.minSegmentS;
    const tooSlow = segment.mean >= HIGH_TENSION && segment.ratio > limits.highMaxRatio;
    const tooFast = segment.mean <= CALM_BELOW && segment.ratio < limits.calmMinRatio;
    if (decisive && tooSlow) {
      return [
        issue('error', 'tension-tempo', `${where}: ${measured}; cut faster here (split shots)`),
      ];
    }
    if (decisive && tooFast) {
      return [
        issue(
          'error',
          'tension-tempo',
          `${where}: ${measured}; let the calm breathe (merge shots)`,
        ),
      ];
    }
    if (segment.ratio > limits.warnRatio || segment.ratio < 1 / limits.warnRatio) {
      return [issue('warning', 'tension-tempo', `${where}: ${measured}`)];
    }
    return [];
  });
}
