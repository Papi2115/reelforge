/**
 * `reelforge kit-docs <kind|look> [--full] [--page n]`: one slice of the kit — a kind (`props`,
 * `env`, `fx`), the look templates (`templates`), the project's own props (`project`) or one look
 * (`voxel`, `retro-ui`, ...) — one line per entry, or every param with `--full`. A text over
 * OUTPUT_BUDGET is split into pages, so no output is ever cut off by the Bash output limit.
 */
import { listLooks, VOXEL_LOOK_ID, type KitCatalog, type KitCatalogEntry } from '@reelforge/kit';
import type { LookMode } from '@reelforge/shared';
import { UsageError } from '../errors.js';
import { OUTPUT_BUDGET, isListed, KIT_DOCS_CATEGORIES } from './kit-docs-index.js';
import { entryLine, entryLook } from './kit-docs-lines.js';

export interface SliceOptions {
  readonly lookMode: LookMode;
  /** Every param instead of one line per entry. */
  readonly full: boolean;
  /** 1-based page of a text longer than the budget. */
  readonly page: number;
  /** Characters per page (default OUTPUT_BUDGET). */
  readonly budget?: number;
}

interface Slice {
  readonly title: string;
  /** Lines before the entries (kit.voxel tools of the voxel look). */
  readonly lead: readonly string[];
  readonly entries: readonly KitCatalogEntry[];
  readonly empty: string;
  readonly note?: string;
}

/** Names of the look templates (whole-shot definitions of the available looks). */
function templateNames(): Set<string> {
  return new Set(
    listLooks().flatMap((look) => (look.kit.templates ?? []).map((template) => template.name)),
  );
}

function allEntries(catalog: KitCatalog): KitCatalogEntry[] {
  return [...catalog.env, ...catalog.props, ...catalog.fx];
}

/** Names `kit-docs` accepts as a slice: the kinds, `templates`, `project` and the look ids. */
export function sliceNames(catalog: KitCatalog): string[] {
  return [...KIT_DOCS_CATEGORIES, ...catalog.looks.map((look) => look.id)];
}

function lookSlice(catalog: KitCatalog, id: string, mode: LookMode): Slice | undefined {
  const look = catalog.looks.find((candidate) => candidate.id === id);
  if (look === undefined) return undefined;
  const voxel = id === VOXEL_LOOK_ID;
  const voxelOnlyNote =
    mode === 'voxel-only' && !voxel
      ? 'note: this project is voxel-only (project.json lookMode): its shots are built in the voxel look'
      : undefined;
  return {
    title: `look ${look.id} (${look.label}): ${look.description}`,
    lead: voxel
      ? Object.values(catalog.voxel).map(
          (doc) => `  kit.voxel.${doc.signature} — ${doc.description}`,
        )
      : [],
    entries: allEntries(catalog).filter(
      (entry) => entry.origin !== 'project' && entryLook(entry) === id,
    ),
    empty: '  (no entries)',
    ...(voxelOnlyNote === undefined ? {} : { note: voxelOnlyNote }),
  };
}

function findSlice(catalog: KitCatalog, name: string, mode: LookMode): Slice | undefined {
  const listed = (entries: readonly KitCatalogEntry[]): KitCatalogEntry[] =>
    entries.filter((entry) => isListed(entry, mode));
  switch (name) {
    case 'props':
    case 'env':
    case 'fx':
      return {
        title: `kit.${name}`,
        lead: [],
        entries: listed(catalog[name]),
        empty: '  (none yet)',
      };
    case 'templates': {
      const names = templateNames();
      const entries = allEntries(catalog).filter(
        (entry) => entry.origin !== 'project' && names.has(entry.name),
      );
      return { title: 'look templates (whole-shot heroes)', lead: [], entries, empty: '  (none)' };
    }
    case 'project':
      return {
        title: 'project props (kit-ext/props)',
        lead: [],
        entries: catalog.props.filter((entry) => entry.origin === 'project'),
        empty: '  (none yet; writing one: reelforge kit-docs prop-module)',
      };
    default:
      return lookSlice(catalog, name, mode);
  }
}

/** Lines into pages of at most `budget` characters, leaving room for a header and a footer. */
function paginate(lines: readonly string[], budget: number): string[][] {
  const room = budget - 400;
  const pages: string[][] = [[]];
  let size = 0;
  for (const line of lines) {
    const page = pages.at(-1) ?? [];
    if (page.length > 0 && size + line.length + 1 > room) {
      pages.push([line]);
      size = line.length + 1;
    } else {
      page.push(line);
      size += line.length + 1;
    }
  }
  return pages;
}

function command(name: string, options: SliceOptions, page?: number): string {
  const flags = [
    options.full ? ' --full' : '',
    page === undefined ? '' : ` --page ${String(page)}`,
  ];
  return `reelforge kit-docs ${name}${flags.join('')}`;
}

/** The slice's text, or undefined when `name` is not a kind, `templates`, `project` or a look. */
export function describeSlice(
  catalog: KitCatalog,
  name: string,
  options: SliceOptions,
): string | undefined {
  const slice = findSlice(catalog, name, options.lookMode);
  if (slice === undefined) return undefined;
  const detail = options.full ? 'full' : 'short';
  const body = [
    ...slice.lead,
    ...(slice.entries.length === 0 ? [slice.empty] : []),
    ...slice.entries.map((entry) => entryLine(entry, detail)),
  ];
  const pages = paginate(body, options.budget ?? OUTPUT_BUDGET);
  if (options.page > pages.length) {
    throw new UsageError(
      `${command(name, options)} has ${String(pages.length)} page(s); --page ${String(options.page)} does not exist`,
    );
  }
  const count = `${String(slice.entries.length)} entr${slice.entries.length === 1 ? 'y' : 'ies'}`;
  const how = options.full
    ? 'every param'
    : `one line each; every param: ${command(name, { ...options, full: true })}`;
  const paging =
    pages.length === 1 ? '' : `, page ${String(options.page)} of ${String(pages.length)}`;
  const next =
    options.page < pages.length ? [`more: ${command(name, options, options.page + 1)}`] : [];
  return [
    slice.title,
    `${count}${paging} (${how}; params, anchors and an example of one: reelforge kit-docs <name>)`,
    ...(slice.note === undefined ? [] : [slice.note]),
    ...(pages[options.page - 1] ?? []),
    ...next,
  ].join('\n');
}
