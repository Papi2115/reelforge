/**
 * View models of the Library dialog (PLAN.md#12.19): the filter choices, a card's licence chip and
 * meta line, tag input parsing and the heading line. Pure.
 */
import type { LibraryLicenceFilter } from '@reelforge/shared';
import type {
  LibraryEntryView,
  LibraryQueryRequest,
  LibraryState,
} from '../../shared/library-contract.js';
import { licenceBadge, sizeText, sourceLabel, type LicenceBadge } from './assets-view.js';

export interface LibraryFilters {
  readonly text: string;
  readonly kind: '' | 'image' | 'video';
  readonly licence: '' | LibraryLicenceFilter;
  readonly tag: string;
  readonly favorites: boolean;
}

export const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  text: '',
  kind: '',
  licence: '',
  tag: '',
  favorites: false,
};

export const LIBRARY_LICENCE_LABELS: Readonly<Record<LibraryLicenceFilter, string>> = {
  verified: 'Open licence (verified)',
  unverified: '⚠ Unverified licence',
  own: 'Your files',
};

/** The IPC query of the filters (empty fields left out). */
export function libraryQuery(filters: LibraryFilters): LibraryQueryRequest {
  const text = filters.text.trim();
  return {
    ...(text === '' ? {} : { text }),
    ...(filters.kind === '' ? {} : { kind: filters.kind }),
    ...(filters.licence === '' ? {} : { licence: filters.licence }),
    ...(filters.tag === '' ? {} : { tag: filters.tag }),
    ...(filters.favorites ? { favorites: true } : {}),
  };
}

/** Licence chip of a library card: your files read "Your file", never ⚠. */
export function libraryBadge(entry: LibraryEntryView): LicenceBadge {
  if (entry.group === 'own') {
    return { text: 'Your file', tone: 'ok', title: 'Your own file: no credit needed' };
  }
  return licenceBadge(entry.licence);
}

/** `Wikimedia Commons · NASA · 640×480 · from "Nokia story"`. */
export function libraryMeta(entry: LibraryEntryView): string {
  const parts = [sourceLabel(entry.source)];
  if (entry.author !== '' && entry.group !== 'own') parts.push(entry.author);
  const size = sizeText(entry.width, entry.height);
  if (size !== null) parts.push(size);
  parts.push(entry.kind);
  if (entry.originProject !== '') parts.push(`from "${entry.originProject}"`);
  return parts.join(' · ');
}

/** `"space, Retro  ,space"` -> `['space', 'retro']` (main normalises again). */
export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== '');
  return [...new Set(tags)].slice(0, 20);
}

export function librarySummary(state: LibraryState | undefined): string {
  if (state === undefined) return 'Loading…';
  if (state.status === 'error') return state.message;
  const shown = state.entries.length;
  const total = state.total;
  if (total === 0) return 'Empty: approved downloads and the files you save appear here.';
  const noun = total === 1 ? 'asset' : 'assets';
  return shown === total
    ? `${String(total)} ${noun}`
    : `${String(shown)} of ${String(total)} ${noun}`;
}

/** The "Use in project" button: its label and why it is disabled (null = enabled). */
export function libraryUseButton(
  entry: LibraryEntryView,
  projectOpen: boolean,
): { readonly label: string; readonly disabled: string | null } {
  if (entry.inProject) return { label: 'In this project', disabled: 'Already in this project.' };
  if (!projectOpen) return { label: 'Use in project', disabled: 'Open a project first.' };
  return { label: 'Use in project', disabled: null };
}
