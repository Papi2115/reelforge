/**
 * Genre presets (PLAN.md#13.8, ADR-035): `GenreSelect` (None + the presets; a saved id this build
 * does not know stays listed) for the New project form and Settings → Channels, and `GenreField`,
 * the form's "Genre" block: the select, the chosen preset's line, a one-line preview of what it
 * sets and, when a preferred style is not offered yet, which one is used instead.
 */
import { useId, type JSX } from 'react';
import {
  GENRE_FIELD_HINT,
  GENRE_NONE_LABEL,
  genreLabel,
  genreOptions,
  genrePreviewLine,
  genreStyleNote,
  type TouchedFields,
} from './genre-view.js';
import type { GenrePresetResolution } from '@reelforge/shared';

const OPTIONS = genreOptions();

export interface GenreSelectProps {
  readonly label: string;
  readonly value: string | null;
  readonly onChange: (genre: string | null) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  /** A muted line under the select. */
  readonly hint?: string;
}

export function GenreSelect({
  label,
  value,
  onChange,
  disabled,
  className,
  hint,
}: GenreSelectProps): JSX.Element {
  const id = useId();
  const unknown = value !== null && !OPTIONS.some((option) => option.id === value);
  return (
    <div className={className ?? 'field'}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled === true}
        onChange={(event) => {
          onChange(event.target.value === '' ? null : event.target.value);
        }}
      >
        <option value="">{GENRE_NONE_LABEL}</option>
        {OPTIONS.map((option) => (
          <option key={option.id} value={option.id} title={option.description}>
            {option.label}
          </option>
        ))}
        {unknown && <option value={value}>{genreLabel(value)} (not in this version)</option>}
      </select>
      {hint !== undefined && <span className="muted">{hint}</span>}
    </div>
  );
}

export interface GenreFieldProps {
  readonly value: string | null;
  readonly resolution: GenrePresetResolution | undefined;
  readonly touched: TouchedFields;
  readonly experimentalWorlds: boolean;
  readonly onChange: (genre: string | null) => void;
  readonly disabled?: boolean;
}

export function GenreField(props: GenreFieldProps): JSX.Element {
  const { resolution } = props;
  const note =
    resolution === undefined ? undefined : genreStyleNote(resolution, props.experimentalWorlds);
  return (
    <div className="start-genre">
      <GenreSelect
        label="Genre"
        value={props.value}
        onChange={props.onChange}
        disabled={props.disabled === true}
      />
      {resolution === undefined ? (
        <p className="muted">{GENRE_FIELD_HINT}</p>
      ) : (
        <>
          <p className="muted">{resolution.preset.description}</p>
          <p className="genre-preview" role="status" aria-label="What the genre sets">
            {genrePreviewLine(resolution, props.touched)}
          </p>
          {note !== undefined && <p className="genre-style-note">{note}</p>}
        </>
      )}
    </div>
  );
}
