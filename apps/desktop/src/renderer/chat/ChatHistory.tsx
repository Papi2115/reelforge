/**
 * History tab of the chat (PLAN.md#6.6): the project's past Claude turns as recorded in git (the
 * `claude-turn` autocommits), newest first, with the files each changed. Reverting lives in the
 * "Saved locally · git history" drawer.
 */
import { useEffect, useState, type JSX } from 'react';
import type { HistoryEntryInfo } from '../../shared/project-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('chat-history');
const HISTORY_LIMIT = 300;

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export interface ChatHistoryProps {
  /** Changes when a turn finished: the list is read again. */
  readonly refreshKey: string;
}

export function ChatHistory({ refreshKey }: ChatHistoryProps): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntryInfo[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    window.reelforge.getProjectHistory(HISTORY_LIMIT).then(
      (result) => {
        if (!active) return;
        if (result.status === 'ok') {
          setEntries(result.entries.filter((entry) => entry.kind === 'claude-turn'));
          setError(undefined);
        } else {
          setError(result.error.message);
        }
      },
      (reason: unknown) => {
        log.error(`getProjectHistory failed: ${errorMessage(reason)}`);
        if (active) setError(errorMessage(reason));
      },
    );
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (error !== undefined) return <p className="panel-empty panel-error">{error}</p>;
  if (entries === undefined) return <p className="panel-empty">Loading…</p>;
  if (entries.length === 0) {
    return <p className="panel-empty">No Claude turns have changed this project yet.</p>;
  }
  return (
    <ol className="chat-history" aria-label="Past Claude turns">
      {entries.map((entry) => (
        <li key={entry.hash} className="chat-history-entry">
          <p className="chat-history-subject">{entry.subject.replace(/^Claude turn:\s*/, '')}</p>
          <p className="muted chat-history-meta">
            <span className="mono">{entry.shortHash}</span> · {when(entry.time)} ·{' '}
            {entry.files.length} {entry.files.length === 1 ? 'file' : 'files'}
          </p>
          {entry.files.length > 0 && (
            <p
              className="muted mono chat-history-files"
              title={entry.files.map((file) => file.path).join('\n')}
            >
              {entry.files
                .slice(0, 4)
                .map((file) => file.path)
                .join(', ')}
              {entry.files.length > 4 ? ' …' : ''}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
