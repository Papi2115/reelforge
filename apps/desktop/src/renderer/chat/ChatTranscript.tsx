/**
 * The chat's message list (PLAN.md#6.6): every turn as the user's request (scope, model) followed
 * by Claude's step log - text, tool steps with status and frame thumbnails, errors - and a footer
 * with the outcome, the usage line and the commit that saved it. Queued messages come last, each
 * removable. Follows the bottom while Claude works unless the user scrolled up.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { ChatTurn } from '../../shared/chat-contract.js';
import { Markdown } from './Markdown.js';
import {
  requestText,
  scopeText,
  stepRow,
  turnStatusText,
  usageLine,
  type StepIcon,
  type StepRow,
  type Thumbnail,
} from './step-view.js';

const ICON_TEXT: Readonly<Record<StepIcon, string>> = {
  running: '…',
  done: '✓',
  error: '✕',
  denied: '⦸',
};

const ICON_LABEL: Readonly<Record<StepIcon, string>> = {
  running: 'running',
  done: 'done',
  error: 'failed',
  denied: 'blocked',
};

function Thumbnails({ items }: { readonly items: readonly Thumbnail[] }): JSX.Element | null {
  const [open, setOpen] = useState<Thumbnail | undefined>(undefined);
  if (items.length === 0) return null;
  return (
    <>
      <ul className="step-thumbnails" aria-label="Rendered frames">
        {items.map((item) => (
          <li key={item.path}>
            <button
              type="button"
              className="thumbnail-button"
              title={item.path}
              onClick={() => {
                setOpen(item);
              }}
            >
              <img src={item.url} alt={item.alt} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <button
          type="button"
          className="thumbnail-viewer"
          aria-label={`${open.alt}: close`}
          // The enlarged frame takes focus, so Esc closes it right away.
          autoFocus
          onClick={() => {
            setOpen(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(undefined);
          }}
        >
          <img src={open.url.replace(/\?w=\d+$/, '?w=1280')} alt={open.alt} />
          <span className="muted">{open.path} · click or Esc to close</span>
        </button>
      )}
    </>
  );
}

/** One step of a Claude step log (also used by the stage progress view). */
export function Step({ row }: { readonly row: StepRow }): JSX.Element {
  if (row.kind === 'text') {
    return (
      <li className="step step-text">
        <Markdown text={row.text} />
      </li>
    );
  }
  if (row.kind === 'error') {
    return (
      <li className="step step-error" role="alert">
        {row.text}
      </li>
    );
  }
  return (
    <li className={`step step-tool status-${row.icon}`}>
      <div className="step-line">
        <span className="step-icon" role="img" aria-label={ICON_LABEL[row.icon]}>
          {ICON_TEXT[row.icon]}
        </span>
        <span className="step-label">{row.label}</span>
        {row.detail !== '' && (
          <span className="step-detail mono" title={row.detail}>
            {row.detail}
          </span>
        )}
      </div>
      {row.output !== null && <pre className="step-output">{row.output}</pre>}
      <Thumbnails items={row.thumbnails} />
    </li>
  );
}

function Turn({ turn }: { readonly turn: ChatTurn }): JSX.Element {
  const status = turnStatusText(turn);
  return (
    <li className={`turn turn-${turn.status}`} data-turn-status={turn.status}>
      <div className="turn-request">
        <div className="turn-meta">
          <span className="turn-scope">{scopeText(turn)}</span>
          <span className="turn-model">{turn.request.model}</span>
        </div>
        <p className="turn-text">{requestText(turn)}</p>
      </div>
      {turn.steps.length > 0 && (
        <ol className="step-log" aria-label="Claude's steps">
          {turn.steps.map((step) => (
            <Step key={step.id} row={stepRow(step)} />
          ))}
        </ol>
      )}
      {(status !== undefined || turn.usage !== null || turn.commit !== null) && (
        <div className="turn-footer">
          {status !== undefined && (
            <p className={turn.status === 'failed' ? 'panel-error' : 'muted'}>{status}</p>
          )}
          {turn.usage !== null && <p className="muted mono">{usageLine(turn.usage)}</p>}
          {turn.commit !== null && (
            <p className="muted" title={turn.commit.subject}>
              Saved · <span className="mono">{turn.commit.hash.slice(0, 7)}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export interface ChatTranscriptProps {
  readonly turns: readonly ChatTurn[];
  readonly queue: readonly ChatTurn[];
  readonly onRemoveQueued: (turnId: string) => void;
  readonly empty: JSX.Element;
}

/** Distance from the bottom (px) within which the list keeps following new content. */
const FOLLOW_SLACK_PX = 48;

export function ChatTranscript({
  turns,
  queue,
  onRemoveQueued,
  empty,
}: ChatTranscriptProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const lastTurn = turns.at(-1);
  const contentKey = `${String(turns.length)}:${String(queue.length)}:${String(lastTurn?.steps.length ?? 0)}:${lastTurn?.status ?? ''}`;

  useEffect(() => {
    const list = listRef.current;
    if (list && following.current) list.scrollTop = list.scrollHeight;
  }, [contentKey]);

  return (
    <div
      className="message-list"
      ref={listRef}
      onScroll={(event) => {
        const list = event.currentTarget;
        following.current =
          list.scrollHeight - list.scrollTop - list.clientHeight < FOLLOW_SLACK_PX;
      }}
    >
      {turns.length === 0 && queue.length === 0 ? (
        empty
      ) : (
        <ol className="turn-list" aria-label="Messages">
          {turns.map((turn) => (
            <Turn key={turn.id} turn={turn} />
          ))}
        </ol>
      )}
      {queue.length > 0 && (
        <ol className="queue-list" aria-label="Queued messages">
          {queue.map((turn, index) => (
            <li key={turn.id} className="queued">
              <span className="queued-index mono">{index + 1}</span>
              <span className="queued-text" title={requestText(turn)}>
                {requestText(turn)}
              </span>
              <button
                type="button"
                className="icon-button small"
                aria-label={`Remove queued message ${String(index + 1)}`}
                title="Remove from the queue"
                onClick={() => {
                  onRemoveQueued(turn.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
