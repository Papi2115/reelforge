/**
 * View model of the Dramaturgy section (PLAN.md#12.25–12.27) under the final review: the pattern
 * interrupts planned vs realised per minute, the open-loop ⚠ warnings and the reveal-moment rows
 * (Accept / Reject / Preview; a locked shot's moment shows disabled). Pure.
 */
import type { DramaturgyReport, MomentKind, MomentStatus } from '@reelforge/shared';
import type { DramaturgyState, MomentView } from '../../shared/dramaturgy-contract.js';

type OkState = Extract<DramaturgyState, { status: 'ok' }>;

/** The section shows only when at least one dramaturgy switch is on. */
export function dramaturgyVisible(state: DramaturgyState | undefined): state is OkState {
  if (state?.status !== 'ok') return false;
  const { switches } = state;
  return (
    switches.patternInterrupts === 'auto' ||
    switches.openLoops === 'auto' ||
    switches.revealMoments === 'auto'
  );
}

const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
};

/** "4 planned, 3 in the frames (0:00 2/2 · 1:00 1/2)", or why there is no line. */
export function interruptLine(report: DramaturgyReport | null): string {
  const interrupts = report?.interrupts;
  if (interrupts === undefined)
    return 'No interrupt report yet: run Storyboard or the final review.';
  if (interrupts.planned === 0) {
    return `No interrupts planned (this length wants ${String(interrupts.range.min)}–${String(interrupts.range.max)}).`;
  }
  const minutes = interrupts.perMinute
    .map(
      (entry) => `${clock(entry.minute * 60)} ${String(entry.realised)}/${String(entry.planned)}`,
    )
    .join(' · ');
  const realised =
    report?.source === 'final-review'
      ? `${String(interrupts.realised)} in the frames`
      : 'not built yet';
  return `${String(interrupts.planned)} planned, ${realised} (${minutes})`;
}

export interface InterruptRow {
  readonly shotId: string;
  readonly t: number;
  readonly symbol: '✓' | '⚠' | '·';
  readonly text: string;
}

export function interruptRows(report: DramaturgyReport | null): InterruptRow[] {
  const built = report?.source === 'final-review';
  return (report?.interrupts?.shots ?? []).map((entry) => ({
    shotId: entry.shotId,
    t: entry.t,
    symbol: !built ? '·' : entry.realisedBy === null ? '⚠' : '✓',
    text: `${clock(entry.t)} ${entry.kind}: ${entry.note}${entry.realisedBy === null ? '' : ` (${entry.realisedBy})`}`,
  }));
}

/** The loop warnings, or a reassuring line. */
export function loopLines(report: DramaturgyReport | null): string[] {
  const loops = report?.loops;
  if (loops === undefined) return ['No open-loop report yet: run Storyboard or the final review.'];
  if (loops.warnings.length > 0) return loops.warnings;
  return [`${String(loops.count)} open loops, all closed with a foreshadow.`];
}

const KIND_LABELS: Readonly<Record<MomentKind, string>> = {
  'silence-hit': 'Silence, then a hit',
  'palette-shift': 'Palette flash',
  'slow-motion': 'Slow motion',
};

const STATUS_LABELS: Readonly<Record<MomentStatus, string>> = {
  proposed: 'proposed',
  accepted: 'accepted',
  rejected: 'rejected',
};

export interface MomentRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly status: MomentStatus;
  readonly statusLabel: string;
  readonly shotId: string;
  /** Where Preview seeks: a little before the effect. */
  readonly seekT: number;
  readonly canAccept: boolean;
  readonly canReject: boolean;
  /** Tooltip of a disabled Accept. */
  readonly acceptNote: string | null;
}

export function momentRows(moments: readonly MomentView[]): MomentRow[] {
  return moments.map(({ moment, locked }) => {
    const applies =
      moment.kind === 'silence-hit'
        ? 'applies at the next Sound design mix'
        : 'shows in the preview and the export';
    const camera = moment.cameraHint === undefined ? '' : ` · camera idea: ${moment.cameraHint}`;
    return {
      id: moment.id,
      title: `${KIND_LABELS[moment.kind]} on “${moment.word}” · ${clock(moment.at)} · ${moment.shotId}`,
      detail: `Tension ${moment.tension.toFixed(2)} · ${(moment.to - moment.from).toFixed(2)} s · ${applies}${camera}`,
      status: moment.status,
      statusLabel: STATUS_LABELS[moment.status],
      shotId: moment.shotId,
      seekT: Math.max(0, moment.from - 1),
      canAccept: moment.status !== 'accepted' && !locked,
      canReject: moment.status !== 'rejected',
      acceptNote: locked ? `${moment.shotId} is locked: unlock it to accept` : null,
    };
  });
}

/** Refresh key of the section: changes when a review, a sync check or the storyboard changes. */
export function dramaturgyKey(parts: readonly (string | number | undefined | null)[]): string {
  return parts.map((part) => String(part ?? '')).join('|');
}
