/**
 * C-CAM character validators (PLAN.md#14.13): shared types. A rule checks one property of a
 * character on the rig (anchors, head coherence, tangle, contact) and reports `Finding`s; the
 * registry (registry.ts) lists every rule with its severity and documented thresholds.
 *
 * Public API: `Severity`, `RuleCategory`, `RuleKind`, `RuleCode`, `RULE_CODES`, `Finding`,
 * `PoseCase`, `SweepCase`, `ValidateOptions`, `ValidationReport`.
 */
import type { Character } from '../draw/character.js';
import type { BodyDims, Pose } from '../draw/poses.js';

/** `error` = the character is broken; `warn` = likely visible in some shots, check the sheet. */
export type Severity = 'error' | 'warn';

export type RuleCategory = 'anchors' | 'head' | 'tangle' | 'contact';

/** `geometry` = measured on the rig and on recorded paths; `raster` = needs a CPU raster. */
export type RuleKind = 'geometry' | 'raster';

export const RULE_CODES = [
  'shoulder-outside-torso',
  'shoulder-above-chin',
  'shoulder-above-open-chin',
  'face-anchor-off-head',
  'head-pieces',
  'figure-pieces',
  'hand-in-head',
  'arm-across-face',
  'out-of-reach',
  'guard-out-of-reach',
  'elbow-flip',
  'contact-miss',
] as const;

export type RuleCode = (typeof RULE_CODES)[number];

/** One problem found. */
export interface Finding {
  readonly code: RuleCode;
  readonly severity: Severity;
  /** Signed ring yaw of the figure (negative = mirrored), or null when the rule is view-free. */
  readonly view: number | null;
  /** Pose case name (`stand`, `jig 6/24`, `handshake ...`), or null when the rule is pose-free. */
  readonly pose: string | null;
  readonly message: string;
  /** A concrete fix hint (which field to change and by how much). */
  readonly fix: string;
  /** The measured value and the limit it broke (px or a fraction, as the message says). */
  readonly measured: number;
  readonly limit: number;
}

/** A named pose of the test grid, built from the character's own dimensions. */
export interface PoseCase {
  readonly name: string;
  readonly pose: (D: BodyDims) => Pose;
}

/** A phase-driven pose (`ph` in [0, 1]) swept frame by frame. */
export interface SweepCase {
  readonly name: string;
  readonly pose: (D: BodyDims, ph: number) => Pose;
}

export interface ValidateOptions {
  /** Ring yaws to check (default `VALIDATE_YAWS`: every view, plain and mirrored). */
  readonly views?: readonly number[];
  /** Static pose cases (default `TEST_POSES`). */
  readonly poses?: readonly PoseCase[];
  /** Phase sweeps (default `TEST_SWEEPS`: jig, flail, walk, stomp). */
  readonly sweeps?: readonly SweepCase[];
  /** Only these rules (default: all). */
  readonly rules?: readonly RuleCode[];
  /** Run the raster rules (`head-pieces`, `figure-pieces`); default true. */
  readonly raster?: boolean;
  /** Handshake partner for `contact-miss` (default: the character itself). */
  readonly partner?: Character;
}

export interface ValidationReport {
  /** No `error` findings. */
  readonly ok: boolean;
  readonly findings: readonly Finding[];
  /** Number of checks run per rule. */
  readonly checks: Readonly<Partial<Record<RuleCode, number>>>;
  /** Extremes seen while checking (e.g. `min shoulder clearance below chin px`), for tuning. */
  readonly metrics: Readonly<Record<string, number>>;
}
