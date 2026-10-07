/**
 * What opening a pipeline step does in the workspace (PLAN.md#6.3): its document under / beside
 * the preview, the export or assets dialog, or the Shots panel brought into view (Storyboard).
 * Also where a "Needs you" item goes (stages/attention-view.ts): a step selected in the pipeline,
 * a shot, the brief, Script → Sources, a Director section or a film of the production line.
 */
import type { AttentionTarget } from '../stages/attention-view.js';
import { PIPELINE_ROWS, type OpenTarget } from '../stages/pipeline-view.js';
import type { CenterDocumentKind } from './CenterDocument.js';

export interface StageOpeners {
  readonly document: (document: CenterDocumentKind) => void;
  readonly exportDialog: () => void;
  readonly assetsDialog: () => void;
}

/** The openers a "Needs you" item can use. */
export interface AttentionOpeners extends StageOpeners {
  readonly shot: (shotId: string, t: number) => void;
  readonly director: (section: 'beats' | 'editing') => void;
  /** A film of the production line in the Production line dialog. */
  readonly line: (ref: { readonly channelId: string; readonly itemId: string }) => void;
}

/** Brings the Shots panel into view (Open of the Storyboard stage). */
function focusShots(): void {
  const panel = document.querySelector<HTMLElement>('[aria-label="Shots"]');
  const target = panel?.querySelector<HTMLElement>('button') ?? panel;
  target?.scrollIntoView({ block: 'nearest' });
  target?.focus();
}

/** Selects a step in the pipeline by focusing its row; false when the row is not shown. */
function focusStepRow(rowId: string): boolean {
  const row = document.querySelector<HTMLElement>(`[data-stage-row="${rowId}"] > button`);
  if (row === null) return false;
  row.scrollIntoView({ block: 'nearest' });
  row.focus();
  return true;
}

export function openStageTarget(
  target: Exclude<OpenTarget, { kind: 'artifact' }>,
  open: StageOpeners,
): void {
  switch (target.kind) {
    case 'script':
      open.document({ kind: 'script', tab: 'script' });
      return;
    case 'words':
    case 'voiceover':
    case 'scenes':
    case 'sound':
      open.document({ kind: target.kind });
      return;
    case 'export':
      open.exportDialog();
      return;
    case 'assets':
      open.assetsDialog();
      return;
    case 'shots':
      open.document({ kind: 'storyboard' });
      focusShots();
      return;
  }
}

export function openAttentionTarget(target: AttentionTarget, open: AttentionOpeners): void {
  switch (target.kind) {
    case 'brief':
      open.document({ kind: 'script', tab: 'brief' });
      return;
    case 'sources':
      open.document({ kind: 'script', tab: 'sources' });
      return;
    case 'open':
      openStageTarget(target.target, open);
      return;
    case 'shot':
      open.shot(target.shotId, target.t);
      return;
    case 'director':
      open.director(target.section);
      return;
    case 'line':
      open.line({ channelId: target.channelId, itemId: target.itemId });
      return;
    case 'step': {
      if (focusStepRow(target.rowId)) return;
      // The steps are hidden (folded sidebar): open the step's own panel instead.
      const spec = PIPELINE_ROWS.find((row) => row.id === target.rowId);
      if (spec !== undefined && spec.open.kind !== 'artifact') openStageTarget(spec.open, open);
      return;
    }
  }
}
