/**
 * One project on the Home screen (PLAN.md#13.16), as a grid card or a list row: picture, title,
 * badges (style, PREVIEW, SHORT, production line, Needs you), the step strip, one status sentence,
 * length and last change, the Shorts cut from it, the "Open editor" quick action and a menu (Show
 * overview, Open editor, Rename…, Show folder). Click = overview, double-click = editor.
 */
import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import type { HomeProject } from '../../shared/home-contract.js';
import { describeStyle } from '../../shared/style-choices.js';
import { ChannelDot } from '../channels/ChannelBadge.js';
import { MenuButton } from '../layout/MenuButton.js';
import { PREVIEW_TAG } from '../project/world-settings-view.js';
import { cardSentence, cardState, formatDuration, relativeTime, styleBadge } from './card-view.js';
import { CardPicture } from './CardPicture.js';
import { ProgressStrip } from './ProgressStrip.js';
import { RenameForm } from './RenameForm.js';

export type OpenTarget = 'overview' | 'editor';

export interface CardActions {
  readonly open: (project: HomeProject, target: OpenTarget) => void;
  readonly showFolder: (project: HomeProject) => void;
  /** Resolves to a problem in plain words, or undefined when renamed. */
  readonly rename: (project: HomeProject, title: string) => Promise<string | undefined>;
}

export interface ProjectCardProps {
  readonly project: HomeProject;
  readonly shorts?: readonly HomeProject[];
  /** Shown as a chip (the Continue row, where no section names the channel). */
  readonly channel?: ChannelView | undefined;
  readonly layout: 'grid' | 'list';
  readonly now: number;
  readonly busy: boolean;
  readonly actions: CardActions;
}

/** A single click waits this long for a second one (double-click = editor). */
const DOUBLE_CLICK_MS = 220;

function Badges({ project }: { readonly project: HomeProject }): JSX.Element {
  const style = styleBadge(project.style);
  const preview = project.style !== null && describeStyle(project.style)?.preview === true;
  const state = cardState(project);
  return (
    <span className="card-badges">
      {state === 'needs-you' && <span className="card-badge badge-needs-you">Needs you</span>}
      {state === 'working' && <span className="card-badge badge-working">Working</span>}
      {project.kind === 'short' && <span className="card-badge badge-short">Short</span>}
      {style !== null && <span className="card-badge badge-style">{style}</span>}
      {preview && <span className="style-preview-tag">{PREVIEW_TAG}</span>}
      {project.fromLine && (
        <span className="card-badge" title="Made by the production line">
          Line
        </span>
      )}
    </span>
  );
}

function CardFacts({
  project,
  now,
}: {
  readonly project: HomeProject;
  readonly now: number;
}): JSX.Element {
  const length = formatDuration(project.durationS);
  const edited = relativeTime(project.updatedAt ?? project.openedAt, now);
  return (
    <span className="card-facts muted">
      {length !== null && <span className="mono">{length}</span>}
      {edited !== null && <span>Edited {edited}</span>}
    </span>
  );
}

export function ProjectCard(props: ProjectCardProps): JSX.Element {
  const { project, actions, busy } = props;
  const [renaming, setRenaming] = useState(false);
  const pending = useRef<number | undefined>(undefined);
  const sentenceId = useId();
  const usable = project.exists && !busy;
  useEffect(
    () => () => {
      window.clearTimeout(pending.current);
    },
    [],
  );
  const shorts = props.shorts ?? [];
  return (
    <article
      className={`project-card layout-${props.layout} card-${cardState(project)}`}
      aria-label={project.title}
    >
      <button
        type="button"
        className="card-main"
        disabled={!usable}
        aria-describedby={sentenceId}
        title={project.exists ? 'Click: overview · Double-click: editor' : project.dir}
        onClick={(event) => {
          if (event.detail > 1) return;
          window.clearTimeout(pending.current);
          pending.current = window.setTimeout(() => {
            actions.open(project, 'overview');
          }, DOUBLE_CLICK_MS);
        }}
        onDoubleClick={() => {
          window.clearTimeout(pending.current);
          actions.open(project, 'editor');
        }}
      >
        <CardPicture project={project} />
        <span className="card-text">
          {!renaming && <span className="card-title">{project.title}</span>}
          {props.channel !== undefined && (
            <span className="card-channel">
              <ChannelDot channel={props.channel} />
              {props.channel.name}
            </span>
          )}
          <Badges project={project} />
        </span>
      </button>
      {renaming && (
        <RenameForm
          title={project.title}
          onCancel={() => {
            setRenaming(false);
          }}
          onSave={async (title) => {
            const problem = await actions.rename(project, title);
            if (problem === undefined) setRenaming(false);
            return problem;
          }}
        />
      )}
      <div className="card-status">
        <ProgressStrip steps={project.steps} />
        <span className="card-sentence" id={sentenceId}>
          {cardSentence(project)}
        </span>
        <CardFacts project={project} now={props.now} />
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="card-open-editor"
          disabled={!usable}
          onClick={() => {
            actions.open(project, 'editor');
          }}
        >
          Open editor
        </button>
        <MenuButton
          label={
            <>
              <span aria-hidden="true">⋯</span>
              <span className="visually-hidden">More actions</span>
            </>
          }
          menuLabel={`Actions for ${project.title}`}
          className="card-menu"
          buttonClassName="card-menu-button"
          title="More actions"
          items={[
            {
              label: 'Show overview',
              run: () => {
                actions.open(project, 'overview');
              },
              ...(usable ? {} : { disabled: 'The project folder is gone' }),
            },
            {
              label: 'Rename…',
              run: () => {
                setRenaming(true);
              },
              ...(project.exists && project.problem === null
                ? {}
                : { disabled: 'The project file cannot be read' }),
            },
            {
              label: 'Show folder',
              run: () => {
                actions.showFolder(project);
              },
              ...(project.exists ? {} : { disabled: 'The project folder is gone' }),
            },
          ]}
        />
      </div>
      {shorts.length > 0 && (
        <ul className="card-shorts" aria-label={`Shorts of ${project.title}`}>
          {shorts.map((short) => (
            <li key={short.dir}>
              <button
                type="button"
                className="short-chip"
                disabled={!short.exists || busy}
                title={`${short.title}: ${cardSentence(short)}`}
                onClick={() => {
                  actions.open(short, 'overview');
                }}
              >
                <span className="card-badge badge-short">Short</span>
                <span className="short-title">{short.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
