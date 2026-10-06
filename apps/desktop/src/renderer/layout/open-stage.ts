/**
 * What opening a pipeline step does in the workspace (PLAN.md#6.3): its document under / beside
 * the preview, the export or assets dialog, or the Shots panel brought into view (Storyboard).
 */
import type { OpenTarget } from '../stages/pipeline-view.js';
import type { CenterDocumentKind } from './CenterDocument.js';

export interface StageOpeners {
  readonly document: (document: CenterDocumentKind) => void;
  readonly exportDialog: () => void;
  readonly assetsDialog: () => void;
}

/** Brings the Shots panel into view (Open of the Storyboard stage). */
function focusShots(): void {
  const panel = document.querySelector<HTMLElement>('[aria-label="Shots"]');
  const target = panel?.querySelector<HTMLElement>('button') ?? panel;
  target?.scrollIntoView({ block: 'nearest' });
  target?.focus();
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
