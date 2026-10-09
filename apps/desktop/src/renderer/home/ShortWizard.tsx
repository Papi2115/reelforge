/**
 * Home → Shorts → "New short from a film" (PLAN.md#13.18): three steps in the wizard's look —
 * the film (only films with a script and a style that has Shorts), the angle (two different
 * automatic angles, or steered by a hint), captions and the review — then both Shorts are made
 * and the 30 s Short's overview opens. Esc goes back to the Shorts.
 */
import { useId, useState, type JSX, type SyntheticEvent } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import { MAX_ANGLE_HINT_LENGTH } from '../../shared/overview-contract.js';
import { styleLabel } from '../../shared/style-choices.js';
import { channelOf, type ChannelList } from '../channels/channel-view.js';
import { errorMessage, rendererLog } from '../log.js';
import { formatDuration } from './card-view.js';
import { CardPicture } from './CardPicture.js';
import { projectChannelId } from './home-view.js';
import {
  eligibleFilms,
  hiddenFilmsNote,
  NEW_SHORT_WIZARD,
  nextShortStep,
  SHORT_WIZARD_STEPS,
  SHORT_WIZARD_TITLES,
  shortsRequest,
  shortsReview,
  shortStepProblem,
  type ShortWizardState,
  type ShortWizardStep,
} from './shorts-view.js';

const log = rendererLog('shorts');

export interface ShortWizardProps {
  readonly projects: readonly HomeProject[];
  readonly channels: ChannelList | undefined;
  readonly onCancel: () => void;
  /** Both Shorts are made: open this one (the 30 s Short). */
  readonly onCreated: (dir: string) => void;
}

function FilmStep(props: {
  readonly films: readonly HomeProject[];
  readonly hidden: string | null;
  readonly state: ShortWizardState;
  readonly onState: (state: ShortWizardState) => void;
  readonly disabled: boolean;
}): JSX.Element {
  const name = useId();
  return (
    <div className="wizard-fields">
      <fieldset className="wizard-voice short-films">
        <legend>Film</legend>
        {props.films.map((film) => (
          <label key={film.dir} className="settings-toggle short-film">
            <input
              type="radio"
              name={name}
              checked={props.state.filmDir === film.dir}
              disabled={props.disabled}
              onChange={() => {
                props.onState({ ...props.state, filmDir: film.dir });
              }}
            />
            <CardPicture project={film} />
            <span>
              <strong>{film.title}</strong>
              <span className="muted">
                {[
                  film.style === null ? null : styleLabel(film.style),
                  formatDuration(film.durationS),
                ]
                  .filter((part) => part !== null)
                  .join(' · ')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {props.hidden !== null && <p className="muted wizard-note">{props.hidden}</p>}
    </div>
  );
}

function AngleStep(props: {
  readonly state: ShortWizardState;
  readonly onState: (state: ShortWizardState) => void;
  readonly disabled: boolean;
}): JSX.Element {
  const name = useId();
  const { state } = props;
  return (
    <div className="wizard-fields">
      <fieldset className="wizard-voice">
        <legend>Angle</legend>
        <label className="settings-toggle">
          <input
            type="radio"
            name={name}
            checked={state.angle === 'auto'}
            disabled={props.disabled}
            onChange={() => {
              props.onState({ ...state, angle: 'auto' });
            }}
          />
          <span>
            <strong>Two different angles</strong>
            <span className="muted">
              30 s opens on the film’s most surprising fact; 60 s raises its central question.
              Neither gives the answer away.
            </span>
          </span>
        </label>
        <label className="settings-toggle">
          <input
            type="radio"
            name={name}
            checked={state.angle === 'steer'}
            disabled={props.disabled}
            onChange={() => {
              props.onState({ ...state, angle: 'steer' });
            }}
          />
          <span>
            <strong>Steer the angle</strong>
            <span className="muted">Both Shorts lean toward your hint and stay different.</span>
          </span>
        </label>
      </fieldset>
      {state.angle === 'steer' && (
        <label className="field">
          <span>Angle hint</span>
          <input
            type="text"
            value={state.hint}
            maxLength={MAX_ANGLE_HINT_LENGTH}
            placeholder="e.g. the moment the vault door opened"
            disabled={props.disabled}
            onChange={(event) => {
              props.onState({ ...state, hint: event.target.value });
            }}
          />
        </label>
      )}
    </div>
  );
}

function CreateStep(props: {
  readonly state: ShortWizardState;
  readonly onState: (state: ShortWizardState) => void;
  readonly review: readonly { label: string; value: string }[];
  readonly disabled: boolean;
}): JSX.Element {
  return (
    <div className="wizard-fields">
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={props.state.captions}
          disabled={props.disabled}
          onChange={(event) => {
            props.onState({ ...props.state, captions: event.target.checked });
          }}
        />
        <span>
          <strong>Word-by-word captions</strong>
          <span className="muted">
            Off by default; you can switch it later in the Short’s overview.
          </span>
        </span>
      </label>
      <section className="wizard-review" aria-label="Review">
        <h3 className="section-title">Review</h3>
        <dl>
          {props.review.map((row) => (
            <div key={row.label} className="wizard-review-row">
              <dt className="muted">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="muted wizard-note">
          Both Shorts are new projects next to the film’s folder, with its voice and style. Then the
          30 s Short’s overview opens.
        </p>
      </section>
    </div>
  );
}

export function ShortWizard(props: ShortWizardProps): JSX.Element {
  const films = eligibleFilms(props.projects);
  const [step, setStep] = useState<ShortWizardStep>('film');
  const [state, setState] = useState<ShortWizardState>(() => ({
    ...NEW_SHORT_WIZARD,
    filmDir: films.length === 1 ? films[0]?.dir : undefined,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const problem = shortStepProblem(step, state, films);
  const film = films.find((entry) => entry.dir === state.filmDir);
  const channelName =
    (film === undefined
      ? undefined
      : channelOf(props.channels, projectChannelId(film, props.channels) ?? undefined)?.name) ??
    'your channel';
  const back = nextShortStep(step, -1);
  const last = nextShortStep(step, 1) === undefined;

  const create = (): void => {
    const request = shortsRequest(state);
    if (request === undefined) return;
    setBusy(true);
    setError(undefined);
    window.reelforge.createShorts(request).then(
      (result) => {
        setBusy(false);
        if (result.status === 'error') setError(result.message);
        else if (result.shorts[0] !== undefined) props.onCreated(result.shorts[0].dir);
      },
      (reason: unknown) => {
        setBusy(false);
        log.error(`createShorts failed: ${errorMessage(reason)}`);
        setError('The Shorts could not be made. See the log for details.');
      },
    );
  };
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (busy || problem !== undefined) return;
    const next = nextShortStep(step, 1);
    if (next === undefined) create();
    else setStep(next);
  };

  return (
    <section
      className="wizard"
      aria-label="New short"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || busy) return;
        event.preventDefault();
        props.onCancel();
      }}
    >
      <header className="wizard-header">
        <h1 className="home-title">New short</h1>
        <ol className="wizard-steps" aria-label="Steps">
          {SHORT_WIZARD_STEPS.map((entry, index) => {
            const current = SHORT_WIZARD_STEPS.indexOf(step);
            const done = index < current;
            return (
              <li
                key={entry}
                className={`wizard-step step-${done ? 'done' : entry === step ? 'current' : 'next'}`}
              >
                <button
                  type="button"
                  aria-current={entry === step ? 'step' : undefined}
                  disabled={busy || !done}
                  onClick={() => {
                    setStep(entry);
                  }}
                >
                  <span className="wizard-step-dot" aria-hidden="true">
                    {index + 1}
                  </span>
                  {SHORT_WIZARD_TITLES[entry]}
                </button>
              </li>
            );
          })}
        </ol>
      </header>
      <form className="wizard-body" onSubmit={submit} noValidate>
        <h2 className="wizard-step-title section-title">
          Step {SHORT_WIZARD_STEPS.indexOf(step) + 1} of {SHORT_WIZARD_STEPS.length}:{' '}
          {SHORT_WIZARD_TITLES[step]}
        </h2>
        {step === 'film' && (
          <FilmStep
            films={films}
            hidden={hiddenFilmsNote(props.projects)}
            state={state}
            onState={setState}
            disabled={busy}
          />
        )}
        {step === 'angle' && <AngleStep state={state} onState={setState} disabled={busy} />}
        {step === 'create' && (
          <CreateStep
            state={state}
            onState={setState}
            review={shortsReview(state, film, channelName)}
            disabled={busy}
          />
        )}
        {problem !== undefined && (
          <p className="muted wizard-problem" role="status">
            {problem}
          </p>
        )}
        {error !== undefined && (
          <p className="home-error" role="alert">
            {error}
          </p>
        )}
        <footer className="wizard-footer">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (back === undefined) props.onCancel();
              else setStep(back);
            }}
          >
            {back === undefined ? 'Back to Shorts' : 'Back'}
          </button>
          <span className="header-spacer" />
          <button type="submit" className="primary" disabled={busy || problem !== undefined}>
            {last ? (busy ? 'Making the Shorts…' : 'Create 2 shorts') : 'Next'}
          </button>
        </footer>
      </form>
    </section>
  );
}
