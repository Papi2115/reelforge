/**
 * View model of the Editing section (PLAN.md#12.21, #12.23), pure: the beat-sync line ("Beat
 * sync ✓ 94 % of cuts on the beat · whooshes 100 %"), the repetition summary and one row per
 * repetition with what Apply would do, where to seek and whether Apply / Ignore are possible.
 */
import type { BeatSyncReport, RepetitionItem, RepetitionsFile } from '@reelforge/shared';
import type { EditingState } from '../../shared/editing-contract.js';

type OkState = Extract<EditingState, { status: 'ok' }>;

/** Shown when a switch is on (else the project behaves as before 2.2: nothing to show). */
export function editingVisible(state: EditingState | undefined): state is OkState {
  return (
    state?.status === 'ok' &&
    (state.switches.beatSync === 'auto' || state.switches.repetitionControl === 'auto')
  );
}

const percent = (value: number): string => `${String(Math.round(value * 100))} %`;

export function beatSyncLine(report: BeatSyncReport | null): string {
  if (report === null)
    return 'Beat sync: not measured yet (runs with the Storyboard and Sound cues).';
  const parts = [`${percent(report.cuts.fraction)} of cuts on the beat (±1 frame)`];
  if (report.whooshes !== undefined && report.whooshes.total > 0) {
    parts.push(`whooshes ${percent(report.whooshes.fraction)}`);
  }
  const nudges = report.nudges;
  if (nudges?.reverted === true) parts.push('snapping undone (the storyboard would not validate)');
  else if (nudges !== undefined && nudges.moved > 0) {
    parts.push(`${String(nudges.moved)} cuts moved (≤ ${String(Math.round(nudges.maxMs))} ms)`);
  }
  if (nudges !== undefined && nudges.locked > 0)
    parts.push(`${String(nudges.locked)} by locked shots`);
  return `Beat sync ${report.ok ? '✓' : '⚠'} ${parts.join(' · ')}`;
}

const KIND_LABELS: Readonly<Record<RepetitionItem['kind'], string>> = {
  visual: 'Visual',
  template: 'Template',
  transition: 'Transition',
  sfx: 'Sound',
  phrase: 'Phrase',
};

const APPLY_LABELS: Readonly<Record<RepetitionItem['action'], string>> = {
  sfx: 'Swap sound',
  transition: 'Re-pick transition',
  variant: 'Build variants',
  none: '',
};

export function repetitionSummary(file: RepetitionsFile | null): string {
  if (file === null) return 'Repetition: not analysed yet (runs with the final review).';
  if (file.items.length === 0) return 'Repetition ✓ nothing repeats too often';
  const open = file.items.filter((entry) => entry.status === 'open');
  const kinds = (['visual', 'template', 'transition', 'sfx', 'phrase'] as const)
    .map((kind) => [kind, open.filter((entry) => entry.kind === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${String(count)} ${KIND_LABELS[kind].toLowerCase()}`);
  return open.length === 0
    ? `Repetition ✓ ${String(file.items.length)} handled`
    : `Repetition ⚠ ${String(open.length)} open: ${kinds.join(', ')}`;
}

export interface RepetitionRow {
  readonly id: string;
  readonly kind: string;
  readonly symbol: '⚠' | 'ℹ' | '✓';
  readonly text: string;
  /** "applied" / "ignored" / "locked" / "report only" / what Apply would change. */
  readonly detail: string;
  readonly applyLabel: string | null;
  readonly canApply: boolean;
  readonly ignored: boolean;
  /** Seek target: the first occurrence. */
  readonly shotId: string | null;
  readonly t: number;
}

function detailOf(item: RepetitionItem): string {
  if (item.status === 'applied') return 'applied';
  if (item.status === 'ignored') return 'ignored';
  if (item.action === 'none') return 'report only';
  if (item.locked) return 'locked shots: nothing to change';
  if (item.changes.length === 0) return 'no replacement found';
  if (item.action === 'variant') {
    return `variants for ${item.changes.map((change) => change.target).join(', ')}`;
  }
  const swaps = [...new Set(item.changes.map((change) => `${change.from} → ${change.to}`))];
  return `${swaps.join(', ')} (${String(item.changes.length)})`;
}

export function repetitionRows(file: RepetitionsFile | null): RepetitionRow[] {
  return (file?.items ?? []).map((item) => {
    const first = item.occurrences[0];
    const canApply = item.status === 'open' && item.action !== 'none' && item.changes.length > 0;
    return {
      id: item.id,
      kind: KIND_LABELS[item.kind],
      symbol: item.status === 'open' ? (item.severity === 'warning' ? '⚠' : 'ℹ') : '✓',
      text: item.text,
      detail: detailOf(item),
      applyLabel: item.action === 'none' ? null : APPLY_LABELS[item.action],
      canApply,
      ignored: item.status === 'ignored',
      shotId: first?.shotId ?? null,
      t: first?.t ?? 0,
    };
  });
}
