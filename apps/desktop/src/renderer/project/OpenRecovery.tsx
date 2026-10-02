/**
 * Start screen companion (PLAN.md#10.2): when opening a project failed on a damaged project.json,
 * main pushes the failure; this offers "Restore from history" (the last good project.json comes
 * back as a new commit) and opens the project once restored.
 */
import { useEffect, useState, type JSX } from 'react';
import type { ProjectOpenFailure, ProjectSummary } from '../../shared/project-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('recovery');

export interface OpenRecoveryProps {
  readonly onOpened: (project: ProjectSummary) => void;
}

export function OpenRecovery({ onOpened }: OpenRecoveryProps): JSX.Element | null {
  const [failure, setFailure] = useState<ProjectOpenFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(
    () =>
      window.reelforge.onProjectOpenFailed((next) => {
        setFailure(next);
        setError(undefined);
      }),
    [],
  );

  if (failure === null) return null;

  const restore = (): void => {
    setBusy(true);
    setError(undefined);
    window.reelforge
      .restoreFailedOpen()
      .then((result) => {
        if (result.status === 'opened') {
          setFailure(null);
          onOpened(result.project);
        } else if (result.status === 'error') {
          setError(result.error.message);
        }
      })
      .catch((reason: unknown) => {
        log.error(`restore failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <section className="banner open-recovery" aria-label="Damaged project file" role="alert">
      <p className="panel-error">{failure.message}</p>
      <p className="muted file-problem-path">{failure.file}</p>
      {failure.canRestore ? (
        <button type="button" className="primary" disabled={busy} onClick={restore}>
          Restore from history
        </button>
      ) : (
        <p className="muted">This folder has no history to restore project.json from.</p>
      )}
      <button
        type="button"
        className="link-button"
        disabled={busy}
        onClick={() => {
          setFailure(null);
        }}
      >
        Dismiss
      </button>
      {error !== undefined && <p className="panel-error">{error}</p>}
    </section>
  );
}
