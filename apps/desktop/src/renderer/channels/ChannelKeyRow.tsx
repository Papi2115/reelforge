/**
 * Settings → Channels → "ElevenLabs API key" (PLAN.md#13.13, ADR-031): whether a key is stored,
 * a masked field to set or replace it, "Remove key" and "Test key" (main asks ElevenLabs for the
 * plan and the characters left; PLAN.md#13.14). The typed key goes to main once and the field is
 * cleared right after: it is never shown again, and main never sends it back. The test result
 * belongs to this row: replacing or removing the key clears it, and the row is mounted per channel
 * (ChannelsPage keys the detail by channel), so another channel starts without one.
 */
import { useId, useState, type JSX, type SyntheticEvent } from 'react';
import type { VoiceTestKeyResult } from '../../shared/voice-contract.js';
import { KEY_HINT, KEY_SAVED_TEXT, NO_KEY_TEXT } from './channel-view.js';
import {
  keyTestLine,
  TEST_KEY_BUSY_TEXT,
  TEST_KEY_LABEL,
  TEST_KEY_TITLE,
  type KeyTestLine,
} from './key-test-view.js';
import type { ChannelOutcome } from './use-channels.js';

export interface ChannelKeyRowProps {
  readonly present: boolean;
  readonly onSet: (value: string) => Promise<ChannelOutcome>;
  readonly onRemove: () => Promise<ChannelOutcome>;
  readonly onTest: () => Promise<VoiceTestKeyResult>;
}

type KeyTest = { readonly kind: 'idle' } | { readonly kind: 'checking' } | KeyTestDone;
interface KeyTestDone {
  readonly kind: 'done';
  readonly line: KeyTestLine;
}

function KeyTestResult({ test }: { readonly test: KeyTest }): JSX.Element | null {
  if (test.kind === 'idle') return null;
  if (test.kind === 'checking') {
    return (
      <span className="muted channel-key-test-line" role="status">
        {TEST_KEY_BUSY_TEXT}
      </span>
    );
  }
  const ok = test.line.tone === 'ok';
  return (
    <span
      className={`channel-key-test-line ${ok ? 'channel-key-saved' : 'channel-error'}`}
      role={ok ? 'status' : 'alert'}
      data-testid="key-test-result"
    >
      {test.line.text}
    </span>
  );
}

export function ChannelKeyRow(props: ChannelKeyRowProps): JSX.Element {
  const { present, onSet, onRemove, onTest } = props;
  const id = useId();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [test, setTest] = useState<KeyTest>({ kind: 'idle' });
  const checking = test.kind === 'checking';

  const run = (call: () => Promise<ChannelOutcome>): void => {
    setBusy(true);
    setError(undefined);
    // The result was about the key being replaced or removed.
    setTest({ kind: 'idle' });
    void call().then((outcome) => {
      setBusy(false);
      if (!outcome.ok) setError(outcome.message);
    });
  };

  const runTest = (): void => {
    setTest({ kind: 'checking' });
    void onTest().then((result) => {
      setTest({ kind: 'done', line: keyTestLine(result) });
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
        <button
          type="submit"
          className="small-button"
          disabled={busy || checking || draft.trim() === ''}
        >
          {present ? 'Replace key' : 'Save key'}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={busy || checking || !present}
          onClick={() => {
            run(onRemove);
          }}
        >
          Remove key
        </button>
      </div>
      <div className="channel-key-test">
        <button
          type="button"
          className="small-button"
          title={TEST_KEY_TITLE}
          disabled={busy || checking || !present}
          onClick={runTest}
        >
          {TEST_KEY_LABEL}
        </button>
        <KeyTestResult test={test} />
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
