/**
 * Shorts in the project overview (PLAN.md#13.18): a film's Shorts (a small card each with its
 * step strip and Open) or "Create 2 shorts (30 s + 60 s)" with why it waits; and, for a Short,
 * its settings (its film, length, end card, word-by-word captions).
 */
import type { JSX } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import type { ProjectOverview } from '../../shared/overview-contract.js';
import { cardSentence } from './card-view.js';
import { CardPicture } from './CardPicture.js';
import { shortLength, shortsButton } from './overview-view.js';
import { ProgressStrip } from './ProgressStrip.js';

function ShortTile(props: {
  readonly short: HomeProject;
  readonly onOpen: (dir: string) => void;
}): JSX.Element {
  const { short } = props;
  return (
    <li className="overview-short" aria-label={short.title}>
      <CardPicture project={short} />
      <div className="overview-short-text">
        <span className="card-badges">
          <span className="card-badge badge-short">Short</span>
          {short.short !== null && (
            <span className="card-badge mono">{shortLength(short.short.lengthS)}</span>
          )}
        </span>
        <span className="card-title">{short.title}</span>
        <ProgressStrip steps={short.steps} />
        <span className="card-sentence">{cardSentence(short)}</span>
      </div>
      <button
        type="button"
        disabled={!short.exists}
        onClick={() => {
          props.onOpen(short.dir);
        }}
      >
        Open<span className="visually-hidden"> {short.title}</span>
      </button>
    </li>
  );
}

export function FilmShortsPanel(props: {
  readonly overview: ProjectOverview;
  readonly busy: boolean;
  /** The Shorts are being made. */
  readonly making: boolean;
  readonly onCreate: () => void;
  readonly onOpen: (dir: string) => void;
}): JSX.Element {
  const { overview } = props;
  const button = shortsButton(overview);
  return (
    <section className="overview-panel" aria-label="Shorts">
      <h2 className="overview-panel-title section-title">Shorts</h2>
      {overview.shorts.length > 0 ? (
        <ul className="overview-shorts">
          {overview.shorts.map((short) => (
            <ShortTile key={short.dir} short={short} onOpen={props.onOpen} />
          ))}
        </ul>
      ) : (
        <>
          <p className="muted overview-note">
            Two vertical teasers of this film (30 s and 60 s): a hook and an open question that send
            viewers to the full video. Each is its own project with new scenes.
          </p>
          <div className="overview-actions">
            <button
              type="button"
              className="primary"
              disabled={!button.enabled || props.busy}
              onClick={props.onCreate}
            >
              {props.making ? 'Making the Shorts…' : 'Create 2 shorts (30 s + 60 s)'}
            </button>
          </div>
          {button.reason !== null && <p className="muted overview-note">{button.reason}</p>}
        </>
      )}
    </section>
  );
}

export function ShortSettingsPanel(props: {
  readonly overview: ProjectOverview;
  readonly busy: boolean;
  readonly onCaptions: (captions: boolean) => void;
  readonly onOpenFilm: (dir: string) => void;
}): JSX.Element {
  const { overview } = props;
  const { card, parent } = overview;
  const short = card.short;
  return (
    <section className="overview-panel" aria-label="Short">
      <h2 className="overview-panel-title section-title">Short</h2>
      <dl className="overview-facts">
        <dt>Film</dt>
        <dd>
          {parent === null ? (
            'Not known'
          ) : parent.known ? (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                props.onOpenFilm(parent.dir);
              }}
            >
              {parent.title}
            </button>
          ) : (
            <span title={parent.dir}>{parent.title} (not in your list)</span>
          )}
        </dd>
        <dt>Length</dt>
        <dd className="mono">{short === null ? '—' : `${shortLength(short.lengthS)}, 9:16`}</dd>
        <dt>End card</dt>
        <dd>{short?.endCardText ?? '—'}</dd>
      </dl>
      <label className="overview-toggle">
        <input
          type="checkbox"
          checked={short?.captions ?? false}
          disabled={short === null || props.busy}
          onChange={(event) => {
            props.onCaptions(event.target.checked);
          }}
        />
        Word-by-word captions
      </label>
      <details className="overview-details">
        <summary>Description</summary>
        <p className="muted">
          A Short needs no tags or timestamps. In its description, link the full video; the film’s
          tags are on the film’s overview.
        </p>
      </details>
    </section>
  );
}
