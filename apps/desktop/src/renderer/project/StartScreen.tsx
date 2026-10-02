/**
 * Start screen (PLAN.md#6.2): new project (title + language, then a folder picker in main), open an
 * existing project folder, or reopen a recent one. Plain on purpose; 6.3 does the real layout.
 */
import { useEffect, useState, type JSX, type SyntheticEvent } from 'react';
import type {
  ProjectOpenResult,
  ProjectSummary,
  RecentProjectEntry,
} from '../../shared/project-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('start');

export interface StartScreenProps {
  readonly onOpened: (project: ProjectSummary) => void;
  /** From the app settings; undefined until they are loaded. */
  readonly defaultLanguage: Language | undefined;
}

type Language = ProjectSummary['language'];

export function StartScreen({ onOpened, defaultLanguage }: StartScreenProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<Language>(defaultLanguage ?? 'en');
  const [recent, setRecent] = useState<RecentProjectEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (defaultLanguage !== undefined) setLanguage(defaultLanguage);
  }, [defaultLanguage]);

  useEffect(() => {
    window.reelforge.getRecentProjects().then(setRecent, (reason: unknown) => {
      log.error(`getRecentProjects failed: ${errorMessage(reason)}`);
    });
  }, []);

  const run = (action: () => Promise<ProjectOpenResult>): void => {
    setBusy(true);
    setError(undefined);
    action()
      .then((result) => {
        if (result.status === 'opened') onOpened(result.project);
        if (result.status === 'error') setError(result.error.message);
      })
      .catch((reason: unknown) => {
        log.error(`project action failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const create = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (title.trim() === '') return;
    run(() => window.reelforge.newProject({ title: title.trim(), language }));
  };

  return (
    <section className="start-screen" aria-label="Start">
      <h1 className="start-heading">Projects</h1>
      <form className="start-new" onSubmit={create}>
        <label className="field">
          <span>Video title</span>
          <input
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
        <button type="submit" className="primary" disabled={busy || title.trim() === ''}>
          New project…
        </button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          run(() => window.reelforge.openProject());
        }}
      >
        Open project…
      </button>
      <button
        type="button"
        disabled={busy}
        title="A fresh copy of “Doom on a calculator”, ready to play, edit and export"
        onClick={() => {
          run(() => window.reelforge.openExampleProject());
        }}
      >
        Open the example project
      </button>
      {error !== undefined && (
        <p className="start-error" role="alert">
          {error}
        </p>
      )}
      <h2 className="start-subheading">Recent</h2>
      {recent.length === 0 ? (
        <p className="muted">No recent projects.</p>
      ) : (
        <ul className="recent-list">
          {recent.map((entry) => (
            <li key={entry.dir}>
              <button
                type="button"
                className="recent-item"
                disabled={busy || !entry.exists}
                title={entry.dir}
                onClick={() => {
                  run(() => window.reelforge.openRecentProject(entry.dir));
                }}
              >
                <span>{entry.title}</span>
                <span className="muted">{entry.exists ? entry.dir : `missing · ${entry.dir}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
