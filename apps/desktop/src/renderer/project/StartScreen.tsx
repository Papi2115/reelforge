/**
 * Start screen (PLAN.md#6.2): new project (title + language, style (PLAN.md#13.6: a preview world
 * only with Settings → Experimental worlds), scenes per minute and faster checks (ADR-027), then a
 * folder picker in main), open an existing project folder, or reopen a recent
 * one. Plain on purpose; 6.3 does the real layout.
 */
import type { ShotsPerMinute } from '@reelforge/shared';
import { useEffect, useMemo, useState, type JSX, type SyntheticEvent } from 'react';
import type {
  ProjectOpenResult,
  ProjectSummary,
  RecentProjectEntry,
} from '../../shared/project-contract.js';
import { styleChoices } from '../../shared/style-choices.js';
import { errorMessage, rendererLog } from '../log.js';
import { SceneCountFields } from './SceneCountFields.js';
import { SCENE_COUNT_HINT } from './scene-count-view.js';
import { StyleField } from './StyleField.js';
import { chosenStyle } from './world-settings-view.js';

const log = rendererLog('start');

export interface StartScreenProps {
  readonly onOpened: (project: ProjectSummary) => void;
  /** From the app settings; undefined until they are loaded. */
  readonly defaultLanguage: Language | undefined;
  /** Settings → Projects defaults (ADR-027); undefined until loaded. */
  readonly defaultShotsPerMinute?: ShotsPerMinute | null | undefined;
  readonly defaultFasterChecks?: boolean | undefined;
  /** Settings → Projects → style of new projects; undefined until loaded. */
  readonly defaultStyle?: string | undefined;
  /** Settings → Projects → "Experimental worlds (preview)" (PLAN.md#13.6). */
  readonly experimentalWorlds?: boolean | undefined;
}

type Language = ProjectSummary['language'];

export function StartScreen({
  onOpened,
  defaultLanguage,
  defaultShotsPerMinute,
  defaultFasterChecks,
  defaultStyle,
  experimentalWorlds,
}: StartScreenProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<Language>(defaultLanguage ?? 'en');
  const [shotsPerMinute, setShotsPerMinute] = useState<ShotsPerMinute | null>(
    defaultShotsPerMinute ?? null,
  );
  const [fasterChecks, setFasterChecks] = useState(defaultFasterChecks ?? false);
  const [pickedStyle, setPickedStyle] = useState<string | undefined>(undefined);
  const styles = useMemo(() => styleChoices(experimentalWorlds === true), [experimentalWorlds]);
  const style = chosenStyle(pickedStyle, defaultStyle, styles);
  const [recent, setRecent] = useState<RecentProjectEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (defaultLanguage !== undefined) setLanguage(defaultLanguage);
  }, [defaultLanguage]);

  useEffect(() => {
    if (defaultShotsPerMinute !== undefined) setShotsPerMinute(defaultShotsPerMinute);
  }, [defaultShotsPerMinute]);

  useEffect(() => {
    if (defaultFasterChecks !== undefined) setFasterChecks(defaultFasterChecks);
  }, [defaultFasterChecks]);

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
    run(() =>
      window.reelforge.newProject({
        title: title.trim(),
        language,
        shotsPerMinute,
        fasterChecks,
        ...(style === undefined ? {} : { style }),
      }),
    );
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
        <StyleField choices={styles} value={style} onChange={setPickedStyle} disabled={busy} />
        <fieldset className="start-scene-count">
          <legend>Scenes and checks</legend>
          <p className="muted">{SCENE_COUNT_HINT}</p>
          <SceneCountFields
            range={shotsPerMinute}
            fasterChecks={fasterChecks}
            onRange={setShotsPerMinute}
            onFasterChecks={setFasterChecks}
            disabled={busy}
          />
        </fieldset>
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
