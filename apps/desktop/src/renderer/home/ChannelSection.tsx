/**
 * One channel on the Home screen (PLAN.md#13.16): a header with the channel's colour, name and
 * count that folds the section, then a big "+ New project" card for that channel and its projects
 * (grid or list).
 */
import type { JSX } from 'react';
import { plural } from '../../shared/plural.js';
import { ChannelBadge } from '../channels/ChannelBadge.js';
import { ChevronIcon } from '../layout/icons.js';
import type { ChannelSection as Section } from './home-view.js';
import { ProjectCard, type CardActions } from './ProjectCard.js';

export interface ChannelSectionProps {
  readonly section: Section;
  readonly collapsed: boolean;
  readonly onCollapse: (collapsed: boolean) => void;
  readonly layout: 'grid' | 'list';
  readonly now: number;
  readonly busy: boolean;
  readonly filtered: boolean;
  readonly actions: CardActions;
  /** "+ New project" with this section's channel (undefined = no channel). */
  readonly onNew: (channelId: string | undefined) => void;
}

function countText(section: Section, filtered: boolean): string {
  const shown = section.cards.length;
  return filtered && shown !== section.total
    ? `${String(shown)} of ${plural(section.total, 'project')}`
    : plural(section.total, 'project');
}

export function ChannelSection(props: ChannelSectionProps): JSX.Element {
  const { section, collapsed, layout } = props;
  const name = section.channel?.name ?? 'No channel';
  const bodyId = `home-section-${section.channel?.id ?? 'none'}`;
  return (
    <section className="home-section" aria-label={`Channel ${name}`}>
      <h2 className="home-section-heading">
        <button
          type="button"
          className="home-section-toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => {
            props.onCollapse(!collapsed);
          }}
        >
          <ChevronIcon direction={collapsed ? 'right' : 'down'} />
          {section.channel !== null && <ChannelBadge channel={section.channel} />}
          <span className="section-title">{name}</span>
          <span className="muted home-section-count">{countText(section, props.filtered)}</span>
        </button>
      </h2>
      {!collapsed && (
        <div id={bodyId} className={`home-cards layout-${layout}`}>
          <button
            type="button"
            className="new-project-card"
            disabled={props.busy}
            onClick={() => {
              props.onNew(section.channel?.id);
            }}
          >
            <span className="new-project-plus" aria-hidden="true">
              +
            </span>
            <span>
              New project
              <span className="visually-hidden"> in {name}</span>
            </span>
          </button>
          {section.cards.map((card) => (
            <ProjectCard
              key={card.project.dir}
              project={card.project}
              shorts={card.shorts}
              layout={layout}
              now={props.now}
              busy={props.busy}
              actions={props.actions}
            />
          ))}
          {section.cards.length === 0 && section.total > 0 && (
            <p className="muted home-section-empty">
              No project of this channel matches the filters.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
