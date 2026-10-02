/**
 * Chat composer (PLAN.md#6.6): the change scope (Selection / Shot / Whole video) with what it
 * targets, the Whole-video suggestion chips (PLAN.md#7.6), the per-message "Think harder" toggle
 * and the message box. Enter sends (queues while Claude works), Shift+Enter is a new line, Esc
 * stops the running turn.
 */
import { useState, type JSX } from 'react';
import {
  CHAT_CHIPS,
  CHAT_SCOPES,
  CHIP_LABELS,
  MAX_CHAT_TEXT,
  SCOPE_LABELS,
  type ChatScope,
  type ChatSelection,
  type ChatSendRequest,
} from '../../shared/chat-contract.js';
import { SendIcon } from '../layout/icons.js';
import { selectionText } from './step-view.js';

export interface ChatComposerProps {
  readonly scope: ChatScope;
  readonly onScope: (scope: ChatScope) => void;
  readonly selection: ChatSelection | null;
  readonly onClearSelection: () => void;
  /** Shot the Shot scope targets (selected in the timeline/shots, else under the playhead). */
  readonly shotId: string | undefined;
  readonly running: boolean;
  readonly onSend: (request: ChatSendRequest) => Promise<boolean>;
  readonly onStop: () => void;
}

/** Why the current scope cannot be sent, if it cannot. */
function scopeProblem(
  scope: ChatScope,
  selection: ChatSelection | null,
  shotId: string | undefined,
): string | undefined {
  if (scope === 'selection' && selection === null) {
    return 'Click an object in the preview to select it';
  }
  if (scope === 'shot' && shotId === undefined) return 'Select a shot first';
  return undefined;
}

function targetText(
  scope: ChatScope,
  selection: ChatSelection | null,
  shotId: string | undefined,
): string {
  if (scope === 'video') return 'the whole video';
  if (scope === 'shot') return shotId === undefined ? 'no shot selected' : `shot ${shotId}`;
  return selection === null ? 'nothing selected in the preview' : selectionText(selection);
}

export function ChatComposer(props: ChatComposerProps): JSX.Element {
  const { scope, selection, shotId, running } = props;
  const [text, setText] = useState('');
  const [boost, setBoost] = useState(false);
  const [sending, setSending] = useState(false);
  const problem = scopeProblem(scope, selection, shotId);
  const canSend = !sending && problem === undefined && text.trim() !== '';

  const submit = async (request: ChatSendRequest): Promise<void> => {
    setSending(true);
    const queued = await props.onSend(request);
    setSending(false);
    if (queued) {
      setBoost(false);
      if (request.chip === null) setText('');
    }
  };

  const sendText = (): void => {
    if (!canSend) return;
    void submit({
      text: text.slice(0, MAX_CHAT_TEXT),
      chip: null,
      scope,
      shotIds:
        scope === 'shot' && shotId !== undefined
          ? [shotId]
          : scope === 'selection' && selection !== null
            ? [selection.shotId]
            : [],
      selection: scope === 'selection' ? selection : null,
      boost,
    });
  };

  return (
    <div className="composer-area">
      <ul className="suggestions" aria-label="Suggestions for the whole video">
        {CHAT_CHIPS.map((chip) => (
          <li key={chip}>
            <button
              type="button"
              className="chip-button"
              disabled={sending}
              onClick={() => {
                void submit({
                  text: '',
                  chip,
                  scope: 'video',
                  shotIds: [],
                  selection: null,
                  boost,
                });
              }}
            >
              {CHIP_LABELS[chip]}
            </button>
          </li>
        ))}
      </ul>
      <fieldset className="scope">
        <legend className="scope-legend">Change applies to</legend>
        {CHAT_SCOPES.map((option) => (
          <label key={option} className={`scope-option${scope === option ? ' active' : ''}`}>
            <input
              type="radio"
              name="chat-scope"
              value={option}
              checked={scope === option}
              onChange={() => {
                props.onScope(option);
              }}
            />
            {SCOPE_LABELS[option]}
          </label>
        ))}
      </fieldset>
      {selection !== null && scope === 'selection' ? (
        <p className="selection-chip">
          <span className="selection-chip-label" title={selection.description}>
            Selected: {selectionText(selection)}
          </span>
          <button
            type="button"
            className="icon-button small"
            aria-label="Clear the selection"
            title="Clear the selection"
            onClick={props.onClearSelection}
          >
            ×
          </button>
        </p>
      ) : (
        <p className="scope-target muted">Target: {targetText(scope, selection, shotId)}</p>
      )}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendText();
        }}
      >
        <textarea
          aria-label="Message to Claude"
          placeholder={problem ?? (running ? 'Queue another change…' : 'Describe a change…')}
          rows={3}
          maxLength={MAX_CHAT_TEXT}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              sendText();
            } else if (event.key === 'Escape' && running) {
              event.preventDefault();
              props.onStop();
            }
          }}
        />
        <div className="composer-actions">
          <label
            className="boost-toggle"
            title="Use the stronger model (Opus by default) for this message"
          >
            <input
              type="checkbox"
              checked={boost}
              onChange={(event) => {
                setBoost(event.target.checked);
              }}
            />
            Think harder
          </label>
          <button
            type="submit"
            className="icon-button primary"
            aria-label={running ? 'Queue message' : 'Send'}
            title={problem ?? (running ? 'Queue (runs after the current turn)' : 'Send (Enter)')}
            disabled={!canSend}
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}
