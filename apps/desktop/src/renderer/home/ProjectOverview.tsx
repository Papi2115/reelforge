/**
 * The project overview (PLAN.md#13.16 part B, #13.18): full screen, before the editor. A film:
 * title, channel, style, "Open editor"; the YouTube thumbnail; where the film is (steps, next
 * step, what needs you); facts; tags and timestamps (the publish kit's panel); its Shorts. A Short:
 * its film, length, end card, captions, steps. The project is already open in main, so the editor
 * opens at once ("← Projects" is in the header).
 */
import { useEffect, useState, type JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import type { HomeProject } from '../../shared/home-contract.js';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { describeStyle } from '../../shared/style-choices.js';
import { ChannelDot } from '../channels/ChannelBadge.js';
import { projectMeta } from '../layout/header-view.js';
import { PREVIEW_TAG } from '../project/world-settings-view.js';
import { PublishSeoPanel } from '../publish/PublishSeoPanel.js';
import type { OpenRequest } from '../queue/use-open-request.js';
import { cardSentence, styleBadge } from './card-view.js';
import { FactsPanel, PhasePanel, ThumbnailPanel } from './OverviewPanels.js';
import { FilmShortsPanel, ShortSettingsPanel } from './OverviewShorts.js';
import { ProgressStrip } from './ProgressStrip.js';
import { useProjectOverview } from './use-project-overview.js';

export interface ProjectOverviewProps {
  readonly project: ProjectSummary;
  /** What Home knew of it (shown until the overview is read); undefined when opened another way. */
  readonly card: HomeProject | undefined;
  readonly channel: ChannelView | undefined;
  /** The editor, optionally on a step's panel. */
  readonly onOpenEditor: (panel?: OpenRequest['panel']) => void;
  /** Another project's overview (the Short's film, a film's Short); resolves to a problem. */
  readonly onOpenProject: (dir: string) => Promise<string | undefined>;
}

function Heading(props: ProjectOverviewProps & { readonly short: boolean }): JSX.Element {
  const { project, channel } = props;
  const style = styleBadge(project.style);
  return (
    <header className="overview-header">
      <div className="overview-heading">
        <h1 className="home-title">{project.title}</h1>
        <p className="overview-meta muted">
          {channel !== undefined && (
            <span className="card-channel">
              <ChannelDot channel={channel} />
              {channel.name}
            </span>
          )}
          <span className="card-badges">
            {props.short && <span className="card-badge badge-short">Short</span>}
            {style !== null && <span className="card-badge badge-style">{style}</span>}
            {describeStyle(project.style)?.preview === true && (
              <span className="style-preview-tag">{PREVIEW_TAG}</span>
            )}
          </span>
          <span>{projectMeta(project)}</span>
        </p>
      </div>
      <span className="header-spacer" />
      <button
        type="button"
        className="primary"
        onClick={() => {
          props.onOpenEditor();
        }}
      >
        Open editor
      </button>
    </header>
  );
}

export function ProjectOverview(props: ProjectOverviewProps): JSX.Element {
  const controller = useProjectOverview(props.project.dir);
  const { overview, busy } = controller;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // A fresh overview: its "2 h ago" counts from now.
    setNow(Date.now());
  }, [overview]);
  const [openProblem, setOpenProblem] = useState<string | undefined>(undefined);
  const openProject = (dir: string): void => {
    setOpenProblem(undefined);
    void props.onOpenProject(dir).then(setOpenProblem);
  };
  const card = overview?.card ?? props.card;
  const problem = controller.error ?? openProblem;
  const short = card?.kind === 'short';
  return (
    <section className="project-overview" aria-label="Project overview">
      <Heading {...props} short={short} />
      {problem !== undefined && (
        <p className="home-error" role="alert">
          {problem}
        </p>
      )}
      {controller.note !== null && (
        <p className="overview-status" role="status">
          {controller.note}
        </p>
      )}
      {overview === undefined ? (
        <>
          {card !== undefined && (
            <>
              <ProgressStrip steps={card.steps} labels />
              <p className="card-sentence">{cardSentence(card)}</p>
            </>
          )}
          {controller.error === undefined && <p className="muted">Reading the project…</p>}
        </>
      ) : (
        <>
          <div className="overview-grid">
            <PhasePanel card={overview.card} onOpenStep={props.onOpenEditor} />
            {short ? (
              <ShortSettingsPanel
                overview={overview}
                busy={busy !== null}
                onCaptions={controller.setCaptions}
                onOpenFilm={openProject}
              />
            ) : (
              <ThumbnailPanel
                card={overview.card}
                thumbnail={overview.thumbnail}
                busy={busy !== null}
                onUpload={controller.uploadThumbnail}
                onRemove={controller.removeThumbnail}
              />
            )}
            <FactsPanel
              card={overview.card}
              facts={overview.facts}
              now={now}
              busy={busy !== null}
              onShowExport={controller.showExport}
            />
          </div>
          {!short && (
            <section className="overview-panel" aria-label="Tags and timestamps">
              <h2 className="overview-panel-title section-title">Tags and timestamps</h2>
              <PublishSeoPanel revision={props.project.dir} onChanged={() => undefined} />
            </section>
          )}
          {!short && (
            <FilmShortsPanel
              overview={overview}
              busy={busy !== null}
              making={busy === 'shorts'}
              onCreate={controller.createShorts}
              onOpen={openProject}
            />
          )}
        </>
      )}
    </section>
  );
}
