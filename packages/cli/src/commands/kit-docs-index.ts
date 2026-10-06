/**
 * `reelforge kit-docs` without a name: the kit index, kept under INDEX_BUDGETS characters. Claude
 * Code saves a Bash output above ~30,000 characters to a file outside the project and shows a
 * 2 KB preview, which scene turns cannot read (real run v2.0: 24 of 97 sessions lost the index).
 * `voxel-only` projects list no entries of other looks (the 1.x text); `mixed` projects list look
 * entries and project props one short line each. When the text is still over budget the longest
 * entries drop their param types (longest first), then their params. Details: kit-docs <name>.
 */
import { VOXEL_LOOK_ID, type KitCatalog, type KitCatalogEntry } from '@reelforge/kit';
import type { LookMode } from '@reelforge/shared';
import { CHARACTERS_INDEX_LINE } from './kit-docs-characters.js';
import { ENTRY_DETAILS, entryLine, entryLook, type EntryDetail } from './kit-docs-lines.js';

/** Most characters of any kit-docs output (a margin under the ~30,000 Bash output limit). */
export const OUTPUT_BUDGET = 27_500;

/**
 * Characters of the whole index per look mode: voxel-only stays at the 1.x size (its 25.6 K
 * index fits unchanged), mixed uses the whole output budget.
 */
export const INDEX_BUDGETS: Readonly<Record<LookMode, number>> = {
  'voxel-only': 25_900,
  mixed: OUTPUT_BUDGET,
};

/** `kit-docs <category>` names (besides the look ids). */
export const KIT_DOCS_CATEGORIES = ['props', 'env', 'fx', 'templates', 'project'] as const;

export interface IndexOptions {
  readonly lookMode: LookMode;
  /** Lines appended after the reference (unreadable project props); they count too. */
  readonly problems?: readonly string[];
  /** Character budget of the whole text (default: INDEX_BUDGETS of the look mode). */
  readonly budget?: number;
}

interface Row {
  readonly entry: KitCatalogEntry;
  detail: EntryDetail;
}

const SECTIONS: readonly (readonly [string, keyof Pick<KitCatalog, 'env' | 'props' | 'fx'>])[] = [
  ['kit.env', 'env'],
  ['kit.props', 'props'],
  ['kit.fx', 'fx'],
];

/** Whether the project's look mode lists an entry (voxel-only: voxel entries and project props). */
export function isListed(entry: KitCatalogEntry, mode: LookMode): boolean {
  return mode === 'mixed' || entry.origin === 'project' || entryLook(entry) === VOXEL_LOOK_ID;
}

function startDetail(entry: KitCatalogEntry, mode: LookMode): EntryDetail {
  const compact = entry.origin === 'project' || entryLook(entry) !== VOXEL_LOOK_ID;
  return mode === 'mixed' && compact ? 'short' : 'full';
}

/** Moves rows to `level`, longest line first, until the text fits (total is kept in sync). */
function shrink(rows: readonly Row[], level: EntryDetail, total: number, budget: number): number {
  const rank = ENTRY_DETAILS.indexOf(level);
  const candidates = rows
    .filter((row) => ENTRY_DETAILS.indexOf(row.detail) < rank)
    .map((row) => ({ row, length: entryLine(row.entry, row.detail).length }))
    .sort((first, second) => second.length - first.length);
  let current = total;
  for (const { row, length } of candidates) {
    if (current <= budget) break;
    row.detail = level;
    current += entryLine(row.entry, level).length - length;
  }
  return current;
}

function trailingLine(
  catalog: KitCatalog,
  mode: LookMode,
  budget: number,
  compacted: boolean,
): string {
  const looks = catalog.looks.map((look) => look.id);
  const slices =
    mode === 'mixed' ? [...KIT_DOCS_CATEGORIES, ...looks] : ['props', 'env', 'fx', 'project'];
  const short = [
    ...(mode === 'mixed' ? ['look entries and project props are one line'] : []),
    ...(compacted ? ['the longest entries are shortened (param names only)'] : []),
  ];
  return [
    `(kept under ${budget.toLocaleString('en-US')} characters so it is never cut off`,
    ...short.map((part) => `; ${part}`),
    `; one kind${mode === 'mixed' ? ' or look' : ''} with every param: reelforge kit-docs ${slices.join('|')} --full`,
    '; one function with params, anchors and an example: reelforge kit-docs <name>)',
  ].join('');
}

/** The kit index (see the file comment). */
export function formatCatalog(
  catalog: KitCatalog,
  options: IndexOptions = { lookMode: 'voxel-only' },
): string {
  const { lookMode } = options;
  const budget = options.budget ?? INDEX_BUDGETS[lookMode];
  // A world's catalog has no voxel API and no character pack (ADR-029): no lines for them.
  const voxel = Object.values(catalog.voxel);
  const head = [
    `kit ${catalog.version} (ctx.kit; build() only; colours are palette names)`,
    ...(voxel.length === 0 ? [] : ['kit.voxel:']),
    ...voxel.map((doc) => `  kit.voxel.${doc.signature} — ${doc.description}`),
  ];
  const sections = SECTIONS.map(([title, key]) => ({
    title,
    rows: catalog[key]
      .filter((entry) => isListed(entry, lookMode))
      .map((entry): Row => ({ entry, detail: startDetail(entry, lookMode) })),
  }));
  const tail = [
    'details + example: reelforge kit-docs <name>; a missing prop can be built: reelforge kit-docs prop-module',
    ...(catalog.cast.length === 0 ? [] : [CHARACTERS_INDEX_LINE]),
    'camera rigs, ctx.text options, ctx.annotate (arrows, callouts, pins...), anchors, sfx, rng, easings: reelforge kit-docs ctx (or camera, text, annotate, ...)',
    ...(options.problems ?? []),
  ];
  const render = (compacted: boolean): string =>
    [
      ...head,
      ...sections.flatMap(({ title, rows }) => [
        `${title}:${rows.length === 0 ? ' (none yet)' : ''}`,
        ...rows.map((row) => entryLine(row.entry, row.detail)),
      ]),
      ...tail,
      trailingLine(catalog, lookMode, budget, compacted),
    ].join('\n');
  const rows = sections.flatMap((section) => section.rows);
  const initial = render(false).length;
  if (initial <= budget) return render(false);
  // The trailing line grows by the compaction note: count it before shrinking.
  const target = budget - (render(true).length - initial);
  shrink(rows, 'short', shrink(rows, 'names', initial, target), target);
  return render(true);
}
