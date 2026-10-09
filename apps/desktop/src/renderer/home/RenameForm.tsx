/**
 * Card menu → Rename… (PLAN.md#13.16): the title in an input, Enter saves, Esc cancels. The folder
 * keeps its name; the change is committed to the project's history.
 */
import { useState, type JSX } from 'react';

export interface RenameFormProps {
  readonly title: string;
  readonly onCancel: () => void;
  /** Resolves to a problem in plain words, or undefined when saved. */
  readonly onSave: (title: string) => Promise<string | undefined>;
}

export const MAX_TITLE_LENGTH = 200;

export function RenameForm({ title, onCancel, onSave }: RenameFormProps): JSX.Element {
  const [text, setText] = useState(title);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const trimmed = text.trim();
  return (
    <form
      className="rename-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed === '' || saving) return;
        if (trimmed === title) {
          onCancel();
          return;
        }
        setSaving(true);
        void onSave(trimmed).then((result) => {
          setSaving(false);
          setProblem(result);
        });
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // The form is the layer on top: Esc closes it alone.
        event.stopPropagation();
        onCancel();
      }}
    >
      <input
        aria-label="New title"
        value={text}
        maxLength={MAX_TITLE_LENGTH}
        autoFocus
        disabled={saving}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <button type="submit" className="primary" disabled={saving || trimmed === ''}>
        Save title
      </button>
      <button type="button" disabled={saving} onClick={onCancel}>
        Cancel
      </button>
      {problem !== undefined && (
        <p className="home-error" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}
