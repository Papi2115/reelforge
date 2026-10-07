/**
 * Project settings → "Genre" (PLAN.md#13.8, ADR-035): the genre preset the project was created
 * with, read-only (it only filled in ordinary options, which stay editable below); the tooltip
 * reads "Recipe: …" (the preset's line and its script tone).
 */
import { useId, type JSX } from 'react';
import { genreRowText } from './genre-view.js';
import { SettingRow } from './SettingRow.js';

export function GenreRow({ genrePreset }: { readonly genrePreset: string | null }): JSX.Element {
  const headingId = useId();
  const { label, recipe, note } = genreRowText(genrePreset ?? undefined);
  return (
    <section className="project-settings-section" aria-labelledby={headingId}>
      <h3 className="settings-heading" id={headingId}>
        Genre
      </h3>
      <SettingRow title="Genre" note={note}>
        {() => (
          <p className="option-readonly project-genre-row" title={recipe}>
            <strong>{label}</strong>
          </p>
        )}
      </SettingRow>
    </section>
  );
}
