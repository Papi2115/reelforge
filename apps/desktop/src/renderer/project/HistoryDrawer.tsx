/**
 * "Saved locally · git history" drawer (PLAN.md#6.2): the open project's commits, newest first,
 * with a Revert button per older entry. A revert is a new commit restoring that point (history is
 * never rewritten), so it is confirmed but not scary.
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import type { HistoryEntryInfo } from '../../shared/project-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { ConfirmDialog } from './ConfirmDialog.js';

const log = rendererLog('history');
const HISTORY_LIMIT = 100;

const KIND_LABELS: Readonly<Record<string, string>> = {
  create: 'Created',
  'pipeline-step': 'Pipeline',
  'claude-turn': 'Claude',
  manual: 'Saved',
  revert: 'Revert',
  external: 'git',
};

function changeSummary(entry: HistoryEntryInfo): string {
  const { added, modified, deleted } = entry.counts;
  const parts = [
    added > 0 ? `+${String(added)}` : '',
    modified > 0 ? `~${String(modified)}` : '',
    deleted > 0 ? `−${String(deleted)}` : '',
  ].filter((part) => part !== '');
  const total = added + modified + deleted;
  return total === 0 ? 'no file changes' : `${parts.join(' ')} ${total === 1 ? 'file' : 'files'}`;
}

export interface HistoryDrawerProps {
  readonly onClose: () => void;
  /** After a successful revert (project files changed on disk). */
  readonly onReverted: () => void;
}

export function HistoryDrawer({ onClose, onReverted }: HistoryDrawerProps): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntryInfo[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<HistoryEntryInfo | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    window.reelforge.getProjectHistory(HISTORY_LIMIT).then(
      (result) => {
        if (result.status === 'ok') {
          setEntries(result.entries);
          setError(undefined);
        } else {
          setError(result.error.message);
        }
      },
      (reason: unknown) => {
        log.error(`getProjectHistory failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      },
    );
  }, []);

  useEffect(load, [load]);

  const revert = (entry: HistoryEntryInfo): void => {
    setBusy(true);
    window.reelforge
      .revertProject(entry.hash)
      .then((result) => {
        if (result.status === 'error') {
          setError(result.error.message);
          return;
        }
        log.info(`reverted to ${entry.shortHash} (${result.status})`);
        onReverted();
        load();
      })
      .catch((reason: unknown) => {
        log.error(`revertProject failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      })
      .finally(() => {
        setBusy(false);
        setPending(undefined);
      });
  };

  return (
    <aside className="history-drawer" aria-label="History">
      <header className="history-header">
        <h2>History</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="muted history-note">
        Every step and Claude turn is saved as a git commit in the project folder.
      </p>
      {error !== undefined && (
        <p className="start-error" role="alert">
          {error}
        </p>
      )}
      {entries === undefined && error === undefined && <p className="muted">Loading…</p>}
      <ol className="history-list">
        {entries?.map((entry, index) => (
          <li key={entry.hash} className="history-entry">
            <div className="history-line">
              <span className={`history-kind kind-${entry.kind}`}>
                {KIND_LABELS[entry.kind] ?? entry.kind}
              </span>
              <span className="history-subject">{entry.subject}</span>
            </div>
            <div className="history-line muted">
              <time dateTime={entry.time}>{new Date(entry.time).toLocaleString()}</time>
              <span>{entry.shortHash}</span>
              <span>{changeSummary(entry)}</span>
              {index === 0 ? (
                <span className="history-current">current</span>
              ) : (
                <button
                  type="button"
                  className="history-revert"
                  disabled={busy}
                  onClick={() => {
                    setPending(entry);
                  }}
                >
                  Revert
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {pending && (
        <ConfirmDialog
          title="Revert project?"
          confirmLabel="Revert"
          busy={busy}
          onCancel={() => {
            setPending(undefined);
          }}
          onConfirm={() => {
            revert(pending);
          }}
        >
          <p>
            Restore every project file to “{pending.subject}” ({pending.shortHash})?
          </p>
          <p className="muted">
            This adds a new commit; nothing is deleted from the history, and unsaved changes are
            saved first. Audio and exports are not affected.
          </p>
        </ConfirmDialog>
      )}
    </aside>
  );
}
