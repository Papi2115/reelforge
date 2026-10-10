/**
 * Panels of the project overview (PLAN.md#13.16 part B): the YouTube thumbnail (upload, replace,
 * remove, its size and gentle notes), the film's phase (the eight steps in words, "Next step",
 * what needs you) and the film facts (length, voice, scenes, the last export).
 */
import type { JSX } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import type { FilmFacts, OverviewThumbnail } from '../../shared/overview-contract.js';
import type { OpenRequest } from '../queue/use-open-request.js';
import { cardSentence, formatDuration, relativeTime } from './card-view.js';
import { CardPicture } from './CardPicture.js';
import {
  needsYouLines,
  nextStepAction,
  scenesFact,
  stepPanel,
  thumbnailFacts,
  thumbnailNotes,
  OPENING_FRAME_NOTE,
  VOICE_WORDS,
} from './overview-view.js';
import { ProgressStrip } from './ProgressStrip.js';

export function ThumbnailPanel(props: {
  readonly card: HomeProject;
  readonly thumbnail: OverviewThumbnail | null;
  readonly busy: boolean;
  readonly onUpload: () => void;
  readonly onRemove: () => void;
}): JSX.Element {
  const { card, thumbnail } = props;
  const notes = thumbnail === null ? [] : thumbnailNotes(thumbnail);
  return (
    <section className="overview-panel overview-thumbnail" aria-label="Thumbnail">
      <h2 className="overview-panel-title section-title">Thumbnail</h2>
      {thumbnail === null ? (
        <CardPicture project={card} />
      ) : (
        <img className="card-picture" src={thumbnail.picture} alt="Your thumbnail" />
      )}
      {thumbnail === null ? (
        <p className="muted overview-note">
          {card.thumbnail === null
            ? 'No thumbnail yet. Upload the picture you made for YouTube (1280 × 720, up to 2 MB).'
            : 'This is a frame of the export. Upload the picture you made for YouTube.'}
        </p>
      ) : (
        <>
          {thumbnail.origin === 'opening-frame' && (
            <p className="muted overview-note">{OPENING_FRAME_NOTE}</p>
          )}
          <p className="muted overview-note mono">{thumbnailFacts(thumbnail)}</p>
        </>
      )}
      {notes.map((note) => (
        <p key={note} className="overview-warning">
          {note}
        </p>
      ))}
      <div className="overview-actions">
        <button type="button" disabled={props.busy} onClick={props.onUpload}>
          {thumbnail === null ? 'Upload thumbnail…' : 'Replace…'}
        </button>
        {thumbnail !== null && (
          <button
            type="button"
            className="link-button"
            disabled={props.busy}
            onClick={props.onRemove}
          >
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

export function PhasePanel(props: {
  readonly card: HomeProject;
  readonly onOpenStep: (panel: OpenRequest['panel']) => void;
}): JSX.Element {
  const { card } = props;
  const next = nextStepAction(card);
  const waiting = needsYouLines(card);
  return (
    <section className="overview-panel overview-phase" aria-label="Phase">
      <h2 className="overview-panel-title section-title">Where the film is</h2>
      <ProgressStrip steps={card.steps} labels states />
      <p className="overview-sentence">{cardSentence(card)}</p>
      {next !== null && (
        <div className="overview-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              props.onOpenStep(next.panel);
            }}
          >
            {next.label}
          </button>
          <span className="muted">Next step: opens the editor there.</span>
        </div>
      )}
      {waiting.length > 0 && (
        <div className="overview-needs-you">
          <h3 className="overview-subtitle">Needs you</h3>
          <ul>
            {waiting.map((line) => (
              <li key={line.step}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    props.onOpenStep(stepPanel(line.step, card.hasScript));
                  }}
                >
                  {line.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function FactsPanel(props: {
  readonly card: HomeProject;
  readonly facts: FilmFacts;
  readonly now: number;
  readonly busy: boolean;
  readonly onShowExport: () => void;
}): JSX.Element {
  const { card, facts } = props;
  const exported = relativeTime(facts.exportedAt, props.now);
  return (
    <section className="overview-panel" aria-label="Film facts">
      <h2 className="overview-panel-title section-title">Facts</h2>
      <dl className="overview-facts">
        <dt>Length</dt>
        <dd className="mono">{formatDuration(card.durationS) ?? 'Not known yet'}</dd>
        <dt>Voice</dt>
        <dd>{VOICE_WORDS[facts.voice]}</dd>
        <dt>Scenes</dt>
        <dd>{scenesFact(facts)}</dd>
        <dt>Last export</dt>
        <dd>
          {facts.exportFile === null ? (
            'None yet'
          ) : (
            <>
              <span className="mono">{facts.exportFile}</span>
              {exported !== null && <span className="muted"> · {exported}</span>}{' '}
              <button
                type="button"
                className="link-button"
                disabled={props.busy}
                onClick={props.onShowExport}
              >
                Show in folder
              </button>
            </>
          )}
        </dd>
      </dl>
    </section>
  );
}
