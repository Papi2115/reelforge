/**
 * Claude chat panel (PLAN.md#6.6): Chat/History tabs, the queue and Stop in the header, usage-limit
 * and connection banners, the transcript with Claude's step log, and the composer (scope, chips,
 * "Think harder"). Talks to main's ClaudeService through `window.reelforge` (use-chat.ts).
 */
import { useEffect, useState, type JSX } from 'react';
import type { ChatPause, ChatScope, ChatSelection } from '../../shared/chat-contract.js';
import { ChatComposer } from '../chat/ChatComposer.js';
import { ChatHistory } from '../chat/ChatHistory.js';
import { ChatTranscript } from '../chat/ChatTranscript.js';
import { useChat } from '../chat/use-chat.js';
import { StopIcon } from './icons.js';

type Tab = 'chat' | 'history';

export interface ChatPanelProps {
  /** Shot targeted by the Shot scope (selected, else under the playhead). */
  readonly shotId: string | undefined;
  /** Object picked in the preview. */
  readonly selection: ChatSelection | null;
  readonly onClearSelection: () => void;
  /** "Fix with Claude…" of a shot: the text goes into the message box, scope Shot. */
  readonly prefill: { readonly text: string; readonly nonce: number } | null;
}

const MINUTE_MS = 60_000;

/** Re-renders every minute (pause countdown). */
function useMinuteTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, MINUTE_MS / 4);
    return () => {
      window.clearInterval(timer);
    };
  }, [active]);
  return now;
}

function pauseText(pause: ChatPause, now: number): string {
  const what = pause.reason === 'limit' ? 'Claude usage limit reached.' : 'Claude is paused.';
  if (pause.until === null) return `${what} Resume when you are ready.`;
  const at = new Date(pause.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const minutes = Math.max(1, Math.ceil((pause.until - now) / MINUTE_MS));
  const wait = minutes >= 90 ? `${String(Math.round(minutes / 60))} h` : `${String(minutes)} min`;
  return `${what} Queued messages continue automatically at ${at} (in ${wait}).`;
}

function EmptyChat(): JSX.Element {
  return (
    <div className="chat-empty">
      <p>Ask Claude to change the video.</p>
      <p className="muted">
        Click an object in the preview to aim a change at it, pick a shot, or use a suggestion for
        the whole video. Every turn is saved in the project history.
      </p>
    </div>
  );
}

export function ChatPanel({
  shotId,
  selection,
  onClearSelection,
  prefill,
}: ChatPanelProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('chat');
  const [scope, setScope] = useState<ChatScope>(selection === null ? 'video' : 'selection');
  const chat = useChat();
  const state = chat.state;
  const running = state?.running ?? null;
  const queue = state?.queue ?? [];
  const pause = state?.pause ?? null;
  const now = useMinuteTick(pause !== null);
  const finished = (state?.turns ?? []).filter((turn) => turn.finishedAt !== null).length;

  // A fresh pick in the preview aims the next message at it.
  const selectionId = selection === null ? null : `${selection.id}@${String(selection.t)}`;
  useEffect(() => {
    if (selectionId !== null) setScope('selection');
  }, [selectionId]);
  const prefillNonce = prefill?.nonce;
  useEffect(() => {
    if (prefillNonce === undefined) return;
    setScope('shot');
    setTab('chat');
  }, [prefillNonce]);

  return (
    <section className="panel chat" aria-label="Claude">
      <div className="chat-header">
        <div className="tabs" role="tablist" aria-label="Claude views">
          {(['chat', 'history'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`chat-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`chat-view-${id}`}
              className="tab"
              onClick={() => {
                setTab(id);
              }}
            >
              {id === 'chat' ? 'Chat' : 'History'}
            </button>
          ))}
        </div>
        <span
          className={`queue-indicator${queue.length > 0 ? ' active' : ''}`}
          title="Messages waiting for Claude"
          aria-live="polite"
        >
          Queue {queue.length}
        </span>
        <button
          type="button"
          className="small-button"
          aria-label="Stop Claude"
          disabled={running === null}
          title={running === null ? 'Nothing is running' : 'Stop the running turn (Esc)'}
          onClick={chat.stop}
        >
          <StopIcon /> Stop
        </button>
      </div>
      {pause !== null && (
        <div className="chat-banner warn" role="status">
          <span>{pauseText(pause, now)}</span>
          <button type="button" className="small-button" onClick={chat.resume}>
            Try now
          </button>
        </div>
      )}
      {state?.notice && (
        <p className="chat-banner error" role="alert">
          {state.notice.message}
        </p>
      )}

      {tab === 'chat' ? (
        <div
          className="chat-view"
          role="tabpanel"
          id="chat-view-chat"
          aria-labelledby="chat-tab-chat"
        >
          {state === undefined ? (
            <p className="panel-empty">Connecting…</p>
          ) : (
            <ChatTranscript
              turns={state.turns}
              queue={queue}
              onRemoveQueued={chat.remove}
              empty={<EmptyChat />}
            />
          )}
          {chat.sendError !== undefined && (
            <p className="chat-send-error panel-error" role="alert">
              {chat.sendError}
            </p>
          )}
          <ChatComposer
            scope={scope}
            onScope={setScope}
            selection={selection}
            onClearSelection={onClearSelection}
            shotId={shotId}
            running={running !== null}
            onSend={chat.send}
            onStop={chat.stop}
            prefill={prefill}
          />
        </div>
      ) : (
        <div
          className="chat-view"
          role="tabpanel"
          id="chat-view-history"
          aria-labelledby="chat-tab-history"
        >
          <ChatHistory refreshKey={`${state?.projectDir ?? ''}:${String(finished)}`} />
        </div>
      )}
    </section>
  );
}
