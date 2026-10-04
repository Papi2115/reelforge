/**
 * "Library" in the Assets dialog (PLAN.md#12.19): the global asset library shared by all projects —
 * search box, filters (kind, licence, tag, favourites), thumbnails, a favourite star, tags, "Use in
 * project" (a copy into this project, no download) and Remove (asks first). Keyboard: native
 * fields and buttons; the star is a toggle button (aria-pressed).
 */
import { useState, type JSX } from 'react';
import { LIBRARY_LICENCE_FILTERS } from '@reelforge/shared';
import { libraryMediaUrl, type LibraryEntryView } from '../../shared/library-contract.js';
import {
  libraryBadge,
  libraryMeta,
  librarySummary,
  LIBRARY_LICENCE_LABELS,
  parseTags,
  libraryUseButton,
  type LibraryFilters,
} from './library-view.js';
import { useLibrary, type LibraryController } from './use-library.js';

function LibraryCard(props: {
  readonly entry: LibraryEntryView;
  readonly projectOpen: boolean;
  readonly library: LibraryController;
  readonly run: (action: () => Promise<{ message: string | null }>) => void;
}): JSX.Element {
  const { entry, library } = props;
  const [confirming, setConfirming] = useState(false);
  const [tags, setTags] = useState(entry.tags.join(', '));
  const badge = libraryBadge(entry);
  const use = libraryUseButton(entry, props.projectOpen);
  const saveTags = (): void => {
    const next = parseTags(tags);
    if (next.join(',') === entry.tags.join(',')) return;
    props.run(() => library.edit({ sha256: entry.sha256, tags: next }));
  };
  return (
    <li className="asset-card library-card">
      {entry.image === null ? (
        <span className="asset-thumb asset-thumb-missing">{entry.kind}</span>
      ) : (
        <img className="asset-thumb" src={libraryMediaUrl(entry.image, 320)} alt="" />
      )}
      <span className="library-card-title">
        <span className="asset-title">{entry.title}</span>
        <button
          type="button"
          className="icon-button library-star"
          aria-pressed={entry.favorite}
          aria-label={`Favourite: ${entry.title}`}
          title={entry.favorite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={() => {
            props.run(() => library.edit({ sha256: entry.sha256, favorite: !entry.favorite }));
          }}
        >
          {entry.favorite ? '★' : '☆'}
        </button>
      </span>
      <span className="asset-meta muted">{libraryMeta(entry)}</span>
      <span className={`asset-licence asset-licence-${badge.tone}`} title={badge.title}>
        {badge.text}
      </span>
      {entry.description !== '' && (
        <span className="own-asset-description">{entry.description}</span>
      )}
      <label className="field library-tags">
        <span>Tags (comma separated)</span>
        <input
          value={tags}
          onChange={(event) => {
            setTags(event.target.value);
          }}
          onBlur={saveTags}
          onKeyDown={(event) => {
            if (event.key === 'Enter') saveTags();
          }}
        />
      </label>
      <span className="asset-actions">
        <button
          type="button"
          className="primary"
          disabled={use.disabled !== null}
          title={use.disabled ?? 'Copy it into this project (nothing is downloaded)'}
          aria-label={`${use.label}: ${entry.title}`}
          onClick={() => {
            props.run(() => library.use(entry.sha256));
          }}
        >
          {use.label}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="small-button danger"
              aria-label={`Remove ${entry.title} from the library`}
              onClick={() => {
                setConfirming(false);
                props.run(() => library.remove(entry.sha256));
              }}
            >
              Remove it
            </button>
            <button
              type="button"
              className="small-button"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="small-button"
            title="Remove it from the library (projects keep their copies)"
            onClick={() => {
              setConfirming(true);
            }}
          >
            Remove
          </button>
        )}
      </span>
    </li>
  );
}

function Filters(props: {
  readonly filters: LibraryFilters;
  readonly tags: readonly string[];
  readonly onChange: (filters: LibraryFilters) => void;
}): JSX.Element {
  const { filters, onChange } = props;
  return (
    <div className="library-filters" role="search">
      <label className="field library-search">
        <span>Search</span>
        <input
          type="search"
          value={filters.text}
          placeholder="Title, description, tag or project"
          onChange={(event) => {
            onChange({ ...filters, text: event.target.value });
          }}
        />
      </label>
      <label className="field">
        <span>Kind</span>
        <select
          value={filters.kind}
          onChange={(event) => {
            const kind = event.target.value;
            onChange({ ...filters, kind: kind === 'image' || kind === 'video' ? kind : '' });
          }}
        >
          <option value="">Images and videos</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
      </label>
      <label className="field">
        <span>Licence</span>
        <select
          value={filters.licence}
          onChange={(event) => {
            const licence = LIBRARY_LICENCE_FILTERS.find((value) => value === event.target.value);
            onChange({ ...filters, licence: licence ?? '' });
          }}
        >
          <option value="">Any licence</option>
          {LIBRARY_LICENCE_FILTERS.map((value) => (
            <option key={value} value={value}>
              {LIBRARY_LICENCE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Tag</span>
        <select
          value={filters.tag}
          onChange={(event) => {
            onChange({ ...filters, tag: event.target.value });
          }}
        >
          <option value="">Any tag</option>
          {props.tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>
      <label className="asset-library-toggle library-favourites">
        <input
          type="checkbox"
          checked={filters.favorites}
          onChange={(event) => {
            onChange({ ...filters, favorites: event.target.checked });
          }}
        />
        <span>Favourites only</span>
      </label>
    </div>
  );
}

/** Mounted when the Library tab opens, so it always reads the library afresh. */
export function LibraryPanel(props: {
  /** A library action changed the open project (e.g. "Use in project"). */
  readonly onChanged: () => void;
  readonly run: (action: () => Promise<{ message: string | null }>) => void;
}): JSX.Element {
  const library = useLibrary(props.onChanged);
  const { state } = library;
  return (
    <section className="library-panel" aria-label="Asset library">
      <p className="muted">
        Shared by all your projects and kept on this computer: approved downloads and the files you
        save. &quot;Use in project&quot; copies one into this project; nothing is downloaded again.
      </p>
      <p className="library-count" role="status">
        {librarySummary(state)}
      </p>
      <Filters
        filters={library.filters}
        tags={state?.status === 'ok' ? state.tags : []}
        onChange={library.setFilters}
      />
      {state?.status === 'ok' && state.problem !== null && (
        <p className="panel-error">{state.problem}</p>
      )}
      {state?.status === 'ok' &&
        (state.entries.length === 0 ? (
          <p className="muted">
            {state.total === 0
              ? 'Nothing here yet. Tick "Save to library" on an asset of a project.'
              : 'Nothing matches these filters.'}
          </p>
        ) : (
          <ul className="asset-grid" aria-label="Library assets">
            {state.entries.map((entry) => (
              <LibraryCard
                key={`${entry.sha256}:${entry.tags.join(',')}`}
                entry={entry}
                projectOpen={state.projectOpen}
                library={library}
                run={props.run}
              />
            ))}
          </ul>
        ))}
    </section>
  );
}
