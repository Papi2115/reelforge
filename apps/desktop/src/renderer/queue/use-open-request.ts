/**
 * What the workspace gets from the production line (PLAN.md#13.9): the line's "Needs you" items,
 * how to show a film in the Production line dialog, and a panel to open once after the dialog
 * opened a film's project ("Open script" → the script, "Add voice" → the Voiceover panel, "Review
 * photos" → the Assets dialog). Each request has a nonce, so opening the same panel again works.
 */
import { useEffect, useRef } from 'react';
import type { QueueItemRef, QueueOpenPanel } from '../../shared/queue-contract.js';
import type { CenterDocumentKind } from '../layout/CenterDocument.js';
import type { AttentionItem } from '../stages/attention-view.js';

/** Step documents the project overview can open the editor on. */
export type StepDocumentPanel = 'words' | 'storyboard' | 'scenes' | 'sound';

export interface OpenRequest {
  /**
   * `brief`: a project the New project wizard just made (its brief is saved: write the script).
   * `words` … `sound`: that step's document (the overview's "Next step", PLAN.md#13.16).
   */
  readonly panel: QueueOpenPanel | 'brief' | StepDocumentPanel;
  /** The project it is for (another project opened later ignores it). */
  readonly dir: string;
  readonly nonce: number;
}

export interface WorkspaceLine {
  readonly items: readonly AttentionItem[];
  readonly show: (ref: QueueItemRef) => void;
  readonly openRequest: OpenRequest | null;
}

export interface OpenRequestTargets {
  readonly document: (document: CenterDocumentKind) => void;
  readonly assetsDialog: () => void;
}

export function useOpenRequest(
  request: OpenRequest | null,
  dir: string,
  targets: OpenRequestTargets,
): void {
  const handled = useRef<number | null>(null);
  const latest = useRef(targets);
  latest.current = targets;
  useEffect(() => {
    if (request === null || request.dir !== dir || handled.current === request.nonce) return;
    handled.current = request.nonce;
    switch (request.panel) {
      case 'script':
        latest.current.document({ kind: 'script', tab: 'script' });
        return;
      case 'brief':
        latest.current.document({ kind: 'script', tab: 'brief' });
        return;
      case 'voiceover':
        latest.current.document({ kind: 'voiceover' });
        return;
      case 'words':
      case 'storyboard':
      case 'scenes':
      case 'sound':
        latest.current.document({ kind: request.panel });
        return;
      case 'assets':
        latest.current.assetsDialog();
        return;
      case 'project':
        return;
    }
  }, [request, dir]);
}
