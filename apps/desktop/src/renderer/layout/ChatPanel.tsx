/**
 * Claude chat panel skeleton (PLAN.md#6.3): Chat/History tabs, change scope, suggestion chips
 * (PLAN.md#7.6), message list, composer, queue and Stop. Nothing here talks to Claude yet: the
 * controls are visibly inactive until the chat lands (PLAN.md#6.6).
 */
import { useState, type JSX } from 'react';
import { SendIcon, StopIcon } from './icons.js';

const SCOPES = ['Selection', 'Shot', 'Whole video'] as const;
type Scope = (typeof SCOPES)[number];
type Tab = 'chat' | 'history';

export const SUGGESTIONS = [
  'Review the whole video and fix what looks wrong',
  'Make all on-screen text easier to read on a phone',
  'Check every visual lands on its spoken word',
] as const;

const NOT_YET = 'Not available yet: chatting with Claude arrives in a later build';

export interface ChatPanelProps {
  readonly selectedShotId: string | undefined;
}

function scopeTarget(scope: Scope, shotId: string | undefined): string {
  if (scope === 'Whole video') return 'the whole video';
  if (scope === 'Shot') return shotId === undefined ? 'no shot selected' : `shot ${shotId}`;
  return 'nothing selected in the preview';
}

export function ChatPanel({ selectedShotId }: ChatPanelProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('chat');
  const [scope, setScope] = useState<Scope>('Whole video');

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
        <span className="queue-indicator" title="Requests waiting for Claude">
          Queue 0
        </span>
        <button
          type="button"
          className="small-button"
          aria-label="Stop Claude"
          aria-disabled="true"
          title="Nothing is running"
        >
          <StopIcon /> Stop
        </button>
      </div>

      {tab === 'chat' ? (
        <div
          className="chat-view"
          role="tabpanel"
          id="chat-view-chat"
          aria-labelledby="chat-tab-chat"
        >
          <ol className="message-list" aria-label="Messages">
            <li className="message message-system">
              <span className="placeholder-badge">Preview</span>
              Chat with Claude is not connected yet. You will ask for changes here and watch each
              step (tools, rendered frames) as Claude works on the project.
            </li>
          </ol>
          <ul className="suggestions" aria-label="Suggestions">
            {SUGGESTIONS.map((text) => (
              <li key={text}>
                <button type="button" className="chip-button" aria-disabled="true" title={NOT_YET}>
                  {text}
                </button>
              </li>
            ))}
          </ul>
          <fieldset className="scope">
            <legend className="scope-legend">Change applies to</legend>
            {SCOPES.map((option) => (
              <label key={option} className={`scope-option${scope === option ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="chat-scope"
                  value={option}
                  checked={scope === option}
                  onChange={() => {
                    setScope(option);
                  }}
                />
                {option}
              </label>
            ))}
          </fieldset>
          <p className="scope-target muted">Target: {scopeTarget(scope, selectedShotId)}</p>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <textarea
              aria-label="Message to Claude"
              placeholder="Describe a change…"
              rows={2}
              disabled
            />
            <button
              type="submit"
              className="icon-button"
              aria-label="Send"
              aria-disabled="true"
              title={NOT_YET}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      ) : (
        <div
          className="chat-view"
          role="tabpanel"
          id="chat-view-history"
          aria-labelledby="chat-tab-history"
        >
          <p className="panel-empty">No Claude sessions in this project yet.</p>
        </div>
      )}
    </section>
  );
}
