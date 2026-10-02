/**
 * Welcome screen after the first-run "Connect Claude" gate (PLAN.md#10.3): three big choices —
 * open the bundled example (a finished short to play with), a new video from a brief, or an
 * existing project. Any choice (or "Skip") answers it once; the start screen comes after.
 */
import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';
import type { ProjectOpenResult, ProjectSummary } from '../../shared/project-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('welcome');

type Language = ProjectSummary['language'];

export interface WelcomeScreenProps {
  readonly defaultLanguage: Language | undefined;
  readonly onOpened: (project: ProjectSummary) => void;
  /** The Welcome screen was answered (any choice that opened a project, or Skip). */
  readonly onDone: () => void;
}

export function WelcomeScreen(props: WelcomeScreenProps): JSX.Element {
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [briefOpen, setBriefOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<Language>(props.defaultLanguage ?? 'en');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  useEffect(() => {
    if (briefOpen) titleRef.current?.focus();
  }, [briefOpen]);

  const run = (label: string, action: () => Promise<ProjectOpenResult>): void => {
    setBusy(label);
    setError(undefined);
    action()
      .then((result) => {
        if (result.status === 'opened') {
          props.onDone();
          props.onOpened(result.project);
        }
        if (result.status === 'error') setError(result.error.message);
      })
      .catch((reason: unknown) => {
        log.error(`${label} failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      })
      .finally(() => {
        setBusy(undefined);
      });
  };

  const create = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (title.trim() === '') return;
    run('new', () => window.reelforge.newProject({ title: title.trim(), language }));
  };

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <h1 id="welcome-title" className="welcome-title" ref={headingRef} tabIndex={-1}>
        Welcome to ReelForge
      </h1>
      <p className="welcome-lead">
        Turn a few sentences into a short voxel-animated video. How do you want to start?
      </p>
      <div className="welcome-choices">
        <button
          type="button"
          className="welcome-choice recommended"
          disabled={busy !== undefined}
          onClick={() => {
            run('example', () => window.reelforge.openExampleProject());
          }}
        >
          <span className="welcome-choice-tag">Start here</span>
          <span className="welcome-choice-title">
            {busy === 'example' ? 'Copying the example…' : 'Open the example project'}
          </span>
          <span className="welcome-choice-text">
            “Doom on a calculator”, a finished 30-second short. Press Play, change a scene in the
            chat, then mix the sound and export your first MP4.
          </span>
        </button>
        <div className={`welcome-choice${briefOpen ? ' expanded' : ''}`}>
          <button
            type="button"
            className="welcome-choice-button"
            aria-expanded={briefOpen}
            disabled={busy !== undefined}
            onClick={() => {
              setBriefOpen((open) => !open);
            }}
          >
            <span className="welcome-choice-title">New video from a brief</span>
            <span className="welcome-choice-text">
              Name it, describe it in 2–5 sentences and Claude writes the script. You record the
              voiceover; the rest is built for you.
            </span>
          </button>
          {briefOpen && (
            <form className="welcome-brief" onSubmit={create}>
              <label className="field">
                <span>Video title</span>
                <input
                  ref={titleRef}
                  value={title}
                  maxLength={200}
                  placeholder="How a calculator runs Doom"
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </label>
              <label className="field">
                <span>Language</span>
                <select
                  value={language}
                  onChange={(event) => {
                    setLanguage(event.target.value === 'pl' ? 'pl' : 'en');
                  }}
                >
                  <option value="en">English</option>
                  <option value="pl">Polski</option>
                </select>
              </label>
              <button
                type="submit"
                className="primary"
                disabled={busy !== undefined || title.trim() === ''}
              >
                Choose a folder and create…
              </button>
            </form>
          )}
        </div>
        <button
          type="button"
          className="welcome-choice"
          disabled={busy !== undefined}
          onClick={() => {
            run('open', () => window.reelforge.openProject());
          }}
        >
          <span className="welcome-choice-title">Open an existing project</span>
          <span className="welcome-choice-text">
            A ReelForge project folder from this computer.
          </span>
        </button>
      </div>
      {error !== undefined && (
        <p className="start-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="link-button welcome-skip" onClick={props.onDone}>
        Skip: go to the start screen
      </button>
    </section>
  );
}
