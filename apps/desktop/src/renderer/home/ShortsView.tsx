/**
 * Home → Shorts (PLAN.md#13.18): every Short, grouped under its film (cards like the project
 * cards, with the SHORT badge and length), and "New short from a film", which opens the Short
 * wizard in place. Making Shorts lives here, not in the editor.
 */
import { useEffect, useState, type JSX } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import type { ChannelList } from '../channels/channel-view.js';
import { ProjectCard, type CardActions } from './ProjectCard.js';
import { shortCardProject, shortGroups } from './shorts-view.js';
import { ShortWizard } from './ShortWizard.js';

export interface ShortsViewProps {
  readonly projects: readonly HomeProject[] | undefined;
  readonly loadError: string | undefined;
  readonly channels: ChannelList | undefined;
  readonly busy: boolean;
  readonly actions: CardActions;
  /** Both Shorts of a film were made: open this one's overview. */
  readonly onCreated: (dir: string) => void;
}

export function ShortsView(props: ShortsViewProps): JSX.Element {
  const [wizard, setWizard] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
  }, [props.projects]);
  const all = props.projects ?? [];
  if (wizard) {
    return (
      <ShortWizard
        projects={all}
        channels={props.channels}
        onCancel={() => {
          setWizard(false);
        }}
        onCreated={props.onCreated}
      />
    );
  }
  const groups = shortGroups(all);
  return (
    <div className="home-projects">
      <header className="home-heading">
        <h1 className="home-title">Shorts</h1>
        <span className="header-spacer" />
        <button
          type="button"
          className="primary"
          disabled={props.busy || props.projects === undefined}
          onClick={() => {
            setWizard(true);
          }}
        >
          New short from a film
        </button>
      </header>
      <p className="muted home-intro">
        Vertical 9:16 teasers of your films: a 30 s and a 60 s Short per film, each its own project
        with new scenes, ending on “Full video on YT: &lt;channel&gt;”.
      </p>
      {props.loadError !== undefined && (
        <p className="home-error" role="alert">
          {props.loadError}
        </p>
      )}
      {props.projects === undefined ? (
        <p className="muted home-loading">Loading your projects…</p>
      ) : groups.length === 0 ? (
        <div className="home-empty">
          <p className="home-empty-title section-title">No Shorts yet</p>
          <p className="muted">
            Pick a film with a script and ReelForge writes two teasers from it: a hook and an open
            question that send viewers to the full video. Shorts are available for voxel and Comic
            films for now.
          </p>
          <div className="home-empty-actions">
            <button
              type="button"
              className="primary"
              disabled={props.busy}
              onClick={() => {
                setWizard(true);
              }}
            >
              New short from a film
            </button>
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <section
            key={group.filmDir}
            className="home-section"
            aria-label={`Shorts of ${group.filmTitle}`}
          >
            <h2 className="home-section-heading shorts-group-heading">
              <span className="section-title">{group.filmTitle}</span>
              {group.film !== undefined && (
                <button
                  type="button"
                  className="link-button"
                  disabled={props.busy || !group.film.exists}
                  onClick={() => {
                    if (group.film !== undefined) props.actions.open(group.film, 'overview');
                  }}
                >
                  Film overview
                </button>
              )}
            </h2>
            <div className="home-cards layout-grid">
              {group.shorts.map((short) => (
                <ProjectCard
                  key={short.dir}
                  project={shortCardProject(short)}
                  layout="grid"
                  now={now}
                  busy={props.busy}
                  actions={props.actions}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
