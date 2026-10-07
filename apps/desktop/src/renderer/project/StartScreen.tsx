/**
 * Start screen (PLAN.md#6.2): new project (title + language, style (PLAN.md#13.6: a preview world
 * only with Settings → Experimental worlds), scenes per minute and faster checks (ADR-027), then a
 * folder picker in main), open an existing project folder, or reopen a recent
 * one. With more than one channel (PLAN.md#13.13) the form names the channel (the one of the most
 * recent project first; its style is preselected) and recent projects show their channel's dot.
 * A genre preset (PLAN.md#13.8, the channel's preselected) fills in the style and the scenes per
 * minute until the user changes them; only the touched fields are sent as explicit choices.
 */
import type { ShotsPerMinute } from '@reelforge/shared';
import { useEffect, useMemo, useState, type JSX, type SyntheticEvent } from 'react';
import type {
  ProjectOpenResult,
  ProjectSummary,
  RecentProjectEntry,
} from '../../shared/project-contract.js';
import { styleChoices } from '../../shared/style-choices.js';
import { ChannelDot } from '../channels/ChannelBadge.js';
import { ChannelField } from '../channels/ChannelField.js';
import {
  channelDefaultStyle,
  channelOf,
  initialChannelId,
  showChannels,
  type ChannelList,
} from '../channels/channel-view.js';
import { errorMessage, rendererLog } from '../log.js';
import { GenreField } from './GenreField.js';
import { chosenGenre, genreFormValues, withTouched, type TouchedFields } from './genre-view.js';
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
  /** The user's channels; undefined until loaded (projects then go to the default channel). */
  readonly channels?: ChannelList | undefined;
}

type Language = ProjectSummary['language'];

export function StartScreen({
  onOpened,
  defaultLanguage,
  defaultShotsPerMinute,
  defaultFasterChecks,
  defaultStyle,
  experimentalWorlds,
  channels,
}: StartScreenProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<Language>(defaultLanguage ?? 'en');
  const [shotsPerMinute, setShotsPerMinute] = useState<ShotsPerMinute | null>(
    defaultShotsPerMinute ?? null,
  );
  const [fasterChecks, setFasterChecks] = useState(defaultFasterChecks ?? false);
  const [pickedStyle, setPickedStyle] = useState<string | undefined>(undefined);
  const styles = useMemo(() => styleChoices(experimentalWorlds === true), [experimentalWorlds]);
  const [recent, setRecent] = useState<RecentProjectEntry[]>([]);
  const [pickedChannel, setPickedChannel] = useState<string | undefined>(undefined);
  const channel =
    channels === undefined
      ? undefined
      : channelOf(channels, pickedChannel ?? initialChannelId(channels, recent));
  const [pickedGenre, setPickedGenre] = useState<string | null | undefined>(undefined);
  const [touched, setTouched] = useState<TouchedFields>(new Set());
  const genre = chosenGenre(pickedGenre, channel?.genrePreset);
  const values = genreFormValues({
    genre,
    touched,
    experimentalWorlds: experimentalWorlds === true,
    style: chosenStyle(pickedStyle, channelDefaultStyle(channel, defaultStyle), styles),
    shotsPerMinute,
    fasterChecks,
  });
  const { style } = values;
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
        shotsPerMinute: values.shotsPerMinute,
        fasterChecks: values.fasterChecks,
        ...(style === undefined ? {} : { style }),
        ...(channel === undefined ? {} : { channelId: channel.id }),
        genrePreset: genre,
        explicitFields: [...touched],
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
        {showChannels(channels) && channel !== undefined && (
          <ChannelField
            channels={channels.channels}
            value={channel.id}
            disabled={busy}
            onChange={(id) => {
              setPickedChannel(id);
              // The new channel's style and genre apply until they are picked again.
              setPickedStyle(undefined);
              setPickedGenre(undefined);
              setTouched((previous) => new Set([...previous].filter((field) => field !== 'style')));
            }}
          />
        )}
        <GenreField
          value={genre}
          resolution={values.resolution}
          touched={touched}
          experimentalWorlds={experimentalWorlds === true}
          onChange={setPickedGenre}
          disabled={busy}
        />
        <StyleField
          choices={styles}
          value={style}
          onChange={(picked) => {
            setPickedStyle(picked);
            setTouched((previous) => withTouched(previous, 'style'));
          }}
          disabled={busy}
        />
        <fieldset className="start-scene-count">
          <legend>Scenes and checks</legend>
          <p className="muted">{SCENE_COUNT_HINT}</p>
          <SceneCountFields
            range={values.shotsPerMinute}
            fasterChecks={values.fasterChecks}
            onRange={(range) => {
              setShotsPerMinute(range);
              setTouched((previous) => withTouched(previous, 'shotsPerMinute'));
            }}
            onFasterChecks={(on) => {
              setFasterChecks(on);
              setTouched((previous) => withTouched(previous, 'fasterChecks'));
            }}
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
          {recent.map((entry) => {
            const entryChannel = showChannels(channels)
              ? channelOf(channels, entry.channelId)
              : undefined;
            return (
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
                  <span className="recent-title">
                    {entryChannel !== undefined && <ChannelDot channel={entryChannel} />}
                    {entry.title}
                  </span>
                  <span className="muted">
                    {entry.exists ? entry.dir : `missing · ${entry.dir}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
