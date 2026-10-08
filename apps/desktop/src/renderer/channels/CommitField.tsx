/**
 * A text field of the channel form that saves when it loses focus (or on Enter in a one-line
 * field), like the other settings: no Save button. `onCommit` answers with an error sentence to
 * show (the text goes back to the saved value) or undefined when it was saved.
 */
import { useEffect, useId, useRef, useState, type JSX } from 'react';

export interface CommitFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (text: string) => Promise<string | undefined>;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly mono?: boolean;
}

export function CommitField(props: CommitFieldProps): JSX.Element {
  const { value, onCommit } = props;
  const id = useId();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | undefined>(undefined);
  // A change from outside (another field saved, the list reloaded) shows the saved value.
  useEffect(() => {
    setText(value);
  }, [value]);

  // Enter then blur must not save the same text twice while the first save is on its way.
  const sending = useRef<string | undefined>(undefined);

  const commit = (): void => {
    if (text === value || text === sending.current) return;
    sending.current = text;
    void onCommit(text).then((message) => {
      sending.current = undefined;
      setError(message);
      if (message !== undefined) setText(value);
    });
  };
  const describedBy = [
    props.hint === undefined ? '' : `${id}-hint`,
    error === undefined ? '' : `${id}-error`,
  ]
    .filter((part) => part !== '')
    .join(' ');
  const common = {
    id,
    value: text,
    placeholder: props.placeholder,
    maxLength: props.maxLength,
    className: props.mono === true ? 'mono' : undefined,
    'aria-describedby': describedBy === '' ? undefined : describedBy,
    'aria-invalid': error !== undefined,
    onBlur: commit,
  };
  return (
    <div className="field channel-field">
      <label htmlFor={id}>{props.label}</label>
      {props.multiline === true ? (
        <textarea
          {...common}
          rows={4}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      ) : (
        <input
          {...common}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      )}
      {props.hint !== undefined && (
        <span className="muted" id={`${id}-hint`}>
          {props.hint}
        </span>
      )}
      {error !== undefined && (
        <span className="channel-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
