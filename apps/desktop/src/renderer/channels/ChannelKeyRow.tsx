/**
 * Settings → Channels → "ElevenLabs API key" (PLAN.md#13.13, ADR-031): whether a key is stored,
 * a masked field to set or replace it and "Remove key". The typed key goes to main once and the
 * field is cleared right after: it is never shown again, and main never sends it back.
 */
import { useId, useState, type JSX, type SyntheticEvent } from 'react';
import { KEY_HINT, KEY_SAVED_TEXT, NO_KEY_TEXT } from './channel-view.js';
import type { ChannelOutcome } from './use-channels.js';

export interface ChannelKeyRowProps {
  readonly present: boolean;
  readonly onSet: (value: string) => Promise<ChannelOutcome>;
  readonly onRemove: () => Promise<ChannelOutcome>;
}

export function ChannelKeyRow({ present, onSet, onRemove }: ChannelKeyRowProps): JSX.Element {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const run = (call: () => Promise<ChannelOutcome>): void => {
    setBusy(true);
    setError(undefined);
    void call().then((outcome) => {
      setBusy(false);
      if (!outcome.ok) setError(outcome.message);
    });
  };

  const save = (event: SyntheticEvent): void => {
    event.preventDefault();
    const value = draft.trim();
    if (value === '') return;
    // Forget the value in the page at once, whatever main answers.
    setDraft('');
    run(() => onSet(value));
  };

  return (
    <form className="channel-key" onSubmit={save} aria-label="ElevenLabs API key">
      <div className="channel-key-status">
        <span className="channel-key-title">ElevenLabs API key</span>
        <span className={present ? 'channel-key-saved' : 'muted'}>
          {present ? KEY_SAVED_TEXT : NO_KEY_TEXT}
        </span>
      </div>
      <div className="channel-key-entry">
        <label className="visually-hidden" htmlFor={id}>
          {present ? 'New API key' : 'API key'}
        </label>
        <input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          disabled={busy}
          placeholder={present ? 'Paste a new key to replace it' : 'Paste the key'}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <button type="submit" className="small-button" disabled={busy || draft.trim() === ''}>
          {present ? 'Replace key' : 'Save key'}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={busy || !present}
          onClick={() => {
            run(onRemove);
          }}
        >
          Remove key
        </button>
      </div>
      <p className="muted channel-key-hint" id={`${id}-hint`}>
        {KEY_HINT}
      </p>
      {error !== undefined && (
        <p className="channel-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
