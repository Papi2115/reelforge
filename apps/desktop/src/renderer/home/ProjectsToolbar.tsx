/**
 * The filter bar of the Projects view (PLAN.md#13.16): search (/), channel chips (with more than
 * one channel), style, state, order and the grid / list switch.
 */
import type { JSX, RefObject } from 'react';
import { styleLabel } from '../../shared/style-choices.js';
import type { ChannelView } from '../../shared/channels-contract.js';
import { ChannelDot } from '../channels/ChannelBadge.js';
import {
  filtersActive,
  NO_FILTERS,
  SORT_ORDERS,
  STATE_FILTERS,
  type HomeFilters,
  type SortOrder,
  type StateFilter,
} from './home-view.js';

export interface ProjectsToolbarProps {
  readonly filters: HomeFilters;
  readonly onFilters: (filters: HomeFilters) => void;
  readonly order: SortOrder;
  readonly onOrder: (order: SortOrder) => void;
  readonly layout: 'grid' | 'list';
  readonly onLayout: (layout: 'grid' | 'list') => void;
  /** The channel chips (shown with more than one channel). */
  readonly channels: readonly ChannelView[];
  /** Styles the projects use. */
  readonly styles: readonly string[];
  readonly searchRef: RefObject<HTMLInputElement | null>;
}

function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function ProjectsToolbar(props: ProjectsToolbarProps): JSX.Element {
  const { filters, onFilters } = props;
  return (
    <div className="home-toolbar" role="search" aria-label="Find projects">
      <input
        ref={props.searchRef}
        type="search"
        className="home-search"
        aria-label="Search projects"
        placeholder="Search projects (/)"
        value={filters.search}
        onChange={(event) => {
          onFilters({ ...filters, search: event.target.value });
        }}
      />
      {props.channels.length > 1 && (
        <div className="home-chips" role="group" aria-label="Channels shown">
          {props.channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className="home-chip"
              aria-pressed={filters.channels.has(channel.id)}
              onClick={() => {
                onFilters({ ...filters, channels: toggled(filters.channels, channel.id) });
              }}
            >
              <ChannelDot channel={channel} />
              {channel.name}
            </button>
          ))}
        </div>
      )}
      <select
        aria-label="Filter by style"
        value={filters.style ?? ''}
        onChange={(event) => {
          onFilters({ ...filters, style: event.target.value === '' ? null : event.target.value });
        }}
      >
        <option value="">Any style</option>
        {props.styles.map((style) => (
          <option key={style} value={style}>
            {styleLabel(style)}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by state"
        value={filters.state}
        onChange={(event) => {
          const state = STATE_FILTERS.find((entry) => entry.id === event.target.value);
          onFilters({ ...filters, state: (state?.id ?? 'all') satisfies StateFilter });
        }}
      >
        {STATE_FILTERS.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
      {filtersActive(filters) && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            onFilters(NO_FILTERS);
          }}
        >
          Clear filters
        </button>
      )}
      <span className="header-spacer" />
      <select
        aria-label="Sort by"
        value={props.order}
        onChange={(event) => {
          props.onOrder(
            SORT_ORDERS.find((entry) => entry.id === event.target.value)?.id ?? 'edited',
          );
        }}
      >
        {SORT_ORDERS.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
      <div className="segmented" role="group" aria-label="View">
        {(['grid', 'list'] as const).map((layout) => (
          <button
            key={layout}
            type="button"
            aria-pressed={props.layout === layout}
            onClick={() => {
              props.onLayout(layout);
            }}
          >
            {layout === 'grid' ? 'Grid' : 'List'}
          </button>
        ))}
      </div>
    </div>
  );
}
