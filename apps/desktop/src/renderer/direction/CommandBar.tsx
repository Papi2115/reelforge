/**
 * Live co-direction command bar (PLAN.md#12.14) docked under the preview: type "slower",
 * "ciemniej", "arrow on the word light"… while the film plays (focus with `/`). Shows what was
 * done, offers "Unlock this shot" for a locked shot and "Rebuild with Claude" for commands only
 * Claude can do and hint chips. One line of fixed height (the status replaces the chips) so the
 * preview keeps its scale. "History (N)" opens the Director tab on its Directions section (the
 * session history with Undo / Redo moved there, U9). Hidden until there is a shot to direct
 * (docs/ux/redesign-2.4.md §5).
 */
import type { DirectionWord } from '@reelforge/shared';
import { useEffect, useRef, useState, type JSX } from 'react';
import { useOpenDirector } from '../director/use-director-tab.js';
import { HINT_CHIPS, hintCommand, isCommandBarKey, statusText } from './direction-view.js';
import type { DirectionControls } from './use-direction.js';

export interface CommandBarProps {
  readonly controls: DirectionControls;
  /** Word spoken at the playhead (fills the "arrow on the word …" chip). */
  readonly wordAtPlayhead: () => DirectionWord | undefined;
  /** Shot under the playhead (undefined: no storyboard yet, the bar is hidden). */
  readonly shotId: string | undefined;
}

export function CommandBar(props: CommandBarProps): JSX.Element | null {
  const { shotId } = props;
  return shotId === undefined ? null : <ShotCommandBar {...props} shotId={shotId} />;
}

function ShotCommandBar({
  controls,
  wordAtPlayhead,
  shotId,
}: CommandBarProps & { readonly shotId: string }): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [command, setCommand] = useState('');
  const openDirector = useOpenDirector();
  const { status, session, busy } = controls;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const focus = isCommandBarKey({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        targetTag: target?.tagName ?? '',
        targetEditable: target?.isContentEditable === true,
      });
      if (!focus) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const send = (text: string): void => {
    const trimmed = text.trim();
    if (trimmed === '' || busy) return;
    void controls.submit(trimmed).then(() => {
      setCommand((current) => (current === text ? '' : current));
    });
  };

  const directedHere = controls.directed.has(shotId);
  const line = statusText(status);
  return (
    <section className="command-bar" aria-label="Direct the shot">
      <form
        className="command-row"
        onSubmit={(event) => {
          event.preventDefault();
          send(command);
        }}
      >
        <span className="command-shot" title="Commands change the shot under the playhead">
          {shotId}
          {directedHere && (
            <span
              className="direction-dot"
              title="This shot has directions"
              aria-label="directed"
            />
          )}
        </span>
        <input
          ref={inputRef}
          className="command-input"
          type="text"
          value={command}
          placeholder='Direct the shot: "slower", "darker", "arrow on the word …" (press /)'
          aria-label="Direction command"
          aria-keyshortcuts="/"
          maxLength={200}
          onChange={(event) => {
            setCommand(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setCommand('');
              controls.dismiss();
              event.currentTarget.blur();
            }
          }}
        />
        <button type="submit" className="small-button" disabled={busy || command.trim() === ''}>
          Apply
        </button>
        {openDirector !== null && (
          <button
            type="button"
            className="link-button command-history-link"
            title="This session's directions with Undo / Redo: now in the Director"
            onClick={() => {
              openDirector('directions');
            }}
          >
            History ({String(session.entries.length)})
          </button>
        )}
        {directedHere && (
          <button
            type="button"
            className="small-button"
            disabled={busy}
            onClick={() => {
              void controls.clear(shotId);
            }}
          >
            Clear directions
          </button>
        )}
      </form>
      {line === '' ? (
        <div className="command-chips" aria-label="Example commands">
          {HINT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="command-chip"
              disabled={busy}
              onClick={() => {
                const text = hintCommand(chip, wordAtPlayhead());
                setCommand(text);
                send(text);
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      ) : (
        <p
          className={`command-status command-status-${status.kind}`}
          role={status.kind === 'error' || status.kind === 'locked' ? 'alert' : 'status'}
        >
          <span className="command-status-text" title={line}>
            {line}
          </span>
          {status.kind === 'locked' && (
            <button
              type="button"
              className="small-button"
              onClick={() => {
                void controls.unlockAndRetry();
              }}
            >
              Unlock this shot
            </button>
          )}
          {status.kind === 'claude' && (
            <>
              <button
                type="button"
                className="small-button primary"
                title={line}
                onClick={() => {
                  void controls.acceptClaude();
                }}
              >
                Rebuild with Claude
              </button>
              <button
                type="button"
                className="small-button"
                onClick={() => {
                  controls.dismiss();
                }}
              >
                Cancel
              </button>
            </>
          )}
        </p>
      )}
    </section>
  );
}
