/**
 * Home → Projects (PLAN.md#13.16): the heading with New project / Open project…, the filter bar,
 * the "Continue" row (the projects opened last) and one section per channel. First run (no
 * project yet) shows a friendly start instead. Grid / list, order and folded sections are
 * remembered on this computer (localStorage).
 */
import { useEffect, useMemo, useState, type JSX, type RefObject } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import { channelOf, type ChannelList } from '../channels/channel-view.js';
import { ChannelSection } from './ChannelSection.js';
import {
  channelSections,
  continueRow,
  filtersActive,
  NO_FILTERS,
  projectChannelId,
  usedStyles,
  type HomeFilters,
  type SortOrder,
} from './home-view.js';
import { loadHomePrefs, saveHomePrefs, type HomePrefs } from './home-prefs.js';
import { ProjectCard, type CardActions } from './ProjectCard.js';
import { ProjectsToolbar } from './ProjectsToolbar.js';

export interface ProjectsViewProps {
  readonly projects: readonly HomeProject[] | undefined;
  readonly loadError: string | undefined;
  readonly channels: ChannelList | undefined;
  readonly busy: boolean;
  readonly actions: CardActions;
  readonly onNew: (channelId: string | undefined) => void;
  readonly onOpenFolder: () => void;
  readonly onOpenExample: () => void;
  readonly searchRef: RefObject<HTMLInputElement | null>;
}

function FirstRun(props: Pick<ProjectsViewProps, 'onNew' | 'onOpenExample' | 'busy'>): JSX.Element {
  return (
    <div className="home-empty">
      <p className="home-empty-title section-title">Your films live here</p>
      <p className="muted">
        Each project is one video: script, voice, scenes and sound, saved in its own folder with its
        history. Start a new one, open a folder you already have, or play with the example.
      </p>
      <div className="home-empty-actions">
        <button
          type="button"
          className="primary"
          disabled={props.busy}
          onClick={() => {
            props.onNew(undefined);
          }}
        >
          Create your first film
        </button>
        <button type="button" disabled={props.busy} onClick={props.onOpenExample}>
          Try the example film
        </button>
      </div>
      <p className="muted">
        Several YouTube channels? Type a new channel name in the second step of New project, or add
        them under Channels on the left.
      </p>
    </div>
  );
}

export function ProjectsView(props: ProjectsViewProps): JSX.Element {
  const { projects, channels } = props;
  const [prefs, setPrefs] = useState<HomePrefs>(loadHomePrefs);
  const [filters, setFilters] = useState<HomeFilters>(NO_FILTERS);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    saveHomePrefs(prefs);
  }, [prefs]);
  useEffect(() => {
    // New cards arrived: their "Edited 5 min ago" counts from now.
    setNow(Date.now());
  }, [projects]);
  const all = useMemo(() => projects ?? [], [projects]);
  const sections = useMemo(
    () => channelSections(all, filters, prefs.order, channels),
    [all, filters, prefs.order, channels],
  );
  const recent = useMemo(() => continueRow(all), [all]);
  const filtered = filtersActive(filters);
  const setOrder = (order: SortOrder): void => {
    setPrefs((current) => ({ ...current, order }));
  };
  return (
    <div className="home-projects">
      <header className="home-heading">
        <h1 className="home-title">Projects</h1>
        <span className="header-spacer" />
        <button
          type="button"
          className="primary"
          disabled={props.busy}
          onClick={() => {
            props.onNew(undefined);
          }}
          title="New project (Ctrl+N)"
        >
          New project
        </button>
        <button type="button" disabled={props.busy} onClick={props.onOpenFolder}>
          Open project…
        </button>
        <button
          type="button"
          className="link-button"
          disabled={props.busy}
          title="A fresh copy of “Doom on a calculator”, ready to play, edit and export"
          onClick={props.onOpenExample}
        >
          Open the example project
        </button>
      </header>
      {props.loadError !== undefined && (
        <p className="home-error" role="alert">
          {props.loadError}
        </p>
      )}
      {projects === undefined ? (
        <p className="muted home-loading">Loading your projects…</p>
      ) : all.length === 0 ? (
        <FirstRun {...props} />
      ) : (
        <>
          <ProjectsToolbar
            filters={filters}
            onFilters={setFilters}
            order={prefs.order}
            onOrder={setOrder}
            layout={prefs.layout}
            onLayout={(layout) => {
              setPrefs((current) => ({ ...current, layout }));
            }}
            channels={channels?.channels ?? []}
            styles={usedStyles(all)}
            searchRef={props.searchRef}
          />
          {!filtered && recent.length > 0 && (
            <section className="home-continue" aria-label="Continue">
              <h2 className="home-section-heading">
                <span className="section-title">Continue</span>
              </h2>
              <div className="home-cards layout-grid continue-cards">
                {recent.map((project) => (
                  <ProjectCard
                    key={project.dir}
                    project={project}
                    channel={
                      (channels?.channels.length ?? 0) > 1
                        ? channelOf(channels, projectChannelId(project, channels) ?? undefined)
                        : undefined
                    }
                    layout="grid"
                    now={now}
                    busy={props.busy}
                    actions={props.actions}
                  />
                ))}
              </div>
            </section>
          )}
          {sections.map((section) => {
            const id = section.channel?.id ?? '';
            return (
              <ChannelSection
                key={id}
                section={section}
                collapsed={prefs.collapsed.includes(id)}
                onCollapse={(collapsed) => {
                  setPrefs((current) => ({
                    ...current,
                    collapsed: collapsed
                      ? [...current.collapsed, id]
                      : current.collapsed.filter((entry) => entry !== id),
                  }));
                }}
                layout={prefs.layout}
                now={now}
                busy={props.busy}
                filtered={filtered}
                actions={props.actions}
                onNew={props.onNew}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
