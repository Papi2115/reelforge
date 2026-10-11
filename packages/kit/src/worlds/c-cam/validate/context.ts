/**
 * The state one validation run shares between rules: the character, the grid (views, poses), a
 * cache of the measured heads and torsos, and the collector for findings, check counts and
 * metrics (c-plus `validate.js` `collector`).
 *
 * Public API: `RuleContext`, `Emit`, `Collector`, `createContext`, `viewIndices`, `fmt`, `str`.
 */
import type { Character } from '../draw/character.js';
import { viewState, type ViewIndex } from '../draw/rig-views.js';
import { measureHead, torsoShapes, type HeadMeasure } from './measure.js';
import type { Shape } from './shape-paint.js';
import { TEST_POSES, TEST_SWEEPS, VALIDATE_YAWS } from './thresholds.js';
import type { Finding, PoseCase, RuleCode, Severity, SweepCase, ValidateOptions } from './types.js';

/** A finding without its severity (the registry adds it). */
export type Emit = Omit<Finding, 'severity'>;

export interface RuleContext {
  readonly character: Character;
  readonly partner: Character;
  readonly views: readonly number[];
  readonly poses: readonly PoseCase[];
  readonly sweeps: readonly SweepCase[];
  head(v: ViewIndex): HeadMeasure;
  torso(v: ViewIndex): readonly Shape[];
  /** Counts one check of the current rule. */
  check(): void;
  /** Reports a failed check of the current rule. */
  fail(f: Omit<Emit, 'code'>): void;
  /** Records an extreme (max by default, min when `min`). */
  metric(name: string, value: number, min?: boolean): void;
}

/** One finding per distinct view index, in the order of first appearance (yaws 1 and -1 -> 1). */
export function viewIndices(views: readonly number[]): readonly ViewIndex[] {
  const out: ViewIndex[] = [];
  for (const yaw of views) {
    const v = viewState(yaw).v;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Fixed-precision number for messages (deterministic, no locale). */
export const fmt = (n: number, digits = 1): string => n.toFixed(digits);

/** A number as written in the character data (`-540`, `0.72`). */
export const str = (n: number): string => String(n);

export interface Collector {
  readonly findings: Finding[];
  readonly checks: Partial<Record<RuleCode, number>>;
  readonly metrics: Record<string, number>;
}

export function createContext(
  character: Character,
  options: ValidateOptions,
  collector: Collector,
  current: () => { code: RuleCode; severity: Severity },
): RuleContext {
  const heads = new Map<ViewIndex, HeadMeasure>();
  const torsos = new Map<ViewIndex, readonly Shape[]>();
  return {
    character,
    partner: options.partner ?? character,
    views: options.views ?? VALIDATE_YAWS,
    poses: options.poses ?? TEST_POSES,
    sweeps: options.sweeps ?? TEST_SWEEPS,
    head(v) {
      const cached = heads.get(v);
      if (cached) return cached;
      const m = measureHead(character, v);
      heads.set(v, m);
      return m;
    },
    torso(v) {
      const cached = torsos.get(v);
      if (cached) return cached;
      const t = torsoShapes(character, v);
      torsos.set(v, t);
      return t;
    },
    check() {
      const { code } = current();
      collector.checks[code] = (collector.checks[code] ?? 0) + 1;
    },
    fail(f) {
      const { code, severity } = current();
      collector.findings.push({ code, severity, ...f });
    },
    metric(name, value, min = false) {
      const prev = collector.metrics[name];
      collector.metrics[name] =
        prev === undefined ? value : min ? Math.min(prev, value) : Math.max(prev, value);
    },
  };
}
