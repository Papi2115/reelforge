/**
 * Settings → Channels → "Add channel": the name comes first, because the channel's id (in
 * project.json and its taste profile's file name) is made from the first name and never changes.
 */
import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import { checkChannelName, MAX_CHANNEL_NAME_LENGTH } from './channel-view.js';
import type { ChannelOutcome } from './use-channels.js';

export interface AddChannelFormProps {
  readonly channels: readonly ChannelView[];
  readonly onAdd: (name: string) => Promise<ChannelOutcome>;
  readonly onCancel: () => void;
}

export function AddChannelForm({ channels, onAdd, onCancel }: AddChannelFormProps): JSX.Element {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const check = checkChannelName(name, channels, '');
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setBusy(true);
    void onAdd(check.name).then((outcome) => {
      setBusy(false);
      if (!outcome.ok) setError(outcome.message);
    });
  };

  return (
    <form className="channel-add" aria-label="New channel" onSubmit={submit}>
      <label className="field">
        <span>Name of the new channel</span>
        <input
          ref={input}
          value={name}
          maxLength={MAX_CHANNEL_NAME_LENGTH}
          placeholder="e.g. Voxplain"
          disabled={busy}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              // Closes the form, not the whole Settings dialog.
              event.stopPropagation();
              onCancel();
            }
          }}
        />
      </label>
      <div className="channel-actions">
        <button type="submit" className="primary small-button" disabled={busy}>
          Add
        </button>
        <button type="button" className="small-button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error !== undefined && (
        <p className="channel-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
