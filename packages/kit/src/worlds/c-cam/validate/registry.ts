/**
 * The rule registry: every validator with its category, severity, kind and the thresholds it
 * uses (values in thresholds.ts; sources in that file's comments).
 *
 * Public API: `RuleSpec`, `RULES`, `ruleSpec`.
 */
import type { RuleContext } from './context.js';
import {
  faceAnchorOffHead,
  shoulderAboveChin,
  shoulderAboveOpenChin,
  shoulderOutsideTorso,
} from './rules-anchors.js';
import { noSignatureGag } from './rules-acting.js';
import { contactMiss } from './rules-contact.js';
import { figurePieces, headPieces } from './rules-head.js';
import {
  armAcrossFace,
  elbowFlip,
  guardOutOfReach,
  handInHead,
  outOfReach,
} from './rules-tangle.js';
import type { RuleCategory, RuleCode, RuleKind, Severity } from './types.js';

export interface RuleSpec {
  readonly code: RuleCode;
  readonly category: RuleCategory;
  readonly severity: Severity;
  readonly kind: RuleKind;
  /** What is checked and with which thresholds (human readable). */
  readonly summary: string;
  readonly run: (ctx: RuleContext) => void;
}

export const RULES: readonly RuleSpec[] = [
  {
    code: 'shoulder-outside-torso',
    category: 'anchors',
    severity: 'error',
    kind: 'geometry',
    summary: 'each shoulder anchor lies inside the torso drawing of its view (0 px tolerance)',
    run: shoulderOutsideTorso,
  },
  {
    code: 'shoulder-above-chin',
    category: 'anchors',
    severity: 'error',
    kind: 'geometry',
    summary: 'shoulders >= D.neckGap (default 6 px) below the measured chin, jaw shut',
    run: shoulderAboveChin,
  },
  {
    code: 'shoulder-above-open-chin',
    category: 'anchors',
    severity: 'warn',
    kind: 'geometry',
    summary:
      'shoulders >= D.neckGap (default 6 px) below the measured chin, jaw fully open (jaw 1)',
    run: shoulderAboveOpenChin,
  },
  {
    code: 'face-anchor-off-head',
    category: 'anchors',
    severity: 'error',
    kind: 'geometry',
    summary: 'each face anchor <= 4 px from the head ink (jaw shut)',
    run: faceAnchorOffHead,
  },
  {
    code: 'head-pieces',
    category: 'head',
    severity: 'error',
    kind: 'raster',
    summary:
      'each head view x expression (own jaw and jaw 1) is 1 piece (pieces >= 6 px) with 0 holes (holes >= 20 px)',
    run: headPieces,
  },
  {
    code: 'figure-pieces',
    category: 'head',
    severity: 'error',
    kind: 'raster',
    summary: 'each figure (view x pose, rasterized 520 px tall) is 1 piece (pieces >= 6 px)',
    run: figurePieces,
  },
  {
    code: 'hand-in-head',
    category: 'tangle',
    severity: 'error',
    kind: 'geometry',
    summary:
      'no palm (radius 0.35 hand) inside the measured head box (jaw shut), every view x pose x sweep frame',
    run: handInHead,
  },
  {
    code: 'arm-across-face',
    category: 'tangle',
    severity: 'error',
    kind: 'geometry',
    summary: 'no front arm (layer 2) crosses the head box shrunk 15% per side',
    run: armAcrossFace,
  },
  {
    code: 'out-of-reach',
    category: 'tangle',
    severity: 'error',
    kind: 'geometry',
    summary: 'pose targets overshoot the arm by <= 8% of its length',
    run: outOfReach,
  },
  {
    code: 'guard-out-of-reach',
    category: 'tangle',
    severity: 'warn',
    kind: 'geometry',
    summary: 'targets moved by the face guard overshoot the arm by <= 8% of its length',
    run: guardOutOfReach,
  },
  {
    code: 'elbow-flip',
    category: 'tangle',
    severity: 'error',
    kind: 'geometry',
    summary:
      'along 24-frame sweeps no elbow changes side (|cross| > 0.12 len^2 both frames) while the wrist moves < 0.5 len',
    run: elbowFlip,
  },
  {
    code: 'contact-miss',
    category: 'contact',
    severity: 'error',
    kind: 'geometry',
    summary:
      'handshake palms and palm-on-object goals within reach (0.9 arm + 0.5 hand) meet: palm on object <= 4 px, handshake gap <= 4 px x max(1, scale)',
    run: contactMiss,
  },
  {
    code: 'no-signature-gag',
    category: 'acting',
    severity: 'warn',
    kind: 'geometry',
    summary: 'the person states its one recurring tic: signatureGag { kind (a gag kind), note }',
    run: noSignatureGag,
  },
];

export function ruleSpec(code: RuleCode): RuleSpec {
  const spec = RULES.find((r) => r.code === code);
  if (!spec) throw new RangeError(`unknown validator rule: ${code}`);
  return spec;
}
