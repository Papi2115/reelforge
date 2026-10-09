/**
 * The Projects view of the Home screen (PLAN.md#13.16): filters (search, channels, style, state),
 * the order, the "Continue" row, the Shorts under their film, and one section per channel (every
 * channel, also an empty one, so each has its "+ New project" card). Pure: no React, no IPC.
 */
import type { HomeProject } from '../../shared/home-contract.js';
import type { ChannelView } from '../../shared/channels-contract.js';
import { channelOf, type ChannelList } from '../channels/channel-view.js';
import { cardState, type CardState } from './card-view.js';

export type StateFilter = 'all' | 'needs-you' | 'working' | 'in-progress' | 'done';

export const STATE_FILTERS: readonly { readonly id: StateFilter; readonly label: string }[] = [
  { id: 'all', label: 'Any state' },
  { id: 'needs-you', label: 'Needs you' },
  { id: 'working', label: 'Working' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Exported' },
];

export type SortOrder = 'edited' | 'opened' | 'title';

export const SORT_ORDERS: readonly { readonly id: SortOrder; readonly label: string }[] = [
  { id: 'edited', label: 'Last edited' },
  { id: 'opened', label: 'Last opened' },
  { id: 'title', label: 'Title (A–Z)' },
];

export interface HomeFilters {
  readonly search: string;
  /** Channel ids shown; empty = every channel. */
  readonly channels: ReadonlySet<string>;
  /** Style id; null = every style. */
  readonly style: string | null;
  readonly state: StateFilter;
}

export const NO_FILTERS: HomeFilters = {
  search: '',
  channels: new Set(),
  style: null,
  state: 'all',
};

export function filtersActive(filters: HomeFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.channels.size > 0 ||
    filters.style !== null ||
    filters.state !== 'all'
  );
}

/** Comparable folder key (separators and case do not matter on Windows). */
export function dirKey(dir: string): string {
  return dir
    .replace(/[\\/]+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
}

/** The channel the card is shown under (absent or unknown id = the default channel). */
export function projectChannelId(
  project: HomeProject,
  list: ChannelList | undefined,
): string | null {
  return channelOf(list, project.channelId ?? undefined)?.id ?? null;
}

const STATE_MATCH: Readonly<Record<StateFilter, (state: CardState) => boolean>> = {
  all: () => true,
  'needs-you': (state) => state === 'needs-you',
  working: (state) => state === 'working',
  'in-progress': (state) => state === 'in-progress' || state === 'new',
  done: (state) => state === 'done',
};

export function matchesFilters(
  project: HomeProject,
  filters: HomeFilters,
  list: ChannelList | undefined,
): boolean {
  const words = filters.search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
  const title = project.title.toLowerCase();
  if (!words.every((word) => title.includes(word))) return false;
  const channel = projectChannelId(project, list);
  if (filters.channels.size > 0 && (channel === null || !filters.channels.has(channel))) {
    return false;
  }
  if (filters.style !== null && project.style !== filters.style) return false;
  return STATE_MATCH[filters.state](cardState(project));
}

function time(iso: string | null): number {
  const value = iso === null ? Number.NaN : Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

export function sortProjects(projects: readonly HomeProject[], order: SortOrder): HomeProject[] {
  const sorted = [...projects];
  if (order === 'title') {
    return sorted.sort((first, second) =>
      first.title.localeCompare(second.title, undefined, { sensitivity: 'base' }),
    );
  }
  const key = (project: HomeProject): number =>
    order === 'opened'
      ? time(project.openedAt)
      : Math.max(time(project.updatedAt), time(project.openedAt));
  return sorted.sort((first, second) => key(second) - key(first));
}

/** A film card with the Shorts cut from it. */
export interface FilmCard {
  readonly project: HomeProject;
  readonly shorts: readonly HomeProject[];
}

/** Shorts go under their film when it is listed; a Short whose film is not listed stays a card. */
export function attachShorts(projects: readonly HomeProject[]): FilmCard[] {
  const films = new Map<string, HomeProject[]>();
  for (const project of projects) {
    if (project.kind === 'film') films.set(dirKey(project.dir), []);
  }
  const cards: HomeProject[] = [];
  for (const project of projects) {
    const parent = project.parentDir === null ? undefined : films.get(dirKey(project.parentDir));
    if (project.kind === 'short' && parent !== undefined) parent.push(project);
    else cards.push(project);
  }
  return cards.map((project) => ({ project, shorts: films.get(dirKey(project.dir)) ?? [] }));
}

export interface ChannelSection {
  /** null = projects of no known channel (only when the channel list cannot be read). */
  readonly channel: ChannelView | null;
  readonly cards: readonly FilmCard[];
  /** Projects of the channel before the filters. */
  readonly total: number;
}

/** One section per channel in the user's order, then "No channel" when needed. */
export function channelSections(
  all: readonly HomeProject[],
  filters: HomeFilters,
  order: SortOrder,
  list: ChannelList | undefined,
): ChannelSection[] {
  const cards = attachShorts(sortProjects(all, order));
  const visible = (card: FilmCard): boolean =>
    matchesFilters(card.project, filters, list) ||
    card.shorts.some((short) => matchesFilters(short, filters, list));
  const sectionOf = (channelId: string | null): ChannelSection => {
    const mine = cards.filter((card) => projectChannelId(card.project, list) === channelId);
    const channel = channelId === null ? null : (channelOf(list, channelId) ?? null);
    return { channel, cards: mine.filter(visible), total: mine.length };
  };
  const shown = (list?.channels ?? []).filter(
    (channel) => filters.channels.size === 0 || filters.channels.has(channel.id),
  );
  const sections = shown.map((channel) => sectionOf(channel.id));
  const orphans = sectionOf(null);
  return orphans.total > 0 && filters.channels.size === 0 ? [...sections, orphans] : sections;
}

/** "Continue": the projects opened last (that still exist). */
export function continueRow(projects: readonly HomeProject[], max = 4): HomeProject[] {
  return sortProjects(
    projects.filter((project) => project.exists && project.openedAt !== null),
    'opened',
  ).slice(0, max);
}

/** The styles the projects use (for the style filter), in first-seen order. */
export function usedStyles(projects: readonly HomeProject[]): string[] {
  return [
    ...new Set(projects.flatMap((project) => (project.style === null ? [] : [project.style]))),
  ];
}

/** The channel of the last opened project (the wizard's first choice), else the default one. */
export function lastChannelId(
  projects: readonly HomeProject[],
  list: ChannelList | undefined,
): string | undefined {
  const [last] = continueRow(projects, 1);
  if (list === undefined) return undefined;
  return last === undefined ? list.defaultChannelId : (projectChannelId(last, list) ?? undefined);
}

/** How many projects wait for the user (the nav's count). */
export function needsYouCount(projects: readonly HomeProject[]): number {
  return projects.filter((project) => cardState(project) === 'needs-you').length;
}
